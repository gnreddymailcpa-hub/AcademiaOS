"""
Psychometric & Behaviour Intelligence routes (Module 4.5).

HIGHEST-RISK module. Every intervention requires human review (HITL).
"""
import uuid
import logging
import random
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field

from ai_service import now_iso

logger = logging.getLogger("academiaos.psychometrics")


class RuleCreate(BaseModel):
    institution_id: str
    name: str
    signal_class: str  # response_time_ms_avg | wrong_streak | hint_usage | inactivity
    threshold: float
    intervention: str  # microlearning_suggested | faculty_alert | break_recommended | easier_explanation | mentor_intervention
    enabled: bool = True
    consent_required: bool = True
    human_review: bool = True
    description: Optional[str] = None


class RulePatch(BaseModel):
    name: Optional[str] = None
    threshold: Optional[float] = None
    intervention: Optional[str] = None
    enabled: Optional[bool] = None


def build_psychometrics_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/psychometrics")

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    # -------- Rules CRUD --------
    @router.get("/rules/{institution_id}")
    async def list_rules(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        return await db.psychometric_rules.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)

    @router.post("/rules")
    async def create_rule(payload: RuleCreate = Body(...), user: dict = Depends(get_current_user)):
        await _scope(user, payload.institution_id)
        db = get_db()
        doc = {
            "id": str(uuid.uuid4()),
            **payload.model_dump(),
            "created_by": user["name"],
            "created_at": now_iso(),
        }
        await db.psychometric_rules.insert_one(dict(doc))
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": payload.institution_id,
            "action": "psychometric.rule.create", "target": doc["id"],
            "actor": user["email"], "ts": now_iso(),
        })
        return doc

    @router.patch("/rules/{rule_id}")
    async def patch_rule(rule_id: str, payload: RulePatch = Body(...), user: dict = Depends(get_current_user)):
        db = get_db()
        rule = await db.psychometric_rules.find_one({"id": rule_id}, {"_id": 0})
        if not rule:
            raise HTTPException(404, "Not found")
        await _scope(user, rule["institution_id"])
        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        if updates:
            await db.psychometric_rules.update_one({"id": rule_id}, {"$set": updates})
            await db.audit_logs.insert_one({
                "id": str(uuid.uuid4()), "institution_id": rule["institution_id"],
                "action": "psychometric.rule.update", "target": rule_id,
                "actor": user["email"], "changes": updates, "ts": now_iso(),
            })
        return await db.psychometric_rules.find_one({"id": rule_id}, {"_id": 0})

    # -------- Events / interventions queue --------
    @router.get("/events/{institution_id}")
    async def list_events(institution_id: str, status: Optional[str] = None, limit: int = 50, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        q = {"institution_id": institution_id}
        if status:
            q["status"] = status
        return await db.psychometric_events.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    @router.post("/events/{event_id}/approve")
    async def approve_event(event_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        ev = await db.psychometric_events.find_one({"id": event_id}, {"_id": 0})
        if not ev:
            raise HTTPException(404, "Not found")
        await _scope(user, ev["institution_id"])
        await db.psychometric_events.update_one(
            {"id": event_id},
            {"$set": {"status": "approved", "approved_by": user["name"], "approved_at": now_iso()}},
        )
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": ev["institution_id"],
            "action": "psychometric.intervention.approve", "target": event_id,
            "actor": user["email"], "ts": now_iso(),
        })
        return {"ok": True}

    @router.post("/events/{event_id}/reject")
    async def reject_event(event_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        ev = await db.psychometric_events.find_one({"id": event_id}, {"_id": 0})
        if not ev:
            raise HTTPException(404, "Not found")
        await _scope(user, ev["institution_id"])
        await db.psychometric_events.update_one(
            {"id": event_id},
            {"$set": {"status": "rejected", "rejected_by": user["name"], "rejected_at": now_iso()}},
        )
        return {"ok": True}

    # -------- Dashboard summary --------
    @router.get("/summary/{institution_id}")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        rules = await db.psychometric_rules.count_documents({"institution_id": institution_id})
        active_rules = await db.psychometric_rules.count_documents({"institution_id": institution_id, "enabled": True})
        pending = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "pending_review"})
        approved = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "approved"})
        rejected = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "rejected"})

        # by signal class breakdown
        cursor = db.psychometric_events.find(
            {"institution_id": institution_id}, {"_id": 0, "signal_class": 1, "status": 1, "intervention": 1}
        )
        by_signal = defaultdict(int)
        by_intervention = defaultdict(int)
        async for e in cursor:
            by_signal[e.get("signal_class", "?")] += 1
            by_intervention[e.get("intervention", "?")] += 1

        return {
            "rules_total": rules,
            "rules_active": active_rules,
            "events": {"pending": pending, "approved": approved, "rejected": rejected},
            "by_signal": [{"signal": k, "count": v} for k, v in by_signal.items()],
            "by_intervention": [{"intervention": k, "count": v} for k, v in by_intervention.items()],
        }

    # -------- Fairness audit --------
    @router.get("/fairness/{institution_id}")
    async def fairness(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        audit = await db.fairness_audits.find_one(
            {"institution_id": institution_id}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if not audit:
            return {"institution_id": institution_id, "dimensions": [], "overall_disparity": 0, "last_audit_at": None}
        return audit

    @router.post("/fairness/{institution_id}/run")
    async def run_fairness(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        # Deterministic-ish synthetic audit (demo); real implementation would compute
        # disparity from attempt scores / intervention rates grouped by demographic
        # dimensions configured for the institution.
        random.seed(hash(institution_id + str(int(datetime.now().timestamp() // 3600))) & 0xFFFFFFFF)
        dimensions = [
            {"dimension": "Cohort", "groups": ["Co'24", "Co'25", "Co'26"], "rates": [round(random.uniform(0.18, 0.32), 3) for _ in range(3)]},
            {"dimension": "Gender", "groups": ["A", "B"], "rates": [round(random.uniform(0.20, 0.28), 3) for _ in range(2)]},
            {"dimension": "Region", "groups": ["Region 1", "Region 2", "Region 3"], "rates": [round(random.uniform(0.18, 0.34), 3) for _ in range(3)]},
        ]
        for d in dimensions:
            mn, mx = min(d["rates"]), max(d["rates"])
            d["disparity"] = round(mx - mn, 3)
            d["status"] = "ok" if d["disparity"] < 0.08 else ("watch" if d["disparity"] < 0.14 else "review")
        overall = round(max(d["disparity"] for d in dimensions), 3)
        doc = {
            "id": str(uuid.uuid4()),
            "institution_id": institution_id,
            "dimensions": dimensions,
            "overall_disparity": overall,
            "threshold_warn": 0.08,
            "threshold_fail": 0.14,
            "created_at": now_iso(),
            "created_by": user["name"],
        }
        await db.fairness_audits.insert_one(dict(doc))
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": institution_id,
            "action": "psychometric.fairness.run", "target": doc["id"],
            "actor": user["email"], "ts": now_iso(),
        })
        return doc

    # -------- Model drift monitoring --------
    @router.get("/drift/{institution_id}")
    async def drift(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        snap = await db.drift_snapshots.find_one(
            {"institution_id": institution_id}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if snap:
            return snap
        # Generate a synthetic 14-week series
        random.seed(hash(institution_id) & 0xFFFFFFFF)
        base = 0.88
        series = []
        for w in range(14):
            base += random.uniform(-0.012, 0.008)
            base = max(0.74, min(0.93, base))
            series.append({
                "week": f"W{w+1}",
                "accuracy": round(base, 3),
                "calibration_error": round(0.05 + random.uniform(-0.015, 0.03), 3),
                "alert": base < 0.80,
            })
        doc = {
            "id": str(uuid.uuid4()),
            "institution_id": institution_id,
            "series": series,
            "model": "intervention_predictor_v2",
            "threshold_accuracy": 0.80,
            "created_at": now_iso(),
        }
        await db.drift_snapshots.insert_one(dict(doc))
        return doc

    return router
