"""
Phase 17 - GUARDIAN (Campus Safety) backend tests.
Endpoints exercised:
  POST /api/guardian/{tenant}/incidents   (writer-guarded)
  GET  /api/guardian/{tenant}/incidents
  PATCH /api/guardian/{tenant}/incidents/{id}/resolve
  POST /api/guardian/{tenant}/access      (NO writer guard by design)
  GET  /api/guardian/{tenant}/access
  POST /api/guardian/{tenant}/vehicles    (NO writer guard by design)
  GET  /api/guardian/{tenant}/vehicles
  POST /api/guardian/{tenant}/assets      (writer-guarded, upsert + status thresholds)
  GET  /api/guardian/{tenant}/assets
  GET  /api/guardian/{tenant}/summary
  GET  /api/modules/{tenant}              (GUARDIAN active regression)
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


# ---------- Incidents ----------
class TestIncidents:
    inc_id = None

    def test_create_incident(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/incidents", headers=hdr(admin_token),
                          json={"camera_id": "CAM-MAIN-01", "location": "Main Gate",
                                "detection_type": "intrusion", "severity": "high",
                                "confidence": 0.92, "note": "Test"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("inc-")
        assert d["status"] == "open"
        assert d["severity"] == "high"
        TestIncidents.inc_id = d["id"]

    def test_list_incidents_has_new_at_top(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/incidents",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        # newest should be first (sorted by detected_at desc)
        assert lst[0]["id"] == TestIncidents.inc_id

    def test_resolve_incident(self, admin_token):
        assert TestIncidents.inc_id
        r = requests.patch(
            f"{BASE_URL}/api/guardian/{VCE}/incidents/{TestIncidents.inc_id}/resolve",
            headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # verify GET shows resolved
        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/incidents",
                         headers=hdr(admin_token), timeout=20)
        match = [i for i in r.json() if i["id"] == TestIncidents.inc_id]
        assert match and match[0]["status"] == "resolved"

    def test_resolve_unknown_404(self, admin_token):
        r = requests.patch(
            f"{BASE_URL}/api/guardian/{VCE}/incidents/inc-bogusxxxxxx/resolve",
            headers=hdr(admin_token), timeout=20)
        assert r.status_code == 404

    def test_student_cannot_post_incident(self, student_token):
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/incidents", headers=hdr(student_token),
                          json={"camera_id": "CAM-X", "location": "Hall",
                                "detection_type": "fire", "severity": "low"}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ---------- Access ----------
class TestAccess:
    def test_student_can_record_access_in_and_out(self, student_token, admin_token):
        # baseline summary
        s0 = requests.get(f"{BASE_URL}/api/guardian/{VCE}/summary",
                          headers=hdr(admin_token), timeout=20).json()
        inside_baseline = s0["people_inside_now"]

        unique_user = f"Manikanta-{os.urandom(3).hex()}"
        r_in = requests.post(f"{BASE_URL}/api/guardian/{VCE}/access", headers=hdr(student_token),
                             json={"card_id": "NFC-1234", "user_name": unique_user,
                                   "zone": "Library", "direction": "in"}, timeout=20)
        assert r_in.status_code == 200, r_in.text
        assert r_in.json()["id"].startswith("acc-")

        r_out = requests.post(f"{BASE_URL}/api/guardian/{VCE}/access", headers=hdr(student_token),
                              json={"card_id": "NFC-1234", "user_name": unique_user,
                                    "zone": "Library", "direction": "out"}, timeout=20)
        assert r_out.status_code == 200, r_out.text

        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/access",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        rows = [a for a in r.json() if a.get("user_name") == unique_user]
        assert len(rows) >= 2

        # net 0 - inside_now should not have increased for this user
        s1 = requests.get(f"{BASE_URL}/api/guardian/{VCE}/summary",
                          headers=hdr(admin_token), timeout=20).json()
        # net IN-OUT is 0 so the count should match baseline (or be lower if another
        # parallel user finished out). We assert it did NOT increase.
        assert s1["people_inside_now"] <= inside_baseline + 0, \
            f"inside_now grew unexpectedly: {inside_baseline} -> {s1['people_inside_now']}"


# ---------- Vehicles ----------
class TestVehicles:
    def test_plate_normalised(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/vehicles", headers=hdr(admin_token),
                          json={"plate": "TS 09 AB 1234", "vehicle_type": "car",
                                "direction": "in", "gate": "Main Gate"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("veh-")
        assert d["plate"] == "TS09AB1234", f"plate not normalised: {d['plate']}"
        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/vehicles",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        plates = [v["plate"] for v in r.json()]
        assert "TS09AB1234" in plates


# ---------- Assets ----------
class TestAssets:
    def test_status_thresholds_and_upsert(self, admin_token):
        # operational (>=80)
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/assets", headers=hdr(admin_token),
                          json={"asset_id": "HVAC-BL1", "asset_type": "HVAC",
                                "location": "Block 1", "health_score": 92}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "operational"

        # upsert same asset_id -> still 1 row, status now 'warning' (>=60 <80)
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/assets", headers=hdr(admin_token),
                          json={"asset_id": "HVAC-BL1", "asset_type": "HVAC",
                                "location": "Block 1", "health_score": 70}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "warning"

        # different asset, critical (>0 <60)
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/assets", headers=hdr(admin_token),
                          json={"asset_id": "GEN-MAIN", "asset_type": "Generator",
                                "location": "Utility", "health_score": 30}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "critical"

        # different asset, down (==0)
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/assets", headers=hdr(admin_token),
                          json={"asset_id": "UPS-OLD", "asset_type": "UPS",
                                "location": "Server Room", "health_score": 0}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "down"

        # list returns 3 distinct asset_ids (HVAC-BL1 was upserted), sorted asc by health
        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/assets",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        ids = [a["asset_id"] for a in rows]
        assert ids.count("HVAC-BL1") == 1, f"upsert duplicated: {ids}"
        # check sort asc
        hs = [a["health_score"] for a in rows]
        assert hs == sorted(hs), f"not sorted asc: {hs}"

    def test_student_cannot_post_asset(self, student_token):
        r = requests.post(f"{BASE_URL}/api/guardian/{VCE}/assets", headers=hdr(student_token),
                          json={"asset_id": "STU-X", "asset_type": "HVAC",
                                "location": "Lab", "health_score": 50}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ---------- Summary ----------
class TestSummary:
    def test_summary_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/guardian/{VCE}/summary",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ["incidents_total", "incidents_open", "incidents_today",
                  "incidents_by_severity", "access_events", "people_inside_now",
                  "vehicles_total", "vehicles_in_today",
                  "assets_total", "asset_status", "assets_needing_attention"]:
            assert k in s, f"missing key {k}"
        for sev in ["low", "medium", "high", "critical"]:
            assert sev in s["incidents_by_severity"]
        for st in ["operational", "warning", "critical", "down"]:
            assert st in s["asset_status"]
        # asset rollup integrity: needing_attention == warning + critical + down
        a = s["asset_status"]
        assert s["assets_needing_attention"] == a["warning"] + a["critical"] + a["down"]


# ---------- Cross-tenant denial ----------
class TestCrossTenant:
    def test_vce_principal_to_isb_403_all_four(self, admin_token):
        bodies = {
            "incidents": {"camera_id": "X", "location": "X",
                          "detection_type": "intrusion", "severity": "low"},
            "access": {"card_id": "X", "user_name": "X", "zone": "X", "direction": "in"},
            "vehicles": {"plate": "AA01AA0001", "vehicle_type": "car", "direction": "in"},
            "assets": {"asset_id": "X", "asset_type": "HVAC",
                       "location": "X", "health_score": 50},
        }
        for ep, body in bodies.items():
            r = requests.post(f"{BASE_URL}/api/guardian/{ISB}/{ep}",
                              headers=hdr(admin_token), json=body, timeout=20)
            assert r.status_code == 403, f"{ep}: expected 403 got {r.status_code} body={r.text}"


# ---------- Module registry regression ----------
class TestModulesRegistry:
    def test_guardian_active_and_count(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/modules/{VCE}",
                         headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 12, f"expected 12 modules got {len(rows)}"
        guard = None
        for m in rows:
            for v in m.values():
                if isinstance(v, str) and v.upper() == "GUARDIAN":
                    guard = m
                    break
            if guard:
                break
        assert guard is not None, "GUARDIAN not in modules registry"
        assert guard.get("status") == "active", f"GUARDIAN status={guard.get('status')}"
