"""Phase 13 — Platform Module Registry tests.

Covers GET /api/modules/catalog, GET /api/modules/{institution_id},
PATCH /api/modules/{institution_id}/{code} including:
- 6 active Phase-1 modules + 6 coming_soon for VCE
- super_admin + tenant institution_admin can PATCH; flip ARISE disabled<->active
- cross-tenant PATCH from non super_admin -> 403
- non-admin role PATCH -> 403
- dependency error (activate COMPASS when NEXUS disabled) -> 409
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"

ACTIVE_PHASE1 = {"VEDA", "ARISE", "NEXUS", "COMPASS", "PATHFINDER", "COMMAND"}
COMING_SOON_DEFAULT = {"ILLUMINATE", "PRISM", "GUARDIAN", "ALUMNI360", "FACULTY", "GREENIQ"}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def principal_token():
    return _login("principal@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def student_token():
    return _login("manikanta.cse@vaagdevi.edu.in", "Demo@2026")


@pytest.fixture(scope="module")
def super_token():
    return _login("admin@academiaos.ai", "Admin@2026")


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- catalog ---
def test_catalog_returns_12_platforms(principal_token):
    r = requests.get(f"{BASE_URL}/api/modules/catalog", headers=_h(principal_token), timeout=15)
    assert r.status_code == 200
    catalog = r.json()
    assert isinstance(catalog, list)
    codes = {c["code"] for c in catalog}
    assert len(catalog) == 12, f"expected 12 platforms, got {len(catalog)}: {codes}"
    expected = ACTIVE_PHASE1 | COMING_SOON_DEFAULT
    assert expected.issubset(codes), f"missing codes: {expected - codes}"
    # Each entry has key shape
    for c in catalog:
        for k in ("code", "phase", "domain", "name", "tagline", "default_status", "depends_on"):
            assert k in c, f"missing {k} in {c['code']}"


# --- VCE per-tenant listing ---
def test_vce_tenant_returns_phase1_active_and_others_coming_soon(principal_token):
    r = requests.get(f"{BASE_URL}/api/modules/{VCE_ID}", headers=_h(principal_token), timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 12, f"expected 12 rows, got {len(rows)}"
    by_code = {row["code"]: row for row in rows}
    for code in ACTIVE_PHASE1:
        assert by_code[code]["status"] == "active", f"{code} expected active, got {by_code[code]['status']}"
    for code in COMING_SOON_DEFAULT:
        assert by_code[code]["status"] == "coming_soon", (
            f"{code} expected coming_soon, got {by_code[code]['status']}"
        )


# --- PATCH flip ARISE disabled then back to active ---
def test_patch_arise_disable_then_reactivate_persists(principal_token):
    # disable
    r = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/ARISE",
        headers=_h(principal_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "disabled"

    # verify GET reflects disabled
    g = requests.get(f"{BASE_URL}/api/modules/{VCE_ID}", headers=_h(principal_token), timeout=15)
    assert g.status_code == 200
    by_code = {row["code"]: row for row in g.json()}
    assert by_code["ARISE"]["status"] == "disabled"

    # reactivate (VEDA dep is active, should succeed)
    r2 = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/ARISE",
        headers=_h(principal_token),
        json={"status": "active"},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "active"

    g2 = requests.get(f"{BASE_URL}/api/modules/{VCE_ID}", headers=_h(principal_token), timeout=15)
    by_code2 = {row["code"]: row for row in g2.json()}
    assert by_code2["ARISE"]["status"] == "active"
    # configured_by stamp is principal
    assert by_code2["ARISE"]["configured_by"] == "principal@vaagdevi.edu.in"


# --- cross-tenant PATCH denied ---
def test_cross_tenant_patch_denied(principal_token):
    r = requests.patch(
        f"{BASE_URL}/api/modules/{ISB_ID}/ARISE",
        headers=_h(principal_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# --- non-admin (student) PATCH denied ---
def test_student_patch_denied(student_token):
    r = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/ARISE",
        headers=_h(student_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# --- dependency 409: activate COMPASS while NEXUS disabled ---
def test_compass_activation_blocked_when_nexus_disabled(principal_token):
    # Step 1: disable NEXUS
    r1 = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/NEXUS",
        headers=_h(principal_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r1.status_code == 200, r1.text

    # Also disable COMPASS first so we can attempt to activate
    r2 = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/COMPASS",
        headers=_h(principal_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text

    try:
        # Attempt to activate COMPASS while NEXUS is disabled -> 409
        r3 = requests.patch(
            f"{BASE_URL}/api/modules/{VCE_ID}/COMPASS",
            headers=_h(principal_token),
            json={"status": "active"},
            timeout=15,
        )
        assert r3.status_code == 409, f"expected 409 dependency error, got {r3.status_code}: {r3.text}"
        detail = r3.json().get("detail", "")
        assert "NEXUS" in detail
    finally:
        # cleanup: restore NEXUS active then COMPASS active
        rr1 = requests.patch(
            f"{BASE_URL}/api/modules/{VCE_ID}/NEXUS",
            headers=_h(principal_token),
            json={"status": "active"},
            timeout=15,
        )
        assert rr1.status_code == 200
        rr2 = requests.patch(
            f"{BASE_URL}/api/modules/{VCE_ID}/COMPASS",
            headers=_h(principal_token),
            json={"status": "active"},
            timeout=15,
        )
        assert rr2.status_code == 200


# --- invalid status returns 400 ---
def test_invalid_status_400(principal_token):
    r = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/ARISE",
        headers=_h(principal_token),
        json={"status": "bogus"},
        timeout=15,
    )
    assert r.status_code == 400


# --- unknown module returns 404 ---
def test_unknown_module_404(principal_token):
    r = requests.patch(
        f"{BASE_URL}/api/modules/{VCE_ID}/NOPE",
        headers=_h(principal_token),
        json={"status": "active"},
        timeout=15,
    )
    assert r.status_code == 404


# --- super_admin can patch any tenant ---
def test_super_admin_patch_isb(super_token):
    # disable then re-enable ARISE on ISB; restore at end
    r1 = requests.patch(
        f"{BASE_URL}/api/modules/{ISB_ID}/ARISE",
        headers=_h(super_token),
        json={"status": "disabled"},
        timeout=15,
    )
    assert r1.status_code == 200, r1.text
    r2 = requests.patch(
        f"{BASE_URL}/api/modules/{ISB_ID}/ARISE",
        headers=_h(super_token),
        json={"status": "active"},
        timeout=15,
    )
    assert r2.status_code == 200
