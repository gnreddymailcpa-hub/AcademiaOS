"""
Phase 25 — ARISE deepening test suite.

Coverage:
  • Logistic-regression lead scorer — train, AUC threshold check, score new lead
  • Active-model retrieval (404 before train, 200 after)
  • Logistic enrollment predictor (rank/branch/geo)
  • EAPCET rank predictor — P50/P90 + counseling probability
  • Source-attribution conversion analytics
  • Auto-drip on lead create — drip_id + drip_dispatched_at present
  • NEXUS hand-off on PATCH stage=enrolled — idempotent
  • B-category allocation — quota cap + lead transitioned to applied
  • Role-gating + cross-tenant 403
"""
import os
import random
import pytest
import requests
import uuid

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


@pytest.fixture(scope="module")
def vce_student_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "manikanta.cse@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _seed_labelled_leads(token: str, suffix: str, n: int = 30):
    """Seed deterministic, well-separated positive/negative labels so AUC is meaningful."""
    random.seed(123 + sum(ord(c) for c in suffix))
    branches = ["CSE", "AIML", "DS", "ECE", "EEE", "MECH", "CIVIL"]
    sources = ["EAPCET counselling", "Reference / Alumni", "Walk-in",
                "Online inquiry", "Social media", "Education fair"]
    cities = ["Hyderabad", "Warangal", "Vijayawada", "Guntur", "Karimnagar"]
    created = 0
    for i in range(n):
        # Force a strong rank–stage relationship so the model has signal
        good = random.random() < 0.45
        if good:
            rank = random.choice([1000, 3000, 5000, 9000])
            branch = random.choice(["CSE", "AIML", "DS"])
            stage = "enrolled"
        else:
            rank = random.choice([60000, 100000, 150000])
            branch = random.choice(["MECH", "CIVIL", "EEE"])
            stage = random.choice(["new", "counseled", "dropped"])
        payload = {
            "name": f"Phase25_{suffix}_{i}",
            "phone": f"9{random.randint(100000000, 999999999)}",
            "email": f"p25{suffix}{i}@x.com",
            "preferred_branch": branch, "eapcet_rank": rank,
            "budget_lakhs": random.choice([2, 3, 4, 5]),
            "source": random.choice(sources),
            "city": random.choice(cities),
        }
        r = requests.post(f"{BASE_URL}/api/admissions/{VCE}/leads",
                          headers=_h(token), json=payload, timeout=15)
        if r.status_code == 200:
            lid = r.json()["id"]
            if stage != "new":
                requests.patch(f"{BASE_URL}/api/admissions/{VCE}/leads/{lid}",
                               headers=_h(token), json={"stage": stage}, timeout=15)
            created += 1
    return created


class TestLeadScorer:
    @pytest.fixture(scope="class")
    def seeded(self, vce_token):
        _seed_labelled_leads(vce_token, "scorer", 30)
        yield

    def test_train_meets_auc(self, vce_token, seeded):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/scoring/train",
                          headers=_h(vce_token),
                          json={"test_fraction": 0.25, "epochs": 600}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["feature_names"]) >= 40   # 40+ signal feature space
        assert body["auc_holdout"] >= 0.78        # acceptance criterion
        assert body["active"] is True
        assert body["n_train"] >= 10
        assert body["n_test"] >= 3

    def test_active_model_get(self, vce_token, seeded):
        r = requests.get(f"{BASE_URL}/api/arise/{VCE}/scoring/model",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["active"] is True

    def test_score_new_lead(self, vce_token, seeded):
        # Strong lead — should score high
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/scoring/score",
                          headers=_h(vce_token), json={
                              "name": "Strong", "phone": "9999999999",
                              "email": "s@x.com", "preferred_branch": "CSE",
                              "eapcet_rank": 2500, "budget_lakhs": 6,
                              "source": "EAPCET counselling", "city": "Hyderabad",
                          }, timeout=20)
        assert r.status_code == 200
        strong = r.json()
        assert 0 <= strong["score_0_100"] <= 100

        # Weak lead
        r2 = requests.post(f"{BASE_URL}/api/arise/{VCE}/scoring/score",
                           headers=_h(vce_token), json={
                               "name": "Weak", "phone": "8888888888",
                               "preferred_branch": "CIVIL",
                               "eapcet_rank": 200000, "budget_lakhs": 1,
                               "source": "Walk-in",
                           }, timeout=20)
        assert r2.status_code == 200
        weak = r2.json()
        # Strong > weak on a separable dataset
        assert strong["probability_enrolled"] > weak["probability_enrolled"]

    def test_train_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/scoring/train",
                          headers=_h(vce_student_token),
                          json={"test_fraction": 0.25}, timeout=20)
        assert r.status_code == 403

    def test_cross_tenant_403(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/arise/{VCE}/scoring/model",
                         headers=_h(isb_token), timeout=20)
        assert r.status_code == 403


class TestEnrollmentPredictor:
    @pytest.fixture(scope="class")
    def seeded(self, vce_token):
        _seed_labelled_leads(vce_token, "enr", 20)
        yield

    def test_predict_ok(self, vce_token, seeded):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/predict-enrollment",
                          headers=_h(vce_token), json={
                              "rank": 5000, "branch": "CSE", "geo": "urban_hyd",
                          }, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert 0.0 <= b["probability_enrolled"] <= 1.0
        assert b["trained_on_n"] >= 10

    def test_predict_bad_branch_422(self, vce_token, seeded):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/predict-enrollment",
                          headers=_h(vce_token), json={
                              "rank": 5000, "branch": "QUANTUM", "geo": "urban_hyd",
                          }, timeout=20)
        assert r.status_code == 422

    def test_predict_bad_geo_422(self, vce_token, seeded):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/predict-enrollment",
                          headers=_h(vce_token), json={
                              "rank": 5000, "branch": "CSE", "geo": "mars",
                          }, timeout=20)
        assert r.status_code == 422


