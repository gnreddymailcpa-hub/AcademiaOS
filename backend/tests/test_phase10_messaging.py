"""Phase 10 — Notifications + Support Tickets + 20-user seed + dashboard metrics."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"

DEMO_PW = "Demo@2026"

ISB_ACCOUNTS = [
    "rajiv.admin@isb.edu", "shankar.dean@isb.edu", "ananya.faculty@isb.edu",
    "vikram.pgp@isb.edu", "meera.pgp@isb.edu", "raghav.registrar@isb.edu",
    "priya.careers@isb.edu", "arjun.compliance@isb.edu", "kavya.aigov@isb.edu",
]
EAIC_ACCOUNTS = [
    "fatima.admin@eaic.gov.ae", "khalid.exec@eaic.gov.ae",
    "noura.instructor@eaic.gov.ae", "saif.cadet@eaic.gov.ae",
    "hessa.training@eaic.gov.ae", "ahmed.workforce@eaic.gov.ae",
    "majid.linemgr@eaic.gov.ae", "mariam.compliance@eaic.gov.ae",
    "saeed.officer@eaic.gov.ae",
]
UOB_ACCOUNTS = ["emma.admin@bradford.ac.uk", "james.faculty@bradford.ac.uk"]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data["access_token"], data["user"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------- Auth -------------
def test_super_admin_login():
    tok, user = _login("admin@academiaos.ai", "Admin@2026")
    assert user["role"] == "super_admin"


@pytest.mark.parametrize("email", ISB_ACCOUNTS)
def test_isb_logins(email):
    tok, user = _login(email, DEMO_PW)
    assert user["institution_id"] == ISB_ID


@pytest.mark.parametrize("email", EAIC_ACCOUNTS)
def test_eaic_logins(email):
    tok, user = _login(email, DEMO_PW)
    assert user["institution_id"] == EAIC_ID


@pytest.mark.parametrize("email", UOB_ACCOUNTS)
def test_uob_logins(email):
    tok, user = _login(email, DEMO_PW)
    assert user["institution_id"] == UOB_ID


# ------------- Dashboard metrics -------------
def test_dashboard_isb_metrics():
    tok, _ = _login("rajiv.admin@isb.edu", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/dashboard/{ISB_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    m = r.json().get("metrics") or {}
    assert m.get("students") == 920
    assert m.get("programmes") == 6
    assert m.get("courses") == 42
    assert m.get("faculty") == 85
    assert m.get("completion_rate") == 87
    assert m.get("at_risk") == 34
    assert m.get("ai_sessions") == 2480
    assert m.get("workforce_readiness") == 89


def test_dashboard_eaic_metrics():
    tok, _ = _login("fatima.admin@eaic.gov.ae", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/dashboard/{EAIC_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    m = r.json().get("metrics") or {}
    assert m.get("learners") == 1450
    assert m.get("ai_sessions") == 4800


def test_dashboard_uob_metrics():
    tok, _ = _login("emma.admin@bradford.ac.uk", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/dashboard/{UOB_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    m = r.json().get("metrics") or {}
    assert m.get("students") == 12400
    assert m.get("ai_sessions") == 9420


# ------------- Institutions regression -------------
def test_institutions_three_tenants():
    tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/institutions", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 3
    shorts = sorted([i["short_name"] for i in items])
    assert shorts == ["EAIC", "ISB", "UoB"]


def test_roles_endpoint_15():
    tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/roles", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 15


# ------------- Users seed coverage -------------
def test_isb_users_role_coverage():
    tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/users/{ISB_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    users = r.json()
    roles = {u["role"] for u in users}
    expected = {"institution_admin", "dean", "faculty", "student",
                "programme_manager", "registrar", "career_services",
                "compliance_officer", "ai_governance_admin"}
    assert expected.issubset(roles), f"missing: {expected - roles}"


def test_eaic_users_role_coverage():
    tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/users/{EAIC_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    roles = {u["role"] for u in r.json()}
    expected = {"institution_admin", "executive_leadership", "instructor",
                "student", "training_manager", "hr_workforce_planner",
                "line_manager", "compliance_officer"}
    assert expected.issubset(roles), f"missing: {expected - roles}"


def test_uob_users_role_coverage():
    tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/users/{UOB_ID}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    roles = {u["role"] for u in r.json()}
    assert {"institution_admin", "faculty"}.issubset(roles)


# ------------- Tickets + Notifications -------------
def test_ticket_creation_and_notifications_flow():
    # Student creates ticket
    stu_tok, stu_user = _login("vikram.pgp@isb.edu", DEMO_PW)
    payload = {
        "institution_id": ISB_ID,
        "subject": "TEST_phase10 enrolment query",
        "body": "I cannot see Module 3 in my dashboard.",
        "category": "enrolment",
        "severity": "normal",
    }
    r = requests.post(f"{BASE_URL}/api/tickets", headers=_hdr(stu_tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    ticket = r.json()
    assert ticket["status"] == "open"
    assert ticket["learner_id"] == stu_user["id"]
    assert ticket["thread"] == []
    tid = ticket["id"]

    # Student GET should only see their own tickets
    r = requests.get(f"{BASE_URL}/api/tickets/{ISB_ID}", headers=_hdr(stu_tok), timeout=15)
    assert r.status_code == 200
    tlist = r.json()
    assert any(t["id"] == tid for t in tlist)
    assert all(t["learner_id"] == stu_user["id"] for t in tlist)

    # Admin sees all
    adm_tok, _ = _login("rajiv.admin@isb.edu", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/tickets/{ISB_ID}", headers=_hdr(adm_tok), timeout=15)
    assert r.status_code == 200
    assert any(t["id"] == tid for t in r.json())

    # Registrar receives notification (role broadcast)
    reg_tok, _ = _login("raghav.registrar@isb.edu", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(reg_tok), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "unread" in body
    kinds = [it["kind"] for it in body["items"]]
    assert "ticket.new" in kinds, f"ticket.new missing in {kinds[:5]}"
    assert body["unread"] >= 1

    # Institution admin also gets the notification
    r = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(adm_tok), timeout=15)
    assert r.status_code == 200
    kinds = [it["kind"] for it in r.json()["items"]]
    assert "ticket.new" in kinds

    # Registrar replies to ticket
    r = requests.patch(
        f"{BASE_URL}/api/tickets/{tid}",
        headers=_hdr(reg_tok),
        json={"status": "resolved", "reply": "Handled — please refresh."},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["status"] == "resolved"
    assert len(updated["thread"]) == 1
    assert updated["thread"][0]["actor_role"] == "registrar"

    # Cross-tenant: EAIC user MUST not see ISB tickets
    eaic_tok, _ = _login("fatima.admin@eaic.gov.ae", DEMO_PW)
    r = requests.get(f"{BASE_URL}/api/tickets/{ISB_ID}", headers=_hdr(eaic_tok), timeout=15)
    assert r.status_code == 403

    # Audit log captures ticket.create
    sa_tok, _ = _login("admin@academiaos.ai", "Admin@2026")
    r = requests.get(f"{BASE_URL}/api/audit/{ISB_ID}", headers=_hdr(sa_tok), timeout=15)
    assert r.status_code == 200
    actions = [a.get("action") for a in r.json().get("items", r.json() if isinstance(r.json(), list) else [])]
    assert "ticket.create" in actions


def test_notifications_mark_all_read():
    reg_tok, _ = _login("raghav.registrar@isb.edu", DEMO_PW)
    r = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=_hdr(reg_tok), timeout=15)
    assert r.status_code == 200
    # Verify unread is now 0
    r = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(reg_tok), timeout=15)
    assert r.status_code == 200
    assert r.json()["unread"] == 0
