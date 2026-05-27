"""Phase 9 — AI Virtual Instructor backend tests.

Covers:
- GET /api/ai/instructor/suggestions/{institution_id} (EN/AR, tenant scope)
- POST /api/ai/instructor/message with persona/depth/show_reasoning
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ISB_EMAIL = "rajiv.admin@isb.edu"
EAIC_EMAIL = "fatima.admin@eaic.gov.ae"
PWD = "Demo@2026"


def _login(email):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": PWD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return body["access_token"], body["user"]


@pytest.fixture(scope="module")
def isb_ctx():
    tok, user = _login(ISB_EMAIL)
    return {"token": tok, "user": user, "institution_id": user["institution_id"]}


@pytest.fixture(scope="module")
def eaic_ctx():
    tok, user = _login(EAIC_EMAIL)
    return {"token": tok, "user": user, "institution_id": user["institution_id"]}


def _h(ctx):
    return {"Authorization": f"Bearer {ctx['token']}"}


# --- Suggestions endpoint --------------------------------------------------

class TestSuggestions:
    def test_english_suggestions(self, isb_ctx):
        r = requests.get(
            f"{BASE_URL}/api/ai/instructor/suggestions/{isb_ctx['institution_id']}",
            params={"language": "en"}, headers=_h(isb_ctx), timeout=15,
        )
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) == 4
        for s in items:
            assert isinstance(s, str) and len(s) > 0
            # English heuristic: contains an ASCII letter
            assert any(c.isascii() and c.isalpha() for c in s)

    def test_arabic_suggestions(self, isb_ctx):
        r = requests.get(
            f"{BASE_URL}/api/ai/instructor/suggestions/{isb_ctx['institution_id']}",
            params={"language": "ar"}, headers=_h(isb_ctx), timeout=15,
        )
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) == 4
        # Arabic heuristic: at least one Arabic char per item
        for s in items:
            assert any("\u0600" <= c <= "\u06FF" for c in s), f"Not arabic: {s}"

    def test_cross_tenant_403(self, isb_ctx, eaic_ctx):
        # ISB admin trying to read EAIC suggestions must be forbidden
        r = requests.get(
            f"{BASE_URL}/api/ai/instructor/suggestions/{eaic_ctx['institution_id']}",
            params={"language": "en"}, headers=_h(isb_ctx), timeout=15,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# --- Instructor message endpoint -------------------------------------------

class TestInstructorMessage:
    def test_message_with_persona_depth(self, isb_ctx):
        payload = {
            "institution_id": isb_ctx["institution_id"],
            "text": "Define Porter's Five Forces in one sentence.",
            "language": "en",
            "persona": "tutor",
            "depth": "concise",
            "show_reasoning": False,
        }
        r = requests.post(
            f"{BASE_URL}/api/ai/instructor/message",
            json=payload, headers=_h(isb_ctx), timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
        assert data.get("persona") == "tutor"
        assert data.get("depth") == "concise"
        assert isinstance(data.get("latency_ms"), int) and data["latency_ms"] >= 0
        assert "citations" in data and isinstance(data["citations"], list)
        # reasoning should be None when show_reasoning=False
        assert data.get("reasoning") in (None, "")

    def test_message_reasoning_request(self, isb_ctx):
        payload = {
            "institution_id": isb_ctx["institution_id"],
            "text": "Briefly explain barriers to entry.",
            "language": "en",
            "persona": "lecturer",
            "depth": "concise",
            "show_reasoning": True,
        }
        r = requests.post(
            f"{BASE_URL}/api/ai/instructor/message",
            json=payload, headers=_h(isb_ctx), timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Field must be present (may be None if model didn't emit the block)
        assert "reasoning" in data
        assert data.get("persona") == "lecturer"
        assert data.get("depth") == "concise"

    def test_message_defaults(self, isb_ctx):
        # Persona/depth should default sensibly when omitted
        payload = {
            "institution_id": isb_ctx["institution_id"],
            "text": "Hello.",
            "language": "en",
        }
        r = requests.post(
            f"{BASE_URL}/api/ai/instructor/message",
            json=payload, headers=_h(isb_ctx), timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("persona") == "lecturer"
        assert data.get("depth") == "standard"
