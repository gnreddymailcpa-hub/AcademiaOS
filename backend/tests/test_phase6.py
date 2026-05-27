"""Phase 6 — Agentic Workflows + Audit explorer tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
PASSWORD = "Demo@2026"

CREDS = {
    "isb": ("rajiv.admin@isb.edu", PASSWORD),
    "eaic": ("fatima.admin@eaic.gov.ae", PASSWORD),
    "uob": ("emma.admin@bradford.ac.uk", PASSWORD),
}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def sessions():
    out = {}
    for tag, (email, pw) in CREDS.items():
        token, user = _login(email, pw)
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}"})
        out[tag] = {"session": s, "user": user, "institution_id": user["institution_id"]}
    return out


# --------- Templates ----------
@pytest.mark.parametrize("tag", ["isb", "eaic", "uob"])
def test_templates_per_tenant(sessions, tag):
    ctx = sessions[tag]
    r = ctx["session"].get(f"{BASE_URL}/api/workflows/{ctx['institution_id']}/templates", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 4, f"expected 4 templates, got {len(items)}"
    kinds = {s["kind"] for t in items for s in t["steps"]}
    assert {"auto", "llm", "hitl"}.issubset(kinds)


# --------- Runs ----------
@pytest.mark.parametrize("tag", ["isb", "eaic", "uob"])
def test_runs_seeded(sessions, tag):
    ctx = sessions[tag]
    r = ctx["session"].get(f"{BASE_URL}/api/workflows/{ctx['institution_id']}/runs", timeout=20)
    assert r.status_code == 200
    runs = r.json()
    assert len(runs) >= 5
    statuses = {x["status"] for x in runs}
    assert "awaiting_approval" in statuses
    assert "completed" in statuses
    assert "rejected" in statuses
    assert "rolled_back" in statuses


# --------- Summary ----------
@pytest.mark.parametrize("tag", ["isb", "eaic", "uob"])
def test_summary(sessions, tag):
    ctx = sessions[tag]
    r = ctx["session"].get(f"{BASE_URL}/api/workflows/{ctx['institution_id']}/summary", timeout=20)
    assert r.status_code == 200
    s = r.json()
    for k in ["templates", "running", "awaiting_approval", "completed", "rolled_back", "rejected"]:
        assert k in s
    assert s["templates"] == 4
    assert s["awaiting_approval"] >= 1


# --------- Approvals queue ----------
@pytest.mark.parametrize("tag", ["isb", "eaic", "uob"])
def test_approvals_queue(sessions, tag):
    ctx = sessions[tag]
    r = ctx["session"].get(f"{BASE_URL}/api/workflows/{ctx['institution_id']}/approvals", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert all(x["status"] == "awaiting_approval" for x in items)


# --------- Tenant scope ----------
def test_tenant_scope_forbidden(sessions):
    isb = sessions["isb"]
    eaic_id = sessions["eaic"]["institution_id"]
    r = isb["session"].get(f"{BASE_URL}/api/workflows/{eaic_id}/templates", timeout=20)
    assert r.status_code == 403


# --------- Start run (template without HITL first step auto-advances) ----------
def test_start_run_auto_advance(sessions):
    ctx = sessions["isb"]
    inst = ctx["institution_id"]
    tpls = ctx["session"].get(f"{BASE_URL}/api/workflows/{inst}/templates", timeout=20).json()
    # Pick one that does not start with HITL — learner_enrolment starts with auto
    tpl = next(t for t in tpls if t["steps"][0]["kind"] != "hitl")
    r = ctx["session"].post(
        f"{BASE_URL}/api/workflows/{inst}/runs",
        json={"institution_id": inst, "workflow_id": tpl["id"],
              "context": {"entity_name": "TEST_Vikram", "programme": "PGP"}},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    run = r.json()
    assert run["steps"], "steps[] missing"
    assert run["audit"], "audit[] missing"
    # Either it advanced past idx 0 or paused at hitl
    assert run["status"] in ("running", "awaiting_approval", "completed")
    assert run["steps"][0]["status"] in ("completed", "running")


# --------- Approve / Reject / Rollback flow ----------
def test_approve_advances_run(sessions):
    ctx = sessions["uob"]
    inst = ctx["institution_id"]
    runs = ctx["session"].get(f"{BASE_URL}/api/workflows/{inst}/approvals", timeout=20).json()
    assert runs, "need an awaiting_approval run"
    run = runs[0]
    prev_idx = run["current_step_index"]
    r = ctx["session"].post(f"{BASE_URL}/api/workflows/runs/{run['id']}/approve", timeout=30)
    assert r.status_code == 200, r.text
    nr = r.json()
    assert nr["current_step_index"] > prev_idx or nr["status"] in ("completed", "awaiting_approval")
    # audit log entry written
    al = ctx["session"].get(f"{BASE_URL}/api/audit/{inst}", params={"action": "workflow.approve", "limit": 50}, timeout=20).json()
    assert any(e["target"] == run["id"] for e in al["items"])


def test_reject_sets_status(sessions):
    ctx = sessions["eaic"]
    inst = ctx["institution_id"]
    runs = ctx["session"].get(f"{BASE_URL}/api/workflows/{inst}/approvals", timeout=20).json()
    assert runs
    run = runs[0]
    r = ctx["session"].post(f"{BASE_URL}/api/workflows/runs/{run['id']}/reject", json={"reason": "test"}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected"
    al = ctx["session"].get(f"{BASE_URL}/api/audit/{inst}", params={"action": "workflow.reject"}, timeout=20).json()
    assert any(e["target"] == run["id"] for e in al["items"])


def test_rollback_finished_run(sessions):
    ctx = sessions["isb"]
    inst = ctx["institution_id"]
    runs = ctx["session"].get(f"{BASE_URL}/api/workflows/{inst}/runs", timeout=20).json()
    finished = next((r for r in runs if r["status"] == "completed"), None)
    assert finished is not None
    r = ctx["session"].post(f"{BASE_URL}/api/workflows/runs/{finished['id']}/rollback", timeout=20)
    assert r.status_code == 200, r.text
    rb = r.json()
    assert rb["status"] == "rolled_back"
    statuses = {s["status"] for s in rb["steps"]}
    assert "rolled_back" in statuses or "completed_irreversible" in statuses


# --------- Audit explorer ----------
def test_audit_list_with_facets(sessions):
    ctx = sessions["isb"]
    inst = ctx["institution_id"]
    r = ctx["session"].get(f"{BASE_URL}/api/audit/{inst}", params={"limit": 100}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["items", "actions", "actors", "count"]:
        assert k in d
    assert isinstance(d["actions"], list)
    assert isinstance(d["actors"], list)


def test_audit_query_filters(sessions):
    ctx = sessions["isb"]
    inst = ctx["institution_id"]
    r = ctx["session"].get(f"{BASE_URL}/api/audit/{inst}", params={"q": "workflow", "limit": 50}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert all("workflow" in (e["action"] + e["actor"] + e["target"]).lower() for e in d["items"])


def test_audit_event_fetch_and_tenant_404(sessions):
    isb = sessions["isb"]
    eaic = sessions["eaic"]
    inst = isb["institution_id"]
    items = isb["session"].get(f"{BASE_URL}/api/audit/{inst}", timeout=20).json()["items"]
    assert items
    eid = items[0]["id"]
    # correct tenant
    r = isb["session"].get(f"{BASE_URL}/api/audit/{inst}/event/{eid}", timeout=20)
    assert r.status_code == 200
    assert r.json()["id"] == eid
    # wrong tenant — eaic user fetching isb event
    r2 = eaic["session"].get(f"{BASE_URL}/api/audit/{inst}/event/{eid}", timeout=20)
    assert r2.status_code == 403  # blocked by _scope before lookup
