"""
Assessment Engine routes (Module 4.7).

Item bank · Adaptive sequencing · Auto-score (MCQ) + LLM rubric (short-answer)
· Faculty review · Competency report.

Signals captured here feed Psychometric & Behaviour Intelligence (Module 4.5).
"""
import os
import re
import uuid
import logging
import random
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field

from ai_service import resolve_model, generate_json, now_iso

logger = logging.getLogger("academiaos.assessments")


# -------- Models --------
class AssessmentCreate(BaseModel):
    institution_id: str
    title: str
    course_id: Optional[str] = None
    type: str = "mcq"  # mcq | scenario | mixed
    description: Optional[str] = None
    time_limit_minutes: int = 30
    adaptive: bool = True
    randomise: bool = True
    retake_allowed: bool = False
    faculty_review_required: bool = False
    pass_score: int = 60


class ItemCreate(BaseModel):
    stem: str
    options: List[str] = Field(default_factory=list)
    correct_index: Optional[int] = None
    type: str = "mcq"  # mcq | short_answer | scenario
    difficulty: str = "intermediate"  # easy | intermediate | hard
    bloom: str = "Apply"
    rubric: Optional[str] = None


class GenerateItemsRequest(BaseModel):
    institution_id: str
    assessment_id: str
    source_id: str
    count: int = 6
    difficulty: str = "intermediate"
    language: str = "en"
    bloom: str = "Apply"


class AnswerSubmission(BaseModel):
    item_id: str
    response_index: Optional[int] = None
    response_text: Optional[str] = None
    response_time_ms: int = 0
    hints_used: int = 0
    reviewed: bool = False


# -------- Adaptive helpers --------
_DIFF_ORDER = ["easy", "intermediate", "hard"]


def _next_difficulty(current: str, correct: bool) -> str:
    i = _DIFF_ORDER.index(current) if current in _DIFF_ORDER else 1
    if correct and i < 2:
        return _DIFF_ORDER[i + 1]
    if not correct and i > 0:
        return _DIFF_ORDER[i - 1]
    return current


def _pick_next_item(items, asked_ids, target_difficulty):
    pool = [x for x in items if x["id"] not in asked_ids]
    if not pool:
        return None
    same = [x for x in pool if x.get("difficulty") == target_difficulty]
    if same:
        return random.choice(same)
    return random.choice(pool)


