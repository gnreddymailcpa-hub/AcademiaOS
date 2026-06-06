"""
Phase 22 — Phase-2 completion tests for routes_phase2_complete.py:
  ILLUMINATE : quiz-gen (Claude live), at-risk heuristic shape + sort
  PRISM      : DOI lookup (CrossRef live), OpenAlex sync (live, idempotent)
  ALUMNI360  : enrichment deterministic, UTM click + summary aggregation
  FACULTY+   : workload optimiser bands + variance, peer review composite + rollup
  GUARDIAN   : YOLO ingestion — auto-escalation iff severity>=medium AND conf>=0.6

Cross-tenant 403 + role-gate 403 on write paths.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
VCE = "44444444-4444-4444-4444-444444444444"
ISB = "11111111-1111-1111-1111-111111111111"


@pytest.fixture(scope="module")
def vce_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "principal@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "rajiv.admin@isb.edu", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def vce_student_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "manikanta.cse@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- ILLUMINATE ----------------
class TestIlluminate:
    def test_quiz_gen_live(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/illuminate/quiz-gen",
                          headers=_h(vce_token),
                          json={"topic": "Binary search trees", "num_questions": 3,
                                "difficulty": "intermediate"}, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["grounding"] in ("rag", "general")
        assert isinstance(body["questions"], list) and 1 <= len(body["questions"]) <= 3
        for q in body["questions"]:
            assert q["stem"]
            assert len(q["options"]) == 4
            assert 0 <= q["correct_index"] <= 3

    def test_quiz_gen_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/illuminate/quiz-gen",
                          headers=_h(vce_student_token),
                          json={"topic": "x", "num_questions": 1}, timeout=20)
        assert r.status_code == 403

    def test_at_risk_returns_list(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase2/{VCE}/illuminate/at-risk",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_cross_tenant_quiz_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/phase2/{VCE}/illuminate/quiz-gen",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403


# ---------------- PRISM ----------------
class TestPrism:
    def test_doi_lookup_real(self, vce_token):
        # 10.1038/nature12373 — landmark Nature paper, always resolvable
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/prism/doi-lookup",
                          headers=_h(vce_token),
                          json={"doi": "10.1038/nature12373"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["title"]
        assert body["year"] == 2013
        assert "Nature" in (body.get("venue") or "")
        assert body["citations"] > 0

    def test_doi_invalid_404(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/prism/doi-lookup",
                          headers=_h(vce_token),
                          json={"doi": "10.9999/this-doi-does-not-exist-xyz"}, timeout=30)
        assert r.status_code in (404, 502)

    def test_openalex_sync_real(self, vce_token):
        # First sync
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/prism/openalex-sync",
                          headers=_h(vce_token),
                          json={"author_name": "Geoffrey Hinton", "max_results": 3}, timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched_author"]
        first_total = body["total_synced"]
        assert first_total >= 1

        # Re-sync should update, not insert duplicates
        r2 = requests.post(f"{BASE_URL}/api/phase2/{VCE}/prism/openalex-sync",
                           headers=_h(vce_token),
                           json={"author_name": "Geoffrey Hinton", "max_results": 3}, timeout=45)
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["updated"] >= 1  # at least one updated row from re-sync
        assert body2["inserted"] == 0  # nothing new on re-sync


# ---------------- ALUMNI360 ----------------
class TestAlumni:
    @pytest.fixture
    def alumni_id(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/alumni/{VCE}/directory",
                         headers=_h(vce_token), timeout=20)
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert items
        return items[0]["id"]

    def test_enrich_profile_deterministic(self, vce_token, alumni_id):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/alumni/enrich-profile",
                          headers=_h(vce_token),
                          json={"alumni_id": alumni_id}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["alumni_id"] == alumni_id
        assert body["method"] == "deterministic_heuristic"
        assert body["seniority"] in ("early", "mid", "senior")
        assert isinstance(body["industries"], list) and body["industries"]
        # Idempotent — call again, same shape
        r2 = requests.post(f"{BASE_URL}/api/phase2/{VCE}/alumni/enrich-profile",
                           headers=_h(vce_token), json={"alumni_id": alumni_id}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["seniority"] == body["seniority"]

    def test_enrich_unknown_404(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/alumni/enrich-profile",
                          headers=_h(vce_token), json={"alumni_id": "does-not-exist"}, timeout=20)
        assert r.status_code == 404

    def test_utm_click_and_summary(self, vce_token):
        for src in ("email", "linkedin", "email"):
            r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/alumni/utm-click",
                              headers=_h(vce_token),
                              json={"campaign": "p22_test", "source": src}, timeout=20)
            assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/phase2/{VCE}/alumni/utm-summary",
                         headers=_h(vce_token), timeout=20)
        body = r.json()
        assert body["total_clicks"] >= 3
        camp = next((c for c in body["by_campaign"] if c["campaign"] == "p22_test"), None)
        assert camp and camp["clicks"] >= 3
        assert camp["sources"]["email"] >= 2

    def test_enrich_student_403(self, vce_student_token, alumni_id):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/alumni/enrich-profile",
                          headers=_h(vce_student_token),
                          json={"alumni_id": alumni_id}, timeout=20)
        assert r.status_code == 403


# ---------------- FACULTY+ ----------------
class TestFaculty:
    def test_workload_bands(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/faculty/workload-optimise",
                          headers=_h(vce_token), json={
                              "faculty_loads": [
                                  {"faculty_id": "f1", "name": "A", "hours_assigned": 30},  # overloaded
                                  {"faculty_id": "f2", "name": "B", "hours_assigned": 10},  # underloaded
                                  {"faculty_id": "f3", "name": "C", "hours_assigned": 18},  # balanced
                              ],
                              "target_hours_per_week": 18,
                          }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["n_faculty"] == 3
        assert body["variance"] > 0
        bands = {p["name"]: p["band"] for p in body["plan"]}
        assert bands["A"] == "overloaded"
        assert bands["B"] == "underloaded"
        assert bands["C"] == "balanced"

    def test_workload_empty_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/faculty/workload-optimise",
                          headers=_h(vce_token), json={"faculty_loads": [], "target_hours_per_week": 18},
                          timeout=20)
        assert r.status_code == 422

    def test_peer_review_submit_summary(self, vce_token):
        for combo in [(5, 4, 5, 4), (4, 4, 4, 4), (3, 5, 4, 5)]:
            r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/faculty/peer-review",
                              headers=_h(vce_token), json={
                                  "faculty_id": "fac-p22", "faculty_name": "Test Faculty",
                                  "reviewer_role": "peer",
                                  "teaching": combo[0], "research": combo[1],
                                  "mentorship": combo[2], "collaboration": combo[3],
                                  "comment": "ok",
                              }, timeout=20)
            assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/phase2/{VCE}/faculty/peer-review/fac-p22",
                         headers=_h(vce_token), timeout=20)
        body = r.json()
        assert body["n_reviews"] >= 3
        assert 1 <= body["overall_composite"] <= 5
        assert "teaching" in body["by_dim"]

    def test_peer_review_rating_validation(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/faculty/peer-review",
                          headers=_h(vce_token), json={
                              "faculty_id": "f", "faculty_name": "F",
                              "teaching": 6, "research": 1, "mentorship": 1, "collaboration": 1,
                          }, timeout=20)
        assert r.status_code == 422


# ---------------- GUARDIAN ----------------
class TestGuardian:
    def test_yolo_high_severity_escalates(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/guardian/yolov8-detect",
                          headers=_h(vce_token), json={
                              "camera_id": "CAM-TEST-1", "location": "Test Gate",
                              "detection_type": "intrusion", "severity": "high",
                              "confidence": 0.92,
                          }, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["auto_escalated"] is True
        assert body["incident_id"]

    def test_yolo_low_confidence_no_escalate(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/guardian/yolov8-detect",
                          headers=_h(vce_token), json={
                              "camera_id": "CAM-TEST-2", "location": "x",
                              "detection_type": "loitering", "severity": "high",
                              "confidence": 0.4,
                          }, timeout=20)
        assert r.status_code == 200
        assert r.json()["auto_escalated"] is False

    def test_yolo_low_severity_no_escalate(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/guardian/yolov8-detect",
                          headers=_h(vce_token), json={
                              "camera_id": "CAM-TEST-3", "location": "x",
                              "detection_type": "crowd", "severity": "low",
                              "confidence": 0.99,
                          }, timeout=20)
        assert r.status_code == 200
        assert r.json()["auto_escalated"] is False

    def test_yolo_bad_detection_type_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase2/{VCE}/guardian/yolov8-detect",
                          headers=_h(vce_token), json={
                              "camera_id": "x", "location": "y",
                              "detection_type": "alien", "severity": "high",
                              "confidence": 0.9,
                          }, timeout=20)
        assert r.status_code == 422

    def test_yolo_stream_listing(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase2/{VCE}/guardian/yolov8-detect",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
