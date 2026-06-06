"""
Phase 20 (P3) tests:
1) seed_phase2 diversity & idempotency (alumni, pubs, drives, energy)
2) ALUMNI mentor-match diversity (AIML/ML, ECE/Embedded)
3) Executive Briefing endpoint shape, content, and cross-tenant 403
4) Modules catalog & PATCH (used by onboarding wizard)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
VCE = "44444444-4444-4444-4444-444444444444"
ISB = "11111111-1111-1111-1111-111111111111"


@pytest.fixture(scope="module")
def vce_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "principal@vaagdevi.edu.in", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "rajiv.admin@isb.edu", "password": "Demo@2026"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------------- 1. seed_phase2 diversity --------------
class TestSeedPhase2:
    def test_alumni_directory_diversity(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/alumni/{VCE}/directory", headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        # find list (could be raw list or wrapped)
        if isinstance(items, dict):
            items = items.get("items") or items.get("data") or items.get("results") or []
        assert isinstance(items, list)
        assert len(items) >= 12, f"Expected ≥12 alumni, got {len(items)}"
        branches = {a.get("branch") for a in items if a.get("branch")}
        required = {"CSE", "AIML", "ECE", "EEE", "MECH", "CIV", "DS"}
        assert required.issubset(branches), f"Missing branches: {required - branches}"
        mentors_available = [a for a in items if a.get("available_for_mentorship")]
        assert len(mentors_available) >= 8, f"Expected ≥8 mentors, got {len(mentors_available)}"

    def test_prism_publications_seeded(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/prism/{VCE}/publications", headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("data") or []
        assert len(items) >= 7, f"Expected ≥7 publications, got {len(items)}"

    def test_pathfinder_drives_seeded(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/placements/{VCE}/drives", headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("data") or []
        assert len(items) >= 4, f"Expected ≥4 drives, got {len(items)}"

    def test_greeniq_energy_seeded(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/greeniq/{VCE}/energy", headers=_h(vce_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("data") or []
        assert len(items) >= 7, f"Expected ≥7 energy readings, got {len(items)}"


# -------------- 2. mentor-match diversity --------------
class TestMentorMatchDiversity:
    def test_aiml_ml_match(self, vce_token):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{VCE}/mentor-match",
            params={"branch": "AIML", "role": "ML", "limit": 3},
            headers=_h(vce_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("matches") or items.get("data") or []
        assert isinstance(items, list) and len(items) >= 1
        aiml_high = [m for m in items if m.get("branch") == "AIML" and (m.get("match_score") or 0) >= 80]
        assert aiml_high, f"Expected ≥1 AIML mentor with score≥80, got: {items}"

    def test_ece_embedded_match(self, vce_token):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{VCE}/mentor-match",
            params={"branch": "ECE", "role": "Embedded", "limit": 3},
            headers=_h(vce_token), timeout=20,
        )
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("matches") or items.get("data") or []
        ece_high = [m for m in items if m.get("branch") == "ECE" and (m.get("match_score") or 0) >= 80]
        assert ece_high, f"Expected ≥1 ECE mentor with score≥80, got: {items}"


# -------------- 3. Executive Briefing --------------
class TestExecBriefing:
    def test_briefing_shape(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/exec/briefing/{VCE}", headers=_h(vce_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "institution" in d and d["institution"]["id"] == VCE
        assert "generated_at" in d and "generated_by" in d
        h = d["headline"]
        assert isinstance(h["composite_score"], (int, float)) and h["composite_score"] >= 75
        assert h["grade"] in ("A++", "A+", "A")
        assert isinstance(h["platforms_active"], int)
        assert isinstance(h["active_users"], int)

        secs = d["sections"]
        codes = [s["code"] for s in secs]
        expected = ["ARISE", "NEXUS", "PRISM", "PATHFINDER", "ALUMNI360", "FACULTY", "GUARDIAN", "GREENIQ"]
        for code in expected:
            assert code in codes, f"Missing section {code}"
        for s in secs:
            assert isinstance(s["metrics"], list) and len(s["metrics"]) >= 1
            for m in s["metrics"]:
                assert "k" in m and "v" in m

    def test_briefing_cross_tenant_403(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/exec/briefing/{ISB}", headers=_h(vce_token), timeout=20)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_briefing_unauth(self):
        r = requests.get(f"{BASE_URL}/api/exec/briefing/{VCE}", timeout=15)
        assert r.status_code in (401, 403)


# -------------- 4. Modules (onboarding backing) --------------
class TestModulesCatalog:
    def test_catalog_has_12(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/modules/catalog", headers=_h(vce_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("data") or []
        assert len(items) == 12, f"Expected 12 catalog entries, got {len(items)}"
        assert all("code" in c and "default_status" in c for c in items)

    def test_tenant_modules_get(self, vce_token):
        r = requests.get(f"{BASE_URL}/api/modules/{VCE}", headers=_h(vce_token), timeout=15)
        assert r.status_code == 200

    def test_patch_module_flip(self, vce_token):
        # Find current ILLUMINATE status, flip then flip back
        get_all = requests.get(f"{BASE_URL}/api/modules/{VCE}", headers=_h(vce_token), timeout=15).json()
        items = get_all if isinstance(get_all, list) else (get_all.get("items") or [])
        target = next((m for m in items if m.get("code") == "ILLUMINATE"), None)
        original = target["status"] if target else "active"
        new_status = "disabled" if original == "active" else "active"
        p1 = requests.patch(f"{BASE_URL}/api/modules/{VCE}/ILLUMINATE",
                            json={"status": new_status}, headers=_h(vce_token), timeout=15)
        assert p1.status_code in (200, 204), p1.text
        # Verify persisted
        verify = requests.get(f"{BASE_URL}/api/modules/{VCE}", headers=_h(vce_token), timeout=15).json()
        verify_items = verify if isinstance(verify, list) else (verify.get("items") or [])
        v_target = next((m for m in verify_items if m.get("code") == "ILLUMINATE"), None)
        assert v_target and v_target["status"] == new_status
        # Restore
        requests.patch(f"{BASE_URL}/api/modules/{VCE}/ILLUMINATE",
                       json={"status": original}, headers=_h(vce_token), timeout=15)
