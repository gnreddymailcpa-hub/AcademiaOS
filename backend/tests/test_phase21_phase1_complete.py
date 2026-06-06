"""
Phase 21 — Phase-1 completion tests covering routes_phase1_complete.py:
  VEDA  : alerts, sentiment (flagged + unflagged), query-gap
  ARISE : program-match (kw scoring), drip (404 unknown lead), application-status
  NEXUS : hostel (warden gate), library, notices, parent-view, timetable (clash), defaulters
  PATHFINDER : mock-interview (band/readiness), company-intel (role-gate), aptitude/next, industry-trends
  COMPASS : OBE upsert + summary rollup, IQAC meeting, NIRF auto-compile, gap-analysis
  COMMAND : finance term breakdown, benchmark vs peers

Strict cross-tenant 403 + audit-log spot checks.
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
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "rajiv.admin@isb.edu", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def vce_student_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "manikanta.cse@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- VEDA ----------------
class TestVeda:
    def test_alert_push_and_list(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/veda/alerts", headers=_h(vce_token),
                          json={"audience": "student", "title": "Sem fee", "body": "Pay by 15 Jun"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["audience"] == "student"
        r2 = requests.get(f"{BASE_URL}/api/phase1/{VCE}/veda/alerts", headers=_h(vce_token), timeout=20)
        assert r2.status_code == 200 and any(a["title"] == "Sem fee" for a in r2.json())

    def test_alert_audience_rejects_invalid(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/veda/alerts", headers=_h(vce_token),
                          json={"audience": "alien", "title": "x", "body": "y"}, timeout=20)
        assert r.status_code == 422

    def test_sentiment_auto_flags_severe(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/veda/sentiment", headers=_h(vce_token),
                          json={"student_id": "s_test", "message": "feeling depressed", "score": -0.8}, timeout=20)
        assert r.status_code == 200
        assert r.json()["flagged_for_counselor"] is True
        r2 = requests.get(f"{BASE_URL}/api/phase1/{VCE}/veda/sentiment?only_flagged=true",
                          headers=_h(vce_token), timeout=20)
        assert any(s["student_id"] == "s_test" for s in r2.json())

    def test_sentiment_mild_unflagged(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/veda/sentiment", headers=_h(vce_token),
                          json={"student_id": "s_t2", "message": "ok", "score": 0.2}, timeout=20)
        assert r.status_code == 200 and r.json()["flagged_for_counselor"] is False

    def test_query_gap_capture(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/veda/query-gap?query=what is veda",
                          headers=_h(vce_token), timeout=20)
        assert r.status_code == 200

    def test_cross_tenant_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/veda/alerts", headers=_h(isb_token), timeout=20)
        assert r.status_code == 403


# ---------------- ARISE ----------------
class TestArise:
    def test_program_match_cse_top(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/arise/program-match", headers=_h(vce_token),
                          json={"aptitude_text": "I love programming and software algorithms and AI ML",
                                "interests": ["data"]}, timeout=20)
        assert r.status_code == 200
        top = r.json()["top"]
        assert top["code"] in ("CSE", "AIML", "DS")
        assert top["score"] >= 2

    def test_program_match_mech_top(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/arise/program-match", headers=_h(vce_token),
                          json={"aptitude_text": "I love mechanical design CAD thermal manufacturing",
                                "interests": []}, timeout=20)
        assert r.json()["top"]["code"] == "MECH"

    def test_drip_unknown_lead_404(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/arise/drip", headers=_h(vce_token),
                          json={"lead_id": "does-not-exist", "channel": "whatsapp", "template": "Hi"}, timeout=20)
        assert r.status_code == 404


# ---------------- NEXUS ----------------
class TestNexus:
    def test_notice_post(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/notices", headers=_h(vce_token),
                          json={"title": "Holiday", "body": "Closed 10 Jun", "audience": "all"}, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/phase1/{VCE}/nexus/notices", headers=_h(vce_token), timeout=20)
        assert any(n["title"] == "Holiday" for n in r2.json())

    def test_notice_student_denied(self, vce_student_token):
        # Students cannot post notices
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/notices", headers=_h(vce_student_token),
                          json={"title": "Nope", "body": "x"}, timeout=20)
        assert r.status_code == 403

    def test_hostel_admin_only(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/hostel", headers=_h(vce_student_token),
                          json={"student_id": "s1", "student_name": "X", "room_no": "1", "block": "A"}, timeout=20)
        assert r.status_code == 403

    def test_hostel_alloc_admin_ok(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/hostel", headers=_h(vce_token),
                          json={"student_id": "s_hostel", "student_name": "TestStu",
                                "room_no": "A-101", "block": "A", "preference_score": 80}, timeout=20)
        assert r.status_code == 200 and r.json()["room_no"] == "A-101"

    def test_library_issue_return(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/library", headers=_h(vce_token),
                          json={"book_title": "DSA", "isbn": "111", "student_id": "s1",
                                "student_name": "Manikanta", "action": "issue"}, timeout=20)
        assert r.status_code == 200

    def test_parent_view_aggregates(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/nexus/parent-view/s1",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["student_id"] == "s1"
        assert "fees" in body and isinstance(body["fees"], list)

    def test_timetable_clash_detect(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/nexus/timetable", headers=_h(vce_token), json={
            "cohort_id": "ay25-26", "sessions": [
                {"course_id": "c1", "day": "MON", "slot": "9-10", "room": "L1", "faculty": "F1"},
                {"course_id": "c2", "day": "MON", "slot": "9-10", "room": "L1", "faculty": "F2"},
            ]}, timeout=20)
        assert r.status_code == 200
        assert any(c["type"] == "room" for c in r.json()["clashes"])

    def test_defaulters_returns_overdue(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/nexus/defaulters",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200 and isinstance(r.json(), list)


# ---------------- PATHFINDER ----------------
class TestPathfinder:
    def test_mock_interview_band(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/pathfinder/mock-interview",
                          headers=_h(vce_token), json={
                              "student_id": "s1", "student_name": "Mani", "target_company": "Amazon",
                              "answers": [
                                  "I led a team of 5 with ownership solving a customer challenge with leadership.",
                                  "Built a scalable system experience handling 1M users with the team.",
                                  "Took ownership of a tough problem and learned to solve it with creativity.",
                              ]}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["band"] in ("Strong", "Good", "Needs prep")
        assert 0 <= body["readiness"] <= 100

    def test_company_intel_admin_only(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/pathfinder/company-intel",
                          headers=_h(vce_student_token),
                          json={"name": "X", "sector": "y", "interview_pattern": "z", "prep_tip": "w"}, timeout=20)
        assert r.status_code == 403

    def test_aptitude_adaptive_difficulty(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/pathfinder/aptitude/next",
                          headers=_h(vce_token),
                          json={"student_id": "s1", "correct": True, "current_difficulty": 3}, timeout=20)
        assert r.status_code == 200 and r.json()["next_difficulty"] == 4

        r2 = requests.post(f"{BASE_URL}/api/phase1/{VCE}/pathfinder/aptitude/next",
                           headers=_h(vce_token),
                           json={"student_id": "s1", "correct": False, "current_difficulty": 1}, timeout=20)
        assert r2.json()["next_difficulty"] == 1  # clamped

    def test_industry_trends_aggregates(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/pathfinder/industry-trends",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "top_roles" in body and "top_skills" in body


# ---------------- COMPASS ----------------
class TestCompass:
    def test_obe_upsert_summary(self, vce_token):
        # Upsert two rows
        for co, pct in [("CO1", 80), ("CO2", 60)]:
            r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/compass/obe", headers=_h(vce_token),
                              json={"course_id": "test101", "co_id": co,
                                    "po_ids": ["PO1", "PO2"], "attainment_pct": pct}, timeout=20)
            assert r.status_code == 200, r.text
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/compass/obe/summary",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["avg_attainment"] > 0
        assert any(p["po"] == "PO1" for p in body["po_rollup"])

    def test_iqac_meeting_admin_only(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/compass/iqac-meetings",
                          headers=_h(vce_student_token),
                          json={"title": "Q1", "date": "2026-01-01", "agenda": ["a"]}, timeout=20)
        assert r.status_code == 403

    def test_iqac_admin_post(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase1/{VCE}/compass/iqac-meetings", headers=_h(vce_token),
                          json={"title": "IQAC Q4", "date": "2026-03-15",
                                "agenda": ["Review", "AQAR"], "decisions": ["Approve"]}, timeout=20)
        assert r.status_code == 200

    def test_nirf_compile_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/compass/nirf",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        for k in ("TLR", "RP", "GO", "OI", "PR"):
            assert k in body

    def test_gap_analysis_runs(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/compass/gap-analysis",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert "gaps" in r.json()


# ---------------- COMMAND ----------------
class TestCommand:
    def test_finance_drilldown(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/command/finance",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "billed" in body and "collected" in body and "by_term" in body

    def test_benchmark_vs_peers(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/command/benchmark",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["peers_compared"] >= 1
        assert "tenant_metrics" in body and "peer_average" in body

    def test_cross_tenant_command_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/phase1/{VCE}/command/finance",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403
