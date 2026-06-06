"""
Phase 14 — ARISE persistence + NEXUS + COMPASS + PATHFINDER + COMMAND.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
VCE = "44444444-4444-4444-4444-444444444444"
ISB = "11111111-1111-1111-1111-111111111111"


def _login(email, password="Demo@2026"):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def principal_token():
    return _login("principal@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def student_token():
    return _login("manikanta.cse@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def isb_admin_token():
    return _login("rajiv.admin@isb.edu")


def H(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ------------------ ARISE ------------------
class TestArise:
    def test_create_lead(self, principal_token):
        body = {
            "name": "Phase1 Test", "phone": "+91 99999 22222",
            "preferred_branch": "AIML", "eapcet_rank": 8200,
            "source": "EAPCET counselling",
        }
        r = requests.post(f"{BASE_URL}/api/admissions/{VCE}/leads", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"].startswith("ld-")
        assert data["score"] >= 80, f"score={data['score']}"
        pytest.shared_lead_id = data["id"]

    def test_list_leads_summary(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/admissions/{VCE}/leads", headers=H(principal_token))
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert any(x["id"] == pytest.shared_lead_id for x in rows)
        s = requests.get(f"{BASE_URL}/api/admissions/{VCE}/summary", headers=H(principal_token))
        assert s.status_code == 200
        sd = s.json()
        assert sd["total"] >= 1 and sd["avg_score"] > 0

    def test_patch_lead_and_cross_tenant(self, principal_token):
        r = requests.patch(
            f"{BASE_URL}/api/admissions/{VCE}/leads/{pytest.shared_lead_id}",
            json={"stage": "counseled"}, headers=H(principal_token),
        )
        assert r.status_code == 200 and r.json()["stage"] == "counseled"
        # Cross-tenant write
        x = requests.post(
            f"{BASE_URL}/api/admissions/{ISB}/leads",
            json={"name": "X", "phone": "+1", "preferred_branch": "CSE"},
            headers=H(principal_token),
        )
        assert x.status_code == 403


# ------------------ NEXUS ------------------
class TestNexus:
    def test_attendance(self, principal_token):
        body = {
            "cohort_id": "cohort-vce-cse-25", "course_id": "course-cse-ml",
            "date": "2026-01-20",
            "entries": [{"student_id": "s1", "status": "present"},
                        {"student_id": "s2", "status": "absent"}],
        }
        r = requests.post(f"{BASE_URL}/api/nexus/{VCE}/attendance", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        assert r.json()["id"].startswith("att-")
        g = requests.get(f"{BASE_URL}/api/nexus/{VCE}/attendance", headers=H(principal_token))
        assert g.status_code == 200
        assert isinstance(g.json()["summary"]["pct"], (int, float))

    def test_fees(self, principal_token, student_token):
        body = {"student_id": "s1", "student_name": "Mani", "term": "AY 2025-26 Sem 1",
                "amount": 85000, "due_date": "2026-03-15"}
        r = requests.post(f"{BASE_URL}/api/nexus/{VCE}/fees", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        p = requests.post(f"{BASE_URL}/api/nexus/{VCE}/fees/{fid}/pay",
                          json={"amount": 85000, "method": "online"}, headers=H(principal_token))
        assert p.status_code == 200 and p.json()["status"] == "paid"
        g = requests.get(f"{BASE_URL}/api/nexus/{VCE}/fees", headers=H(principal_token))
        assert g.status_code == 200
        assert g.json()["summary"]["collection_pct"] > 0
        # non-admin write
        ns = requests.post(f"{BASE_URL}/api/nexus/{VCE}/fees", json=body, headers=H(student_token))
        assert ns.status_code == 403

    def test_certificates_public_verify(self, principal_token):
        body = {"student_id": "s1", "student_name": "Manikanta",
                "cert_type": "bonafide", "purpose": "Higher studies"}
        r = requests.post(f"{BASE_URL}/api/nexus/{VCE}/certificates", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        vcode = r.json()["verify_code"]
        v = requests.get(f"{BASE_URL}/api/nexus/verify/{vcode}")  # no auth
        assert v.status_code == 200 and v.json()["valid"] is True


# ------------------ COMPASS ------------------
class TestCompass:
    def test_preview(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/compass/{VCE}/aqar/preview", headers=H(principal_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["criteria"]) == 7
        assert isinstance(d["computed_score"], (int, float))
        assert d["projected_grade"] in ("A++", "A+", "A", "B+")

    def test_freeze_and_history(self, principal_token):
        f = requests.post(f"{BASE_URL}/api/compass/{VCE}/aqar/freeze", headers=H(principal_token))
        assert f.status_code == 200, f.text
        assert f.json()["id"].startswith("aqar-")
        h = requests.get(f"{BASE_URL}/api/compass/{VCE}/aqar/history", headers=H(principal_token))
        assert h.status_code == 200 and len(h.json()) >= 1


# ------------------ PATHFINDER ------------------
class TestPathfinder:
    def test_drives_and_apply(self, principal_token):
        body = {"company": "Microsoft", "role": "SDE", "package_lpa": 18,
                "eligibility_branches": ["CSE", "AIML"], "eligibility_cgpa": 7.5,
                "scheduled_date": "2026-04-10"}
        r = requests.post(f"{BASE_URL}/api/placements/{VCE}/drives", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        assert did.startswith("drv-")
        ok = requests.post(f"{BASE_URL}/api/placements/{VCE}/drives/{did}/apply",
                           json={"student_id": "stu1", "student_name": "M", "branch": "CSE", "cgpa": 8.0},
                           headers=H(principal_token))
        assert ok.status_code == 200
        bad = requests.post(f"{BASE_URL}/api/placements/{VCE}/drives/{did}/apply",
                            json={"student_id": "stu2", "student_name": "N", "branch": "ECE", "cgpa": 8.0},
                            headers=H(principal_token))
        assert bad.status_code == 400
        s = requests.get(f"{BASE_URL}/api/placements/{VCE}/summary", headers=H(principal_token))
        assert s.status_code == 200 and s.json()["total_drives"] >= 1

    def test_resume_score(self, principal_token):
        body = {"student_name": "Mani", "skills": ["python", "aws", "system design", "docker"],
                "projects": 3, "internships": 1, "cgpa": 8.7}
        r = requests.post(f"{BASE_URL}/api/placements/{VCE}/resume-score", json=body, headers=H(principal_token))
        assert r.status_code == 200, r.text
        res = r.json()["result"]
        assert res["total"] >= 70
        assert res["band"] == "Strong"
        assert isinstance(res["suggestions"], list) and len(res["suggestions"]) >= 1


# ------------------ COMMAND ------------------
class TestCommand:
    def test_forecast(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/command/{VCE}/forecast", headers=H(principal_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["history"]) == 5
        assert len(d["forecast"]) == 3
        assert d["trend"] in ("growth", "decline", "flat")

    def test_anomalies(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/command/{VCE}/anomalies", headers=H(principal_token))
        assert r.status_code == 200
        d = r.json()
        assert "alerts" in d and len(d["alerts"]) >= 1
        assert "high_count" in d and "medium_count" in d

    def test_readiness(self, principal_token):
        r = requests.get(f"{BASE_URL}/api/command/{VCE}/readiness", headers=H(principal_token))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["composite"], (int, float))
        assert d["grade"] in ("A++", "A+", "A", "B+")
        assert len(d["dimensions"]) == 5


# ------------------ Cross-tenant security ------------------
class TestSecurity:
    def test_cross_tenant_blocked(self, principal_token):
        # VCE principal hitting ISB — should be 403 across all routers
        for url in [
            f"{BASE_URL}/api/admissions/{ISB}/summary",
            f"{BASE_URL}/api/nexus/{ISB}/attendance",
            f"{BASE_URL}/api/compass/{ISB}/aqar/preview",
            f"{BASE_URL}/api/placements/{ISB}/summary",
            f"{BASE_URL}/api/command/{ISB}/forecast",
        ]:
            r = requests.get(url, headers=H(principal_token))
            assert r.status_code == 403, f"{url} returned {r.status_code}"