# -------- Router --------
def build_assessments_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/assessments")

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    # ---------- Assessments CRUD ----------
    @router.get("/{institution_id}")
    async def list_assessments(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        items = await db.assessments.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        # attach item counts
        for a in items:
            a["item_count"] = await db.assessment_items.count_documents({"assessment_id": a["id"]})
            a["attempts_count"] = await db.assessment_attempts.count_documents({"assessment_id": a["id"]})
        return items

    @router.post("/")
    async def create_assessment(payload: AssessmentCreate = Body(...), user: dict = Depends(get_current_user)):
        await _scope(user, payload.institution_id)
        db = get_db()
        doc = {
            "id": str(uuid.uuid4()),
            **payload.model_dump(),
            "created_by": user["name"],
            "created_at": now_iso(),
            "status": "draft",
        }
        await db.assessments.insert_one(dict(doc))
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": payload.institution_id,
            "action": "assessment.create", "target": doc["id"],
            "actor": user["email"], "ts": now_iso(),
        })
        return doc

    @router.get("/detail/{assessment_id}")
    async def get_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        items = await db.assessment_items.find(
            {"assessment_id": assessment_id}, {"_id": 0}
        ).to_list(500)
        a["items"] = items
        return a

    # ---------- Item bank ----------
    @router.get("/{assessment_id}/items")
    async def list_items(assessment_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        return await db.assessment_items.find(
            {"assessment_id": assessment_id}, {"_id": 0}
        ).to_list(500)

    @router.post("/{assessment_id}/items")
    async def add_item(assessment_id: str, payload: ItemCreate = Body(...), user: dict = Depends(get_current_user)):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        doc = {
            "id": str(uuid.uuid4()),
            "assessment_id": assessment_id,
            "institution_id": a["institution_id"],
            **payload.model_dump(),
            "created_at": now_iso(),
        }
        await db.assessment_items.insert_one(dict(doc))
        return doc

    @router.post("/{assessment_id}/items/generate")
    async def generate_items(
        assessment_id: str,
        payload: GenerateItemsRequest = Body(...),
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        src = await db.content_sources.find_one({"id": payload.source_id}, {"_id": 0})
        if not src:
            raise HTTPException(404, "Source not found")
        provider, model = await resolve_model(db, a["institution_id"], "assessments")
        sys = (
            "You are AcademiaOS Assessment Engine. Generate high-quality MCQ items strictly "
            "grounded in the provided source. " 
            f"Language: {'Arabic (formal modern)' if payload.language=='ar' else 'English'}. "
            f"Bloom level: {payload.bloom}. Difficulty: {payload.difficulty}."
        )
        user_text = (
            f"### SOURCE TITLE\n{src['title']}\n\n### SOURCE TEXT\n{(src.get('text') or '')[:6000]}\n\n"
            f"### TASK\nGenerate {payload.count} MCQ items as JSON. "
            "Schema: {items:[{stem, options:[A,B,C,D], correct_index:int, explanation, difficulty, bloom, source_citation}]}"
        )
        try:
            data = await generate_json(system_message=sys, user_text=user_text, provider=provider, model=model)
        except Exception as e:
            raise HTTPException(502, f"AI provider error: {e}")
        items = data.get("items", []) if isinstance(data, dict) else []
        inserted = []
        for it in items[: payload.count]:
            doc = {
                "id": str(uuid.uuid4()),
                "assessment_id": assessment_id,
                "institution_id": a["institution_id"],
                "stem": it.get("stem", "")[:1000],
                "options": it.get("options", []),
                "correct_index": it.get("correct_index", 0),
                "explanation": it.get("explanation", ""),
                "type": "mcq",
                "difficulty": it.get("difficulty") or payload.difficulty,
                "bloom": it.get("bloom") or payload.bloom,
                "source_citation": it.get("source_citation"),
                "source_id": payload.source_id,
                "created_at": now_iso(),
            }
            if doc["stem"] and len(doc["options"]) >= 2:
                await db.assessment_items.insert_one(dict(doc))
                inserted.append(doc)
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": a["institution_id"],
            "action": "assessment.items.generate", "target": assessment_id,
            "actor": user["email"], "count": len(inserted),
            "model": f"{provider}/{model}", "ts": now_iso(),
        })
        return {"inserted": len(inserted), "items": inserted}

    @router.post("/{assessment_id}/publish")
    async def publish_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        await db.assessments.update_one(
            {"id": assessment_id}, {"$set": {"status": "published", "published_at": now_iso()}}
        )
        return {"ok": True}

    # ---------- Attempts (adaptive) ----------
    @router.post("/{assessment_id}/start")
    async def start_attempt(assessment_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        a = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Not found")
        await _scope(user, a["institution_id"])
        items = await db.assessment_items.find(
            {"assessment_id": assessment_id}, {"_id": 0}
        ).to_list(500)
        if not items:
            raise HTTPException(400, "No items in this assessment")

        first = _pick_next_item(items, set(), "easy" if a.get("adaptive") else (items[0].get("difficulty", "intermediate")))
        attempt = {
            "id": str(uuid.uuid4()),
            "assessment_id": assessment_id,
            "institution_id": a["institution_id"],
            "user_id": user["id"],
            "user_name": user["name"],
            "started_at": now_iso(),
            "answers": [],
            "asked": [first["id"]],
            "current_difficulty": first.get("difficulty", "intermediate"),
            "score": None,
            "completed_at": None,
            "signals": {
                "total_response_time_ms": 0,
                "hint_count": 0,
                "wrong_streak": 0,
                "max_wrong_streak": 0,
                "inactivity_events": 0,
            },
            "interventions": [],
        }
        await db.assessment_attempts.insert_one(dict(attempt))
        return {"attempt_id": attempt["id"], "item": _strip_item(first), "remaining_estimate": min(8, len(items))}

    def _strip_item(it):
        # Never expose correct_index to the client mid-attempt
        return {
            "id": it["id"],
            "stem": it["stem"],
            "options": it.get("options", []),
            "type": it.get("type", "mcq"),
            "difficulty": it.get("difficulty"),
            "bloom": it.get("bloom"),
        }

    async def _evaluate_signals(db, attempt: dict, assessment: dict) -> List[dict]:
        """Check active rules; record signals + queue interventions (HITL)."""
        rules = await db.psychometric_rules.find(
            {"institution_id": attempt["institution_id"], "enabled": True}, {"_id": 0}
        ).to_list(50)
        triggered = []
        sig = attempt["signals"]
        # Compute average response time
        n = max(1, len(attempt["answers"]))
        avg_rt = sig["total_response_time_ms"] / n
        for r in rules:
            cls = r["signal_class"]
            thr = r["threshold"]
            hit = False
            value = None
            if cls == "response_time_ms_avg":
                value = avg_rt
                hit = avg_rt > thr
            elif cls == "wrong_streak":
                value = sig["max_wrong_streak"]
                hit = sig["max_wrong_streak"] >= thr
            elif cls == "hint_usage":
                value = sig["hint_count"]
                hit = sig["hint_count"] >= thr
            elif cls == "inactivity":
                value = sig["inactivity_events"]
                hit = sig["inactivity_events"] >= thr
            if hit:
                ev_id = str(uuid.uuid4())
                event = {
                    "id": ev_id,
                    "institution_id": attempt["institution_id"],
                    "user_id": attempt["user_id"],
                    "user_name": attempt["user_name"],
                    "assessment_id": attempt["assessment_id"],
                    "attempt_id": attempt["id"],
                    "rule_id": r["id"],
                    "signal_class": cls,
                    "value": value,
                    "threshold": thr,
                    "intervention": r["intervention"],
                    "status": "pending_review",
                    "created_at": now_iso(),
                }
                await db.psychometric_events.insert_one(dict(event))
                triggered.append(event)
        return triggered

    @router.post("/attempts/{attempt_id}/answer")
    async def submit_answer(
        attempt_id: str,
        payload: AnswerSubmission = Body(...),
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        attempt = await db.assessment_attempts.find_one({"id": attempt_id}, {"_id": 0})
        if not attempt:
            raise HTTPException(404, "Attempt not found")
        if attempt["user_id"] != user["id"] and user["role"] != "super_admin":
            raise HTTPException(403, "Forbidden")
        if attempt.get("completed_at"):
            raise HTTPException(400, "Attempt already completed")
        a = await db.assessments.find_one({"id": attempt["assessment_id"]}, {"_id": 0})
        item = await db.assessment_items.find_one({"id": payload.item_id}, {"_id": 0})
        if not item:
            raise HTTPException(404, "Item not found")

        correct = (
            item.get("type") == "mcq"
            and payload.response_index is not None
            and payload.response_index == item.get("correct_index")
        )
        # Update signals
        sig = attempt["signals"]
        sig["total_response_time_ms"] += int(payload.response_time_ms or 0)
        sig["hint_count"] += int(payload.hints_used or 0)
        if not correct:
            sig["wrong_streak"] += 1
            sig["max_wrong_streak"] = max(sig["max_wrong_streak"], sig["wrong_streak"])
        else:
            sig["wrong_streak"] = 0
        if (payload.response_time_ms or 0) > 60000:
            sig["inactivity_events"] += 1

        answer = {
            "item_id": item["id"],
            "stem": item["stem"],
            "response_index": payload.response_index,
            "response_text": payload.response_text,
            "correct": correct,
            "difficulty": item.get("difficulty"),
            "bloom": item.get("bloom"),
            "response_time_ms": payload.response_time_ms,
            "hints_used": payload.hints_used,
            "ts": now_iso(),
        }
        attempt["answers"].append(answer)
        new_difficulty = _next_difficulty(item.get("difficulty", "intermediate"), correct) if a.get("adaptive") else item.get("difficulty", "intermediate")

        # Decide next: max 8 questions or until pool exhausted
        all_items = await db.assessment_items.find(
            {"assessment_id": attempt["assessment_id"]}, {"_id": 0}
        ).to_list(500)
        asked = set(attempt["asked"])
        question_limit = min(8, len(all_items))
        done = len(attempt["answers"]) >= question_limit or len(asked) >= len(all_items)

        next_item = None
        if not done:
            next_item = _pick_next_item(all_items, asked, new_difficulty)
            if next_item:
                asked.add(next_item["id"])

        # Evaluate signals + queue interventions
        triggered = await _evaluate_signals(db, attempt, a)
        attempt["interventions"].extend([t["id"] for t in triggered])

        # Persist attempt state
        update = {
            "answers": attempt["answers"],
            "asked": list(asked),
            "current_difficulty": new_difficulty,
            "signals": sig,
            "interventions": attempt["interventions"],
        }
        result_payload = None
        if done or not next_item:
            score_pct = round(
                100 * sum(1 for x in attempt["answers"] if x["correct"]) / max(1, len(attempt["answers"])), 1
            )
            update["completed_at"] = now_iso()
            update["score"] = score_pct
            result_payload = score_pct
        await db.assessment_attempts.update_one({"id": attempt_id}, {"$set": update})

        return {
            "correct": correct,
            "correct_index": item.get("correct_index"),
            "explanation": item.get("explanation"),
            "next_item": _strip_item(next_item) if next_item and not done else None,
            "completed": done or not next_item,
            "score": result_payload,
            "triggered_interventions": [
                {"id": t["id"], "signal": t["signal_class"], "intervention": t["intervention"]}
                for t in triggered
            ],
            "answered": len(attempt["answers"]),
            "limit": question_limit,
        }

    @router.get("/attempts/{attempt_id}/report")
    async def attempt_report(attempt_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        attempt = await db.assessment_attempts.find_one({"id": attempt_id}, {"_id": 0})
        if not attempt:
            raise HTTPException(404, "Not found")
        if attempt["user_id"] != user["id"] and user["role"] not in ("super_admin", "institution_admin", "faculty", "dean", "executive_leadership"):
            raise HTTPException(403, "Forbidden")
        # By bloom + difficulty competency
        by_bloom = defaultdict(lambda: {"total": 0, "correct": 0})
        by_diff = defaultdict(lambda: {"total": 0, "correct": 0})
        for ans in attempt["answers"]:
            by_bloom[ans.get("bloom", "?")]["total"] += 1
            by_diff[ans.get("difficulty", "?")]["total"] += 1
            if ans["correct"]:
                by_bloom[ans.get("bloom", "?")]["correct"] += 1
                by_diff[ans.get("difficulty", "?")]["correct"] += 1
        return {
            "attempt": attempt,
            "competency_bloom": [
                {"bloom": k, "total": v["total"], "correct": v["correct"],
                 "pct": round(100 * v["correct"] / max(1, v["total"]), 1)}
                for k, v in by_bloom.items()
            ],
            "competency_difficulty": [
                {"difficulty": k, "total": v["total"], "correct": v["correct"],
                 "pct": round(100 * v["correct"] / max(1, v["total"]), 1)}
                for k, v in by_diff.items()
            ],
        }

    @router.get("/attempts/list/{institution_id}")
    async def list_attempts(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        items = await db.assessment_attempts.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("started_at", -1).limit(100).to_list(100)
        return items

    return router
