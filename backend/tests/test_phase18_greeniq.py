"""
Phase 18 - GREENIQ (Sustainability) backend tests.
Endpoints exercised:
  POST /api/greeniq/{tenant}/energy  (writer-guarded)
  GET  /api/greeniq/{tenant}/energy
  POST /api/greeniq/{tenant}/water   (writer-guarded)
  POST /api/greeniq/{tenant}/carbon  (writer-guarded, scope 1..3)
  GET  /api/greeniq/{tenant}/esg     (read-only, composite + grade)
  GET  /api/modules/{tenant}         (GREENIQ active regression + 12 modules)
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


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return login(*PRINCIPAL)


@pytest.fixture(scope="module")
def student_token():
    return login(*STUDENT)


# ---------- Energy ----------
class TestEnergy:
    def test_post_grid_energy(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/energy", headers=hdr(admin_token),
                          json={"meter_id": "M-BL1", "location": "Block 1",
                                "kwh": 12000, "source": "grid", "period": "2026-02"},
                          timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("en-")
        # 12000 * 0.82 / 1000 = 9.84
        assert d["tco2e"] == 9.84, f"tco2e expected 9.84 got {d['tco2e']}"

    def test_post_solar_energy(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/energy", headers=hdr(admin_token),
                          json={"meter_id": "M-SOLAR", "location": "Block 1",
                                "kwh": 4500, "source": "solar", "period": "2026-02"},
                          timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # 4500 * 0.04 / 1000 = 0.18
        assert d["tco2e"] == 0.18, f"tco2e expected 0.18 got {d['tco2e']}"

    def test_list_energy_sorted_desc(self, admin_token):
        # Post one for an older period to verify sort order
        requests.post(f"{BASE_URL}/api/greeniq/{VCE}/energy", headers=hdr(admin_token),
                      json={"meter_id": "M-OLD", "location": "Block 1",
                            "kwh": 1000, "source": "grid", "period": "2026-01"},
                      timeout=20)
        r = requests.get(f"{BASE_URL}/api/greeniq/{VCE}/energy",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 2
        periods = [x["period"] for x in rows]
        assert periods == sorted(periods, reverse=True), f"not desc: {periods}"

    def test_student_cannot_post_energy(self, student_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/energy", headers=hdr(student_token),
                          json={"meter_id": "S-X", "location": "X",
                                "kwh": 100, "source": "grid", "period": "2026-02"},
                          timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_student_can_read_esg(self, student_token):
        # writer-blocked but read-only allowed
        r = requests.get(f"{BASE_URL}/api/greeniq/{VCE}/esg",
                         headers=hdr(student_token), timeout=20)
        assert r.status_code == 200


# ---------- Water ----------
class TestWater:
    def test_post_water(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/water", headers=hdr(admin_token),
                          json={"source_id": "W-BORE-01", "location": "Block 1",
                                "kilolitres": 250, "source": "borewell",
                                "period": "2026-02"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("wa-")
        assert d["kilolitres"] == 250


# ---------- Carbon ----------
class TestCarbon:
    def test_post_carbon_scope1(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/carbon", headers=hdr(admin_token),
                          json={"scope": 1, "activity": "Diesel generator",
                                "tco2e": 3.5, "period": "2026-02"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("co-")
        assert d["scope"] == 1
        assert d["tco2e"] == 3.5

    def test_post_carbon_scope4_invalid(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/greeniq/{VCE}/carbon", headers=hdr(admin_token),
                          json={"scope": 4, "activity": "Bogus",
                                "tco2e": 1.0, "period": "2026-02"}, timeout=20)
        assert r.status_code == 422, f"expected 422 got {r.status_code}"


# ---------- ESG ----------
class TestESG:
    def test_esg_shape_and_values(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/greeniq/{VCE}/esg",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["composite"], (int, float))
        assert d["grade"] in ("A++", "A+", "A", "B+", "B")
        assert isinstance(d["dimensions"], list) and len(d["dimensions"]) == 5
        for key in ["energy_kwh", "renewable_pct", "water_kl", "recycled_pct", "carbon_tco2e"]:
            assert key in d["totals"], f"missing totals.{key}"
        assert isinstance(d["energy_trend"], list)
        # renewable pct check: this test class state depends on energy postings
        # (grid 12000 + solar 4500 + grid 1000 -> renewable = 4500/17500 = 25.7)
        # But other tests may interfere - just sanity check it's a number 0..100
        assert 0 <= d["totals"]["renewable_pct"] <= 100


# ---------- Cross-tenant denial ----------
class TestCrossTenant:
    def test_vce_principal_to_isb_403(self, admin_token):
        bodies = {
            "energy": {"meter_id": "X", "location": "X", "kwh": 10,
                       "source": "grid", "period": "2026-02"},
            "water": {"source_id": "X", "location": "X", "kilolitres": 10,
                      "source": "borewell", "period": "2026-02"},
            "carbon": {"scope": 1, "activity": "X", "tco2e": 1.0, "period": "2026-02"},
        }
        for ep, body in bodies.items():
            r = requests.post(f"{BASE_URL}/api/greeniq/{ISB}/{ep}",
                              headers=hdr(admin_token), json=body, timeout=20)
            assert r.status_code == 403, f"{ep}: expected 403 got {r.status_code}"


# ---------- Module registry regression ----------
class TestModulesRegistry:
    def test_all_12_active(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/modules/{VCE}",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 12, f"expected 12 modules got {len(rows)}"
        codes = {row["code"]: row["status"] for row in rows}
        assert "GREENIQ" in codes
        assert codes["GREENIQ"] == "active", f"GREENIQ status={codes['GREENIQ']}"
        # All 12 should be active per the request
        inactive = {c: s for c, s in codes.items() if s != "active"}
        assert not inactive, f"inactive modules: {inactive}"
