"""Phase 5 backend tests — Executive Analytics + NL Console + AI Examiner."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

ISB = "11111111-1111-1111-1111-111111111111"
EAIC = "22222222-2222-2222-2222-222222222222"
UOB = "33333333-3333-3333-3333-333333333333"


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_admin():
    return {"Authorization": f"Bearer {_login('rajiv.admin@isb.edu', 'Demo@2026')}"}


@pytest.fixture(scope="module")
def eaic_admin():
    return {"Authorization": f"Bearer {_login('fatima.admin@eaic.gov.ae', 'Demo@2026')}"}


# ============ Analytics dashboards ============
class TestAnalyticsDashboards:
    def test_executive_isb(self, isb_admin):
        r = requests.get(f"{BASE}/api/analytics/{ISB}/executive", headers=isb_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        kpis = d["kpis"]
        for k in ["programmes", "courses", "users", "ai_sessions", "ai_outputs",
                  "avg_assessment_score", "pass_rate", "pending_events"]:
            assert k in kpis, f"missing kpi {k}"
        assert isinstance(d["trend"], list) and len(d["trend"]) == 12
        assert all("m" in t and "enrolments" in t and "completion" in t for t in d["trend"])
        assert isinstance(d["programmes"], list) and len(d["programmes"]) == 6, f"want 6 programmes, got {len(d['programmes'])}"

    def test_workforce_eaic(self, eaic_admin):
        r = requests.get(f"{BASE}/api/analytics/{EAIC}/workforce", headers=eaic_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "by_role" in d and len(d["by_role"]) >= 1
        for role in d["by_role"]:
            assert "readiness_pct" in role
            assert isinstance(role["heatmap"], list) and len(role["heatmap"]) >= 1
            for sk in role["heatmap"]:
                assert "current" in sk and "target" in sk and "gap" in sk

    def test_compliance_isb(self, isb_admin):
        r = requests.get(f"{BASE}/api/analytics/{ISB}/compliance", headers=isb_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["audit_total", "by_action", "by_actor", "timeline", "recent"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["by_action"], list)
        # audit_total should reflect prior runs — allow zero only if no audit_logs exist
        assert d["audit_total"] >= 0

    def test_ai_usage_isb(self, isb_admin):
        r = requests.get(f"{BASE}/api/analytics/{ISB}/ai-usage", headers=isb_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["sessions_total", "outputs_total", "by_kind", "by_model", "provider_mix", "latency"]:
            assert k in d
        assert isinstance(d["latency"], list)
        for row in d["latency"]:
            assert "p50_ms" in row and "p95_ms" in row

    def test_programmes_isb(self, isb_admin):
        r = requests.get(f"{BASE}/api/analytics/{ISB}/programmes", headers=isb_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, list) and len(d) == 6
        for p in d:
            assert "course_count" in p and "module_count" in p

    def test_cross_tenant_forbidden(self, isb_admin):
        # ISB admin must not be able to read EAIC analytics
        r = requests.get(f"{BASE}/api/analytics/{EAIC}/executive", headers=isb_admin, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ============ NL Console ============
def _ask(headers, institution_id, question, expected_intent=None, retries=1):
    payload = {"institution_id": institution_id, "question": question}
    for attempt in range(retries + 1):
        r = requests.post(f"{BASE}/api/analytics/ask", headers=headers, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        if not expected_intent or body.get("intent") == expected_intent:
            return body
        time.sleep(1)
    return body  # return last response even if intent didn't match


class TestNLConsole:
    def test_completion_by_programme(self, isb_admin):
        body = _ask(isb_admin, ISB, "Which programme has the highest completion rate?",
                    expected_intent="completion_by_programme", retries=2)
        assert body.get("intent") == "completion_by_programme", body
        assert body["chart_type"] == "bar"
        assert len(body["data"]) == 6, f"expected 6 ISB programmes, got {len(body['data'])}"
        assert body.get("narrative")
        assert body.get("model")

    def test_ai_sessions_by_module(self, isb_admin):
        body = _ask(isb_admin, ISB, "How many AI sessions per module?",
                    expected_intent="ai_sessions_by_module", retries=2)
        assert body.get("intent") == "ai_sessions_by_module", body
        assert body["chart_type"] == "pie"

    def test_assessment_scores_distribution(self, isb_admin):
        body = _ask(isb_admin, ISB, "show me the assessment scores distribution",
                    expected_intent="assessment_scores_distribution", retries=2)
        assert body.get("intent") == "assessment_scores_distribution", body
        assert len(body["data"]) == 5  # five buckets

    def test_unsupported(self, isb_admin):
        body = _ask(isb_admin, ISB, "what is the moon made of", expected_intent="unsupported", retries=1)
        assert body.get("intent") == "unsupported", body
        assert "available_intents" in body
        assert isinstance(body["available_intents"], list) and len(body["available_intents"]) >= 5
        assert body.get("narrative")

    def test_ask_logs_audit_event(self, isb_admin):
        # Run an ask, then verify a recent nl_query audit log exists with model + question
        q = "What is the AI provider mix?"
        r = requests.post(f"{BASE}/api/analytics/ask", headers=isb_admin,
                          json={"institution_id": ISB, "question": q}, timeout=60)
        assert r.status_code == 200
        comp = requests.get(f"{BASE}/api/analytics/{ISB}/compliance", headers=isb_admin, timeout=20)
        assert comp.status_code == 200
        recent = comp.json()["recent"]
        nl = [e for e in recent if e.get("action") == "analytics.nl_query"]
        assert nl, "no analytics.nl_query in recent audit logs"
        ev = nl[0]
        assert ev.get("model"), "audit event missing model"
        assert ev.get("question"), "audit event missing question"


# ============ AI Examiner ============
class TestExaminer:
    def test_examine_isb_item(self, isb_admin):
        r = requests.post(f"{BASE}/api/assessments/items/item-isb-strategy-1/examine",
                          headers=isb_admin, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("model", "").startswith("openai/gpt-4o"), f"model was {body.get('model')}"
        rep = body["report"]
        assert isinstance(rep.get("overall_score"), int)
        assert rep.get("verdict") in {"pass", "revise", "reject"}, rep.get("verdict")
        for k in ["fairness", "distractor_quality", "bloom_alignment", "source_grounding"]:
            assert k in rep, f"missing {k}"
        assert "score" in rep["fairness"]
        assert "score" in rep["distractor_quality"]
        assert "stated" in rep["bloom_alignment"] and "suggested" in rep["bloom_alignment"]
        assert "score" in rep["source_grounding"]
        assert isinstance(rep.get("suggestions"), list)

    def test_examine_cross_tenant_forbidden(self, isb_admin):
        # ISB user examining EAIC item must 403
        r = requests.post(f"{BASE}/api/assessments/items/item-eaic-border-1/examine",
                          headers=isb_admin, timeout=60)
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text[:200]}"

    def test_examiner_writes_audit(self, isb_admin):
        # Just verify recent compliance log has at least one ai.examiner.run event from previous tests
        comp = requests.get(f"{BASE}/api/analytics/{ISB}/compliance", headers=isb_admin, timeout=20)
        assert comp.status_code == 200
        ev = [e for e in comp.json()["recent"] if e.get("action") == "ai.examiner.run"]
        assert ev, "no ai.examiner.run audit event found"
        assert ev[0].get("model")