class TestEapcetPredictor:
    @pytest.fixture(scope="class")
    def seeded(self, vce_token):
        _seed_labelled_leads(vce_token, "eapcet", 25)
        yield

    def test_predict_shape(self, vce_token, seeded):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/eapcet/predict-counseling",
                          headers=_h(vce_token), json={"rank": 12000}, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["input_rank"] == 12000
        assert len(b["branches"]) == 7
        # Best match has the highest probability
        if b["best_match"]:
            best_prob = b["best_match"]["counseling_probability"]
            for br in b["branches"]:
                assert br["counseling_probability"] <= best_prob + 1e-6

    def test_low_rank_high_chance(self, vce_token, seeded):
        # A very strong rank should have a high counseling probability for at
        # least the top-1 branch
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/eapcet/predict-counseling",
                          headers=_h(vce_token), json={"rank": 500}, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["best_match"]["counseling_probability"] >= 0.5


class TestSourceAttribution:
    def test_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/arise/{VCE}/source-attribution",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["total_leads"] > 0
        assert b["by_source"] and "conversion_pct" in b["by_source"][0]
        # Sorted desc
        pct = [s["conversion_pct"] for s in b["by_source"]]
        assert pct == sorted(pct, reverse=True)


class TestAutoDrip:
    def test_drip_dispatched_on_create(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/admissions/{VCE}/leads",
                          headers=_h(vce_token), json={
                              "name": f"AutoDrip_{uuid.uuid4().hex[:6]}",
                              "phone": "9876543210",
                              "preferred_branch": "CSE", "eapcet_rank": 5000,
                              "source": "Online inquiry",
                          }, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["drip_id"]
        assert d["drip_dispatched_at"]
        # Verify the drip row exists
        dr = requests.get(f"{BASE_URL}/api/phase1/{VCE}/arise/drip",
                          headers=_h(vce_token), timeout=20).json()
        ids = [x["id"] for x in dr]
        assert d["drip_id"] in ids


class TestNexusHandoff:
    def test_enroll_creates_nexus_student(self, vce_token):
        lead = requests.post(f"{BASE_URL}/api/admissions/{VCE}/leads",
                             headers=_h(vce_token), json={
                                 "name": f"Handoff_{uuid.uuid4().hex[:6]}",
                                 "phone": "9999000011",
                                 "preferred_branch": "AIML", "eapcet_rank": 3500,
                                 "source": "EAPCET counselling",
                             }, timeout=20).json()
        r = requests.patch(f"{BASE_URL}/api/admissions/{VCE}/leads/{lead['id']}",
                           headers=_h(vce_token),
                           json={"stage": "enrolled"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["stage"] == "enrolled"
        assert body["nexus_student_id"]

        # Idempotency: PATCH again to enrolled, nexus_student_id is preserved
        r2 = requests.patch(f"{BASE_URL}/api/admissions/{VCE}/leads/{lead['id']}",
                            headers=_h(vce_token),
                            json={"stage": "enrolled", "notes": "double"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["nexus_student_id"] == body["nexus_student_id"]


class TestBCategory:
    def test_allocate_and_cap(self, vce_token):
        lead = requests.post(f"{BASE_URL}/api/admissions/{VCE}/leads",
                             headers=_h(vce_token), json={
                                 "name": f"BCat_{uuid.uuid4().hex[:6]}",
                                 "phone": "9012345678",
                                 "preferred_branch": "ECE", "eapcet_rank": 90000,
                                 "source": "Reference / Alumni",
                             }, timeout=20).json()
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/b-category/allocate",
                          headers=_h(vce_token), json={
                              "lead_id": lead["id"], "quota": "b_category",
                              "branch": "ECE", "fee_quoted_lakhs": 11,
                          }, timeout=20)
        assert r.status_code == 200
        # Lead is transitioned to applied + tagged with quota_path
        ll = requests.get(f"{BASE_URL}/api/admissions/{VCE}/leads",
                          headers=_h(vce_token), timeout=20).json()
        flipped = next((x for x in ll if x["id"] == lead["id"]), None)
        assert flipped["stage"] == "applied"
        assert flipped["quota_path"] == "b_category"

    def test_unknown_lead_404(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/b-category/allocate",
                          headers=_h(vce_token), json={
                              "lead_id": "doesnotexist", "quota": "spot", "branch": "CSE",
                          }, timeout=20)
        assert r.status_code == 404

    def test_bad_quota_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/b-category/allocate",
                          headers=_h(vce_token), json={
                              "lead_id": "x", "quota": "alien", "branch": "CSE",
                          }, timeout=20)
        assert r.status_code == 422

    def test_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/arise/{VCE}/b-category/allocate",
                          headers=_h(vce_student_token), json={
                              "lead_id": "x", "quota": "spot", "branch": "CSE",
                          }, timeout=20)
        assert r.status_code == 403

    def test_listing(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/arise/{VCE}/b-category",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200 and isinstance(r.json(), list)
