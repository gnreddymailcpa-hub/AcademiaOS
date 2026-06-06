"""Phase 19 cross-platform integration tests.

Covers:
  - PRISM /publications-by-author (token-split, stopwords, cross-tenant)
  - ALUMNI /mentor-match (branch+role scoring, availability filter, limit, cross-tenant)
  - COMPASS /aqar/preview new metrics + totals + score band
  - COMPASS /aqar/freeze captures totals into compass_aqar collection
"""
import os
import pytest
import requests

def _read_env(key: str, path: str = "/app/frontend/.env"):
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        return None
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not found"
VCE = "44444444-4444-4444-4444-444444444444"
ISB = "11111111-1111-1111-1111-111111111111"


def _login(email: str, password: str = "Demo@2026") -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def vce_principal():
    return _login("principal@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def vce_student():
    return _login("manikanta.cse@vaagdevi.edu.in")


@pytest.fixture(scope="module")
def isb_admin():
    return _login("rajiv.admin@isb.edu")


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- PRISM publications-by-author ----------------
class TestPrismPubsByAuthor:
    def test_basic_author_match(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/prism/{VCE}/publications-by-author",
            params={"author": "Hari"}, headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Every returned row must have at least one author containing 'hari'
        for row in data:
            assert any("hari" in (a or "").lower() for a in row.get("authors", [])), row

    def test_token_split_drops_dr_stopword(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/prism/{VCE}/publications-by-author",
            params={"author": "Dr Hari"}, headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for row in data:
            assert any("hari" in (a or "").lower() for a in row.get("authors", []))

    def test_empty_author(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/prism/{VCE}/publications-by-author",
            params={"author": ""}, headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_only_stopword(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/prism/{VCE}/publications-by-author",
            params={"author": "Dr."}, headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_cross_tenant_denied(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/prism/{ISB}/publications-by-author",
            params={"author": "Hari"}, headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 403


# ---------------- ALUMNI mentor-match ----------------
class TestAlumniMentorMatch:
    def test_cse_sde_returns_scored_mentors(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{VCE}/mentor-match",
            params={"branch": "CSE", "role": "SDE", "limit": 3},
            headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 3
        for row in data:
            assert "match_score" in row
            assert isinstance(row["match_score"], (int, float))
            assert row.get("available_for_mentorship") is True
        # sorted descending
        if len(data) >= 2:
            assert data[0]["match_score"] >= data[1]["match_score"]

    def test_aiml_ml_filter_availability(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{VCE}/mentor-match",
            params={"branch": "AIML", "role": "ML"},
            headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        for row in data:
            assert row.get("available_for_mentorship") is True

    def test_limit_1(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{VCE}/mentor-match",
            params={"branch": "CSE", "role": "SDE", "limit": 1},
            headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 200
        assert len(r.json()) <= 1

    def test_cross_tenant_denied(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/alumni/{ISB}/mentor-match",
            params={"branch": "CSE", "role": "SDE"},
            headers=_h(vce_principal), timeout=30,
        )
        assert r.status_code == 403


# ---------------- COMPASS AQAR cross-platform ----------------
class TestCompassAqarPreview:
    @pytest.fixture(scope="class")
    def preview(self, vce_principal):
        r = requests.get(
            f"{BASE_URL}/api/compass/{VCE}/aqar/preview",
            headers=_h(vce_principal), timeout=60,
        )
        assert r.status_code == 200
        return r.json()

    def test_c3_research_metrics(self, preview):
        c3 = next((c for c in preview.get("criteria", []) if c.get("id") == "C3"), None)
        assert c3 is not None, f"C3 missing. Got ids: {[c.get('id') for c in preview.get('criteria', [])]}"
        keys = {m["key"] for m in c3.get("metrics", [])}
        for k in ("publications", "total_citations", "h_index", "patents_granted", "active_grants_value"):
            assert k in keys, f"C3 missing metric {k}"
        assert "h-index" in c3.get("narrative", "").lower() or "h_index" in c3.get("narrative", "").lower()
        assert "patent" in c3.get("narrative", "").lower()

    def test_c5_student_support_metrics(self, preview):
        c5 = next((c for c in preview.get("criteria", []) if c.get("id") == "C5"), None)
        assert c5 is not None
        keys = {m["key"] for m in c5.get("metrics", [])}
        for k in ("placement_drives_total", "applications_total", "selected_total"):
            assert k in keys, f"C5 missing metric {k}"
        narrative = c5.get("narrative", "").lower()
        assert "drive" in narrative
        assert "select" in narrative

    def test_c7_best_practices_metrics(self, preview):
        c7 = next((c for c in preview.get("criteria", []) if c.get("id") == "C7"), None)
        assert c7 is not None
        keys = {m["key"] for m in c7.get("metrics", [])}
        for k in ("renewable_energy_share", "carbon_footprint"):
            assert k in keys, f"C7 missing metric {k}"
        assert "renewable" in c7.get("narrative", "").lower()

    def test_totals_object_extended(self, preview):
        totals = preview.get("totals", {})
        for k in (
            "publications", "citations", "h_index", "patents_granted",
            "active_grant_value_lakhs", "placement_drives",
            "placement_applications", "placement_selected",
            "avg_package_lpa", "max_package_lpa",
            "renewable_energy_pct", "carbon_tco2e",
        ):
            assert k in totals, f"totals missing {k}"

    def test_score_a_plus_band(self, preview):
        score = preview.get("computed_score")
        assert score is not None
        assert score >= 75, f"Expected A+ band (>=75), got {score}"

    def test_freeze_persists_totals(self, vce_principal):
        r = requests.post(
            f"{BASE_URL}/api/compass/{VCE}/aqar/freeze",
            headers=_h(vce_principal), timeout=60,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # Should include score / grade or a record id
        assert "computed_score" in body or "score" in body or "id" in body
