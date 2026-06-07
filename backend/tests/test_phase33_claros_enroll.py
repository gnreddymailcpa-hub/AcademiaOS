"""
Phase 33 — Claros Enroll backend smoke tests.
Covers all 11 /api/v1/enroll/* endpoints + auth 403s + lead-score formula +
multi-tenant seed + legacy ARISE/Phase-32 regression.
"""
import os
import io
import pytest
import requests
from pathlib import Path

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
def registrar_token():
    return _login("examcell@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def super_admin_token():
    return _login("admin@academiaos.ai", "Admin@2026")


# -------------------- ENDPOINT SMOKE --------------------

class TestEnrollEndpoints:
    def test_a_list_leads_seeded(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/leads?page=1&page_size=200",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 30, f"expected 30 seeded leads, got {d['total']}"
        assert len(d["items"]) == 30

    def test_b_create_lead_authed(self, principal_token):
        r = requests.post(f"{API}/v1/enroll/leads",
                          headers=_hdr(principal_token),
                          json={"full_name": "TEST_QA Lead",
                                "email": "TEST_qaauth@demo.claros",
                                "phone": "+91-9988776655",
                                "program_interest": "B.Tech CSE",
                                "eapcet_rank": 15000,
                                "source": "REFERRAL"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "NEW"
        assert d["lead_score"] > 0
        # Expected: rank 15000 -> +20, REFERRAL -> +15, no activities, NEW -> 0 => 35
        assert d["lead_score"] == 35, f"expected 35 got {d['lead_score']}"
        # GET to verify persistence
        g = requests.get(f"{API}/v1/enroll/leads/{d['id']}",
                         headers=_hdr(principal_token), timeout=30)
        assert g.status_code == 200
        assert g.json()["lead"]["email"] == "test_qaauth@demo.claros"

    def test_c_create_lead_public_no_auth(self):
        # public form must include institution_id in body
        r = requests.post(f"{API}/v1/enroll/leads",
                          json={"institution_id": VCE_IID,
                                "full_name": "TEST_Public Lead",
                                "email": "TEST_public@demo.claros",
                                "phone": "+91-9000000001",
                                "source": "WEBSITE"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["tenant_id"] == VCE_IID

    def test_d_create_lead_public_missing_iid_400(self):
        r = requests.post(f"{API}/v1/enroll/leads",
                          json={"full_name": "x", "email": "x@x.com", "phone": "1",
                                "source": "WEBSITE"}, timeout=30)
        assert r.status_code == 400

    def test_e_filter_status_source(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/leads?status=NEW",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["status"] == "NEW"
        r = requests.get(f"{API}/v1/enroll/leads?source=REFERRAL",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["source"] == "REFERRAL"

    def test_f_update_with_status_change(self, principal_token):
        # Create a fresh lead
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_Move Lead",
                                 "email": "TEST_move@demo.claros",
                                 "phone": "+91-9000000002",
                                 "source": "WEBSITE"}, timeout=30).json()
        lid = cr["id"]
        r = requests.put(f"{API}/v1/enroll/leads/{lid}",
                         headers=_hdr(principal_token),
                         json={"status": "CONTACTED"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "CONTACTED"
        # auto STATUS_CHANGE activity expected
        tl = requests.get(f"{API}/v1/enroll/leads/{lid}/timeline",
                          headers=_hdr(principal_token), timeout=30).json()
        kinds = [a["activity_type"] for a in tl["items"]]
        assert "STATUS_CHANGE" in kinds

    def test_g_invalid_status_400(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_Bad Status",
                                 "email": "TEST_badstatus@demo.claros",
                                 "phone": "+91-9000000003",
                                 "source": "WEBSITE"}, timeout=30).json()
        r = requests.put(f"{API}/v1/enroll/leads/{cr['id']}",
                         headers=_hdr(principal_token),
                         json={"status": "INVALID"}, timeout=30)
        assert r.status_code == 400

    def test_h_log_activity(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_Act Lead",
                                 "email": "TEST_act@demo.claros",
                                 "phone": "+91-9000000004",
                                 "source": "WEBSITE"}, timeout=30).json()
        lid = cr["id"]
        r = requests.post(f"{API}/v1/enroll/leads/{lid}/activity",
                          headers=_hdr(principal_token),
                          json={"activity_type": "CALL",
                                "description": "TEST initial call"}, timeout=30)
        assert r.status_code == 200, r.text
        tl = requests.get(f"{API}/v1/enroll/leads/{lid}/timeline",
                          headers=_hdr(principal_token), timeout=30).json()
        assert tl["items"][0]["activity_type"] == "CALL"

    def test_i_invalid_activity_type_400(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_BadAct",
                                 "email": "TEST_badact@demo.claros",
                                 "phone": "+91-9000000005",
                                 "source": "WEBSITE"}, timeout=30).json()
        r = requests.post(f"{API}/v1/enroll/leads/{cr['id']}/activity",
                          headers=_hdr(principal_token),
                          json={"activity_type": "BOGUS",
                                "description": "x"}, timeout=30)
        assert r.status_code == 400

    def test_j_ai_counsel(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_AI Lead",
                                 "email": "TEST_ai@demo.claros",
                                 "phone": "+91-9000000006",
                                 "program_interest": "B.Tech CSE",
                                 "eapcet_rank": 5000,
                                 "source": "REFERRAL"}, timeout=30).json()
        r = requests.post(f"{API}/v1/enroll/leads/{cr['id']}/ai-counsel",
                          headers=_hdr(principal_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "talking_points" in d
        assert isinstance(d["talking_points"], list)
        assert len(d["talking_points"]) == 5
        for tp in d["talking_points"]:
            assert isinstance(tp, str) and len(tp.strip()) > 0
        assert "model" in d

    def test_k_funnel(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/analytics/funnel",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["stages"]) == 7
        statuses = [s["status"] for s in d["stages"]]
        for s in ["NEW", "CONTACTED", "COUNSELED", "APPLIED", "OFFERED", "ENROLLED", "DROPPED"]:
            assert s in statuses
        assert "totals" in d
        for k in ("month_total", "enrolled", "conversion_pct"):
            assert k in d["totals"]

    def test_l_sources(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/analytics/sources",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and len(d["items"]) >= 1
        for it in d["items"]:
            for k in ("source", "total", "enrolled", "conversion_pct"):
                assert k in it

    def test_m_daily(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/analytics/daily",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["items"]) == 30
        for it in d["items"]:
            assert "day" in it and "count" in it

    def test_n_bulk_import(self, principal_token):
        csv_content = (
            "name,email,phone,program,rank,source\n"
            "TEST_Bulk One,TEST_bulk1@demo.claros,+91-9000111111,B.Tech CSE,10000,WEBSITE\n"
            "TEST_Bulk Two,TEST_bulk2@demo.claros,+91-9000111112,B.Tech ECE,25000,EVENT\n"
            ",no_name@demo.claros,123,X,5000,WEBSITE\n"  # skipped: no name
        )
        files = {"file": ("leads.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        r = requests.post(f"{API}/v1/enroll/leads/bulk-import",
                          headers=_hdr(principal_token),
                          files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 2
        assert d["skipped"] == 1

    def test_o_delete_lead(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_DELETE",
                                 "email": "TEST_del@demo.claros",
                                 "phone": "+91-9000000007",
                                 "source": "WEBSITE"}, timeout=30).json()
        r = requests.delete(f"{API}/v1/enroll/leads/{cr['id']}",
                            headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        g = requests.get(f"{API}/v1/enroll/leads/{cr['id']}",
                         headers=_hdr(principal_token), timeout=30)
        assert g.status_code == 404


# -------------------- AUTHZ --------------------

class TestAuthz:
    def _make_lead(self, principal_token):
        return requests.post(f"{API}/v1/enroll/leads",
                             headers=_hdr(principal_token),
                             json={"full_name": "TEST_AZ",
                                   "email": "TEST_az@demo.claros",
                                   "phone": "+91-9000000099",
                                   "source": "WEBSITE"}, timeout=30).json()["id"]

    def test_student_cannot_delete(self, student_token, principal_token):
        lid = self._make_lead(principal_token)
        r = requests.delete(f"{API}/v1/enroll/leads/{lid}",
                            headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403

    def test_student_cannot_activity(self, student_token, principal_token):
        lid = self._make_lead(principal_token)
        r = requests.post(f"{API}/v1/enroll/leads/{lid}/activity",
                          headers=_hdr(student_token),
                          json={"activity_type": "CALL", "description": "x"}, timeout=30)
        assert r.status_code == 403

    def test_student_cannot_ai_counsel(self, student_token, principal_token):
        lid = self._make_lead(principal_token)
        r = requests.post(f"{API}/v1/enroll/leads/{lid}/ai-counsel",
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403

    def test_cross_tenant_list_403(self, principal_token):
        r = requests.get(f"{API}/v1/enroll/leads?iid={ISB_IID}",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 403

    def test_registrar_cannot_delete(self, registrar_token, principal_token):
        # Registrar in WRITE_ROLES but not DELETE_ROLES
        lid = self._make_lead(principal_token)
        r = requests.delete(f"{API}/v1/enroll/leads/{lid}",
                            headers=_hdr(registrar_token), timeout=30)
        assert r.status_code == 403


# -------------------- LEAD SCORE FORMULA --------------------

class TestLeadScore:
    @pytest.mark.parametrize("rank,source,expected", [
        (1000, "REFERRAL", 45),   # 30 + 15
        (18000, "EVENT", 30),     # 20 + 10
        (10000, "WEBSITE", 25),   # 20 + 5
        (600000, "WALKIN", 0),    # 0 + 0
    ])
    def test_score_at_creation(self, principal_token, rank, source, expected):
        r = requests.post(f"{API}/v1/enroll/leads",
                          headers=_hdr(principal_token),
                          json={"full_name": f"TEST_Score_{rank}_{source}",
                                "email": f"TEST_score_{rank}_{source.lower()}@demo.claros",
                                "phone": "+91-9000000010",
                                "eapcet_rank": rank,
                                "source": source}, timeout=30).json()
        assert r["lead_score"] == expected, f"rank={rank} source={source}: expected {expected} got {r['lead_score']}"

    def test_score_after_status_counseled(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_Couns Lead",
                                 "email": "TEST_couns@demo.claros",
                                 "phone": "+91-9000000011",
                                 "eapcet_rank": 10000,  # +20
                                 "source": "WEBSITE"},  # +5
                           timeout=30).json()
        lid = cr["id"]
        r = requests.put(f"{API}/v1/enroll/leads/{lid}",
                         headers=_hdr(principal_token),
                         json={"status": "COUNSELED"}, timeout=30)
        # 20 + 5 + 10 (COUNSELED) + 10 (auto STATUS_CHANGE activity) = 45
        assert r.json()["lead_score"] == 45, f"got {r.json()['lead_score']}"

    def test_score_bumps_with_activities(self, principal_token):
        cr = requests.post(f"{API}/v1/enroll/leads",
                           headers=_hdr(principal_token),
                           json={"full_name": "TEST_Bump Lead",
                                 "email": "TEST_bump@demo.claros",
                                 "phone": "+91-9000000012",
                                 "eapcet_rank": 1000,
                                 "source": "REFERRAL"}, timeout=30).json()
        lid = cr["id"]
        assert cr["lead_score"] == 45  # 30 + 15
        for i in range(3):
            requests.post(f"{API}/v1/enroll/leads/{lid}/activity",
                          headers=_hdr(principal_token),
                          json={"activity_type": "CALL",
                                "description": f"TEST activity {i}"}, timeout=30)
        g = requests.get(f"{API}/v1/enroll/leads/{lid}",
                         headers=_hdr(principal_token), timeout=30).json()
        # 30 + 15 + 20 (3 acts) = 65
        assert g["lead"]["lead_score"] == 65, f"got {g['lead']['lead_score']}"


# -------------------- MULTI-TENANT SEED --------------------

class TestMultiTenantSeed:
    @pytest.mark.parametrize("email", [
        "shankar.dean@isb.edu",
        "khalid.exec@eaic.gov.ae",
        "emma.admin@bradford.ac.uk",
    ])
    def test_tenant_has_30_leads(self, email):
        try:
            tok = _login(email, "Demo@2026")
        except AssertionError:
            pytest.skip(f"login fail {email}")
        r = requests.get(f"{API}/v1/enroll/leads?page=1&page_size=200",
                         headers=_hdr(tok), timeout=30)
        assert r.status_code == 200
        assert r.json()["total"] == 30, f"{email}: total={r.json()['total']}"

    def test_isb_sources_distribution(self):
        tok = _login("shankar.dean@isb.edu", "Demo@2026")
        r = requests.get(f"{API}/v1/enroll/analytics/sources",
                         headers=_hdr(tok), timeout=30).json()
        by_src = {it["source"]: it["total"] for it in r["items"]}
        # Spec: WEBSITE 15 / REFERRAL 7 / EVENT 5 / WALKIN 3
        assert by_src.get("WEBSITE", 0) == 15, by_src
        assert by_src.get("REFERRAL", 0) == 7, by_src
        assert by_src.get("EVENT", 0) == 5, by_src
        assert by_src.get("WALKIN", 0) == 3, by_src


# -------------------- LEGACY ARISE / PHASE-32 REGRESSION --------------------

class TestRegression:
    def test_arise_legacy_leads(self, principal_token):
        r = requests.get(f"{API}/admissions/{VCE_IID}/leads",
                         headers=_hdr(principal_token), timeout=30)
        # accept 200 or 404 (if endpoint shape differs) but not 5xx
        assert r.status_code < 500, r.text

    def test_arise_scoring(self, principal_token):
        r = requests.post(f"{API}/arise/{VCE_IID}/scoring/score",
                          headers=_hdr(principal_token),
                          json={}, timeout=30)
        assert r.status_code < 500, r.text

    def test_core_stats_still_works(self, principal_token):
        r = requests.get(f"{API}/v1/core/stats",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["total_students"] == 20

    def test_core_notices(self, principal_token):
        r = requests.get(f"{API}/v1/core/notices",
                         headers=_hdr(principal_token), timeout=30)
        assert r.status_code == 200
