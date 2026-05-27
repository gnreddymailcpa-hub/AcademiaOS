"""
AcademiaOS Phase 3 backend tests — AI use cases catalog, Content Studio, AI Instructor,
AI Advisor, Student Assistant, audit, cross-tenant scoping, backward compatibility.
Uses real Emergent LLM key (Claude Sonnet 4.6 / GPT-4o).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"

LLM_TIMEOUT = 60


def _login(s, email, password):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def isb_admin_token(session):
    return _login(session, "rajiv.admin@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def isb_student_token(session):
    return _login(session, "vikram.pgp@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def eaic_admin_token(session):
    return _login(session, "fatima.admin@eaic.gov.ae", "Demo@2026")


@pytest.fixture(scope="module")
def eaic_cadet_token(session):
    return _login(session, "saif.cadet@eaic.gov.ae", "Demo@2026")


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- AI Use Cases catalog ----------
def test_use_cases_isb_count_and_shape(session, isb_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/use-cases/{ISB_ID}", headers=hdr(isb_admin_token), timeout=30)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 8, f"expected 8 use cases, got {len(items)}"
    codes = sorted([str(i.get("code", "")) for i in items])
    # Codes may be "4.1"-"4.8" or "M4.1"-"M4.8"; verify 8 unique 4.x codes
    assert len(codes) == 8 and all("4." in c for c in codes), f"codes: {codes}"
    # Bilingual + provider/model + status fields
    for i in items:
        assert "key" in i
        assert i.get("name_en") and i.get("name_ar")
        assert i.get("provider") and i.get("model")
        assert i.get("status") in ("active", "coming_soon", "beta", "disabled")


def test_use_cases_eaic_default_provider(session, eaic_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/use-cases/{EAIC_ID}", headers=hdr(eaic_admin_token), timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 8
    # EAIC should default to anthropic claude-sonnet-4-6
    ai_instr = next((i for i in items if i["key"] == "ai_instructor"), None)
    assert ai_instr is not None
    assert ai_instr["provider"] == "anthropic"
    assert "claude-sonnet-4" in ai_instr["model"]


def test_patch_use_case_ai_instructor(session, isb_admin_token):
    payload = {"provider": "openai", "model": "gpt-4o", "status": "active"}
    r = session.patch(
        f"{BASE_URL}/api/ai/use-cases/{ISB_ID}/ai_instructor",
        headers=hdr(isb_admin_token), json=payload, timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "openai"
    assert body["model"] == "gpt-4o"
    # verify persistence
    r2 = session.get(f"{BASE_URL}/api/ai/use-cases/{ISB_ID}", headers=hdr(isb_admin_token), timeout=20)
    uc = next(i for i in r2.json() if i["key"] == "ai_instructor")
    assert uc["provider"] == "openai" and uc["model"] == "gpt-4o"
    # audit log was created
    r3 = session.get(f"{BASE_URL}/api/ai/audit/{ISB_ID}", headers=hdr(isb_admin_token), timeout=20)
    assert r3.status_code == 200
    audits = r3.json()
    assert any(a.get("action") == "ai.use_case.update" and a.get("target") == "ai_instructor" for a in audits)


# ---------- Content sources ----------
def test_content_sources_eaic_seeded(session, eaic_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/content/sources/{EAIC_ID}", headers=hdr(eaic_admin_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    titles = [i["title"] for i in items]
    assert any("UAE Border" in t or "Border" in t for t in titles), f"titles: {titles}"
    assert any("Biometric" in t for t in titles), f"titles: {titles}"
    # approved ones should exist
    approved = [i for i in items if i.get("approved")]
    assert len(approved) >= 2


def test_content_upload_text_only(session, eaic_admin_token):
    # Form-data upload (no file)
    files = {
        "institution_id": (None, EAIC_ID),
        "title": (None, f"TEST_upload_{uuid.uuid4().hex[:6]}"),
        "kind": (None, "lecture_notes"),
        "text": (None, "Test content body for unit test. Border inspection has four stages: arrival, document, biometric, clearance."),
    }
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {eaic_admin_token}"})
    r = s.post(f"{BASE_URL}/api/ai/content/upload", files=files, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["institution_id"] == EAIC_ID
    assert body["approved"] is False
    assert "id" in body


def test_content_approve_indexes_chunks(session, eaic_admin_token):
    # Create source
    files = {
        "institution_id": (None, EAIC_ID),
        "title": (None, f"TEST_approve_{uuid.uuid4().hex[:6]}"),
        "kind": (None, "lecture_notes"),
        "text": (None, "UAE border inspection workflow. Stage 1: arrival processing. Stage 2: document verification. Stage 3: biometric capture. Stage 4: final clearance and entry stamp."),
    }
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {eaic_admin_token}"})
    r = s.post(f"{BASE_URL}/api/ai/content/upload", files=files, timeout=30)
    assert r.status_code == 200
    source_id = r.json()["id"]

    r2 = s.post(f"{BASE_URL}/api/ai/content/{source_id}/approve", timeout=30)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("ok") is True
    assert body.get("chunks_indexed", 0) >= 1


# Module-level container for AI-generated output id reused across tests
_ai_output_holder = {}


def test_content_generate_mcqs(session, eaic_admin_token):
    # Find an approved seeded source
    r = session.get(f"{BASE_URL}/api/ai/content/sources/{EAIC_ID}", headers=hdr(eaic_admin_token), timeout=20)
    sources = r.json()
    approved = [i for i in sources if i.get("approved")]
    assert approved, "no approved sources"
    source_id = approved[0]["id"]

    payload = {
        "institution_id": EAIC_ID,
        "source_id": source_id,
        "kind": "mcqs",
        "difficulty": "intermediate",
        "language": "en",
        "count": 3,
        "bloom": "Apply",
    }
    r2 = session.post(
        f"{BASE_URL}/api/ai/content/generate", headers=hdr(eaic_admin_token),
        json=payload, timeout=LLM_TIMEOUT,
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("status") == "pending_review"
    assert "payload" in body
    pl = body["payload"]
    # mcqs should have questions array
    assert "questions" in pl or "items" in pl or isinstance(pl.get("mcqs"), list), f"payload: {list(pl.keys())}"
    _ai_output_holder["id"] = body["id"]


def test_content_output_approve(session, eaic_admin_token):
    out_id = _ai_output_holder.get("id")
    if not out_id:
        pytest.skip("no generated output to approve")
    r = session.post(
        f"{BASE_URL}/api/ai/content/outputs/{out_id}/approve",
        headers=hdr(eaic_admin_token), timeout=20,
    )
    assert r.status_code == 200
    # verify via list
    r2 = session.get(
        f"{BASE_URL}/api/ai/content/outputs/{EAIC_ID}",
        headers=hdr(eaic_admin_token), timeout=20,
    )
    rec = next((o for o in r2.json() if o["id"] == out_id), None)
    assert rec is not None
    assert rec["status"] == "approved"


# ---------- AI Instructor chat ----------
def test_instructor_message_with_citations(session, eaic_admin_token):
    payload = {
        "institution_id": EAIC_ID,
        "course_id": "eaic-course-1",
        "text": "What are the four stages of UAE border inspection workflow?",
        "language": "en",
    }
    r = session.post(
        f"{BASE_URL}/api/ai/instructor/message", headers=hdr(eaic_admin_token),
        json=payload, timeout=LLM_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "reply" in body and isinstance(body["reply"], str) and len(body["reply"]) > 20
    assert "citations" in body and isinstance(body["citations"], list)
    assert len(body["citations"]) >= 1
    assert "claude" in body.get("model", "").lower() or "anthropic" in body.get("model", "").lower()
    session_id = body.get("session_id")
    assert session_id

    # second turn — should reuse session
    payload2 = {
        "institution_id": EAIC_ID,
        "course_id": "eaic-course-1",
        "text": "Which of these stages involves biometric capture?",
        "language": "en",
    }
    r2 = session.post(
        f"{BASE_URL}/api/ai/instructor/message", headers=hdr(eaic_admin_token),
        json=payload2, timeout=LLM_TIMEOUT,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json().get("session_id") == session_id

    # verify session has 2+ messages
    r3 = session.get(
        f"{BASE_URL}/api/ai/instructor/sessions/{EAIC_ID}",
        headers=hdr(eaic_admin_token), timeout=20,
    )
    sess = next((s for s in r3.json() if s["id"] == session_id), None)
    assert sess is not None
    msgs = sess.get("messages", [])
    # at least 2 user + 2 assistant
    assert len(msgs) >= 4, f"messages: {len(msgs)}"


# ---------- AI Advisor ----------
def test_advisor_framework_isb(session, isb_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/advisor/framework/{ISB_ID}", headers=hdr(isb_admin_token), timeout=20)
    assert r.status_code == 200
    fw = r.json()
    roles = fw.get("target_roles", [])
    keys = {r["key"] for r in roles}
    expected = {"product_manager", "consultant", "founder"}
    assert expected.issubset(keys), f"missing roles: {expected - keys}"


def test_advisor_profile_isb_student(session, isb_admin_token):
    r = session.get(
        f"{BASE_URL}/api/ai/advisor/profile/{ISB_ID}/u-isb-student",
        headers=hdr(isb_admin_token), timeout=20,
    )
    assert r.status_code == 200
    p = r.json()
    assert isinstance(p.get("skills"), list) and len(p["skills"]) > 0


def test_advisor_analyse(session, isb_admin_token):
    payload = {"institution_id": ISB_ID, "user_id": "u-isb-student", "language": "en"}
    r = session.post(
        f"{BASE_URL}/api/ai/advisor/analyse", headers=hdr(isb_admin_token),
        json=payload, timeout=LLM_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    gaps = body.get("gaps", [])
    assert len(gaps) == 6, f"expected 6 gaps, got {len(gaps)}"
    pl = body.get("payload", {})
    for k in ("summary", "top_priorities", "recommended_path", "career_pathway", "proactive_alerts"):
        assert k in pl, f"missing key in payload: {k}"


# ---------- Student Assistant ----------
def test_assistant_message_attendance(session, eaic_cadet_token):
    payload = {
        "institution_id": EAIC_ID,
        "text": "What is my attendance policy?",
        "language": "en",
    }
    r = session.post(
        f"{BASE_URL}/api/ai/assistant/message", headers=hdr(eaic_cadet_token),
        json=payload, timeout=LLM_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    reply = body.get("reply", "")
    assert "75" in reply, f"reply did not mention 75%: {reply[:200]}"


# ---------- Audit + cross-tenant ----------
def test_audit_isb_has_entries(session, isb_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/audit/{ISB_ID}", headers=hdr(isb_admin_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1


def test_cross_tenant_use_cases_forbidden(session, isb_admin_token):
    r = session.get(f"{BASE_URL}/api/ai/use-cases/{EAIC_ID}", headers=hdr(isb_admin_token), timeout=20)
    assert r.status_code == 403


# ---------- Backward compat (Phase 1+2) ----------
def test_backward_compat_login_me_institutions(session, isb_admin_token):
    r = session.get(f"{BASE_URL}/api/auth/me", headers=hdr(isb_admin_token), timeout=20)
    assert r.status_code == 200
    r2 = session.get(f"{BASE_URL}/api/institutions", headers=hdr(isb_admin_token), timeout=20)
    assert r2.status_code == 200 and len(r2.json()) == 1
    r3 = session.get(f"{BASE_URL}/api/academic/{ISB_ID}/programmes", headers=hdr(isb_admin_token), timeout=20)
    assert r3.status_code == 200 and len(r3.json()) >= 6
    r4 = session.get(f"{BASE_URL}/api/dashboard/{ISB_ID}", headers=hdr(isb_admin_token), timeout=20)
    assert r4.status_code == 200
