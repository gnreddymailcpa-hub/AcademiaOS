"""Phase 31 — Claros AI (VEDA rebrand) backend tests.

Coverage:
- NEW endpoints
    GET    /api/ai/sessions/list/{institution_id}
    GET    /api/ai/sessions/detail/{session_id}
    DELETE /api/ai/sessions/{session_id}
    POST   /api/ai/sessions/new/{institution_id}
    DELETE /api/ai/content/sources/{source_id}
- Authorisation 403s (cross-user session, student delete source)
- Full integration smoke through /api/ai/assistant/message
- Existing endpoint regression (assistant/instructor/content list)
"""
import os
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from /app/frontend/.env (no defaults — fail fast if missing)
_env_path = Path("/app/frontend/.env")
if _env_path.is_file():
    for line in _env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            os.environ.setdefault("REACT_APP_BACKEND_URL", line.split("=", 1)[1].strip())
            break

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

VCE_IID = "44444444-4444-4444-4444-444444444444"
PRINCIPAL = ("principal@vaagdevi.edu.in", "Demo@2026")
STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
SUPER_ADMIN = ("admin@academiaos.ai", "Admin@2026")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def principal_token():
    return _login(*PRINCIPAL)


@pytest.fixture(scope="module")
def student_token():
    return _login(*STUDENT)


@pytest.fixture(scope="module")
def super_token():
    return _login(*SUPER_ADMIN)


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# --------------------------------------------------------------------------- assistant integration
class TestAssistantIntegration:
    def test_assistant_message_grounded(self, principal_token):
        r = requests.post(
            f"{API}/ai/assistant/message",
            headers=_h(principal_token),
            json={"institution_id": VCE_IID, "text": "What is the attendance policy?", "language": "en"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("reply", "model", "session_id", "persona", "language", "grounding", "citations"):
            assert k in data, f"missing {k} in assistant response: {list(data.keys())}"
        assert data["language"] == "en"
        assert data["grounding"] in ("rag", "faq", "llm", "none")
        assert isinstance(data["citations"], list)
        # session_id is used in subsequent tests
        pytest.assistant_session_id = data["session_id"]


# --------------------------------------------------------------------------- session manager
class TestSessionManager:
    def test_list_sessions(self, principal_token):
        r = requests.get(
            f"{API}/ai/sessions/list/{VCE_IID}",
            headers=_h(principal_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1, "principal should now have at least 1 session from previous test"
        first = items[0]
        for k in ("id", "title", "open", "created_at", "message_count"):
            assert k in first
        assert isinstance(first["message_count"], int)

    def test_session_detail_owner_ok(self, principal_token):
        sid = getattr(pytest, "assistant_session_id", None)
        assert sid, "session id must be set by assistant integration test"
        r = requests.get(f"{API}/ai/sessions/detail/{sid}", headers=_h(principal_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == sid
        assert isinstance(d.get("messages"), list)
        assert len(d["messages"]) >= 2  # user + assistant

    def test_session_detail_cross_user_403(self, principal_token, student_token):
        sid = getattr(pytest, "assistant_session_id", None)
        assert sid
        r = requests.get(f"{API}/ai/sessions/detail/{sid}", headers=_h(student_token), timeout=20)
        assert r.status_code == 403, f"expected 403 for cross-user, got {r.status_code}"

    def test_session_detail_super_admin_ok(self, super_token):
        sid = getattr(pytest, "assistant_session_id", None)
        assert sid
        r = requests.get(f"{API}/ai/sessions/detail/{sid}", headers=_h(super_token), timeout=20)
        assert r.status_code == 200

    def test_start_new_session_closes_open(self, principal_token):
        r = requests.post(f"{API}/ai/sessions/new/{VCE_IID}", headers=_h(principal_token), timeout=20)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        # verify no open sessions remain
        r2 = requests.get(f"{API}/ai/sessions/list/{VCE_IID}", headers=_h(principal_token), timeout=20)
        items = r2.json()
        opens = [s for s in items if s.get("open")]
        assert opens == [], f"expected no open sessions after /new, got {len(opens)}"

    def test_delete_session_and_persisted(self, principal_token):
        # Create a throwaway session via assistant
        r = requests.post(
            f"{API}/ai/assistant/message",
            headers=_h(principal_token),
            json={"institution_id": VCE_IID, "text": "throwaway message for deletion", "language": "en"},
            timeout=60,
        )
        assert r.status_code == 200
        sid = r.json()["session_id"]
        # Delete
        dr = requests.delete(f"{API}/ai/sessions/{sid}", headers=_h(principal_token), timeout=20)
        assert dr.status_code == 200
        assert dr.json() == {"ok": True}
        # Verify gone
        gr = requests.get(f"{API}/ai/sessions/detail/{sid}", headers=_h(principal_token), timeout=20)
        assert gr.status_code == 404


# --------------------------------------------------------------------------- content source delete + role gating
class TestContentSourceDelete:
    def test_student_delete_source_403(self, principal_token, student_token):
        # find any existing source in VCE
        r = requests.get(f"{API}/ai/content/sources/{VCE_IID}", headers=_h(principal_token), timeout=20)
        assert r.status_code == 200
        sources = r.json()
        if not sources:
            pytest.skip("no VCE content sources to test 403 delete")
        sid = sources[0]["id"]
        # student attempts delete
        d = requests.delete(f"{API}/ai/content/sources/{sid}", headers=_h(student_token), timeout=20)
        assert d.status_code in (403,), f"expected 403 student delete, got {d.status_code} {d.text}"

    def test_upload_then_admin_delete_removes_chunks(self, principal_token):
        # upload a minimal source
        files = {
            "file": ("test_delete_me.txt", b"This is a TEST source for Phase 31 delete check.", "text/plain"),
        }
        data = {
            "institution_id": VCE_IID,
            "title": "TEST_Phase31_delete_me",
            "kind": "policy",
            "source_type": "POLICY",
            "language": "en",
        }
        u = requests.post(
            f"{API}/ai/content/upload",
            headers=_h(principal_token),
            files=files,
            data=data,
            timeout=30,
        )
        assert u.status_code == 200, u.text
        new_id = u.json().get("id") or u.json().get("source_id")
        assert new_id, f"upload response missing id: {u.json()}"
        # delete as principal (institution_admin role) — should succeed
        d = requests.delete(f"{API}/ai/content/sources/{new_id}", headers=_h(principal_token), timeout=20)
        assert d.status_code == 200, d.text
        assert d.json() == {"ok": True}
        # verify it no longer appears in list
        r = requests.get(f"{API}/ai/content/sources/{VCE_IID}", headers=_h(principal_token), timeout=20)
        ids = {s["id"] for s in r.json()}
        assert new_id not in ids


# --------------------------------------------------------------------------- existing endpoint regression
class TestRegressionExistingEndpoints:
    def test_instructor_message_still_works(self, principal_token):
        r = requests.post(
            f"{API}/ai/instructor/message",
            headers=_h(principal_token),
            json={"institution_id": VCE_IID, "text": "Summarize discrete math basics.", "language": "en"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        for k in ("reply", "session_id"):
            assert k in r.json()

    def test_content_sources_list_still_works(self, principal_token):
        r = requests.get(f"{API}/ai/content/sources/{VCE_IID}", headers=_h(principal_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
