"""Claros Phase 37 — Research, People, Alumni, Safe, Green.

Covers happy paths + RBAC for each new router. Uses Vaagdevi tenant.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
FACULTY = ("prof.suresh@vaagdevi.edu.in", "Demo@2026")
HOD = ("hod.cse@vaagdevi.edu.in", "Demo@2026")
ADMIN = ("principal@vaagdevi.edu.in", "Demo@2026")
TIMEOUT = 90


def _login(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ============================================================ fixtures
@pytest.fixture(scope="module")
def s_tok(): return _login(*STUDENT)


@pytest.fixture(scope="module")
def f_tok(): return _login(*FACULTY)


@pytest.fixture(scope="module")
def h_tok(): return _login(*HOD)


@pytest.fixture(scope="module")
def a_tok(): return _login(*ADMIN)


# ============================================================ RESEARCH
class TestResearch:
    def test_stats(self, f_tok):
        r = requests.get(f"{BASE_URL}/api/v1/research/stats", headers=_h(f_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("publications_total", "patents_total", "projects_active", "h_index_avg"):
            assert k in d, f"missing {k}: {d}"
        assert d["publications_total"] >= 3
        assert d["projects_active"] >= 2
        assert d["h_index_avg"] >= 1

    def test_publications_seed(self, f_tok):
        r = requests.get(f"{BASE_URL}/api/v1/research/publications", headers=_h(f_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 3

    def test_add_pub_and_persist(self, f_tok):
        body = {
            "title": "TEST_Phase37 AI in Edge Classrooms",
            "authors": ["P Suresh"],
            "journal_name": "Journal of Tests",
            "publication_type": "JOURNAL",
            "year_of_publication": 2026,
            "is_indexed": False,
        }
        r = requests.post(f"{BASE_URL}/api/v1/research/publications",
                          headers=_h(f_tok), json=body, timeout=20)
        assert r.status_code == 200, r.text
        doc = r.json()
        pid = doc["id"]
        assert doc["title"] == body["title"]
        # verify GET
        rows = requests.get(f"{BASE_URL}/api/v1/research/publications",
                            headers=_h(f_tok), timeout=20).json()
        assert any(p["id"] == pid for p in rows)
        # cleanup
        d = requests.delete(f"{BASE_URL}/api/v1/research/publications/{pid}",
                            headers=_h(f_tok), timeout=20)
        assert d.status_code == 200

    def test_grants_match(self, f_tok):
        # ensure 3+ grants seeded
        gr = requests.get(f"{BASE_URL}/api/v1/research/grants", headers=_h(f_tok), timeout=20)
        assert gr.status_code == 200 and len(gr.json()) >= 3
        r = requests.post(f"{BASE_URL}/api/v1/research/grants/match",
                          headers=_h(f_tok), json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        # could be {matches:[...]} or list
        matches = data.get("matches") if isinstance(data, dict) else data
        assert isinstance(matches, list) and len(matches) >= 1

    def test_literature_review(self, f_tok):
        r = requests.post(f"{BASE_URL}/api/v1/research/literature-review",
                          headers=_h(f_tok),
                          json={"topic": "Edge AI in classrooms"},
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        # find any markdown/text field
        text = data.get("content") or data.get("review") or data.get("markdown") or ""
        assert len(text) > 200, f"too short: {data}"

    def test_rbac_student_cannot_post(self, s_tok):
        r = requests.post(f"{BASE_URL}/api/v1/research/publications",
                          headers=_h(s_tok),
                          json={"title": "x", "year_of_publication": 2026},
                          timeout=20)
        assert r.status_code == 403


# ============================================================ PEOPLE
class TestPeople:
    def test_stats_faculty(self, f_tok):
        r = requests.get(f"{BASE_URL}/api/v1/people/stats", headers=_h(f_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total_faculty"] >= 1
        assert d["avg_api"] >= 0

    def test_stats_student_403(self, s_tok):
        r = requests.get(f"{BASE_URL}/api/v1/people/stats", headers=_h(s_tok), timeout=20)
        assert r.status_code == 403

    def test_training_list_and_add(self, f_tok):
        r = requests.get(f"{BASE_URL}/api/v1/people/training", headers=_h(f_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        initial = len(rows)
        body = {
            "training_type": "FDP",
            "title": "TEST_AI Workshop 2026",
            "organiser": "IIT-X",
            "duration_days": 2,
            "completion_date": "2026-01-15",
        }
        a = requests.post(f"{BASE_URL}/api/v1/people/training",
                          headers=_h(f_tok), json=body, timeout=20)
        assert a.status_code == 200, a.text
        tid = a.json()["id"]
        rows2 = requests.get(f"{BASE_URL}/api/v1/people/training",
                             headers=_h(f_tok), timeout=20).json()
        assert len(rows2) == initial + 1
        # cleanup
        requests.delete(f"{BASE_URL}/api/v1/people/training/{tid}",
                        headers=_h(f_tok), timeout=20)

    def test_training_student_no_fid_400_or_403(self, s_tok):
        body = {"training_type": "FDP", "title": "x",
                "duration_days": 1, "completion_date": "2026-01-15"}
        r = requests.post(f"{BASE_URL}/api/v1/people/training",
                          headers=_h(s_tok), json=body, timeout=20)
        # Per route: STAFF_ROLES check first → student gets 403.
        assert r.status_code in (400, 403)

    def test_workload_me(self, f_tok):
        r = requests.get(f"{BASE_URL}/api/v1/people/workload/me",
                         headers=_h(f_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("teaching_hours_week", "courses_count", "students_count"):
            assert k in d

    def test_faculty_me_and_dev_plan(self, f_tok):
        me = requests.get(f"{BASE_URL}/api/v1/people/faculty/me",
                          headers=_h(f_tok), timeout=20)
        assert me.status_code == 200
        fid = me.json()["id"]
        r = requests.post(
            f"{BASE_URL}/api/v1/people/faculty/{fid}/development-plan",
            headers=_h(f_tok), json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        rec = r.json()
        goals = rec.get("goals") or {}
        assert "goals" in goals and "courses" in goals, f"unexpected payload: {rec}"

    def test_hod_sees_admin_faculty(self, h_tok):
        r = requests.get(f"{BASE_URL}/api/v1/people/faculty",
                         headers=_h(h_tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============================================================ ALUMNI
class TestAlumni:
    def test_stats(self, s_tok):
        r = requests.get(f"{BASE_URL}/api/v1/alumni/stats", headers=_h(s_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total_alumni"] >= 5
        assert d["active_mentors"] >= 4

    def test_directory_and_mentors(self, s_tok):
        r = requests.get(f"{BASE_URL}/api/v1/alumni/profiles",
                         headers=_h(s_tok), timeout=20)
        assert r.status_code == 200 and len(r.json()) >= 5
        m = requests.get(f"{BASE_URL}/api/v1/alumni/mentors",
                         headers=_h(s_tok), timeout=20)
        assert m.status_code == 200 and len(m.json()) >= 4
        TestAlumni._mentor_id = m.json()[0]["id"]

    def test_outreach_and_request(self, s_tok):
        aid = TestAlumni._mentor_id
        # AI draft
        d = requests.post(f"{BASE_URL}/api/v1/alumni/outreach/generate",
                          headers=_h(s_tok),
                          json={"alumni_id": aid, "purpose": "MENTORSHIP"},
                          timeout=TIMEOUT)
        assert d.status_code == 200, d.text
        assert len(d.json().get("message", "")) > 20

        # Send request
        body = {"alumni_id": aid, "message": "TEST_Phase37 hello",
                "domain_sought": "Software"}
        r = requests.post(f"{BASE_URL}/api/v1/alumni/mentorship/request",
                          headers=_h(s_tok), json=body, timeout=20)
        assert r.status_code == 200, r.text
        TestAlumni._req_id = r.json()["id"]

        mine = requests.get(f"{BASE_URL}/api/v1/alumni/mentorship/requests",
                            headers=_h(s_tok), timeout=20).json()
        assert any(x["id"] == TestAlumni._req_id for x in mine)

    def test_jobs_list_and_faculty_post_403(self, s_tok, f_tok):
        lj = requests.get(f"{BASE_URL}/api/v1/alumni/jobs",
                          headers=_h(s_tok), timeout=20)
        assert lj.status_code == 200
        # faculty (no alumni profile) cannot post
        r = requests.post(f"{BASE_URL}/api/v1/alumni/jobs",
                          headers=_h(f_tok),
                          json={"title": "Test Job"}, timeout=20)
        assert r.status_code == 403


# ============================================================ SAFE
class TestSafe:
    def test_stats(self, a_tok):
        r = requests.get(f"{BASE_URL}/api/v1/safe/stats", headers=_h(a_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("visitors_today", "checked_in_now",
                  "open_incidents", "critical_open"):
            assert k in d

    def test_visitors_student_403(self, s_tok):
        r = requests.get(f"{BASE_URL}/api/v1/safe/visitors",
                         headers=_h(s_tok), timeout=20)
        assert r.status_code == 403

    def test_visitor_create_checkin_checkout(self, a_tok):
        today = time.strftime("%Y-%m-%d")
        body = {"visitor_name": "TEST_Phase37 Guest",
                "phone": "9999999999", "purpose": "Audit",
                "visit_date": today, "id_type": "Aadhaar",
                "id_number": "1234"}
        c = requests.post(f"{BASE_URL}/api/v1/safe/visitors",
                          headers=_h(a_tok), json=body, timeout=20)
        assert c.status_code == 200, c.text
        vid = c.json()["id"]
        ci = requests.put(f"{BASE_URL}/api/v1/safe/visitors/{vid}/checkin",
                          headers=_h(a_tok), timeout=20)
        assert ci.status_code == 200 and ci.json()["status"] == "CHECKED_IN"
        co = requests.put(f"{BASE_URL}/api/v1/safe/visitors/{vid}/checkout",
                          headers=_h(a_tok), timeout=20)
        assert co.status_code == 200 and co.json()["status"] == "CHECKED_OUT"

    def test_incident_bad_type_400(self, s_tok):
        r = requests.post(f"{BASE_URL}/api/v1/safe/incidents",
                          headers=_h(s_tok),
                          json={"incident_type": "BOGUS",
                                "description": "x", "severity": "LOW"},
                          timeout=20)
        assert r.status_code == 400

    def test_incident_lifecycle(self, a_tok):
        body = {"incident_type": "THEFT", "description": "TEST_Phase37 Laptop missing",
                "location": "Library", "severity": "HIGH"}
        c = requests.post(f"{BASE_URL}/api/v1/safe/incidents",
                          headers=_h(a_tok), json=body, timeout=20)
        assert c.status_code == 200, c.text
        iid = c.json()["id"]
        u = requests.put(f"{BASE_URL}/api/v1/safe/incidents/{iid}",
                         headers=_h(a_tok),
                         json={"status": "RESOLVED",
                               "resolution_notes": "recovered"},
                         timeout=20)
        assert u.status_code == 200 and u.json()["status"] == "RESOLVED"


# ============================================================ GREEN
class TestGreen:
    def test_stats(self, a_tok):
        r = requests.get(f"{BASE_URL}/api/v1/green/stats",
                         headers=_h(a_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        # Expect kWh-related figure present
        has_kwh = any("kwh" in k.lower() for k in d.keys())
        assert has_kwh, f"no kwh stat in {d}"

    def test_energy_trends_30_days(self, a_tok):
        r = requests.get(f"{BASE_URL}/api/v1/green/energy/trends",
                         headers=_h(a_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) == 30
        assert {"date", "total_kwh"} <= set(rows[0].keys())

    def test_metrics_seed(self, a_tok):
        r = requests.get(f"{BASE_URL}/api/v1/green/metrics",
                         headers=_h(a_tok), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_generate_report(self, a_tok):
        r = requests.post(f"{BASE_URL}/api/v1/green/report/generate",
                         headers=_h(a_tok), json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        text = (r.json().get("content") or r.json().get("report")
                or r.json().get("markdown") or "")
        assert len(text) > 300, f"short report: {r.json()}"
