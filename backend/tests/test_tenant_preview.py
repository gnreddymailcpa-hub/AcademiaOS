"""Backend regression tests for 'Preview as Tenant' (P2 feature).

Validates that GET /api/v1/tenants/{tenant_id}/config:
  - returns 200 for super_admin and resolves VCE branding (VEDA rename)
  - returns 403 for non-super-admin (institution_admin in this case)
  - returns 401 with no token
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

SUPER_ADMIN = ("admin@academiaos.ai", "Admin@2026")
VCE_PRINCIPAL = ("principal@vaagdevi.edu.in", "Demo@2026")

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return _login(*SUPER_ADMIN)


@pytest.fixture(scope="module")
def vce_principal_token():
    return _login(*VCE_PRINCIPAL)


class TestTenantPreviewConfig:
    def test_super_admin_can_fetch_vce_config(self, super_token):
        r = requests.get(f"{BASE_URL}/api/v1/tenants/{VCE_ID}/config",
                         headers={"Authorization": f"Bearer {super_token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["tenant_id"] == VCE_ID
        assert "Vaagdevi" in (data.get("tenant_name") or "")
        # VEDA seed rename for claros-ai
        ai = data["modules"]["claros-ai"]
        assert ai["display_name"] == "VEDA", f"Expected VEDA, got {ai['display_name']}"
        assert ai["is_overridden"] is True
        # Platform display name should be VCE-branded
        assert "VCE" in (data.get("platform_display_name") or "") or \
               "Vaagdevi" in (data.get("platform_display_name") or "")

    def test_super_admin_can_fetch_isb_config(self, super_token):
        r = requests.get(f"{BASE_URL}/api/v1/tenants/{ISB_ID}/config",
                         headers={"Authorization": f"Bearer {super_token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["tenant_id"] == ISB_ID
        # ISB should have a claros-ai module entry
        assert "claros-ai" in data["modules"]

    def test_non_super_admin_forbidden(self, vce_principal_token):
        r = requests.get(f"{BASE_URL}/api/v1/tenants/{VCE_ID}/config",
                         headers={"Authorization": f"Bearer {vce_principal_token}"}, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_non_super_admin_forbidden_other_tenant(self, vce_principal_token):
        # Even for a different tenant, regular user must get 403
        r = requests.get(f"{BASE_URL}/api/v1/tenants/{ISB_ID}/config",
                         headers={"Authorization": f"Bearer {vce_principal_token}"}, timeout=15)
        assert r.status_code == 403

    def test_unauthenticated_rejected(self):
        r = requests.get(f"{BASE_URL}/api/v1/tenants/{VCE_ID}/config", timeout=15)
        assert r.status_code in (401, 403)

    def test_me_config_still_works_for_principal(self, vce_principal_token):
        # Regression: non-super-admin can still read their own tenant config
        r = requests.get(f"{BASE_URL}/api/v1/tenants/me/config",
                         headers={"Authorization": f"Bearer {vce_principal_token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["modules"]["claros-ai"]["display_name"] == "VEDA"
