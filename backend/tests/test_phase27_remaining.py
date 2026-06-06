"""
Phase 27 — bulk closeout tests across 9 platforms.
Coverage: each platform's 2-3 new endpoints + role gating + cross-tenant.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
VCE = "44444444-4444-4444-4444-444444444444"


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


def _h(t):
    return {"Authorization": f"Bearer {t}"}


class TestPathfinder:
    def test_skill_gap(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/pathfinder/skill-gap",
                          headers=_h(vce_token), json={
                              "student_skills": ["python", "java", "aws"],
                              "target_role": "swe",
                          }, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["target_role"] == "swe"
        assert "covered" in b and "missing" in b
        assert b["readiness_band"] in ("ready", "near", "gap")

    def test_skill_gap_bad_role_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/pathfinder/skill-gap",
                          headers=_h(vce_token), json={
                              "student_skills": [], "target_role": "astronaut",
                          }, timeout=20)
        assert r.status_code == 422

    def test_resume_parse_extracts(self, vce_token):
        resume = """Mani Kumar — Bangalore
        Email: mani@example.com  Phone: +91 9876543210
        SKILLS: Python, Java, AWS, Docker, SQL
        Experience 2019-2024
        """
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/pathfinder/resume-parse",
                          headers=_h(vce_token), json={
                              "student_id": "s_parse",
                              "student_name": "Mani Kumar",
                              "resume_text": resume,
                          }, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert "mani@example.com" in b["emails"]
        assert len(b["skills"]) >= 3
        assert b["years_experience_estimate"] >= 4

    def test_salary_benchmarks_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/pathfinder/salary-benchmarks",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert "by_branch" in r.json()


class TestCompass:
    def test_timeline(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/compass/accreditation-timeline",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert len(b["items"]) >= 4
        for it in b["items"]:
            assert it["band"] in ("overdue", "urgent", "soon", "later")

    def test_ssr_compose(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/compass/ssr-compose",
                          headers=_h(vce_token), json={
                              "cycle": "A++",
                              "section": "research_innovations",
                          }, timeout=90)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["narrative"]
        assert b["baseline"]["students"] > 0


class TestCommand:
    def test_kpi_stream(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/command/kpi-stream",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        b = r.json()
        for k in ("students", "leads_total", "publications", "alumni",
                   "grievances_open", "incidents_open"):
            assert k in b

    def test_board_deck(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/command/board-deck",
                          headers=_h(vce_token), json={
                              "quarter": "Q4 2026", "audience": "board",
                          }, timeout=90)
        assert r.status_code == 200
        b = r.json()
        assert b["slides"] and len(b["slides"]) >= 3


class TestIlluminate:
    def test_moderate_ok(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/illuminate/moderate",
                          headers=_h(vce_token),
                          json={"message": "great lecture today"}, timeout=20)
        assert r.status_code == 200 and r.json()["decision"] == "ok"

    def test_moderate_review(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/illuminate/moderate",
                          headers=_h(vce_token),
                          json={"message": "share answer to question 5"}, timeout=20)
        assert r.json()["decision"] == "review"
        assert "academic_integrity" in r.json()["categories_hit"]

    def test_moderate_block(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/illuminate/moderate",
                          headers=_h(vce_token),
                          json={"message": "go die, loser"}, timeout=20)
        assert r.json()["decision"] == "block"

    def test_learning_path(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/illuminate/learning-path",
                          headers=_h(vce_token), json={
                              "student_id": "s_lp",
                              "target_topic": "linear regression",
                              "current_level": "beginner",
                          }, timeout=20)
        assert r.status_code == 200
        assert len(r.json()["steps"]) == 3


class TestPrism:
    def test_h_index_zero(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/prism/h-index/totally_unknown_author_xyz",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["h_index"] == 0

    def test_grant_log_pipeline(self, vce_token):
        suffix = uuid.uuid4().hex[:6]
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/prism/grants",
                          headers=_h(vce_token), json={
                              "faculty_id": "f1",
                              "title": f"DST grant {suffix}",
                              "agency": "DST", "amount_lakhs": 15,
                              "status": "awarded",
                          }, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/closeout/{VCE}/prism/grants/pipeline",
                          headers=_h(vce_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["awarded_amount_lakhs"] >= 15


class TestAlumni:
    def test_mentor_match(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/alumni/mentor-match",
                          headers=_h(vce_token), json={
                              "student_id": "s_match",
                              "interests": ["python", "ai"],
                              "target_industry": "tech",
                          }, timeout=20)
        assert r.status_code == 200
        assert "matches" in r.json()

    def test_giving_log_summary(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/alumni/giving",
                          headers=_h(vce_token), json={
                              "alumni_id": "al-test", "alumni_name": "T Donor",
                              "amount_inr": 25000, "purpose": "research",
                          }, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/closeout/{VCE}/alumni/giving/summary",
                          headers=_h(vce_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["total_donations"] >= 1


class TestFaculty:
    def test_fdp_log(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/faculty/fdp",
                          headers=_h(vce_token), json={
                              "title": "ML Workshop", "faculty_id": "f1",
                              "faculty_name": "Dr A", "organiser": "IIT-H",
                              "hours": 40, "started_at": "2026-01-15",
                          }, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/closeout/{VCE}/faculty/fdp/summary",
                          headers=_h(vce_token), timeout=20)
        assert r2.json()["total_events"] >= 1

    def test_appraisal_composite(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/faculty/appraisal",
                          headers=_h(vce_token), json={
                              "faculty_id": "f1", "faculty_name": "Dr A",
                              "period": "2025-26", "teaching_score": 9,
                              "research_score": 7, "service_score": 8,
                          }, timeout=20)
        assert r.status_code == 200
        assert abs(r.json()["composite"] - 8.0) < 0.01


class TestGuardian:
    def test_drill_score(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/guardian/drill",
                          headers=_h(vce_token), json={
                              "drill_type": "fire", "location": "Main",
                              "participants": 400, "evac_time_seconds": 90,
                              "issues_found": [],
                          }, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["readiness_score"] > 60
        assert b["band"] in ("excellent", "good")

    def test_drill_bad_type_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/closeout/{VCE}/guardian/drill",
                          headers=_h(vce_token), json={
                              "drill_type": "alien", "location": "x",
                              "participants": 1, "evac_time_seconds": 1,
                          }, timeout=20)
        assert r.status_code == 422

    def test_incident_dashboard(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/guardian/incident-dashboard",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert "total" in r.json()


class TestGreeniq:
    def test_carbon_footprint(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/greeniq/carbon-footprint",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        b = r.json()
        for k in ("grid_kwh", "solar_kwh", "emissions_kg_co2e",
                  "offset_kg_co2e", "net_kg_co2e"):
            assert k in b

    def test_esg_composite(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/greeniq/esg-composite",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        b = r.json()
        for k in ("E_environment", "S_social", "G_governance", "composite"):
            assert 0 <= b[k] <= 100
        assert b["band"] in ("leader", "average", "lagging")


class TestCrossTenant:
    def test_cross_tenant_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/closeout/{VCE}/command/kpi-stream",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403
