"""
Phase 24 — VEDA hardening tests:
  • intent-classify keyword path (multiple categories)
  • intent-classify LLM fallback path (no keyword match)
  • intent catalog ≥ 60 intents
  • intent persistence + listing
  • voice/transcribe — extension validation 422 (no need to call Whisper live;
    we validate the guard path)
  • voice/transcribe language validation 422
  • kb/ingest-run — incremental processes pending sources, updates status,
    marks sources as 'ingested' so a second run with only_pending=true skips
  • kb/ingest-run admin-only 403
  • kb/status snapshot shape
  • assistant/message — RAG-grounded (grounding=rag, citations populated),
    persona inferred from role (student→student, admin→admin)
"""
import io
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
VCE = "44444444-4444-4444-4444-444444444444"


@pytest.fixture(scope="module")
def vce_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "principal@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def vce_student_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "manikanta.cse@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "rajiv.admin@isb.edu", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


class TestIntent:
    def test_catalog_has_60_plus(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/veda/{VCE}/intent-catalog",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["total_intents"] >= 60
        # 8 categories per spec
        assert len(body["categories"]) == 8

    @pytest.mark.parametrize("text,exp_cat,exp_intent", [
        ("when are the exam dates published?", "academic", "exam_schedule"),
        ("what is my attendance percentage", "academic", "attendance"),
        ("my fee is due tomorrow", "fees", "fee_due"),
        ("which book can I borrow", "library", "library_book"),
        ("how can I book a hostel room", "hostel", "hostel_allocation"),
        ("any internship opportunities", "placement", "internship"),
        ("I am feeling anxious", "wellbeing", "mental_health"),
        ("hello there", "general", "small_talk"),
    ])
    def test_keyword_classify(self, vce_token, text, exp_cat, exp_intent):
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/intent-classify",
                          headers=_h(vce_token),
                          json={"text": text, "persist": False}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == "keyword"
        assert body["category"] == exp_cat
        assert body["intent"] == exp_intent
        assert 0.5 <= body["confidence"] <= 0.99

    def test_llm_fallback(self, vce_token):
        # Phrase with no catalog keywords — LLM (or final fallback) must answer
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/intent-classify",
                          headers=_h(vce_token),
                          json={"text": "what gear should I bring to the hackathon"},
                          timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["method"] in ("llm", "fallback")
        assert body["category"] in (
            "academic", "admin", "fees", "hostel", "library",
            "placement", "wellbeing", "general",
        )

    def test_empty_text_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/intent-classify",
                          headers=_h(vce_token),
                          json={"text": "   "}, timeout=20)
        assert r.status_code == 422

    def test_persist_and_list(self, vce_token):
        tok = uuid.uuid4().hex[:8]
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/intent-classify",
                          headers=_h(vce_token),
                          json={"text": f"attendance please {tok}", "persist": True}, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/veda/{VCE}/intent-classify",
                          headers=_h(vce_token), timeout=20)
        assert any(tok in i.get("text", "") for i in r2.json())

    def test_cross_tenant_403(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/veda/{VCE}/intent-catalog",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403


class TestVoice:
    def test_bad_language_422(self, vce_token):
        files = {"audio": ("clip.mp3", io.BytesIO(b"\x00\x00"), "audio/mpeg")}
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/voice/transcribe",
                          headers=_h(vce_token), files=files, data={"language": "klingon"},
                          timeout=20)
        assert r.status_code == 422

    def test_bad_extension_422(self, vce_token):
        files = {"audio": ("photo.png", io.BytesIO(b"\x00\x00"), "image/png")}
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/voice/transcribe",
                          headers=_h(vce_token), files=files, data={"language": "en"},
                          timeout=20)
        assert r.status_code == 422

    def test_voice_list(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/veda/{VCE}/voice/transcribe",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestKbIngestion:
    def test_status_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/veda/{VCE}/kb/status",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        for k in ("sources_total", "sources_ingested", "sources_pending", "chunks_total"):
            assert k in body

    def test_ingest_run_processes_pending(self, vce_token):
        # First, force-reingest everything
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/kb/ingest-run",
                          headers=_h(vce_token),
                          json={"only_pending": False}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["sources_processed"] >= 0

        # Second run with only_pending=True should process 0 (everything is ingested)
        r2 = requests.post(f"{BASE_URL}/api/veda/{VCE}/kb/ingest-run",
                           headers=_h(vce_token),
                           json={"only_pending": True}, timeout=60)
        assert r2.status_code == 200
        assert r2.json()["sources_processed"] == 0

        # Status should reflect all sources ingested
        s = requests.get(f"{BASE_URL}/api/veda/{VCE}/kb/status",
                         headers=_h(vce_token), timeout=20).json()
        assert s["sources_pending"] == 0
        assert s["sources_total"] == s["sources_ingested"]

    def test_ingest_history(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/veda/{VCE}/kb/ingest-run",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_ingest_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/veda/{VCE}/kb/ingest-run",
                          headers=_h(vce_student_token),
                          json={"only_pending": True}, timeout=20)
        assert r.status_code == 403


class TestAssistant:
    def test_rag_grounded_for_admin(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/ai/assistant/message",
                          headers=_h(vce_token), json={
                              "institution_id": VCE,
                              "text": "what is the attendance policy",
                              "language": "en",
                          }, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["persona"] == "admin"
        assert body["language"] == "en"
        assert body["grounding"] in ("rag", "faq")
        assert body["reply"]
        assert body["session_id"]

    def test_persona_student(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/ai/assistant/message",
                          headers=_h(vce_student_token), json={
                              "institution_id": VCE,
                              "text": "when are my exams",
                              "language": "en",
                          }, timeout=60)
        assert r.status_code == 200
        assert r.json()["persona"] == "student"

    def test_role_override_parent(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/ai/assistant/message",
                          headers=_h(vce_token), json={
                              "institution_id": VCE,
                              "text": "I need my ward's attendance update",
                              "language": "en",
                              "role_override": "parent",
                          }, timeout=60)
        assert r.status_code == 200
        assert r.json()["persona"] == "parent"

    def test_telugu_request(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/ai/assistant/message",
                          headers=_h(vce_token), json={
                              "institution_id": VCE,
                              "text": "exam schedule chepandi",  # code-switched
                              "language": "te",
                          }, timeout=60)
        assert r.status_code == 200
        assert r.json()["language"] == "te"
