"""Phase 35 — Claros Launch (Career & Placement Intelligence) backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
TIMEOUT = 60

VCE_IID = "44444444-4444-4444-4444-444444444444"
ISB_IID = "11111111-1111-1111-1111-111111111111"
EAIC_IID = "22222222-2222-2222-2222-222222222222"
UOB_IID = "33333333-3333-3333-3333-333333333333"


def _login(email: str, password: str = "Demo@2026") -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=TIMEOUT)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def student_token():
    return _login("manikanta.cse@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def principal_token():
    return _login("principal@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def isb_dean_token():
    return _login("shankar.dean@isb.edu")


@pytest.fixture(scope="module")
def eaic_token():
    return _login("khalid.exec@eaic.gov.ae")


@pytest.fixture(scope="module")
def uob_token():
    return _login("emma.admin@bradford.ac.uk")


# ---------------- COMPANIES ----------------
class TestCompanies:
    def test_list_companies_vce(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/companies", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 15, f"expected 15 companies for VCE, got {len(items)}"

    def test_get_company_detail(self, student_token):
        items = requests.get(f"{BASE_URL}/api/v1/launch/companies", headers=_h(student_token), timeout=TIMEOUT).json()["items"]
        cid = items[0]["id"]
        r = requests.get(f"{BASE_URL}/api/v1/launch/companies/{cid}", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "company" in d and "drives" in d
        assert d["company"]["id"] == cid


# ---------------- DRIVES ----------------
class TestDrives:
    def test_list_drives_vce_has_8(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 8, f"expected 8 drives for VCE, got {len(items)}"
        for d in items:
            assert "company_name" in d
            assert "industry" in d

    def test_drive_eligibility(self, student_token):
        items = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(student_token), timeout=TIMEOUT).json()["items"]
        did = items[0]["id"]
        r = requests.get(f"{BASE_URL}/api/v1/launch/drives/{did}/eligible", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "eligible" in d and "reasons" in d
        assert isinstance(d["eligible"], bool)

    def test_apply_to_drive(self, student_token):
        items = requests.get(f"{BASE_URL}/api/v1/launch/drives?status=UPCOMING", headers=_h(student_token), timeout=TIMEOUT).json()["items"]
        # pick an eligible upcoming
        target = None
        for it in items:
            r = requests.get(f"{BASE_URL}/api/v1/launch/drives/{it['id']}/eligible", headers=_h(student_token), timeout=TIMEOUT)
            if r.status_code == 200 and r.json()["eligible"]:
                target = it
                break
        if not target:
            pytest.skip("No eligible upcoming drive for student")
        r = requests.post(f"{BASE_URL}/api/v1/launch/drives/{target['id']}/apply", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        app1 = r.json()
        assert app1.get("status") in {"APPLIED", "SHORTLISTED", "TEST_CLEARED", "INTERVIEW_CLEARED", "SELECTED", "REJECTED", "WITHDRAWN"}
        # idempotent — applying again returns same row
        r2 = requests.post(f"{BASE_URL}/api/v1/launch/drives/{target['id']}/apply", headers=_h(student_token), timeout=TIMEOUT)
        assert r2.status_code == 200
        assert r2.json()["id"] == app1["id"]

    def test_apply_as_non_student_forbidden(self, principal_token):
        items = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(principal_token), timeout=TIMEOUT).json()["items"]
        if not items:
            pytest.skip("no drives")
        did = items[0]["id"]
        r = requests.post(f"{BASE_URL}/api/v1/launch/drives/{did}/apply", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_my_applications(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/applications/me", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        for a in items:
            assert "drive" in a
            assert "company_name" in a


# ---------------- SKILLS ----------------
class TestSkills:
    def test_seeded_skills(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/skills/me", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 5, f"expected ≥5 seeded skills, got {len(items)}"

    def test_create_and_delete_skill(self, student_token):
        body = {"skill_name": "TEST_React", "category": "PROGRAMMING", "proficiency_level": 4}
        r = requests.post(f"{BASE_URL}/api/v1/launch/skills", headers=_h(student_token), json=body, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        # fetch to find id
        items = requests.get(f"{BASE_URL}/api/v1/launch/skills/me", headers=_h(student_token), timeout=TIMEOUT).json()["items"]
        new = next((s for s in items if s["skill_name"] == "TEST_React"), None)
        assert new is not None
        # delete
        rd = requests.delete(f"{BASE_URL}/api/v1/launch/skills/{new['id']}", headers=_h(student_token), timeout=TIMEOUT)
        assert rd.status_code == 200
        assert rd.json()["ok"] is True

    def test_skills_forbidden_for_non_student(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/skills/me", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_skill_gaps(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/skills/gaps", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "company_skills_sampled" in d
        assert len(d["items"]) <= 5


# ---------------- INTERVIEW ----------------
class TestInterview:
    def test_generate_question(self, student_token):
        body = {"target_role": "Software Engineer", "question_type": "TECHNICAL"}
        r = requests.post(f"{BASE_URL}/api/v1/launch/interview/question", headers=_h(student_token), json=body, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d.get("question")
        assert d.get("target_role") == "Software Engineer"

    def test_evaluate_answer(self, student_token):
        body = {
            "question": "Explain dynamic programming.",
            "answer": "Dynamic programming is solving complex problems by breaking them into overlapping subproblems and storing intermediate results to avoid redundant computation. Examples include fibonacci, knapsack, longest common subsequence.",
            "role": "Software Engineer",
            "company_name": "TCS",
        }
        r = requests.post(f"{BASE_URL}/api/v1/launch/interview/evaluate", headers=_h(student_token), json=body, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert 1 <= int(d.get("ai_score", 0)) <= 10
        assert isinstance(d.get("ai_strengths", []), list)
        assert isinstance(d.get("ai_improvements", []), list)

    def test_history(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/interview/history", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1  # at least the one we just evaluated

    def test_interview_forbidden_for_non_student(self, principal_token):
        r = requests.post(f"{BASE_URL}/api/v1/launch/interview/question",
                          headers=_h(principal_token),
                          json={"target_role": "X", "question_type": "TECHNICAL"}, timeout=TIMEOUT)
        assert r.status_code == 403


# ---------------- READINESS ----------------
class TestReadiness:
    def test_readiness_score(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/readiness-score", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert 0 <= d["score"] <= 100
        b = d["breakdown"]
        assert {"cgpa", "skills", "mock_interview", "applications"} <= set(b.keys())

    def test_readiness_forbidden_for_non_student(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/readiness-score", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 403


# ---------------- ADMIN STATS ----------------
class TestAdminStats:
    def test_stats_for_principal(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/stats", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ("placed_count", "placement_pct", "avg_package", "max_package", "top_recruiters"):
            assert k in d
        assert d["placed_count"] >= 9, f"expected ≥9 placements, got {d['placed_count']}"
        names = {tr["company"] for tr in d["top_recruiters"]}
        assert names, "top_recruiters empty"

    def test_stats_forbidden_for_student(self, student_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/stats", headers=_h(student_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_cross_tenant_blocked(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/launch/companies?iid={ISB_IID}", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 403


# ---------------- MULTI-TENANT ----------------
class TestMultiTenant:
    def test_isb_companies_and_drives(self, isb_dean_token):
        c = requests.get(f"{BASE_URL}/api/v1/launch/companies", headers=_h(isb_dean_token), timeout=TIMEOUT)
        assert c.status_code == 200
        assert len(c.json()["items"]) == 15
        d = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(isb_dean_token), timeout=TIMEOUT)
        assert d.status_code == 200
        assert len(d.json()["items"]) == 8

    def test_eaic_no_drives(self, eaic_token):
        c = requests.get(f"{BASE_URL}/api/v1/launch/companies", headers=_h(eaic_token), timeout=TIMEOUT)
        assert c.status_code == 200
        assert len(c.json()["items"]) == 15
        d = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(eaic_token), timeout=TIMEOUT)
        assert d.status_code == 200
        assert len(d.json()["items"]) == 0

    def test_uob_no_drives(self, uob_token):
        c = requests.get(f"{BASE_URL}/api/v1/launch/companies", headers=_h(uob_token), timeout=TIMEOUT)
        assert c.status_code == 200
        assert len(c.json()["items"]) == 15
        d = requests.get(f"{BASE_URL}/api/v1/launch/drives", headers=_h(uob_token), timeout=TIMEOUT)
        assert d.status_code == 200
        assert len(d.json()["items"]) == 0


# ---------------- REGRESSION ----------------
class TestRegression:
    def test_core_stats(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/core/stats", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200

    def test_enroll_leads(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/enroll/leads", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200

    def test_comply_dashboard(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/comply/dashboard", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200

    def test_legacy_alumni_directory(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/alumni/{VCE_IID}/directory", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200

    def test_legacy_placements_dashboard(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/placements/{VCE_IID}/summary", headers=_h(principal_token), timeout=TIMEOUT)
        assert r.status_code == 200
