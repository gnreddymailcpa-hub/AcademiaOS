"""Phase 8 backend tests:
- Workflow template CRUD (admin only, tenant scoped, audit)
- Per-tenant email integration (masked key, preserve-on-blank, test send)
- Google session endpoint (400/401 paths)
- Email/password login still issues JWT
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_admin():
    return _login("rajiv.admin@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def isb_dean():
    return _login("shankar.dean@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def eaic_admin():
    return _login("fatima.admin@eaic.gov.ae", "Demo@2026")


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ----------- Auth ---------------------------------------------------------
class TestAuth:
    def test_email_password_login_issues_jwt(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "rajiv.admin@isb.edu", "password": "Demo@2026"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and len(body["access_token"]) > 20
        assert body["user"]["email"] == "rajiv.admin@isb.edu"

    def test_google_session_no_sid_returns_400(self):
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:120]}"

    def test_google_session_bad_sid_in_body_returns_401(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "bogus-not-a-real-session"})
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:160]}"
        # must NOT be 500
        assert r.status_code != 500

    def test_google_session_bad_sid_in_header_returns_401(self):
        r = requests.post(f"{API}/auth/session", headers={"X-Session-ID": "bogus-header-sid"})
        assert r.status_code == 401


# ----------- Workflow Templates -------------------------------------------
class TestWorkflowTemplates:
    created_id = None

    def test_create_template_admin_ok(self, isb_admin):
        key = f"TEST_phase8_{uuid.uuid4().hex[:6]}"
        payload = {
            "institution_id": ISB_ID,
            "key": key,
            "name": "TEST Phase8 Template",
            "description": "test description",
            "category": "operations",
            "steps": [
                {"key": "s1", "name": "Validate", "kind": "auto", "tool": "validate_input", "undoable": False},
                {"key": "s2", "name": "Review", "kind": "hitl", "tool": "noop", "role": "Approver", "undoable": True},
                {"key": "s3", "name": "Summarise", "kind": "llm", "tool": "llm_summarise"},
            ],
        }
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_admin))
        assert r.status_code == 200, r.text[:200]
        doc = r.json()
        assert doc["id"].startswith("wf-")
        assert doc["version"] == 1
        assert len(doc["steps"]) == 3
        TestWorkflowTemplates.created_id = doc["id"]

    def test_create_no_steps_returns_422(self, isb_admin):
        payload = {"institution_id": ISB_ID, "key": "TEST_empty", "name": "x",
                   "description": "x", "steps": []}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_admin))
        assert r.status_code == 422

    def test_create_invalid_kind_returns_422(self, isb_admin):
        payload = {"institution_id": ISB_ID, "key": "TEST_badkind", "name": "x",
                   "description": "x", "steps": [{"key": "a", "name": "x", "kind": "wrong"}]}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_admin))
        assert r.status_code == 422

    def test_create_duplicate_keys_returns_422(self, isb_admin):
        payload = {"institution_id": ISB_ID, "key": "TEST_dup", "name": "x",
                   "description": "x", "steps": [
                       {"key": "a", "name": "1", "kind": "auto"},
                       {"key": "a", "name": "2", "kind": "auto"},
                   ]}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_admin))
        assert r.status_code == 422

    def test_create_tenant_mismatch_returns_400(self, isb_admin):
        payload = {"institution_id": EAIC_ID, "key": "TEST_mismatch", "name": "x",
                   "description": "x", "steps": [{"key": "a", "name": "1", "kind": "auto"}]}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_admin))
        assert r.status_code == 400

    def test_create_non_admin_returns_403(self, isb_dean):
        payload = {"institution_id": ISB_ID, "key": "TEST_dean", "name": "x",
                   "description": "x", "steps": [{"key": "a", "name": "1", "kind": "auto"}]}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(isb_dean))
        assert r.status_code == 403

    def test_cross_tenant_create_returns_403(self, eaic_admin):
        payload = {"institution_id": ISB_ID, "key": "TEST_xtenant", "name": "x",
                   "description": "x", "steps": [{"key": "a", "name": "1", "kind": "auto"}]}
        r = requests.post(f"{API}/workflows/{ISB_ID}/templates", json=payload, headers=_h(eaic_admin))
        assert r.status_code == 403

    def test_patch_template_updates_and_bumps_version(self, isb_admin):
        tid = TestWorkflowTemplates.created_id
        assert tid
        r = requests.patch(f"{API}/workflows/templates/{tid}",
                           json={"name": "TEST Phase8 Renamed",
                                 "description": "updated desc",
                                 "steps": [
                                     {"key": "x1", "name": "New only step", "kind": "auto", "tool": "noop"},
                                 ]},
                           headers=_h(isb_admin))
        assert r.status_code == 200, r.text[:200]
        doc = r.json()
        assert doc["name"] == "TEST Phase8 Renamed"
        assert doc["version"] == 2
        assert len(doc["steps"]) == 1
        assert doc["steps"][0]["key"] == "x1"

    def test_cross_tenant_patch_returns_403(self, eaic_admin):
        tid = TestWorkflowTemplates.created_id
        r = requests.patch(f"{API}/workflows/templates/{tid}",
                           json={"name": "hijacked"}, headers=_h(eaic_admin))
        assert r.status_code == 403

    def test_delete_template_admin_ok_and_audit_written(self, isb_admin):
        tid = TestWorkflowTemplates.created_id
        r = requests.delete(f"{API}/workflows/templates/{tid}", headers=_h(isb_admin))
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{API}/workflows/templates/{tid}", headers=_h(isb_admin))
        assert r2.status_code == 404
        # verify audit entry
        a = requests.get(f"{API}/audit/{ISB_ID}",
                         params={"action": "workflow.template.delete", "target": tid},
                         headers=_h(isb_admin))
        assert a.status_code == 200
        items = a.json()["items"]
        assert any(it["target"] == tid and it["action"] == "workflow.template.delete" for it in items), \
            "audit log for workflow.template.delete missing"


# ----------- Integrations -------------------------------------------------
class TestIntegrations:
    def test_get_returns_skeleton_no_500(self, isb_admin):
        r = requests.get(f"{API}/integrations/{ISB_ID}", headers=_h(isb_admin))
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["institution_id"] == ISB_ID
        # email may be None or dict, must not 500
        assert "email" in body

    def test_patch_persists_and_response_masks_key(self, isb_admin):
        full_key = "re_TEST_PHASE8_FULLKEY_ABCDEF"
        r = requests.patch(f"{API}/integrations/{ISB_ID}/email",
                           json={"provider": "resend", "api_key": full_key,
                                 "from_email": "no-reply@test.isb.edu",
                                 "from_name": "ISB Test", "enabled": True},
                           headers=_h(isb_admin))
        assert r.status_code == 200, r.text[:200]
        g = requests.get(f"{API}/integrations/{ISB_ID}", headers=_h(isb_admin)).json()
        email = g["email"]
        assert email["api_key"] in (None, "")  # raw NEVER echoed
        assert "api_key_masked" in email and email["api_key_masked"].endswith(full_key[-6:])
        assert email["from_email"] == "no-reply@test.isb.edu"
        assert email["enabled"] is True

    def test_patch_blank_key_preserves_existing(self, isb_admin):
        # send no api_key, change only from_name
        r = requests.patch(f"{API}/integrations/{ISB_ID}/email",
                           json={"provider": "resend", "from_email": "no-reply@test.isb.edu",
                                 "from_name": "ISB Renamed", "enabled": True},
                           headers=_h(isb_admin))
        assert r.status_code == 200
        g = requests.get(f"{API}/integrations/{ISB_ID}", headers=_h(isb_admin)).json()
        email = g["email"]
        # masked tail should match what we wrote in the previous test
        assert email.get("api_key_masked", "").endswith("BCDEF") or email.get("api_key_masked", "").endswith("ABCDEF"[-6:])
        assert email["from_name"] == "ISB Renamed"

    def test_email_test_with_bogus_key_returns_4xx_no_500(self, isb_admin):
        # using existing bogus key configured above
        r = requests.post(f"{API}/integrations/{ISB_ID}/email/test",
                          json={"to": "rajiv.admin@isb.edu"}, headers=_h(isb_admin))
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["ok"] is False
        # error string should contain resend_4xx or any non-empty error
        assert body.get("error"), f"expected error, got {body}"
        assert "resend_" in str(body["error"]).lower() or "401" in str(body["error"]) or "403" in str(body["error"]) or "400" in str(body["error"])

    def test_email_test_not_configured_returns_graceful(self, eaic_admin):
        # ensure EAIC has no email or enabled=False
        requests.patch(f"{API}/integrations/{EAIC_ID}/email",
                       json={"provider": "resend", "enabled": False, "api_key": ""},
                       headers=_h(eaic_admin))
        r = requests.post(f"{API}/integrations/{EAIC_ID}/email/test",
                          json={"to": "fatima.admin@eaic.gov.ae"}, headers=_h(eaic_admin))
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["ok"] is False
        assert body["error"] == "not_configured"
