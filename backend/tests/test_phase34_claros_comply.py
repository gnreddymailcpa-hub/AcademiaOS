"""Phase 34 — Claros Comply (NAAC accreditation) backend tests."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

VCE_IID = "44444444-4444-4444-4444-444444444444"
ISB_IID = "11111111-1111-1111-1111-111111111111"
EAIC_IID = "22222222-2222-2222-2222-222222222222"
UOB_IID = "33333333-3333-3333-3333-333333333333"

CRED_PRINCIPAL = ("principal@vaagdevi.edu.in", "Demo@2026")
CRED_STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
CRED_FACULTY = ("prof.suresh@vaagdevi.edu.in", "Demo@2026")
CRED_IQAC = ("iqac@vaagdevi.edu.in", "Demo@2026")
CRED_ISB_DEAN = ("shankar.dean@isb.edu", "Demo@2026")
CRED_EAIC = ("khalid.exec@eaic.gov.ae", "Demo@2026")
CRED_UOB = ("emma.admin@bradford.ac.uk", "Demo@2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def principal_token():
    return _login(*CRED_PRINCIPAL)


@pytest.fixture(scope="module")
def student_token():
    return _login(*CRED_STUDENT)


@pytest.fixture(scope="module")
def faculty_token():
    return _login(*CRED_FACULTY)


@pytest.fixture(scope="module")
def iqac_token():
    return _login(*CRED_IQAC)


@pytest.fixture(scope="module")
def isb_token():
    return _login(*CRED_ISB_DEAN)


@pytest.fixture(scope="module")
def eaic_token():
    return _login(*CRED_EAIC)


@pytest.fixture(scope="module")
def uob_token():
    return _login(*CRED_UOB)


# ============================================================ DASHBOARD ===
class TestDashboard:
    def test_dashboard_shape(self, principal_token):
        r = requests.get(f"{API}/v1/comply/dashboard", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) == 7
        codes = sorted([i["code"] for i in items])
        assert codes == [1, 2, 3, 4, 5, 6, 7]
        for it in items:
            for k in ("criterion_id", "code", "name", "current_score", "max_score",
                      "evidence_count", "readiness_pct", "metric_count"):
                assert k in it, f"missing key {k} in dashboard item"

    def test_dashboard_seeded_metrics_for_c1_c3_c5(self, principal_token):
        r = requests.get(f"{API}/v1/comply/dashboard", headers=_hdr(principal_token), timeout=20)
        items = {i["code"]: i for i in r.json()["items"]}
        # C1/C3/C5 should have seeded metrics
        for code in (1, 3, 5):
            assert items[code]["metric_count"] > 0, f"C{code} has 0 metrics"
        for code in (2, 4, 6, 7):
            assert items[code]["metric_count"] == 0
            assert items[code]["readiness_pct"] == 0


# ============================================================ CRITERIA ====
class TestCriteria:
    def test_list_criteria(self, principal_token):
        r = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 7
        assert sorted([c["code"] for c in data]) == [1, 2, 3, 4, 5, 6, 7]

    def test_get_criterion_detail(self, principal_token):
        # Get C1 id
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        r = requests.get(f"{API}/v1/comply/criteria/{c1['id']}", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("criterion", "metrics", "evidence", "score"):
            assert k in data
        # C1 has 4 metrics seeded
        assert len(data["metrics"]) == 4
        metric_codes = sorted([m["metric_code"] for m in data["metrics"]])
        assert metric_codes == ["1.1.1", "1.2.1", "1.3.1", "1.4.1"]


# ============================================================ METRICS =====
class TestMetrics:
    def test_list_metrics_by_criterion(self, principal_token):
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        r = requests.get(f"{API}/v1/comply/metrics?criterion_id={c1['id']}", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 4

    def test_update_metric_as_admin(self, principal_token):
        # Pick metric 1.2.1
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        ml = requests.get(f"{API}/v1/comply/metrics?criterion_id={c1['id']}", headers=_hdr(principal_token), timeout=20).json()["items"]
        m121 = next(m for m in ml if m["metric_code"] == "1.2.1")
        prev = m121.get("current_value")
        new_val = 98.0 if prev != 98.0 else 97.0
        r = requests.put(f"{API}/v1/comply/metrics/{m121['id']}", json={"current_value": new_val},
                         headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert float(body["current_value"]) == new_val
        assert "last_updated" in body

    def test_update_metric_as_student_forbidden(self, student_token, principal_token):
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        ml = requests.get(f"{API}/v1/comply/metrics?criterion_id={c1['id']}", headers=_hdr(principal_token), timeout=20).json()["items"]
        m121 = ml[0]
        r = requests.put(f"{API}/v1/comply/metrics/{m121['id']}", json={"current_value": 50.0},
                         headers=_hdr(student_token), timeout=20)
        assert r.status_code == 403


# ============================================================ EVIDENCE ====
class TestEvidence:
    def test_list_evidence(self, principal_token):
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        r = requests.get(f"{API}/v1/comply/evidence?criterion_id={c1['id']}", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 2  # seed has 2 for C1

    def test_upload_and_delete_evidence(self, principal_token):
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        files = {"file": ("TEST_evidence.txt", io.BytesIO(b"hello evidence"), "text/plain")}
        data = {"criterion_id": c1["id"], "title": "TEST_ Upload",
                "academic_year": "2025-26", "description": "qa"}
        r = requests.post(f"{API}/v1/comply/evidence/upload", data=data, files=files,
                          headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["title"] == "TEST_ Upload"
        assert ev["file_url"].startswith("/uploads/comply/")
        ev_id = ev["id"]

        # Delete
        dr = requests.delete(f"{API}/v1/comply/evidence/{ev_id}",
                             headers=_hdr(principal_token), timeout=20)
        assert dr.status_code == 200
        assert dr.json()["ok"] is True

    def test_delete_evidence_student_forbidden(self, principal_token, student_token):
        # Upload as principal first
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        files = {"file": ("TEST_fb.txt", io.BytesIO(b"x"), "text/plain")}
        data = {"criterion_id": c1["id"], "title": "TEST_ FB", "academic_year": "2025-26"}
        up = requests.post(f"{API}/v1/comply/evidence/upload", data=data, files=files,
                           headers=_hdr(principal_token), timeout=30)
        ev_id = up.json()["id"]
        # Student delete -> 403
        r = requests.delete(f"{API}/v1/comply/evidence/{ev_id}",
                            headers=_hdr(student_token), timeout=20)
        assert r.status_code == 403
        # Cleanup
        requests.delete(f"{API}/v1/comply/evidence/{ev_id}", headers=_hdr(principal_token))


# ============================================================ READINESS ===
class TestReadiness:
    def test_readiness_shape(self, principal_token):
        r = requests.get(f"{API}/v1/comply/readiness", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("overall_score", "max_score", "overall_pct", "per_criterion", "grade_projection"):
            assert k in d
        assert len(d["per_criterion"]) == 7
        assert d["grade_projection"] in {"A++", "A+", "A", "B++", "B+", "B", "C"}


# ============================================================ AQAR ========
class TestAqar:
    def test_aqar_generate_as_faculty(self, faculty_token, principal_token):
        rr = requests.get(f"{API}/v1/comply/criteria", headers=_hdr(principal_token), timeout=20)
        c1 = next(c for c in rr.json() if c["code"] == 1)
        r = requests.post(f"{API}/v1/comply/aqar/generate",
                          json={"criterion_id": c1["id"], "academic_year": "2025-26"},
                          headers=_hdr(faculty_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["criterion_code"] == 1
        assert d["academic_year"] == "2025-26"
        assert d["generated_text"] and len(d["generated_text"]) > 100
        assert isinstance(d["word_count"], int) and d["word_count"] > 0

    def test_aqar_invalid_criterion_404(self, principal_token):
        r = requests.post(f"{API}/v1/comply/aqar/generate",
                          json={"criterion_id": "00000000-0000-0000-0000-000000000000",
                                "academic_year": "2025-26"},
                          headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 404


# ============================================================ OBE =========
class TestOBE:
    def test_obe_programs(self, principal_token):
        r = requests.get(f"{API}/v1/comply/obe/programs", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        for p in items:
            for k in ("po_count", "co_count", "mapping_count", "completion_pct"):
                assert k in p

    def test_obe_outcomes_for_btech_cse(self, principal_token):
        progs = requests.get(f"{API}/v1/comply/obe/programs", headers=_hdr(principal_token), timeout=20).json()["items"]
        btech_cse = next((p for p in progs if "BTECH-CSE" in (p.get("code") or "")
                          or "B.Tech CSE" in (p.get("name") or "")
                          or "BTECH-CSE" in (p.get("name") or "")), None)
        if not btech_cse:
            # fallback: any program with PO count > 0
            btech_cse = next((p for p in progs if p["po_count"] > 0), progs[0])
        r = requests.get(f"{API}/v1/comply/obe/{btech_cse['id']}/outcomes",
                         headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("program", "program_outcomes", "courses", "course_outcomes", "mappings"):
            assert k in d
        if btech_cse["po_count"] > 0:
            assert len(d["program_outcomes"]) == 12

    def test_obe_mapping_upsert(self, principal_token):
        progs = requests.get(f"{API}/v1/comply/obe/programs", headers=_hdr(principal_token), timeout=20).json()["items"]
        target = next((p for p in progs if p["po_count"] > 0), None)
        if not target:
            pytest.skip("No program with seeded POs")
        oc = requests.get(f"{API}/v1/comply/obe/{target['id']}/outcomes", headers=_hdr(principal_token), timeout=20).json()
        if not oc["course_outcomes"] or not oc["program_outcomes"]:
            pytest.skip("No COs or POs to test mapping")
        co = oc["course_outcomes"][0]
        po = oc["program_outcomes"][0]
        r = requests.post(f"{API}/v1/comply/obe/mapping",
                          json={"course_outcome_id": co["id"], "program_outcome_id": po["id"], "level": 2},
                          headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_obe_mapping_invalid_level(self, principal_token):
        r = requests.post(f"{API}/v1/comply/obe/mapping",
                          json={"course_outcome_id": "x", "program_outcome_id": "y", "level": 4},
                          headers=_hdr(principal_token), timeout=20)
        assert r.status_code in (400, 422)


# ============================================================ AUTHZ =======
class TestAuthZ:
    def test_cross_tenant_dashboard_forbidden(self, principal_token):
        r = requests.get(f"{API}/v1/comply/dashboard?iid={ISB_IID}",
                         headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 403


# ============================================================ MULTI-TENANT
class TestMultiTenant:
    def test_isb_has_seeded_metrics(self, isb_token):
        r = requests.get(f"{API}/v1/comply/dashboard", headers=_hdr(isb_token), timeout=20)
        assert r.status_code == 200
        items = {i["code"]: i for i in r.json()["items"]}
        for code in (1, 3, 5):
            assert items[code]["metric_count"] > 0, f"ISB C{code} has 0 metrics"

    def test_eaic_empty_naac_seed(self, eaic_token):
        r = requests.get(f"{API}/v1/comply/dashboard", headers=_hdr(eaic_token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 7
        for it in items:
            assert it["metric_count"] == 0

    def test_uob_empty_naac_seed(self, uob_token):
        r = requests.get(f"{API}/v1/comply/dashboard", headers=_hdr(uob_token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 7
        for it in items:
            assert it["metric_count"] == 0


# ============================================================ REGRESSION ==
class TestRegression:
    def test_enroll_leads(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/leads", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200

    def test_enroll_funnel(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/analytics/funnel", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200

    def test_core_stats(self, principal_token):
        r = requests.get(f"{API}/v1/core/stats", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200

    def test_core_students(self, principal_token):
        r = requests.get(f"{API}/v1/core/students", headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200

    def test_legacy_compass_timeline(self, principal_token):
        # Actual mounted path is under /api/closeout
        r = requests.get(f"{API}/closeout/{VCE_IID}/compass/accreditation-timeline",
                         headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200

    def test_legacy_compass_aqar_preview(self, principal_token):
        r = requests.get(f"{API}/compass/{VCE_IID}/aqar/preview",
                         headers=_hdr(principal_token), timeout=20)
        assert r.status_code == 200
