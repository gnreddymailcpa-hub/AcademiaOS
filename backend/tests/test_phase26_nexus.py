"""
Phase 26 — NEXUS deepening tests:
  • timetable CSP solver — 9 cohorts × 3 sessions, clash-free, <60s
  • defaulter predictor 14d — bands + advance warning
  • library CF — cold-start + neighbour-based
  • JNTUH sync — SLA computation
  • grievance CRUD + SLA breach
  • cert issue + verify (hash chain)
  • CampX migration fidelity
  • notice AI draft (LLM)
  • fee instalment plan creation
  • attendance auto-alert
  • lifecycle graduate → alumni (idempotent)
  • role-gating + cross-tenant 403
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


class TestTimetable:
    def test_solve_9_departments(self, vce_token):
        sessions = []
        for c in range(9):
            for k in range(3):
                sessions.append({
                    "cohort_id": f"C{c}", "course_id": f"CS-{c}-{k}",
                    "faculty_id": f"F{(c + k) % 6}", "room_type": "lecture",
                })
        rooms = [
            {"room_id": f"L{i}", "type": "lecture", "capacity": 60}
            for i in range(1, 4)
        ]
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/timetable/solve",
                          headers=_h(vce_token), json={
                              "sessions": sessions, "rooms": rooms,
                              "max_seconds": 55,
                          }, timeout=70)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["solved"] is True
        assert body["departments"] == 9
        assert body["sessions_count"] == 27
        assert body["elapsed_seconds"] < 60.0
        # Verify clash-free
        seen_fac, seen_room, seen_coh = set(), set(), set()
        for s in body["sessions"]:
            assert s["day"] and s["slot"] and s["room"]
            kf = (s["day"], s["slot"], s["faculty_id"])
            kr = (s["day"], s["slot"], s["room"])
            kc = (s["day"], s["slot"], s["cohort_id"])
            assert kf not in seen_fac
            assert kr not in seen_room
            assert kc not in seen_coh
            seen_fac.add(kf); seen_room.add(kr); seen_coh.add(kc)

    def test_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/timetable/solve",
                          headers=_h(vce_student_token), json={
                              "sessions": [], "rooms": [],
                          }, timeout=20)
        assert r.status_code == 403


class TestDefaulterPredictor:
    def test_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/fees/predict-defaulters",
                         params={"horizon_days": 14}, headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["horizon_days"] == 14
        assert body["model"].startswith("logistic_regression")
        if body["predictions"]:
            p = body["predictions"][0]
            assert 0 <= p["default_probability"] <= 1
            assert p["risk_band"] in ("low", "medium", "high")
            assert "days_until_default" in p

    def test_bad_horizon_422(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/fees/predict-defaulters",
                         params={"horizon_days": 999}, headers=_h(vce_token), timeout=20)
        assert r.status_code == 422


class TestLibraryRec:
    def test_cold_start(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/library/recommend/nonexistent_student",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["method"] in ("popularity_cold_start",
                                  "jaccard_collaborative_filtering")


class TestJntuh:
    def test_sync_within_sla(self, vce_token):
        from datetime import datetime, timezone, timedelta
        pub = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/jntuh/sync",
                          headers=_h(vce_token), json={
                              "kind": "results",
                              "payload": {"semester": "5",
                                          "rows": [{"hall_ticket": "abc"}]},
                              "published_at": pub,
                          }, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["sla_ok"] is True
        assert body["sla_minutes"] < 60

    def test_sync_outside_sla(self, vce_token):
        from datetime import datetime, timezone, timedelta
        pub = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/jntuh/sync",
                          headers=_h(vce_token), json={
                              "kind": "syllabus", "payload": {"course": "x"},
                              "published_at": pub,
                          }, timeout=20)
        assert r.json()["sla_ok"] is False

    def test_bad_kind_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/jntuh/sync",
                          headers=_h(vce_token), json={
                              "kind": "noise", "payload": {},
                          }, timeout=20)
        assert r.status_code == 422

    def test_history_filter(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/jntuh/sync",
                         params={"kind": "results"},
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        for row in r.json():
            assert row["kind"] == "results"


class TestGrievance:
    @pytest.fixture(scope="class")
    def gid(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/grievances",
                          headers=_h(vce_token), json={
                              "category": "academic",
                              "title": f"QA test {uuid.uuid4().hex[:6]}",
                              "description": "marks discrepancy", "severity": "high",
                          }, timeout=20)
        assert r.status_code == 200
        return r.json()["id"]

    def test_create_sets_sla(self, vce_token, gid):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/grievances",
                         headers=_h(vce_token), timeout=20)
        row = next((x for x in r.json() if x["id"] == gid), None)
        assert row is not None
        assert row["sla_hours"] == 24
        assert "sla_deadline" in row
        assert row["sla_breach"] is False  # just created

    def test_update_status(self, vce_token, gid):
        r = requests.patch(f"{BASE_URL}/api/nexus2/{VCE}/grievances/{gid}",
                           headers=_h(vce_token), json={
                               "status": "resolved",
                               "resolution_note": "marks rechecked",
                           }, timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "resolved"

    def test_bad_status_422(self, vce_token, gid):
        r = requests.patch(f"{BASE_URL}/api/nexus2/{VCE}/grievances/{gid}",
                           headers=_h(vce_token), json={"status": "alien"}, timeout=20)
        assert r.status_code == 422

    def test_unknown_404(self, vce_token):
        r = requests.patch(f"{BASE_URL}/api/nexus2/{VCE}/grievances/nope",
                           headers=_h(vce_token), json={"status": "closed"}, timeout=20)
        assert r.status_code == 404


class TestCertChain:
    def test_issue_verify(self, vce_token):
        ri = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/certificates/issue",
                           headers=_h(vce_token), json={
                               "student_id": "s_chain",
                               "student_name": "Chain Test",
                               "cert_type": "bonafide",
                               "issued_for": "Phase26 verify",
                           }, timeout=20)
        assert ri.status_code == 200
        cid = ri.json()["id"]
        rv = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/certificates/verify/{cid}",
                          headers=_h(vce_token), timeout=20)
        assert rv.status_code == 200
        body = rv.json()
        assert body["valid"] is True
        assert body["content_hash_ok"] is True
        assert body["block_hash_ok"] is True

    def test_verify_unknown_404(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/certificates/verify/nope",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 404

    def test_issue_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/certificates/issue",
                          headers=_h(vce_student_token), json={
                              "student_id": "s", "student_name": "x",
                              "cert_type": "bonafide", "issued_for": "y",
                          }, timeout=20)
        assert r.status_code == 403


class TestCampxMigration:
    def test_fidelity_100(self, vce_token):
        suffix = uuid.uuid4().hex[:6]
        rows = [
            {"id": f"mig-{suffix}-1", "name": "Alice", "branch": "CSE"},
            {"id": f"mig-{suffix}-2", "name": "Bob", "branch": "ECE"},
            {"id": f"mig-{suffix}-3", "name": "Charlie", "branch": "MECH"},
        ]
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/migration/campx",
                          headers=_h(vce_token), json={
                              "target_collection": "students",
                              "rows": rows, "primary_key": "id",
                          }, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["fidelity_pct"] == 100.0
        assert body["inserted"] + body["updated"] == 3
        assert body["errors"] == 0

    def test_skip_invalid_rows(self, vce_token):
        rows = [
            {"id": "valid-1", "name": "ok"},
            {"no_id_field": True},
            {},  # empty dict — no primary key
        ]
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/migration/campx",
                          headers=_h(vce_token), json={
                              "target_collection": "students", "rows": rows,
                          }, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["skipped"] >= 2
        assert b["fidelity_pct"] < 100


class TestNoticeDraft:
    def test_draft(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/notices/draft",
                          headers=_h(vce_token), json={
                              "topic": "library reopens after maintenance",
                              "audience": "student", "tone": "warm",
                          }, timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert body["title"]
        assert body["body"]
        assert body["recommended_schedule"] in ("now", "next_morning", "next_week")


class TestFeePlan:
    def test_creates_n_instalments(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/fees/plan",
                          headers=_h(vce_token), json={
                              "student_id": "s_plan",
                              "student_name": "Plan Test",
                              "total_amount": 100000,
                              "instalments": 4,
                              "first_due_date": "2026-04-01",
                              "interval_days": 30,
                          }, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert len(body["rows"]) == 4
        # Total amount = sum of all instalment amounts
        total = round(sum(r["amount"] for r in body["rows"]), 2)
        assert abs(total - 100000) < 1.0  # rounding tolerance

    def test_bad_date_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/fees/plan",
                          headers=_h(vce_token), json={
                              "student_id": "s", "student_name": "x",
                              "total_amount": 10000, "instalments": 3,
                              "first_due_date": "not-a-date",
                          }, timeout=20)
        assert r.status_code == 422


class TestAttendanceAutoAlert:
    def test_auto_alert_runs(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/attendance/auto-alert",
                          params={"threshold_pct": 75.0},
                          headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "alerts_emitted" in body
        assert body["threshold_pct"] == 75.0


class TestLifecycleGraduate:
    def test_graduate_creates_alumni(self, vce_token):
        # Seed a student via campx migration (deterministic)
        sid = f"grad-{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/nexus2/{VCE}/migration/campx",
                      headers=_h(vce_token), json={
                          "target_collection": "students",
                          "rows": [{"id": sid, "name": f"Grad {sid}",
                                    "branch": "CSE",
                                    "email": f"{sid}@x.com",
                                    "phone": "9000000000"}],
                      }, timeout=20)
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/students/graduate",
                          headers=_h(vce_token), json={
                              "student_id": sid, "graduation_year": 2026,
                              "cgpa": 8.5, "branch": "CSE",
                          }, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["created"] is True
        assert body["alumni"]["graduation_year"] == 2026

        # Idempotent
        r2 = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/students/graduate",
                           headers=_h(vce_token), json={
                               "student_id": sid, "graduation_year": 2026,
                               "cgpa": 8.5, "branch": "CSE",
                           }, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["created"] is False

    def test_unknown_student_404(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/nexus2/{VCE}/students/graduate",
                          headers=_h(vce_token), json={
                              "student_id": "nobody", "graduation_year": 2026,
                          }, timeout=20)
        assert r.status_code == 404


class TestCrossTenant:
    def test_cross_tenant_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/nexus2/{VCE}/grievances",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403
