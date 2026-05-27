"""
Phase 9 regression — verify the two fixes from iteration_9:
 1) Suggestions endpoint anchors the first English item to an approved source title
    (must mention 'Porter' OR 'Competitive Strategy' for ISB / isb-course-1).
 2) POST /api/ai/instructor/message with that first suggestion returns >=1 citation
    (tenant-wide retrieval fallback).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

ISB_ADMIN = ("rajiv.admin@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def isb_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ISB_ADMIN[0], "password": ISB_ADMIN[1]}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def isb_headers(isb_token):
    return {"Authorization": f"Bearer {isb_token[0]}"}


@pytest.fixture(scope="module")
def isb_institution_id(isb_token):
    return isb_token[1]["institution_id"]


def test_suggestions_first_item_anchored_to_porter(isb_headers, isb_institution_id):
    # Default course on AIInstructor page is isb-course-1 (PGP-101).
    r = requests.get(
        f"{BASE_URL}/api/ai/instructor/suggestions/{isb_institution_id}",
        params={"language": "en", "course_id": "isb-course-1"},
        headers=isb_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    assert isinstance(items, list) and len(items) >= 1, f"expected >=1 item: {items}"
    first = items[0]
    print("FIRST SUGGESTION:", first)
    assert ("Porter" in first) or ("Competitive Strategy" in first), (
        f"First suggestion should be anchored to approved source vocab; got: {first}"
    )


def test_instructor_message_first_suggestion_returns_citations(isb_headers, isb_institution_id):
    # Pull the first suggestion (same call the UI makes).
    sg = requests.get(
        f"{BASE_URL}/api/ai/instructor/suggestions/{isb_institution_id}",
        params={"language": "en", "course_id": "isb-course-1"},
        headers=isb_headers,
        timeout=30,
    )
    assert sg.status_code == 200, sg.text
    first = sg.json()["items"][0]

    payload = {
        "institution_id": isb_institution_id,
        "course_id": "isb-course-1",
        "text": first,
        "language": "en",
        "persona": "lecturer",
        "depth": "concise",
        "show_reasoning": False,
    }
    r = requests.post(
        f"{BASE_URL}/api/ai/instructor/message", json=payload, headers=isb_headers, timeout=90
    )
    assert r.status_code == 200, r.text
    body = r.json()
    citations = body.get("citations") or []
    print("CITATIONS COUNT:", len(citations), "TITLES:", [c.get("title") for c in citations])
    assert len(citations) >= 1, (
        f"Expected >=1 citation via tenant-wide retrieval fallback; got 0. body={body}"
    )
    # And the reply should not be empty
    assert isinstance(body.get("reply"), str) and len(body["reply"]) > 0


def test_instructor_message_tenant_wide_fallback_when_course_has_no_match(isb_headers, isb_institution_id):
    """Even with a totally unrelated course_id, an obvious tenant query should now
    surface at least one citation thanks to the fallback."""
    payload = {
        "institution_id": isb_institution_id,
        "course_id": "isb-course-1",
        "text": "Summarise Porter's Five Forces in two sentences.",
        "language": "en",
        "persona": "lecturer",
        "depth": "concise",
        "show_reasoning": False,
    }
    r = requests.post(
        f"{BASE_URL}/api/ai/instructor/message", json=payload, headers=isb_headers, timeout=90
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body.get("citations") or []) >= 1, f"Expected citations; body={body}"
