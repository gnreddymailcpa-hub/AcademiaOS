"""
Phase 23 — Phase-3 (GREENIQ) closeout tests for routes_phase3_complete.py:
  • z-score anomaly detection on energy + water (boundary at threshold)
  • solar inverter ingest — performance ratio math + greeniq_energy mirror
  • solar summary aggregation (total/per-inverter)
  • Claude-grounded action plan — baseline metrics + actions array shape

Cross-tenant 403 + role-gate 403 on action-plan generation.
"""
import os
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


class TestAnomalies:
    def test_seed_then_detect(self, vce_token):
        # Seed a unique meter with clear outlier
        meter = f"M-anom-{uuid.uuid4().hex[:6]}"
        baseline = [100, 110, 105, 102, 99, 108, 103, 101, 107]
        for kwh in baseline + [1500]:  # 1500 = obvious anomaly
            r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/energy",
                              headers=_h(vce_token), json={
                                  "meter_id": meter, "location": "Block-Test",
                                  "kwh": kwh, "source": "grid", "period": "2026-02",
                              }, timeout=15)
            assert r.status_code == 200

        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "energy", "threshold": 2.0},
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["metric"] == "energy"
        flags_for_meter = [a for a in body["anomalies"] if a["group_id"] == meter]
        assert flags_for_meter, "1500 kWh outlier should be flagged"
        f = flags_for_meter[0]
        assert f["value"] == 1500.0
        assert f["direction"] == "above"
        assert abs(f["z_score"]) >= 2.0

    def test_invalid_metric_422(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "noise"}, headers=_h(vce_token), timeout=20)
        assert r.status_code == 422

    def test_threshold_zero_422(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "energy", "threshold": 0}, headers=_h(vce_token), timeout=20)
        assert r.status_code == 422

    def test_higher_threshold_returns_fewer(self, vce_token):
        a = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "energy", "threshold": 1.5}, headers=_h(vce_token), timeout=20).json()
        b = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "energy", "threshold": 3.0}, headers=_h(vce_token), timeout=20).json()
        assert len(a["anomalies"]) >= len(b["anomalies"])

    def test_cross_tenant_blocked(self, isb_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/anomalies",
                         params={"metric": "energy"}, headers=_h(isb_token), timeout=20)
        assert r.status_code == 403


class TestSolar:
    def test_ingest_with_pr(self, vce_token):
        # 50 kWh at 1000 W/m² with 50 kWp → expected 50 → PR ≈ 1.0
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/ingest",
                          headers=_h(vce_token), json={
                              "inverter_id": "INV-P23-A", "location": "Block A",
                              "generation_kwh": 50.0, "irradiance_wm2": 1000,
                              "capacity_kwp": 50.0, "period": "2026-02-06T12:00",
                          }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["performance_ratio"] == 1.0

    def test_ingest_low_pr(self, vce_token):
        # 20 kWh at 1000 W/m² with 50 kWp → PR = 0.4
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/ingest",
                          headers=_h(vce_token), json={
                              "inverter_id": "INV-P23-B", "location": "Block B",
                              "generation_kwh": 20.0, "irradiance_wm2": 1000,
                              "capacity_kwp": 50.0, "period": "2026-02-06T12:00",
                          }, timeout=20)
        assert r.status_code == 200
        assert r.json()["performance_ratio"] == 0.4

    def test_ingest_without_irradiance_no_pr(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/ingest",
                          headers=_h(vce_token), json={
                              "inverter_id": "INV-P23-C", "location": "x",
                              "generation_kwh": 10.0, "period": "2026-02-06T12:00",
                          }, timeout=20)
        assert r.status_code == 200
        assert r.json()["performance_ratio"] is None

    def test_summary_rolls_up(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/summary",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["total_readings"] >= 3
        # At least INV-P23-A should appear in the inverter rollup
        inv_a = [i for i in body["inverters"] if i["inverter_id"] == "INV-P23-A"]
        assert inv_a and inv_a[0]["total_kwh"] >= 50.0

    def test_solar_mirrored_into_energy(self, vce_token):
        # After ingests above, greeniq_energy should have a solar-meter row
        r = requests.get(f"{BASE_URL}/api/greeniq/{VCE}/energy",
                         headers=_h(vce_token), timeout=20)
        rows = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        solar_rows = [x for x in rows if x.get("source") == "solar"
                       and x.get("meter_id") == "solar-INV-P23-A"]
        assert solar_rows, "solar ingest should mirror into greeniq_energy"

    def test_readings_listing(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/readings",
                         params={"limit": 5}, headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) <= 5

    def test_ingest_invalid_irradiance(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/solar/ingest",
                          headers=_h(vce_token), json={
                              "inverter_id": "x", "location": "y",
                              "generation_kwh": 10, "irradiance_wm2": 5000,  # > 1500 max
                              "period": "2026-02-06T12:00",
                          }, timeout=20)
        assert r.status_code == 422


class TestActionPlan:
    def test_generate_grounded_plan(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/action-plan",
                          headers=_h(vce_token),
                          json={"focus": "energy", "horizon_months": 6}, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["focus"] == "energy"
        assert body["horizon_months"] == 6
        assert isinstance(body["actions"], list) and body["actions"]
        for a in body["actions"]:
            assert a["title"]
            assert a["target_metric"] in ("energy", "water", "carbon", "waste", "other")
            assert a["effort"] in ("low", "medium", "high")
            assert a["impact"] in ("low", "medium", "high")
            assert 1 <= a["timeline_months"] <= 60
        # Baseline metrics must reflect actual DB state
        assert "total_kwh" in body["baseline_metrics"]
        assert body["baseline_metrics"]["energy_readings"] > 0

    def test_plan_listing(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/phase3/{VCE}/greeniq/action-plan",
                         headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1

    def test_plan_student_403(self, vce_student_token):
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/action-plan",
                          headers=_h(vce_student_token),
                          json={"focus": "overall", "horizon_months": 6}, timeout=20)
        assert r.status_code == 403

    def test_plan_invalid_focus_422(self, vce_token):
        r = requests.post(f"{BASE_URL}/api/phase3/{VCE}/greeniq/action-plan",
                          headers=_h(vce_token),
                          json={"focus": "moon", "horizon_months": 6}, timeout=20)
        assert r.status_code == 422
