"""
PATHFINDER — Placement Intelligence backend (Phase 1).

Phase-1 MVP scope:
  - Placement drives: company, role, package, eligibility (CGPA/branches), schedule
  - Student applications + status tracking
  - Resume scoring API (heuristic on keywords + completeness)
  - Mock-interview log
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class DriveIn(BaseModel):
    company: str
    role: str
    package_lpa: float
    eligibility_branches: List[str] = Field(default_factory=list)
    eligibility_cgpa: float = 6.0
    scheduled_date: str  # YYYY-MM-DD
    description: Optional[str] = ""


class ApplyIn(BaseModel):
    student_id: str
    student_name: str
    branch: str
    cgpa: float


class ResumeScoreIn(BaseModel):
    student_name: str
    target_role: str = "Software Engineer"
    skills: List[str] = Field(default_factory=list)
    projects: int = 0
    internships: int = 0
    certifications: int = 0
    cgpa: float = 7.0
    leadership_roles: int = 0
    publications: int = 0


# Keywords scored higher for SDE / DS roles — drives the resume rating
KEYWORD_WEIGHTS = {
    "python": 8, "java": 7, "c++": 6, "javascript": 6, "react": 7,
    "node": 6, "sql": 7, "mongodb": 5, "aws": 8, "docker": 6,
    "kubernetes": 7, "system design": 9, "data structures": 8,
    "algorithms": 8, "machine learning": 9, "deep learning": 9,
    "tensorflow": 7, "pytorch": 7, "spark": 6, "hadoop": 5,
    "git": 4, "linux": 5, "rest api": 6, "microservices": 7,
}


def _resume_score(payload: dict) -> dict:
    """Transparent scoring — every component is callable independently."""
    skill_kw_score = 0
    matched = []
    for s in payload.get("skills", []):
        w = KEYWORD_WEIGHTS.get(s.strip().lower(), 0)
        if w:
            skill_kw_score += w
            matched.append(s.strip())
    skill_kw_score = min(skill_kw_score, 40)  # cap at 40

    completeness = 0
    if payload.get("projects", 0) >= 2:
        completeness += 10
    if payload.get("internships", 0) >= 1:
        completeness += 12
    if payload.get("certifications", 0) >= 1:
        completeness += 6
    if payload.get("leadership_roles", 0) >= 1:
        completeness += 6
    if payload.get("publications", 0) >= 1:
        completeness += 6

    cgpa = payload.get("cgpa", 0)
    if cgpa >= 9.0:
        cgpa_score = 20
    elif cgpa >= 8.5:
        cgpa_score = 18
    elif cgpa >= 8.0:
        cgpa_score = 16
    elif cgpa >= 7.0:
        cgpa_score = 12
    elif cgpa >= 6.0:
        cgpa_score = 6
    else:
        cgpa_score = 0

    total = skill_kw_score + completeness + cgpa_score
    total = min(total, 100)

    suggestions = []
    if skill_kw_score < 25:
        suggestions.append("Add 3-4 industry keywords (e.g. system design, AWS, Docker) tied to recent projects.")
    if payload.get("internships", 0) < 1:
        suggestions.append("Aim for at least one summer internship — biggest single recruiter signal.")
    if payload.get("projects", 0) < 2:
        suggestions.append("Publish 2+ portfolio projects with GitHub link and one-line problem statement.")
    if cgpa < 7:
        suggestions.append("CGPA under 7.0 — backstop with strong project + certification narrative.")
    if not suggestions:
        suggestions.append("Solid profile — focus next on system-design depth and one open-source contribution.")

    band = "Strong" if total >= 70 else "Good" if total >= 50 else "Needs work"

    return {
        "total": total,
        "band": band,
        "components": {
            "skill_keywords": skill_kw_score,
            "completeness": completeness,
            "cgpa": cgpa_score,
        },
        "matched_keywords": matched,
        "suggestions": suggestions,
    }


def build_pathfinder_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/placements", tags=["placements"])

    def _guard(user: dict, institution_id: str):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    async def _audit(db, institution_id: str, actor: str, action: str, target: str, details: dict):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ---------------- DRIVES ----------------
    @router.get("/{institution_id}/drives")
    async def list_drives(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.placement_drives.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("scheduled_date", -1).to_list(200)
        return rows

    @router.post("/{institution_id}/drives")
    async def create_drive(
        institution_id: str, payload: DriveIn, user: dict = Depends(get_current_user)
    ):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "career_services"):
            raise HTTPException(status_code=403, detail="T&P / admin role required")
        db = get_db()
        doc = {
            "id": f"drv-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            **payload.model_dump(),
            "status": "scheduled",
            "applicants": [],
            "selected": [],
            "created_by": user["email"],
            "created_at": _now(),
        }
        await db.placement_drives.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "placements.drive.create", doc["id"],
                     {"company": payload.company, "package": payload.package_lpa})
        return doc

    @router.post("/{institution_id}/drives/{drive_id}/apply")
    async def apply_drive(
        institution_id: str, drive_id: str,
        payload: ApplyIn, user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        drive = await db.placement_drives.find_one(
            {"id": drive_id, "institution_id": institution_id}, {"_id": 0}
        )
        if not drive:
            raise HTTPException(status_code=404, detail="Drive not found")
        # Eligibility check
        if drive["eligibility_branches"] and payload.branch not in drive["eligibility_branches"]:
            raise HTTPException(status_code=400, detail=f"Branch {payload.branch} not eligible")
        if payload.cgpa < drive["eligibility_cgpa"]:
            raise HTTPException(status_code=400, detail=f"CGPA below {drive['eligibility_cgpa']}")
        if any(a["student_id"] == payload.student_id for a in drive.get("applicants", [])):
            raise HTTPException(status_code=409, detail="Already applied")
        app_row = {**payload.model_dump(), "applied_at": _now(), "status": "applied"}
        await db.placement_drives.update_one(
            {"id": drive_id, "institution_id": institution_id},
            {"$push": {"applicants": app_row}},
        )
        await _audit(db, institution_id, user["email"], "placements.drive.apply", drive_id,
                     {"student": payload.student_name, "branch": payload.branch})
        return {"ok": True, "drive_id": drive_id, "student_id": payload.student_id}

    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.placement_drives.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).to_list(500)
        upcoming = sum(1 for r in rows if r.get("status") == "scheduled")
        total_apps = sum(len(r.get("applicants", [])) for r in rows)
        total_selected = sum(len(r.get("selected", [])) for r in rows)
        avg_package = round(sum(r.get("package_lpa", 0) for r in rows) / max(len(rows), 1), 2)
        max_package = max((r.get("package_lpa", 0) for r in rows), default=0)
        return {
            "total_drives": len(rows),
            "upcoming": upcoming,
            "total_applications": total_apps,
            "total_selected": total_selected,
            "avg_package_lpa": avg_package,
            "highest_package_lpa": max_package,
        }

    # ---------------- RESUME SCORING ----------------
    @router.post("/{institution_id}/resume-score")
    async def score_resume(
        institution_id: str, payload: ResumeScoreIn, user: dict = Depends(get_current_user)
    ):
        _guard(user, institution_id)
        body = payload.model_dump()
        result = _resume_score(body)
        db = get_db()
        doc = {
            "id": f"rs-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "scored_by": user["email"],
            "scored_at": _now(),
            "input": body,
            "result": result,
        }
        await db.resume_scores.insert_one(doc)
        doc.pop("_id", None)
        return doc

    return router
