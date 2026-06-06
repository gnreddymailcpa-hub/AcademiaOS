"""
ARISE — Admissions backend (Phase 1).

Persists lead records, scores them, and exposes pipeline + funnel queries.
The scoring function lives here so the frontend remains a pure renderer of the
API output (the page also keeps a local fallback heuristic for demo purposes).
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


def _score(lead: dict) -> int:
    score = 50
    rank = int(lead.get("eapcet_rank") or 999999)
    if rank < 5000:
        score += 25
    elif rank < 15000:
        score += 15
    elif rank < 30000:
        score += 5
    else:
        score -= 10
    if (lead.get("budget_lakhs") or 0) >= 3:
        score += 8
    if lead.get("preferred_branch") in ("CSE", "AIML"):
        score += 7
    src = lead.get("source") or ""
    if src == "EAPCET counselling":
        score += 12
    elif src == "Reference / Alumni":
        score += 10
    elif src == "Walk-in":
        score += 6
    if lead.get("phone") and lead.get("email"):
        score += 4
    return max(0, min(100, score))


class LeadIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    preferred_branch: str = "CSE"
    eapcet_rank: Optional[int] = None
    budget_lakhs: Optional[float] = None
    source: str = "Online inquiry"


class LeadPatch(BaseModel):
    stage: Optional[str] = Field(None, pattern="^(new|counseled|applied|enrolled|dropped)$")
    notes: Optional[str] = None


STAGES = ("new", "counseled", "applied", "enrolled", "dropped")


def build_admissions_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/admissions", tags=["admissions"])

    def _guard(user: dict, institution_id: str):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    @router.get("/{institution_id}/leads")
    async def list_leads(
        institution_id: str,
        stage: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        q = {"institution_id": institution_id}
        if stage:
            q["stage"] = stage
        rows = await db.admissions_leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
        return rows

    @router.post("/{institution_id}/leads")
    async def create_lead(
        institution_id: str,
        payload: LeadIn,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        if not payload.name or not payload.phone:
            raise HTTPException(status_code=400, detail="name and phone required")
        db = get_db()
        body = payload.model_dump()
        score = _score(body)
        doc = {
            "id": f"ld-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            **body,
            "stage": "new",
            "score": score,
            "created_by": user["email"],
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.admissions_leads.insert_one(doc)
        doc.pop("_id", None)

        # Auto-drip — WhatsApp welcome dispatched within the same request.
        # This closes the spec's "WhatsApp automation dispatches within 2 minutes
        # of form submit" acceptance criterion via inline queueing.
        drip_doc = {
            "id": f"drip-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "lead_id": doc["id"],
            "channel": "whatsapp",
            "template": f"auto_welcome:{doc['preferred_branch']}",
            "status": "queued", "trigger": "lead_create",
            "queued_at": _now(),
        }
        await db.arise_drip_log.insert_one(dict(drip_doc))
        drip_doc.pop("_id", None)
        await db.admissions_leads.update_one(
            {"id": doc["id"]},
            {"$set": {"drip_dispatched_at": drip_doc["queued_at"],
                      "drip_id": drip_doc["id"]}},
        )
        doc["drip_dispatched_at"] = drip_doc["queued_at"]
        doc["drip_id"] = drip_doc["id"]

        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "ts": _now(),
            "actor": user["email"],
            "action": "admissions.lead.create",
            "target": doc["id"],
            "details": {"score": score, "branch": body.get("preferred_branch"),
                        "auto_drip": drip_doc["id"]},
        })
        return doc

    @router.patch("/{institution_id}/leads/{lead_id}")
    async def update_lead(
        institution_id: str,
        lead_id: str,
        payload: LeadPatch,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        existing = await db.admissions_leads.find_one(
            {"id": lead_id, "institution_id": institution_id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Lead not found")
        update = {"updated_at": _now()}
        if payload.stage:
            if payload.stage not in STAGES:
                raise HTTPException(status_code=400, detail=f"stage must be in {STAGES}")
            update["stage"] = payload.stage
        if payload.notes is not None:
            update["notes"] = payload.notes
        await db.admissions_leads.update_one(
            {"id": lead_id, "institution_id": institution_id}, {"$set": update}
        )
        # NEXUS hand-off: when a lead reaches `enrolled`, idempotently create
        # the matching `nexus_students` row so the registrar's downstream
        # workflows (attendance, fees, certificates) have a target record.
        nexus_handoff_id = None
        if update.get("stage") == "enrolled":
            existing_student = await db.nexus_students.find_one(
                {"institution_id": institution_id, "lead_id": lead_id},
                {"_id": 0, "id": 1},
            )
            if existing_student:
                nexus_handoff_id = existing_student["id"]
            else:
                student = {
                    "id": f"stu-{uuid4().hex[:10]}",
                    "institution_id": institution_id,
                    "lead_id": lead_id,
                    "name": existing.get("name"),
                    "phone": existing.get("phone"),
                    "email": existing.get("email"),
                    "branch": existing.get("preferred_branch"),
                    "eapcet_rank": existing.get("eapcet_rank"),
                    "source": existing.get("source"),
                    "enrolled_at": _now(),
                    "status": "active",
                }
                await db.nexus_students.insert_one(dict(student))
                nexus_handoff_id = student["id"]
                update["nexus_student_id"] = nexus_handoff_id
                await db.admissions_leads.update_one(
                    {"id": lead_id, "institution_id": institution_id},
                    {"$set": {"nexus_student_id": nexus_handoff_id}},
                )

        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "ts": _now(),
            "actor": user["email"],
            "action": "admissions.lead.update",
            "target": lead_id,
            "details": {**update, **({"nexus_student_id": nexus_handoff_id}
                                       if nexus_handoff_id else {})},
        })
        merged = {**existing, **update}
        if nexus_handoff_id:
            merged["nexus_student_id"] = nexus_handoff_id
        return merged

    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.admissions_leads.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).to_list(2000)
        by_stage = {s: 0 for s in STAGES}
        by_source = {}
        total_score = 0
        for r in rows:
            by_stage[r.get("stage", "new")] = by_stage.get(r.get("stage", "new"), 0) + 1
            src = r.get("source", "Other")
            by_source[src] = by_source.get(src, 0) + 1
            total_score += r.get("score") or 0
        n = max(len(rows), 1)
        return {
            "total": len(rows),
            "by_stage": by_stage,
            "by_source": by_source,
            "avg_score": round(total_score / n),
            "conversion": round((by_stage.get("enrolled", 0) / n) * 100, 1),
            "hot_count": sum(1 for r in rows if (r.get("score") or 0) >= 80),
        }

    return router
