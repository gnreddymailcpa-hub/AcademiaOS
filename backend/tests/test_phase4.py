"""Phase 4 backend tests — Assessment Engine + Psychometric Intelligence."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

ISB = "11111111-1111-1111-1111-111111111111"
EAIC = "22222222-2222-2222-2222-222222222222"
ASM_ISB = "asm-isb-strategy-w1"
ASM_EAIC = "asm-eaic-border-w1"


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def isb_admin():
    return {"Authorization": f"Bearer {_login('rajiv.admin@isb.edu', 'Demo@2026')}"}

@pytest.fixture(scope="module")
def eaic_admin():
    return {"Authorization": f"Bearer {_login('fatima.admin@eaic.gov.ae', 'Demo@2026')}"}

@pytest.fixture(scope="module")
def eaic_cadet():
    return {"Authorization": f"Bearer {_login('saif.cadet@eaic.gov.ae', 'Demo@2026')}"}


# ============ Assessments ============
class TestAssessments:
    def test_list_isb(self, isb_admin):
        r = requests.get(f"{BASE}/api/assessments/{ISB}", headers=isb_admin, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        target = next((a for a in data if a["id"] == ASM_ISB), None)
        assert target, f"seeded {ASM_ISB} missing"
        assert target["item_count"] == 8
        assert "attempts_count" in target

    def test_detail_eaic(self, eaic_admin):
        r = requests.get(f"{BASE}/api/assessments/detail/{ASM_EAIC}", headers=eaic_admin, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["items"]) == 8
        item1 = next((i for i in d["items"] if i["id"] == "item-eaic-border-1"), None)
        assert item1 is not None
        assert item1["correct_index"] == 1
        assert item1.get("stem")

    def test_create_assessment_draft(self, isb_admin):
        r = requests.post(f"{BASE}/api/assessments/", headers=isb_admin, json={
            "institution_id": ISB, "title": "TEST_phase4_quiz", "type": "mcq",
            "time_limit_minutes": 15, "adaptive": True, "pass_score": 50,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "draft"
        assert d["institution_id"] == ISB

    def test_start_and_first_item_no_correct_index(self, eaic_cadet):
        r = requests.post(f"{BASE}/api/assessments/{ASM_EAIC}/start", headers=eaic_cadet, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "attempt_id" in d
        assert "id" in d["item"]
        assert "correct_index" not in d["item"]  # never expose
        # Save for next test
        pytest.attempt_id = d["attempt_id"]
        pytest.first_item = d["item"]

    def test_correct_then_wrong_streak_triggers_event(self, eaic_cadet):
        # First answer correctly (item-eaic-border-1 correct_index=1)
        first = pytest.first_item
        # Determine correct index for first item — we don't know it; use index 1 if id matches; else 0
        # Better: fetch item from detail
        det = requests.get(f"{BASE}/api/assessments/detail/{ASM_EAIC}", headers=eaic_cadet, timeout=15).json()
        items_by_id = {i["id"]: i for i in det["items"]}
        correct_idx = items_by_id[first["id"]]["correct_index"]
        r = requests.post(f"{BASE}/api/assessments/attempts/{pytest.attempt_id}/answer",
                          headers=eaic_cadet, timeout=15, json={
                              "item_id": first["id"], "response_index": correct_idx,
                              "response_time_ms": 5000, "hints_used": 0,
                          })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["correct"] is True
        # Submit 3 wrong answers in a row
        next_item = d.get("next_item")
        for i in range(3):
            assert next_item is not None, f"no next_item at i={i}"
            wrong = items_by_id[next_item["id"]]["correct_index"]
            wrong_pick = 0 if wrong != 0 else 1
            r2 = requests.post(f"{BASE}/api/assessments/attempts/{pytest.attempt_id}/answer",
                               headers=eaic_cadet, timeout=15, json={
                                   "item_id": next_item["id"], "response_index": wrong_pick,
                                   "response_time_ms": 4000, "hints_used": 0,
                               })
            assert r2.status_code == 200, r2.text
            dd = r2.json()
            assert dd["correct"] is False
            next_item = dd.get("next_item")
            last_data = dd
        # After 3 wrong in a row, wrong_streak event should be triggered
        triggered_classes = []
        # event list
        evr = requests.get(f"{BASE}/api/psychometrics/events/{EAIC}?status=pending_review",
                           headers=eaic_cadet, timeout=15)
        assert evr.status_code == 200
        evs = evr.json()
        wrong_evs = [e for e in evs if e.get("signal_class") == "wrong_streak"
                     and e.get("attempt_id") == pytest.attempt_id]
        assert len(wrong_evs) >= 1, f"wrong_streak event not created. events: {evs[:3]}"

    def test_attempt_report(self, eaic_cadet):
        r = requests.get(f"{BASE}/api/assessments/attempts/{pytest.attempt_id}/report",
                         headers=eaic_cadet, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "competency_bloom" in d
        assert "competency_difficulty" in d
        assert isinstance(d["competency_bloom"], list)


# ============ Psychometrics ============
class TestPsychometrics:
    def test_summary(self, eaic_admin):
        r = requests.get(f"{BASE}/api/psychometrics/summary/{EAIC}", headers=eaic_admin, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rules_total"] == 4
        assert "rules_active" in d
        assert "pending" in d["events"]
        assert isinstance(d["by_signal"], list)
        assert isinstance(d["by_intervention"], list)

    def test_rules_list_4(self, eaic_admin):
        r = requests.get(f"{BASE}/api/psychometrics/rules/{EAIC}", headers=eaic_admin, timeout=15)
        assert r.status_code == 200
        rules = r.json()
        assert len(rules) == 4
        pytest.eaic_rules = rules

    def test_patch_rule_disable_and_persist(self, eaic_admin):
        rule = pytest.eaic_rules[0]
        rid = rule["id"]
        r = requests.patch(f"{BASE}/api/psychometrics/rules/{rid}",
                           headers=eaic_admin, json={"enabled": False}, timeout=15)
        assert r.status_code == 200, r.text
        # Verify persist
        r2 = requests.get(f"{BASE}/api/psychometrics/rules/{EAIC}", headers=eaic_admin, timeout=15)
        updated = next((x for x in r2.json() if x["id"] == rid), None)
        assert updated and updated["enabled"] is False
        # Re-enable
        requests.patch(f"{BASE}/api/psychometrics/rules/{rid}", headers=eaic_admin,
                       json={"enabled": True}, timeout=15)

    def test_create_rule_then_patch_threshold(self, eaic_admin):
        r = requests.post(f"{BASE}/api/psychometrics/rules", headers=eaic_admin, timeout=15, json={
            "institution_id": EAIC, "name": "TEST_new_rule", "signal_class": "hint_usage",
            "threshold": 6, "intervention": "microlearning_suggested",
        })
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        r2 = requests.patch(f"{BASE}/api/psychometrics/rules/{rid}",
                            headers=eaic_admin, json={"threshold": 8}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["threshold"] == 8

    def test_events_filter_pending(self, eaic_admin):
        r = requests.get(f"{BASE}/api/psychometrics/events/{EAIC}?status=pending_review",
                         headers=eaic_admin, timeout=15)
        assert r.status_code == 200
        evs = r.json()
        for e in evs:
            assert e["status"] == "pending_review"

    def test_approve_event(self, eaic_admin):
        r = requests.get(f"{BASE}/api/psychometrics/events/{EAIC}?status=pending_review",
                         headers=eaic_admin, timeout=15)
        evs = r.json()
        if not evs:
            pytest.skip("no pending events")
        eid = evs[0]["id"]
        ra = requests.post(f"{BASE}/api/psychometrics/events/{eid}/approve",
                           headers=eaic_admin, timeout=15)
        assert ra.status_code == 200
        # verify status
        r2 = requests.get(f"{BASE}/api/psychometrics/events/{EAIC}?status=approved",
                          headers=eaic_admin, timeout=15)
        assert any(e["id"] == eid for e in r2.json())

    def test_fairness_run_and_get(self, eaic_admin):
        r = requests.post(f"{BASE}/api/psychometrics/fairness/{EAIC}/run",
                          headers=eaic_admin, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["dimensions"]) == 3
        dim_names = [x["dimension"] for x in d["dimensions"]]
        assert set(dim_names) == {"Cohort", "Gender", "Region"}
        max_disp = max(x["disparity"] for x in d["dimensions"])
        assert abs(d["overall_disparity"] - max_disp) < 0.001
        # GET returns saved snapshot
        r2 = requests.get(f"{BASE}/api/psychometrics/fairness/{EAIC}", headers=eaic_admin, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("overall_disparity") is not None

    def test_drift(self, eaic_admin):
        r = requests.get(f"{BASE}/api/psychometrics/drift/{EAIC}", headers=eaic_admin, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["series"]) == 14
        assert d["threshold_accuracy"] == 0.80
        for w in d["series"]:
            assert "accuracy" in w and "calibration_error" in w and "alert" in w

    def test_cross_tenant_403(self, isb_admin):
        # ISB admin trying to PATCH an EAIC rule
        eaic_rules = requests.get(f"{BASE}/api/psychometrics/rules/{EAIC}",
                                   headers={"Authorization": f"Bearer {_login('fatima.admin@eaic.gov.ae','Demo@2026')}"}).json()
        rid = eaic_rules[0]["id"]
        r = requests.patch(f"{BASE}/api/psychometrics/rules/{rid}",
                           headers=isb_admin, json={"enabled": False}, timeout=15)
        assert r.status_code == 403


# ============ Backward compat ============
class TestBackwardCompat:
    def test_login_still_works(self):
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"email": "admin@academiaos.ai", "password": "Admin@2026"}, timeout=15)
        assert r.status_code == 200

    def test_institutions(self):
        # Use super admin to see all 3
        tok = _login("admin@academiaos.ai", "Admin@2026")
        r = requests.get(f"{BASE}/api/institutions", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_ai_use_cases(self, isb_admin):
        r = requests.get(f"{BASE}/api/ai/use-cases/{ISB}", headers=isb_admin, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 6
