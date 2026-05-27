"""
Phase 7 — Academic CRUD + Institution PATCH + Content Studio uploads/downloads.
Tests all P1 follow-up items from iteration_6.
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
ISB = "11111111-1111-1111-1111-111111111111"
EAIC = "22222222-2222-2222-2222-222222222222"


# ------------------------ fixtures ------------------------
def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_headers():
    return {"Authorization": f"Bearer {_login('rajiv.admin@isb.edu', 'Demo@2026')}"}


@pytest.fixture(scope="module")
def eaic_headers():
    return {"Authorization": f"Bearer {_login('fatima.admin@eaic.gov.ae', 'Demo@2026')}"}


@pytest.fixture(scope="module")
def super_headers():
    return {"Authorization": f"Bearer {_login('admin@academiaos.ai', 'Admin@2026')}"}


def _make_pdf_bytes():
    """Generate a tiny PDF using reportlab."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(72, 720, "TEST_PHASE7 PDF content for AcademiaOS upload test.")
    c.drawString(72, 700, "Second line: extracted by pypdf and stored in /app/uploads.")
    c.showPage()
    c.save()
    return buf.getvalue()


# ------------------------ Academic CRUD ------------------------
class TestAcademicCRUD:
    """POST/GET/PATCH/DELETE for each entity + audit log writes."""

    @pytest.fixture(scope="class")
    def existing_programme_id(self, isb_headers):
        r = requests.get(f"{BASE_URL}/api/academic/{ISB}/programmes", headers=isb_headers, timeout=15)
        assert r.status_code == 200 and r.json(), "no seed programmes for ISB"
        return r.json()[0]["id"]

    @pytest.mark.parametrize("entity,body_template,patch", [
        ("campuses",  {"institution_id": ISB, "name": "TEST_Phase7 Campus", "city": "Mohali", "country": "India"},
                      {"city": "Hyderabad"}),
        ("departments", {"institution_id": ISB, "name": "TEST_Phase7 Dept"},
                        {"name": "TEST_Phase7 Dept Updated"}),
        ("programmes", {"institution_id": ISB, "name": "TEST_Phase7 Prog", "code": "TP7P",
                        "duration": "12 months"},
                       {"duration": "18 months"}),
        ("courses",   {"institution_id": ISB, "title": "TEST_Phase7 Course", "code": "TP7CR",
                       "credits": 3, "programme_id": "__PROG__"},
                      {"credits": 4}),
        ("cohorts",   {"institution_id": ISB, "name": "TEST_Phase7 Cohort", "start_date": "2026-01-01",
                       "end_date": "2026-12-01", "size": 30, "programme_id": "__PROG__"},
                      {"name": "TEST_Phase7 Cohort Updated"}),
    ])
    def test_crud_lifecycle(self, isb_headers, existing_programme_id, entity, body_template, patch):
        body = {k: (existing_programme_id if v == "__PROG__" else v) for k, v in body_template.items()}
        url = f"{BASE_URL}/api/academic/{ISB}/{entity}"
        # CREATE
        r = requests.post(url, json=body, headers=isb_headers, timeout=15)
        assert r.status_code in (200, 201), f"POST {entity}: {r.status_code} {r.text}"
        created = r.json()
        assert "id" in created
        ent_id = created["id"]

        # GET list contains it
        r = requests.get(url, headers=isb_headers, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == ent_id for x in r.json())

        # PATCH
        r = requests.patch(f"{url}/{ent_id}", json=patch, headers=isb_headers, timeout=15)
        assert r.status_code == 200, f"PATCH: {r.status_code} {r.text}"
        # Verify the patched field persisted
        r = requests.get(url, headers=isb_headers, timeout=15)
        item = next(x for x in r.json() if x["id"] == ent_id)
        for k, v in patch.items():
            assert item[k] == v, f"persistence mismatch on {k}: got {item[k]} expected {v}"

        # DELETE
        r = requests.delete(f"{url}/{ent_id}", headers=isb_headers, timeout=15)
        assert r.status_code in (200, 204)
        # Confirm removal
        r = requests.get(url, headers=isb_headers, timeout=15)
        assert not any(x["id"] == ent_id for x in r.json())

    def test_audit_entries_present(self, isb_headers):
        """Verify audit_logs receives entries for academic mutations."""
        # Create a throwaway campus
        url = f"{BASE_URL}/api/academic/{ISB}/campuses"
        r = requests.post(url, json={"institution_id": ISB, "name": "TEST_Phase7 Audit Campus",
                                     "city": "Mohali", "country": "India"},
                          headers=isb_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        requests.delete(f"{url}/{cid}", headers=isb_headers, timeout=15)

        # Fetch audit feed
        r = requests.get(f"{BASE_URL}/api/ai/audit/{ISB}?limit=200", headers=isb_headers, timeout=15)
        assert r.status_code == 200
        actions = [a.get("action") for a in r.json()]
        assert "academic.campus.create" in actions
        assert "academic.campus.delete" in actions


# ------------------------ Tenant isolation ------------------------
class TestTenantIsolation:
    def test_isb_user_cannot_post_to_eaic(self, isb_headers):
        r = requests.post(
            f"{BASE_URL}/api/academic/{EAIC}/campuses",
            json={"institution_id": EAIC, "name": "Cross-tenant attempt",
                  "city": "X", "country": "X"},
            headers=isb_headers, timeout=15,
        )
        assert r.status_code == 403

    def test_isb_user_cannot_patch_eaic_institution(self, isb_headers):
        r = requests.patch(
            f"{BASE_URL}/api/institutions/{EAIC}",
            json={"name": "hacked"}, headers=isb_headers, timeout=15,
        )
        assert r.status_code == 403


# ------------------------ Institution PATCH ------------------------
class TestInstitutionPatch:
    def test_patch_ai_config_and_governance(self, isb_headers):
        ai_config = {
            "provider": "claude_sonnet",
            "tone": "academic",
            "max_tokens": 1024,
        }
        governance = {
            "audit_level": "Forensic",
            "require_human_approval": True,
            "block_pii": True,
        }
        r = requests.patch(
            f"{BASE_URL}/api/institutions/{ISB}",
            json={"ai_config": ai_config, "governance": governance},
            headers=isb_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["ai_config"]["provider"] == "claude_sonnet"
        assert doc["ai_config"]["tone"] == "academic"
        assert doc["ai_config"]["max_tokens"] == 1024
        assert doc["governance"]["audit_level"] == "Forensic"
        assert doc["governance"]["require_human_approval"] is True

        # Verify GET echoes the same persisted values
        r2 = requests.get(f"{BASE_URL}/api/institutions/{ISB}", headers=isb_headers, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ai_config"]["provider"] == "claude_sonnet"
        assert d2["governance"]["audit_level"] == "Forensic"

        # Audit entry
        ar = requests.get(f"{BASE_URL}/api/ai/audit/{ISB}?limit=50", headers=isb_headers, timeout=15)
        actions = [a for a in ar.json() if a.get("action") == "institution.update"]
        assert actions, "institution.update audit missing"
        latest = actions[0]
        assert "ai_config" in latest.get("changes", []) or "governance" in latest.get("changes", [])


# ------------------------ Content Studio upload/download ------------------------
class TestContentStudioUpload:
    @pytest.fixture(scope="class")
    def uploaded_source(self, isb_headers):
        pdf_bytes = _make_pdf_bytes()
        files = {"file": ("test_phase7.pdf", pdf_bytes, "application/pdf")}
        data = {"institution_id": ISB, "title": "TEST_Phase7 Source PDF", "kind": "lecture_notes"}
        # Build a fresh headers dict without forcing JSON content-type
        h = {k: v for k, v in isb_headers.items()}
        r = requests.post(f"{BASE_URL}/api/ai/content/upload", data=data, files=files,
                          headers=h, timeout=30)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        src = r.json()
        assert src["id"]
        assert src["filename"]
        assert src["size_bytes"] > 0
        assert "AcademiaOS" in (src.get("text") or "")
        # File stored on disk?
        assert os.path.isfile(f"/app/uploads/{src['filename']}")
        yield src

    def test_pdf_text_extraction_present(self, uploaded_source):
        assert "TEST_PHASE7" in uploaded_source["text"]

    def test_upload_audit_written(self, isb_headers, uploaded_source):
        r = requests.get(f"{BASE_URL}/api/ai/audit/{ISB}?limit=50", headers=isb_headers, timeout=15)
        assert any(a.get("action") == "content.upload" and a.get("target") == uploaded_source["id"]
                   for a in r.json())

    def test_unsupported_mime_returns_415(self, isb_headers):
        files = {"file": ("hack.xyz", b"not a real file", "application/x-foo")}
        data = {"institution_id": ISB, "title": "TEST_Phase7 Bad", "kind": "lecture_notes"}
        h = {k: v for k, v in isb_headers.items()}
        r = requests.post(f"{BASE_URL}/api/ai/content/upload", data=data, files=files,
                          headers=h, timeout=15)
        assert r.status_code == 415, f"expected 415 got {r.status_code} {r.text}"

    def test_download_returns_binary(self, isb_headers, uploaded_source):
        r = requests.get(
            f"{BASE_URL}/api/ai/content/sources/{uploaded_source['id']}/download",
            headers=isb_headers, timeout=15,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_download_cross_tenant_forbidden(self, eaic_headers, uploaded_source):
        r = requests.get(
            f"{BASE_URL}/api/ai/content/sources/{uploaded_source['id']}/download",
            headers=eaic_headers, timeout=15,
        )
        assert r.status_code == 403

    def test_download_missing_source_404(self, isb_headers):
        r = requests.get(
            f"{BASE_URL}/api/ai/content/sources/nonexistent-xyz/download",
            headers=isb_headers, timeout=15,
        )
        assert r.status_code == 404
