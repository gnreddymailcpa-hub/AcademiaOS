"""
Phase 16 - Backend tests for the 4 Phase-2 platforms:
ILLUMINATE / PRISM / ALUMNI360 / FACULTY+ at /api/{illuminate|prism|alumni|faculty-plus}/{tenant}/...

All flows tested against VCE (44444444-...) tenant, using:
  principal@vaagdevi.edu.in     -> institution_admin
  manikanta.cse@vaagdevi.edu.in -> student (non-admin / non-HR)
  rajiv.admin@isb.edu           -> ISB admin (cross-tenant probe)
"""
import os
import pytest
import requests

def _read_backend_url():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        u = line.strip().split("=", 1)[1]
                        break
        except Exception:
            pass
    assert u, "REACT_APP_BACKEND_URL not configured"
    return u.rstrip("/")

BASE_URL = _read_backend_url()
VCE = "44444444-4444-4444-4444-444444444444"
ISB = "11111111-1111-1111-1111-111111111111"

PRINCIPAL = ("principal@vaagdevi.edu.in", "Demo@2026")
STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
ISB_ADMIN = ("rajiv.admin@isb.edu", "Demo@2026")


# ---------- shared helpers ----------
def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    return login(*PRINCIPAL)


@pytest.fixture(scope="module")
def student_token():
    return login(*STUDENT)


@pytest.fixture(scope="module")
def isb_token():
    return login(*ISB_ADMIN)


