"""Claros Insights — Executive Analytics backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")
PRINCIPAL = ("principal@vaagdevi.edu.in", "Demo@2026")
STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
VCE_ID = "44444444-4444-4444-4444-444444444444"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(*PRINCIPAL)}"}


@pytest.fixture(scope="module")
def student_h():
    return {"Authorization": f"Bearer {_login(*STUDENT)}"}


# --- Overview KPIs --------------------------------------------------------
def test_overview_returns_12_keys(admin_h):
    r = requests.get(f"{BASE_URL}/api/v1/insights/overview", headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    expected = {"total_students", "total_faculty", "departments", "avg_attendance_pct",
                "fee_collection_pct", "placed_count", "placement_rate", "avg_package",
                "naac_readiness_pct", "active_leads", "ai_sessions_today", "enrolled_this_month"}
    assert expected.issubset(set(d.keys())), f"missing: {expected - set(d.keys())}"
    assert d["total_students"] == 20
    assert d["departments"] == 10
    assert d["placed_count"] == 9
    assert d["placement_rate"] == 45.0
    assert d["active_leads"] >= 20
    assert d["naac_readiness_pct"] > 0


# --- Alerts ---------------------------------------------------------------
def test_alerts_listing(admin_h):
    r = requests.get(f"{BASE_URL}/api/v1/insights/alerts", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "items" in d and "rules" in d
    assert len(d["rules"]) >= 3
    # at least one warning event for low attendance
    warns = [e for e in d["items"] if e.get("severity") == "WARNING"]
    assert warns, "expected at least 1 WARNING alert"
    assert any("avg_attendance_pct" in (e.get("message") or "") for e in d["items"])


def test_create_alert_rule(admin_h):
    payload = {"rule_name": "TEST_RULE_FeeFloor", "metric_key": "fee_collection_pct",
               "threshold": 50.0, "comparison": "LT", "severity": "WARNING", "is_active": True}
    r = requests.post(f"{BASE_URL}/api/v1/insights/alerts/rules", headers=admin_h, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["rule_name"] == "TEST_RULE_FeeFloor"
    assert d["metric_key"] == "fee_collection_pct"
    assert "id" in d


def test_evaluate_rules(admin_h):
    r = requests.post(f"{BASE_URL}/api/v1/insights/alerts/evaluate", headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "triggered" in d and "rule_count" in d
    assert d["rule_count"] >= 3


# --- NAAC summary ---------------------------------------------------------
def test_naac_summary(admin_h):
    r = requests.get(f"{BASE_URL}/api/v1/insights/naac/summary", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d, list)
    assert len(d) == 7, f"expected 7 criteria got {len(d)}"
    # criterion_code returned as "C1".."C7" string
    codes = [str(c["criterion_code"]) for c in d]
    assert "C1" in codes and "C5" in codes
    c1 = next(c for c in d if str(c["criterion_code"]) == "C1")
    c5 = next(c for c in d if str(c["criterion_code"]) == "C5")
    assert abs(c1["pct"] - 79.2) < 0.5
    assert abs(c5["pct"] - 78.3) < 0.5


# --- Trends ---------------------------------------------------------------
def test_trends_attendance(admin_h):
    r = requests.get(f"{BASE_URL}/api/v1/insights/trends/attendance", headers=admin_h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d, list) and len(d) == 12


def test_trends_placements(admin_h):
    r = requests.get(f"{BASE_URL}/api/v1/insights/trends/placements", headers=admin_h, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d, list) and len(d) == 4


# --- Reports --------------------------------------------------------------
def test_generate_report(admin_h):
    payload = {"report_type": "MONTHLY"}
    r = requests.post(f"{BASE_URL}/api/v1/insights/reports/generate", headers=admin_h, json=payload, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "report_id" in d and "content" in d and "period_label" in d
    assert "Vaagdevi" in d["content"] or "vaagdevi" in d["content"].lower()


# --- Role gating ----------------------------------------------------------
@pytest.mark.parametrize("path,method,body", [
    ("/api/v1/insights/overview", "GET", None),
    ("/api/v1/insights/alerts", "GET", None),
    ("/api/v1/insights/naac/summary", "GET", None),
    ("/api/v1/insights/trends/attendance", "GET", None),
    ("/api/v1/insights/reports/generate", "POST", {"report_type": "MONTHLY"}),
    ("/api/v1/insights/alerts/rules", "POST",
     {"rule_name": "X", "metric_key": "avg_attendance_pct", "threshold": 1, "comparison": "LT", "severity": "WARNING", "is_active": True}),
])
def test_student_forbidden(student_h, path, method, body):
    url = f"{BASE_URL}{path}"
    if method == "GET":
        r = requests.get(url, headers=student_h, timeout=15)
    else:
        r = requests.post(url, headers=student_h, json=body or {}, timeout=15)
    assert r.status_code == 403, f"{path} {method} expected 403 got {r.status_code} {r.text[:120]}"
