"""Phase 11 — Governance + Cross-tenant super_admin notifications + role gating."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ISB = "11111111-1111-1111-1111-111111111111"
EAIC = "22222222-2222-2222-2222-222222222222"
DEMO = "Demo@2026"


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- AI Governance use-cases ----------
def test_ai_usecases_isb_has_4_active_4_pending():
    """AIGovernance dashboard needs 4 active + 4 pending for KPIs."""
    tok, _ = _login("kavya.aigov@isb.edu", DEMO)
    r = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=_h(tok), timeout=15)
    assert r.status_code == 200, r.text
    cases = r.json()
    assert isinstance(cases, list)
    assert len(cases) == 8, f"expected 8 use-cases for ISB, got {len(cases)}"
    active = [c for c in cases if c.get("status") == "active"]
    pending = [c for c in cases if c.get("status") != "active"]
    assert len(active) == 4, f"expected 4 active, got {len(active)}: {[c['key'] for c in active]}"
    assert len(pending) == 4, f"expected 4 pending, got {len(pending)}: {[c['key'] for c in pending]}"


def test_ai_usecase_patch_status_flip_persists_and_audits():
    tok, _ = _login("kavya.aigov@isb.edu", DEMO)
    # find a non-active to flip
    cases = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=_h(tok), timeout=15).json()
    target = next((c for c in cases if c.get("status") != "active"), None)
    assert target, "expected at least one non-active use-case"
    key = target["key"]
    orig_status = target["status"]
    # flip to active
    r = requests.patch(
        f"{BASE}/api/ai/use-cases/{ISB}/{key}",
        headers=_h(tok),
        json={"status": "active"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    # verify persistence via GET
    cases2 = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=_h(tok), timeout=15).json()
    flipped = next(c for c in cases2 if c["key"] == key)
    assert flipped["status"] == "active"
    # audit captures ai.use_case.update
    sa_tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    a = requests.get(f"{BASE}/api/audit/{ISB}", headers=_h(sa_tok), timeout=15).json()
    items = a.get("items", a if isinstance(a, list) else [])
    actions = [x.get("action") for x in items]
    assert "ai.use_case.update" in actions, f"expected ai.use_case.update in {set(actions)}"
    # restore
    requests.patch(f"{BASE}/api/ai/use-cases/{ISB}/{key}", headers=_h(tok),
                   json={"status": orig_status}, timeout=15)


def test_ai_usecase_patch_hitl_toggle():
    tok, _ = _login("kavya.aigov@isb.edu", DEMO)
    cases = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=_h(tok), timeout=15).json()
    target = cases[0]
    key = target["key"]
    orig = target.get("human_in_the_loop", False)
    r = requests.patch(f"{BASE}/api/ai/use-cases/{ISB}/{key}", headers=_h(tok),
                       json={"human_in_the_loop": not orig}, timeout=15)
    assert r.status_code == 200, r.text
    cases2 = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=_h(tok), timeout=15).json()
    after = next(c for c in cases2 if c["key"] == key)
    assert after.get("human_in_the_loop") == (not orig)
    # restore
    requests.patch(f"{BASE}/api/ai/use-cases/{ISB}/{key}", headers=_h(tok),
                   json={"human_in_the_loop": orig}, timeout=15)


# ---------- Tickets count for student/registrar dashboards ----------
def test_student_tickets_count_endpoint():
    tok, user = _login("vikram.pgp@isb.edu", DEMO)
    r = requests.get(f"{BASE}/api/tickets/{ISB}", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_registrar_open_tickets_filter():
    tok, _ = _login("raghav.registrar@isb.edu", DEMO)
    r = requests.get(f"{BASE}/api/tickets/{ISB}?status=open", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    tickets = r.json()
    assert all(t.get("status") == "open" for t in tickets)


# ---------- Cross-tenant super_admin notifications ----------
def test_super_admin_cross_tenant_inbox():
    sa_tok, sa_user = _login("admin@academiaos.ai", "Admin@2026")
    # Create a notification scoped to EAIC tenant
    unique = f"TEST_phase11_xtenant_{uuid.uuid4().hex[:8]}"
    payload = {
        "institution_id": EAIC,
        "user_id": None,
        "role": "super_admin",
        "kind": "system.test",
        "title": unique,
        "body": "cross tenant inbox check",
    }
    r = requests.post(f"{BASE}/api/notifications", headers=_h(sa_tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text

    # super_admin GET /api/notifications must include this EAIC notification
    r = requests.get(f"{BASE}/api/notifications", headers=_h(sa_tok), timeout=15)
    assert r.status_code == 200
    titles = [it["title"] for it in r.json()["items"]]
    assert unique in titles, f"super_admin did not see EAIC notification; got titles {titles[:5]}"

    # ISB registrar must NOT see EAIC-scoped notification
    reg_tok, _ = _login("raghav.registrar@isb.edu", DEMO)
    r = requests.get(f"{BASE}/api/notifications", headers=_h(reg_tok), timeout=15)
    assert r.status_code == 200
    titles = [it["title"] for it in r.json()["items"]]
    assert unique not in titles, "registrar leaked EAIC notification"


def test_non_super_admin_cannot_mark_read_cross_tenant():
    """Defense-in-depth: registrar in ISB cannot mark-read an EAIC role-broadcast notif."""
    sa_tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    # create EAIC notification broadcast to registrar role
    unique = f"TEST_phase11_xtenant_reg_{uuid.uuid4().hex[:8]}"
    payload = {
        "institution_id": EAIC,
        "user_id": None,
        # use '*' broadcast so it appears in both registrar's and super_admin's $or filter;
        # but institution_id scope still applies to non-super-admin → registrar should NOT
        # be able to mutate the EAIC-scoped notification.
        "role": "*",
        "kind": "system.test",
        "title": unique,
        "body": "should not be markable read by ISB registrar",
    }
    r = requests.post(f"{BASE}/api/notifications", headers=_h(sa_tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    notif_id = r.json()["id"]

    # ISB registrar tries to mark as read
    reg_tok, _ = _login("raghav.registrar@isb.edu", DEMO)
    r = requests.post(f"{BASE}/api/notifications/{notif_id}/read", headers=_h(reg_tok), timeout=15)
    # Endpoint returns {"ok": True} regardless, but DB must not have been updated
    # Verify via super_admin GET — find the EAIC notif and ensure read==False
    r = requests.get(f"{BASE}/api/notifications?limit=100", headers=_h(sa_tok), timeout=15)
    items = r.json()["items"]
    me = next((it for it in items if it["id"] == notif_id), None)
    assert me is not None, "super_admin should see the EAIC notification"
    assert me.get("read") is False, "EAIC notification was incorrectly marked read by ISB registrar"


# ---------- Regression: all 20 demo accounts log in ----------
ALL_DEMO = [
    ("rajiv.admin@isb.edu", DEMO),
    ("shankar.dean@isb.edu", DEMO),
    ("ananya.faculty@isb.edu", DEMO),
    ("vikram.pgp@isb.edu", DEMO),
    ("meera.pgp@isb.edu", DEMO),
    ("raghav.registrar@isb.edu", DEMO),
    ("priya.careers@isb.edu", DEMO),
    ("arjun.compliance@isb.edu", DEMO),
    ("kavya.aigov@isb.edu", DEMO),
    ("fatima.admin@eaic.gov.ae", DEMO),
    ("khalid.exec@eaic.gov.ae", DEMO),
    ("noura.instructor@eaic.gov.ae", DEMO),
    ("saif.cadet@eaic.gov.ae", DEMO),
    ("hessa.training@eaic.gov.ae", DEMO),
    ("ahmed.workforce@eaic.gov.ae", DEMO),
    ("majid.linemgr@eaic.gov.ae", DEMO),
    ("mariam.compliance@eaic.gov.ae", DEMO),
    ("saeed.officer@eaic.gov.ae", DEMO),
    ("emma.admin@bradford.ac.uk", DEMO),
    ("james.faculty@bradford.ac.uk", DEMO),
]


@pytest.mark.parametrize("email,pw", ALL_DEMO)
def test_all_demo_logins(email, pw):
    tok, user = _login(email, pw)
    assert user["email"] == email


def test_super_admin_login():
    tok, user = _login("admin@academiaos.ai", "Admin@2026")
    assert user["role"] == "super_admin"
