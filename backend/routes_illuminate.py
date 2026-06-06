"""
ILLUMINATE — Learning Management System (Phase 2).

Phase-2 MVP scope:
  - Course catalog (title, code, credits, instructor, cohort)
  - Assignments per course with due date + max marks
  - Learner progress (lessons completed %, last activity)
  - Certificate-of-completion issuance via NEXUS verify endpoint reuse
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class CourseIn(BaseModel):
    title: str
    code: str
    credits: int = 3
    instructor: str
    cohort: str = ""
    lessons_total: int = 12
    description: Optional[str] = ""


class AssignmentIn(BaseModel):
    course_id: str
    title: str
    due_date: str
    max_marks: int = 100
    description: Optional[str] = ""


class ProgressIn(BaseModel):
    course_id: str
    student_id: str
    student_name: str
    lessons_completed: int = 0


def build_illuminate_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/illuminate", tags=["illuminate"])

    def _guard(user: dict, institution_id: str):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    @router.get("/{institution_id}/courses")
    async def list_courses(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.illuminate_courses.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        return rows

    @router.post("/{institution_id}/courses")
    async def create_course(institution_id: str, payload: CourseIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "faculty", "instructor"):
            raise HTTPException(status_code=403, detail="Faculty / admin role required")
        db = get_db()
        doc = {"id": f"crs-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now(), "created_by": user["email"]}
        await db.illuminate_courses.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "illuminate.course.create", doc["id"], {"code": payload.code})
        return doc

    @router.get("/{institution_id}/assignments")
    async def list_assignments(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.illuminate_assignments.find({"institution_id": institution_id}, {"_id": 0}).sort("due_date", 1).to_list(500)
        return rows

    @router.post("/{institution_id}/assignments")
    async def create_assignment(institution_id: str, payload: AssignmentIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "faculty", "instructor"):
            raise HTTPException(status_code=403, detail="Faculty / admin role required")
        db = get_db()
        doc = {"id": f"asn-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "submissions": [], "created_at": _now()}
        await db.illuminate_assignments.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "illuminate.assignment.create", doc["id"], {"course": payload.course_id})
        return doc

    @router.post("/{institution_id}/progress")
    async def upsert_progress(institution_id: str, payload: ProgressIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        key = {"institution_id": institution_id, "course_id": payload.course_id, "student_id": payload.student_id}
        await db.illuminate_progress.update_one(
            key,
            {"$set": {**payload.model_dump(), "institution_id": institution_id,
                      "updated_at": _now(), "last_actor": user["email"]}},
            upsert=True,
        )
        return {"ok": True, **payload.model_dump()}

    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        courses = await db.illuminate_courses.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        asns = await db.illuminate_assignments.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        prog = await db.illuminate_progress.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        completion = 0
        if prog:
            total_pct = sum(
                (p.get("lessons_completed", 0) / max(_lessons_for(courses, p["course_id"]), 1)) * 100
                for p in prog
            )
            completion = round(total_pct / len(prog), 1)
        return {
            "courses": len(courses),
            "assignments": len(asns),
            "active_learners": len({p["student_id"] for p in prog}),
            "avg_completion_pct": completion,
        }

    return router


def _lessons_for(courses: list, course_id: str) -> int:
    for c in courses:
        if c["id"] == course_id:
            return c.get("lessons_total", 12)
    return 12
