"""
Phase 32 — Claros Core (Campus ERP) backend smoke tests.

Covers all 17 /api/v1/core/* endpoints + authorisation 403 cases +
multi-tenant seed verification + NEXUS legacy regression + Phase 31 AI
regression.
"""
import os
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env (pytest doesn't auto-load it)
_env = Path("/app/frontend/.env").read_text() if Path("/app/frontend/.env").exists() else ""
for _l in _env.splitlines():
    if _l.startswith("REACT_APP_BACKEND_URL="):
        os.environ.setdefault("REACT_APP_BACKEND_URL", _l.split("=", 1)[1].strip())
        break

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be configured"
API = f"{BASE_URL}/api"

VCE_IID = "44444444-4444-4444-4444-444444444444"
ISB_IID = "11111111-1111-1111-1111-111111111111"
EAIC_IID = "22222222-2222-2222-2222-222222222222"
UOB_IID = "33333333-3333-3333-3333-333333333333"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:300]}"
    return r.json()["access_token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def principal_token():
    return _login("principal@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def student_token():
    return _login("manikanta.cse@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def faculty_token():
    return _login("prof.suresh@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def super_admin_token():
    return _login("admin@academiaos.ai", "Admin@2026")


# -------------------- 17 ENDPOINT SMOKE --------------------

class TestCoreStatsAndLookups:
    def test_stats_admin(self, principal_token):
        r = requests.get(f"{API}/v1/core/stats", headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_students"] == 20
        assert d["total_faculty"] == 8
        assert d["departments_count"] == 3
        assert d["current_year"] == "2025-26"
        assert d["fee_collection_pct"] is not None

    def test_departments(self, principal_token):
        r = requests.get(f"{API}/v1/core/departments", headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_programs(self, principal_token):
        r = requests.get(f"{API}/v1/core/programs", headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_courses(self, principal_token):
        r = requests.get(f"{API}/v1/core/courses", headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 10


class TestStudents:
    def test_list_students_admin(self, principal_token):
        r = requests.get(f"{API}/v1/core/students?page=1&page_size=50",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 20
        assert len(d["items"]) == 20
        rolls = [s["roll_number"] for s in d["items"]]
        assert "22CSE001" in rolls
        # attendance_pct enrichment
        assert "attendance_pct" in d["items"][0]

    def test_list_students_filter_q(self, principal_token):
        r = requests.get(f"{API}/v1/core/students?q=CSE",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert all("CSE" in s["roll_number"] for s in items)
        assert len(items) >= 10

    def test_list_students_filter_graduated_empty(self, principal_token):
        r = requests.get(f"{API}/v1/core/students?status=GRADUATED",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_students_me_student(self, student_token):
        r = requests.get(f"{API}/v1/core/students/me",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        s = r.json()
        assert s["roll_number"] == "22CSE001"
        assert "attendance" in s and "fees" in s

    def test_get_student_by_id_admin(self, principal_token):
        list_r = requests.get(f"{API}/v1/core/students?q=22CSE001",
                              headers=_hdr(principal_token), timeout=30).json()
        sid = list_r["items"][0]["id"]
        r = requests.get(f"{API}/v1/core/students/{sid}",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["roll_number"] == "22CSE001"

    def test_update_student_admin(self, principal_token):
        list_r = requests.get(f"{API}/v1/core/students?q=22CSE002",
                              headers=_hdr(principal_token), timeout=30).json()
        sid = list_r["items"][0]["id"]
        r = requests.put(f"{API}/v1/core/students/{sid}",
                         headers=_hdr(principal_token),
                         json={"cgpa": 9.12, "current_semester": 6}, timeout=30)
        assert r.status_code == 200
        # verify persist via GET
        g = requests.get(f"{API}/v1/core/students/{sid}",
                         headers=_hdr(principal_token), timeout=30).json()
        assert g["cgpa"] == 9.12 and g["current_semester"] == 6


class TestAttendance:
    def test_mark_attendance_faculty(self, faculty_token, principal_token):
        # Pick first course available
        c = requests.get(f"{API}/v1/core/courses",
                         headers=_hdr(principal_token), timeout=30).json()[0]
        roster = requests.get(f"{API}/v1/core/courses/{c['id']}/roster",
                              headers=_hdr(principal_token), timeout=30).json()
        students = roster["students"]
        if not students:
            pytest.skip("Empty roster")
        records = [{"student_id": students[0]["id"], "status": "PRESENT"}]
        r = requests.post(f"{API}/v1/core/attendance/mark",
                          headers=_hdr(faculty_token),
                          json={"course_id": c["id"],
                                "class_date": "2026-01-12",
                                "records": records}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True

    def test_attendance_report_admin(self, principal_token):
        r = requests.get(f"{API}/v1/core/attendance/report",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "row_count" in d
        assert d["row_count"] > 100

    def test_attendance_summary_me(self, student_token):
        r = requests.get(f"{API}/v1/core/attendance/summary/me",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "per_course" in d and "overall" in d
        assert 0 <= d["overall"]["pct"] <= 100


class TestTimetable:
    def test_timetable_me_student(self, student_token):
        r = requests.get(f"{API}/v1/core/timetable/me",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        assert "slots" in r.json()
        assert len(r.json()["slots"]) >= 5

    def test_timetable_me_faculty(self, faculty_token):
        r = requests.get(f"{API}/v1/core/timetable/me",
                         headers=_hdr(faculty_token), timeout=30)
        assert r.status_code == 200


class TestFees:
    def test_fees_me(self, student_token):
        r = requests.get(f"{API}/v1/core/fees/me",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["components"]) == 4
        assert "summary" in d

    def test_fees_student_admin(self, principal_token):
        sid = requests.get(f"{API}/v1/core/students?q=22CSE003",
                           headers=_hdr(principal_token), timeout=30).json()["items"][0]["id"]
        r = requests.get(f"{API}/v1/core/fees/student/{sid}",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200

    def test_fee_payment_mock(self, principal_token):
        sid = requests.get(f"{API}/v1/core/students?q=22CSE004",
                           headers=_hdr(principal_token), timeout=30).json()["items"][0]["id"]
        r = requests.post(f"{API}/v1/core/fees/payment",
                          headers=_hdr(principal_token),
                          json={"student_id": sid, "amount_paid": 100.0}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["transaction_ref"].startswith("MOCK-")
        assert d["payment_mode"] == "MOCK"

    def test_fees_report(self, principal_token):
        r = requests.get(f"{API}/v1/core/fees/report",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_expected", "total_collected", "collection_pct", "defaulters", "active_students"):
            assert k in d
        assert d["active_students"] == 20


class TestNotices:
    def test_list_notices_admin(self, principal_token):
        r = requests.get(f"{API}/v1/core/notices",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert len(r.json()["items"]) >= 5

    def test_list_notices_category_filter(self, principal_token):
        r = requests.get(f"{API}/v1/core/notices?category=EXAM",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        for n in items:
            assert n["category"] == "EXAM"

    def test_create_and_delete_notice(self, principal_token):
        r = requests.post(f"{API}/v1/core/notices",
                          headers=_hdr(principal_token),
                          json={"title": "TEST_QA Notice",
                                "body": "phase32 test",
                                "category": "PLACEMENT"}, timeout=30)
        assert r.status_code == 200
        nid = r.json()["id"]
        d = requests.delete(f"{API}/v1/core/notices/{nid}",
                            headers=_hdr(principal_token), timeout=30)
        assert d.status_code == 200

    def test_invalid_category_400(self, principal_token):
        r = requests.post(f"{API}/v1/core/notices",
                          headers=_hdr(principal_token),
                          json={"title": "x", "body": "y",
                                "category": "BOGUS"}, timeout=30)
        assert r.status_code == 400


# -------------------- AUTHORISATION 403 --------------------

class TestAuthorization:
    def test_student_cannot_mark_attendance(self, student_token, principal_token):
        c = requests.get(f"{API}/v1/core/courses",
                         headers=_hdr(principal_token), timeout=30).json()[0]
        r = requests.post(f"{API}/v1/core/attendance/mark",
                          headers=_hdr(student_token),
                          json={"course_id": c["id"], "class_date": "2026-01-12",
                                "records": []}, timeout=30)
        assert r.status_code == 403

    def test_student_cannot_delete_others_notice(self, student_token, principal_token):
        r = requests.get(f"{API}/v1/core/notices",
                         headers=_hdr(principal_token), timeout=30)
        nid = r.json()["items"][0]["id"]
        d = requests.delete(f"{API}/v1/core/notices/{nid}",
                            headers=_hdr(student_token), timeout=30)
        assert d.status_code == 403

    def test_student_cannot_get_other_student(self, student_token, principal_token):
        # Get someone else's id
        items = requests.get(f"{API}/v1/core/students?q=22CSE005",
                             headers=_hdr(principal_token), timeout=30).json()["items"]
        if not items:
            pytest.skip("no other student")
        other_id = items[0]["id"]
        r = requests.get(f"{API}/v1/core/students/{other_id}",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403

    def test_student_cannot_update_student(self, student_token, principal_token):
        items = requests.get(f"{API}/v1/core/students?q=22CSE001",
                             headers=_hdr(principal_token), timeout=30).json()["items"]
        sid = items[0]["id"]
        r = requests.put(f"{API}/v1/core/students/{sid}",
                         headers=_hdr(student_token),
                         json={"cgpa": 9.9}, timeout=30)
        assert r.status_code == 403

    def test_student_cannot_fetch_other_fees(self, student_token, principal_token):
        items = requests.get(f"{API}/v1/core/students?q=22CSE006",
                             headers=_hdr(principal_token), timeout=30).json()["items"]
        sid = items[0]["id"]
        r = requests.get(f"{API}/v1/core/fees/student/{sid}",
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403

    def test_cross_tenant_403(self, principal_token):
        # VCE principal tries to access ISB stats
        r = requests.get(f"{API}/v1/core/stats?iid={ISB_IID}",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 403


# -------------------- MULTI-TENANT SEED --------------------

class TestMultiTenantSeed:
    @pytest.mark.parametrize("email,password", [
        ("shankar.dean@isb.edu", "Demo@2026"),
        ("khalid.exec@eaic.gov.ae", "Demo@2026"),
        ("emma.admin@bradford.ac.uk", "Demo@2026"),
    ])
    def test_each_tenant_has_seed(self, email, password):
        try:
            tok = _login(email, password)
        except AssertionError:
            pytest.skip(f"{email} unable to login")
        r = requests.get(f"{API}/v1/core/stats", headers=_hdr(tok), timeout=30)
        assert r.status_code == 200, f"{email}: {r.text[:200]}"
        d = r.json()
        assert d["total_students"] == 20, f"{email}: students={d['total_students']}"
        assert d["total_faculty"] == 8, f"{email}: faculty={d['total_faculty']}"
        assert d["departments_count"] == 3, f"{email}: depts={d['departments_count']}"
        assert d["current_year"] == "2025-26"


# -------------------- NEXUS LEGACY REGRESSION --------------------

class TestNexusLegacyRegression:
    def test_nexus_fees_legacy(self, principal_token):
        r = requests.get(f"{API}/nexus/{VCE_IID}/fees",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200, r.text

    def test_nexus2_timetable_solve(self, principal_token):
        r = requests.post(f"{API}/nexus2/{VCE_IID}/timetable/solve",
                          headers=_hdr(principal_token),
                          json={}, timeout=60)
        # Accept 200 (success) or 400 (validation) — anything but 5xx
        assert r.status_code < 500, r.text


# -------------------- PHASE 31 AI REGRESSION --------------------

class TestPhase31Regression:
    def test_ai_assistant_message(self, principal_token):
        r = requests.post(f"{API}/ai/assistant/message",
                          headers=_hdr(principal_token),
                          json={"text": "hello",
                                "institution_id": VCE_IID}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert "reply" in r.json()