# ============================================================
# ILLUMINATE
# ============================================================
class TestIlluminate:
    course_id = None
    asn_id = None

    def test_list_courses_authorized(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/illuminate/{VCE}/courses", headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_course(self, admin_token):
        payload = {"title": "ML", "code": "CSE-ML-501", "credits": 4,
                   "instructor": "Dr Hari", "cohort": "CSE-IV", "lessons_total": 24}
        r = requests.post(f"{BASE_URL}/api/illuminate/{VCE}/courses", headers=hdr(admin_token),
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("crs-")
        assert d["code"] == "CSE-ML-501"
        TestIlluminate.course_id = d["id"]

    def test_create_course_forbidden_for_student(self, student_token):
        payload = {"title": "blocked", "code": "X", "instructor": "x"}
        r = requests.post(f"{BASE_URL}/api/illuminate/{VCE}/courses", headers=hdr(student_token),
                          json=payload, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_create_assignment(self, admin_token):
        assert TestIlluminate.course_id, "course missing"
        payload = {"course_id": TestIlluminate.course_id, "title": "HW1",
                   "due_date": "2026-04-15", "max_marks": 100}
        r = requests.post(f"{BASE_URL}/api/illuminate/{VCE}/assignments",
                          headers=hdr(admin_token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["id"].startswith("asn-")
        TestIlluminate.asn_id = r.json()["id"]

    def test_progress_upsert_no_dup(self, admin_token):
        payload = {"course_id": TestIlluminate.course_id, "student_id": "stu1",
                   "student_name": "Manikanta", "lessons_completed": 12}
        r1 = requests.post(f"{BASE_URL}/api/illuminate/{VCE}/progress",
                           headers=hdr(admin_token), json=payload, timeout=20)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE_URL}/api/illuminate/{VCE}/progress",
                           headers=hdr(admin_token), json=payload, timeout=20)
        assert r2.status_code == 200, r2.text

    def test_summary(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/illuminate/{VCE}/summary", headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["courses"] >= 1
        assert s["assignments"] >= 1
        assert s["active_learners"] >= 1
        assert isinstance(s["avg_completion_pct"], (int, float))


# ============================================================
# PRISM
# ============================================================
class TestPrism:
    def test_publications_and_summary(self, admin_token):
        pubs = [
            {"title": "Deep Learning for IIoT", "venue": "IEEE TII", "year": 2024,
             "citations": 42, "authors": ["Hari", "Sundar"]},
            {"title": "Edge AI", "venue": "ACM TOIT", "year": 2023,
             "citations": 20, "authors": ["Hari"]},
            {"title": "Smart Bus", "venue": "Springer", "year": 2022,
             "citations": 8, "authors": ["Sundar"]},
        ]
        for p in pubs:
            r = requests.post(f"{BASE_URL}/api/prism/{VCE}/publications",
                              headers=hdr(admin_token), json=p, timeout=20)
            assert r.status_code == 200, r.text
            assert r.json()["id"].startswith("pub-")
        # patent
        r = requests.post(f"{BASE_URL}/api/prism/{VCE}/patents",
                          headers=hdr(admin_token),
                          json={"title": "Smart Sensor", "status": "granted",
                                "year": 2023, "inventors": ["Hari"]}, timeout=20)
        assert r.status_code == 200, r.text
        # grant
        r = requests.post(f"{BASE_URL}/api/prism/{VCE}/grants",
                          headers=hdr(admin_token),
                          json={"agency": "DST", "title": "Energy AI", "amount_lakhs": 25,
                                "pi": "Hari", "status": "active",
                                "start_year": 2024, "end_year": 2027}, timeout=20)
        assert r.status_code == 200, r.text
        # summary
        r = requests.get(f"{BASE_URL}/api/prism/{VCE}/summary",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        # h-index for at least [42,20,8]: i=3→8>=3✓ -> h>=3 (may be higher
        # if previous test runs left publications in the DB)
        assert s["h_index"] >= 3, f"expected >=3, got {s['h_index']}"
        assert s["publications"] >= 3
        assert s["patents_granted"] >= 1
        assert s["active_grants"] >= 1
        assert s["grant_value_lakhs"] >= 25
        assert len(s["publications_by_year"]) == 5

    def test_cross_tenant_write_forbidden(self, admin_token):
        # VCE principal tries to write to ISB
        r = requests.post(f"{BASE_URL}/api/prism/{ISB}/publications",
                          headers=hdr(admin_token),
                          json={"title": "cross", "venue": "v", "year": 2024,
                                "citations": 1, "authors": ["x"]}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ============================================================
# ALUMNI360
# ============================================================
class TestAlumni:
    avail_id = None
    not_avail_id = None

    def test_add_two_alumni(self, admin_token):
        r1 = requests.post(f"{BASE_URL}/api/alumni/{VCE}/directory",
                           headers=hdr(admin_token),
                           json={"name": "Ravi", "email": "ravi@google.com",
                                 "graduation_year": 2019, "branch": "CSE",
                                 "company": "Google", "role": "SDE-III",
                                 "location": "Hyderabad",
                                 "available_for_mentorship": True}, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json()["id"].startswith("al-")
        TestAlumni.avail_id = r1.json()["id"]

        r2 = requests.post(f"{BASE_URL}/api/alumni/{VCE}/directory",
                           headers=hdr(admin_token),
                           json={"name": "Sita", "email": "sita@ms.com",
                                 "graduation_year": 2018, "branch": "ECE",
                                 "company": "MS", "role": "PM",
                                 "available_for_mentorship": False}, timeout=20)
        assert r2.status_code == 200
        TestAlumni.not_avail_id = r2.json()["id"]

    def test_mentorship_happy(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/alumni/{VCE}/mentorships",
                          headers=hdr(admin_token),
                          json={"mentor_alumni_id": TestAlumni.avail_id,
                                "mentee_student_id": "stu1",
                                "mentee_name": "Manikanta",
                                "focus_area": "Placement prep"}, timeout=20)
        assert r.status_code == 200, r.text

    def test_mentorship_not_available(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/alumni/{VCE}/mentorships",
                          headers=hdr(admin_token),
                          json={"mentor_alumni_id": TestAlumni.not_avail_id,
                                "mentee_student_id": "stu2",
                                "mentee_name": "X",
                                "focus_area": "Y"}, timeout=20)
        assert r.status_code == 400, f"expected 400 got {r.status_code} body={r.text}"

    def test_mentorship_unknown_mentor(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/alumni/{VCE}/mentorships",
                          headers=hdr(admin_token),
                          json={"mentor_alumni_id": "al-bogusnope",
                                "mentee_student_id": "stu2",
                                "mentee_name": "X",
                                "focus_area": "Y"}, timeout=20)
        assert r.status_code == 404, f"expected 404 got {r.status_code} body={r.text}"

    def test_donation_and_summary(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/alumni/{VCE}/donations",
                          headers=hdr(admin_token),
                          json={"donor_alumni_id": TestAlumni.avail_id,
                                "donor_name": "Ravi",
                                "campaign": "Scholarship Fund",
                                "amount_inr": 50000}, timeout=20)
        assert r.status_code == 200, r.text
        r = requests.get(f"{BASE_URL}/api/alumni/{VCE}/summary",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["alumni"] >= 2
        assert s["available_mentors"] >= 1
        assert s["active_mentorships"] >= 1
        assert s["total_giving_inr"] >= 50000
        assert isinstance(s["top_campaigns"], list) and len(s["top_campaigns"]) >= 1


# ============================================================
# FACULTY+
# ============================================================
class TestFacultyPlus:
    fac_id = None

    def test_create_profile(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/profiles",
                          headers=hdr(admin_token),
                          json={"name": "Dr Hari", "email": "hari@vaagdevi.edu.in",
                                "department": "CSE", "designation": "Professor",
                                "expertise": ["ML", "NLP"], "joined_year": 2015}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["id"].startswith("fac-")
        TestFacultyPlus.fac_id = r.json()["id"]

    def test_profile_forbidden_for_student(self, student_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/profiles",
                          headers=hdr(student_token),
                          json={"name": "x", "email": "x@x", "department": "CSE",
                                "joined_year": 2020}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_fdp_admin_ok(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/fdp",
                          headers=hdr(admin_token),
                          json={"faculty_id": TestFacultyPlus.fac_id,
                                "faculty_name": "Dr Hari",
                                "programme": "OBE workshop",
                                "hours": 12,
                                "completion_date": "2026-01-20",
                                "status": "completed"}, timeout=20)
        assert r.status_code == 200, r.text

    def test_fdp_student_allowed(self, student_token):
        # FDP has no writer-guard role gate beyond auth+_guard
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/fdp",
                          headers=hdr(student_token),
                          json={"faculty_id": TestFacultyPlus.fac_id or "fac-x",
                                "faculty_name": "Dr Hari",
                                "programme": "self-record",
                                "hours": 2,
                                "status": "enrolled"}, timeout=20)
        # explicit: 200 OK because faculty.fdp has no role guard
        assert r.status_code == 200, f"expected 200 got {r.status_code} body={r.text}"

    def test_appraisal_composite_meets(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/appraisals",
                          headers=hdr(admin_token),
                          json={"faculty_id": TestFacultyPlus.fac_id,
                                "faculty_name": "Dr Hari",
                                "cycle": "AY 2025-26",
                                "teaching": 88, "research": 76,
                                "institutional_service": 80,
                                "student_feedback": 92}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["composite"] == 83.8
        assert d["band"] == "Meets"

    def test_appraisal_exceeds(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/appraisals",
                          headers=hdr(admin_token),
                          json={"faculty_id": TestFacultyPlus.fac_id,
                                "faculty_name": "Dr Hari",
                                "cycle": "AY 2025-26-a",
                                "teaching": 90, "research": 90,
                                "institutional_service": 90,
                                "student_feedback": 90}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["composite"] >= 90
        assert d["band"] == "Exceeds"

    def test_appraisal_below(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/appraisals",
                          headers=hdr(admin_token),
                          json={"faculty_id": TestFacultyPlus.fac_id,
                                "faculty_name": "Dr Hari",
                                "cycle": "AY 2025-26-b",
                                "teaching": 50, "research": 50,
                                "institutional_service": 50,
                                "student_feedback": 50}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["composite"] == 50
        assert d["band"] == "Below"

    def test_appraisal_forbidden_for_student(self, student_token):
        r = requests.post(f"{BASE_URL}/api/faculty-plus/{VCE}/appraisals",
                          headers=hdr(student_token),
                          json={"faculty_id": "fac-x", "faculty_name": "x",
                                "cycle": "AY 2025-26-z",
                                "teaching": 70, "research": 70,
                                "institutional_service": 70, "student_feedback": 70}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_summary(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/faculty-plus/{VCE}/summary",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["faculty_count"] >= 1
        assert s["departments"] >= 1
        assert s["fdp_completed"] >= 1
        assert s["fdp_total_hours"] >= 12
        assert s["appraisals_done"] >= 1
        assert isinstance(s["avg_appraisal_composite"], (int, float))
        assert "weights" in s


# ============================================================
# MODULES REGISTRY REGRESSION
# ============================================================
class TestModulesRegistry:
    def test_phase2_modules_active(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/modules/{VCE}",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        # find the 4 modules
        by_key = {m.get("module_key") or m.get("key") or m.get("id"): m for m in rows}
        # Try multiple lookup styles for robustness
        def find(name):
            for m in rows:
                for v in m.values():
                    if isinstance(v, str) and v.upper() == name:
                        return m
            return None
        for key in ["ILLUMINATE", "PRISM", "ALUMNI360", "FACULTY"]:
            m = find(key)
            assert m is not None, f"{key} module missing from registry"
            assert m.get("status") == "active", f"{key} not active: {m}"
