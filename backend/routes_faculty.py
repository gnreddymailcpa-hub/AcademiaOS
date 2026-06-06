"""
FACULTY+ — Faculty Operations backend (Phase 2).

Phase-2 MVP scope:
  - Faculty profiles (name, department, designation, expertise, joined)
  - FDP (Faculty Development Programme) enrollments + completion
  - Appraisal cycles with composite score across 4 weighted dimensions
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class FacultyIn(BaseModel):
    name: str
    email: str
    department: str
    designation: str = "Assistant Professor"
    expertise: List[str] = Field(default_factory=list)
    joined_year: int


class FdpIn(BaseModel):
    faculty_id: str
    faculty_name: str
    programme: str
    hours: int
    completion_date: Optional[str] = None
    status: str = Field(default="enrolled", pattern="^(enrolled|completed|dropped)$")


class AppraisalIn(BaseModel):
    faculty_id: str
    faculty_name: str
    cycle: str  # "AY 2025-26"
    teaching: float = Field(ge=0, le=100)
    research: float = Field(ge=0, le=100)
    institutional_service: float = Field(ge=0, le=100)
    student_feedback: float = Field(ge=0, le=100)


# Standard CAS-style weights (UGC reference): Teaching 40 / Research 30 / Service 15 / Feedback 15
WEIGHTS = {"teaching": 0.40, "research": 0.30, "institutional_service": 0.15, "student_feedback": 0.15}


def build_faculty_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/faculty-plus", tags=["faculty-plus"])

    def _guard(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ----- Profiles -----
    @router.get("/{institution_id}/profiles")
    async def list_profiles(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.faculty_profiles.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)

    @router.post("/{institution_id}/profiles")
    async def add_profile(institution_id: str, payload: FacultyIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "hr_admin"):
            raise HTTPException(status_code=403, detail="Admin / HR role required")
        db = get_db()
        doc = {"id": f"fac-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now()}
        await db.faculty_profiles.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "faculty.profile.add", doc["id"],
                     {"department": payload.department})
        return doc

    # ----- FDP -----
    @router.get("/{institution_id}/fdp")
    async def list_fdp(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.faculty_fdp.find({"institution_id": institution_id}, {"_id": 0}).sort("completion_date", -1).to_list(500)

    @router.post("/{institution_id}/fdp")
    async def add_fdp(institution_id: str, payload: FdpIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        doc = {"id": f"fdp-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now(), "recorded_by": user["email"]}
        await db.faculty_fdp.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "faculty.fdp.record", doc["id"],
                     {"programme": payload.programme, "status": payload.status})
        return doc

    # ----- Appraisals -----
    @router.get("/{institution_id}/appraisals")
    async def list_appraisals(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.faculty_appraisals.find({"institution_id": institution_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/{institution_id}/appraisals")
    async def add_appraisal(institution_id: str, payload: AppraisalIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "hr_admin"):
            raise HTTPException(status_code=403, detail="Admin / HR role required")
        composite = round(
            payload.teaching * WEIGHTS["teaching"]
            + payload.research * WEIGHTS["research"]
            + payload.institutional_service * WEIGHTS["institutional_service"]
            + payload.student_feedback * WEIGHTS["student_feedback"],
            1,
        )
        band = "Exceeds" if composite >= 85 else "Meets" if composite >= 65 else "Below"
        db = get_db()
        doc = {"id": f"apr-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "composite": composite, "band": band,
               "weights": WEIGHTS, "created_at": _now(), "evaluated_by": user["email"]}
        await db.faculty_appraisals.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "faculty.appraisal.record", doc["id"],
                     {"composite": composite, "band": band})
        return doc

    # ----- Summary -----
    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        profs = await db.faculty_profiles.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        fdps = await db.faculty_fdp.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        apps = await db.faculty_appraisals.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        by_dept = {}
        for p in profs:
            by_dept[p["department"]] = by_dept.get(p["department"], 0) + 1
        completed_fdp = sum(1 for f in fdps if f.get("status") == "completed")
        fdp_hours = sum(f.get("hours", 0) for f in fdps if f.get("status") == "completed")
        avg_composite = round(sum(a.get("composite", 0) for a in apps) / max(len(apps), 1), 1)
        return {
            "faculty_count": len(profs),
            "departments": len(by_dept),
            "by_department": [{"department": k, "count": v} for k, v in sorted(by_dept.items(), key=lambda x: -x[1])],
            "fdp_completed": completed_fdp,
            "fdp_total_hours": fdp_hours,
            "appraisals_done": len(apps),
            "avg_appraisal_composite": avg_composite,
            "weights": WEIGHTS,
        }

    return router
