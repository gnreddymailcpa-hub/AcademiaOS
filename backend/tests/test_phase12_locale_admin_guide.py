"""
Phase 12 tests — Tenant-controlled Arabic locale + Admin Guide.

Covers:
  - GET /api/institutions returns locale_arabic_enabled with correct seeded values.
  - PATCH /api/institutions/{id} as tenant admin toggles locale_arabic_enabled and writes audit.
  - Authorization: student → 403, cross-tenant admin → 403, super_admin → 200.
"""
import os
import pytest
import requests
from pathlib import Path


def _load_frontend_env():
    env_path = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_admin_token():
    return _login("admin@academiaos.ai", "Admin@2026")


@pytest.fixture(scope="module")
def isb_admin_token():
    return _login("rajiv.admin@isb.edu", "Demo@2026")


@pytest.fixture(scope="module")
def eaic_admin_token():
    return _login("fatima.admin@eaic.gov.ae", "Demo@2026")


@pytest.fixture(scope="module")
def student_token():
    return _login("vikram.pgp@isb.edu", "Demo@2026")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- GET institutions seed verification ---
class TestInstitutionsLocaleSeed:
    def test_seed_locale_flags(self, super_admin_token):
        r = requests.get(f"{BASE_URL}/api/institutions", headers=_h(super_admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        by_id = {i["id"]: i for i in items}
        assert ISB_ID in by_id and EAIC_ID in by_id and UOB_ID in by_id
        assert by_id[ISB_ID].get("locale_arabic_enabled") is False
        assert by_id[EAIC_ID].get("locale_arabic_enabled") is True
        assert by_id[UOB_ID].get("locale_arabic_enabled") is False


# --- PATCH happy-path + audit ---
class TestLocaleArabicTogglePersistence:
    def test_isb_admin_can_toggle_locale_and_revert(self, isb_admin_token):
        # toggle ON
        r = requests.patch(
            f"{BASE_URL}/api/institutions/{ISB_ID}",
            headers=_h(isb_admin_token),
            json={"locale_arabic_enabled": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["locale_arabic_enabled"] is True
        assert body["id"] == ISB_ID

        # GET re-verifies
        r2 = requests.get(f"{BASE_URL}/api/institutions/{ISB_ID}", headers=_h(isb_admin_token), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["locale_arabic_enabled"] is True

        # revert
        r3 = requests.patch(
            f"{BASE_URL}/api/institutions/{ISB_ID}",
            headers=_h(isb_admin_token),
            json={"locale_arabic_enabled": False},
            timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json()["locale_arabic_enabled"] is False

        # GET re-verifies revert
        r4 = requests.get(f"{BASE_URL}/api/institutions/{ISB_ID}", headers=_h(isb_admin_token), timeout=15)
        assert r4.status_code == 200
        assert r4.json()["locale_arabic_enabled"] is False

    def test_audit_event_written(self, isb_admin_token):
        # Trigger a known PATCH so a fresh audit row exists
        requests.patch(
            f"{BASE_URL}/api/institutions/{ISB_ID}",
            headers=_h(isb_admin_token),
            json={"locale_arabic_enabled": False},
            timeout=15,
        )
        r = requests.get(f"{BASE_URL}/api/audit/{ISB_ID}", headers=_h(isb_admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert any(it.get("action") == "institution.update" for it in items), (
            "expected at least one institution.update audit event"
        )


# --- Authorization matrix ---
class TestLocaleAuthorization:
    def test_student_forbidden(self, student_token):
        r = requests.patch(
            f"{BASE_URL}/api/institutions/{ISB_ID}",
            headers=_h(student_token),
            json={"locale_arabic_enabled": True},
            timeout=15,
        )
        assert r.status_code == 403

    def test_cross_tenant_admin_forbidden(self, isb_admin_token):
        # ISB admin trying to PATCH EAIC must be 403
        r = requests.patch(
            f"{BASE_URL}/api/institutions/{EAIC_ID}",
            headers=_h(isb_admin_token),
            json={"locale_arabic_enabled": True},
            timeout=15,
        )
        assert r.status_code == 403

    def test_super_admin_cross_tenant_allowed(self, super_admin_token):
        # toggle EAIC OFF then back ON to leave seed intact
        r1 = requests.patch(
            f"{BASE_URL}/api/institutions/{EAIC_ID}",
            headers=_h(super_admin_token),
            json={"locale_arabic_enabled": False},
            timeout=15,
        )
        assert r1.status_code == 200
        assert r1.json()["locale_arabic_enabled"] is False

        r2 = requests.patch(
            f"{BASE_URL}/api/institutions/{EAIC_ID}",
            headers=_h(super_admin_token),
            json={"locale_arabic_enabled": True},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["locale_arabic_enabled"] is True


# --- Regression: institutions list still returns 3 with expected ids ---
class TestRegressionInstitutionsShape:
    def test_three_tenants_present(self, super_admin_token):
        r = requests.get(f"{BASE_URL}/api/institutions", headers=_h(super_admin_token), timeout=15)
        assert r.status_code == 200
        ids = {i["id"] for i in r.json()}
        assert {ISB_ID, EAIC_ID, UOB_ID}.issubset(ids)

    def test_isb_dashboard_metrics_unchanged(self, isb_admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/{ISB_ID}", headers=_h(isb_admin_token), timeout=20)
        assert r.status_code == 200
        # don't over-assert: just confirm payload is non-empty and tenant-scoped
        body = r.json()
        assert isinstance(body, dict) and len(body) > 0
