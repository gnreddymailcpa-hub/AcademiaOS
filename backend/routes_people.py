"""Claros People — faculty development, training, API scores, AI dev plan."""
from __future__ import annotations
import json, logging, re, uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.people")

FACULTY_ROLES = {"faculty", "instructor", "hod", "dean"}
ADMIN_ROLES = {"super_admin", "institution_admin"}
STAFF_ROLES = FACULTY_ROLES | ADMIN_ROLES

TRAINING_TYPES = {"FDP", "STTP", "WORKSHOP", "ONLINE_COURSE", "CONFERENCE"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


def _safe_json(raw):
    if not raw:
        raise ValueError("empty")
    s = raw.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", s, flags=re.DOTALL | re.IGNORECASE)
    if m:
        s = m.group(1).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = s.find(opener)
        if start < 0:
            continue
        depth = 0
        for i in range(start, len(s)):
            if s[i] == opener:
                depth += 1
            elif s[i] == closer:
                depth -= 1
                if depth == 0:
                    return json.loads(s[start:i + 1])
    raise ValueError("bad json")


class TrainingBody(BaseModel):
    training_type: str
    title: str
    organiser: str = ""
    duration_days: int = 1
    completion_date: str
    certificate_url: str = ""
    platform: str = ""
    faculty_id: Optional[str] = None


class DevPlanBody(BaseModel):
    academic_year: Optional[str] = None


def build_claros_people_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/people", tags=["claros-people"])

    async def _my_faculty(db, user):
        if user["role"] in FACULTY_ROLES:
            return await db.faculty_profiles.find_one(
                {"user_id": user["id"], "tenant_id": _tenant_of(user)}, {"_id": 0})
        return None

    async def _can_view_faculty(db, user, fid: str) -> bool:
        if user["role"] in ADMIN_ROLES:
            return True
        if user["role"] == "dean" or user["role"] == "hod":
            return True
        fp = await _my_faculty(db, user)
        return bool(fp and fp.get("id") == fid)

    # ============================== LIST FACULTY
    @r.get("/faculty")
    async def list_faculty(user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid, "is_active": {"$ne": False}}
        if user["role"] == "hod":
            mine = await _my_faculty(db, user)
            if mine and mine.get("department_id"):
                flt["department_id"] = mine["department_id"]
        return await db.faculty_profiles.find(flt, {"_id": 0}).to_list(500)

    @r.get("/faculty/me")
    async def faculty_me(user: dict = Depends(get_current_user)):
        db = get_db()
        fp = await _my_faculty(db, user)
        if not fp:
            raise HTTPException(404, "Faculty record not found")
        return fp

    # ============================== API SCORE
    async def _compute_api(db, iid: str, fid: str, ay: Optional[str] = None) -> dict:
        ay = ay or f"{datetime.now(timezone.utc).year - 1}-{str(datetime.now(timezone.utc).year)[-2:]}"
        # Teaching: course count via faculty_user_id
        fp = await db.faculty_profiles.find_one(
            {"id": fid, "tenant_id": iid}, {"_id": 0})
        teaching_count = 0
        if fp and fp.get("user_id"):
            teaching_count = await db.courses.count_documents(
                {"institution_id": iid, "faculty_user_id": fp["user_id"]})
        # Research
        pubs_year = await db.research_publications.count_documents(
            {"tenant_id": iid, "faculty_id": fid,
             "year_of_publication": datetime.now(timezone.utc).year})
        projects_active = await db.research_projects.count_documents(
            {"tenant_id": iid, "principal_investigator": fid, "status": "ONGOING"})
        # Service
        training_count = await db.training_records.count_documents(
            {"tenant_id": iid, "faculty_id": fid})

        teaching_score = min(teaching_count * 10, 50)
        research_score = min(pubs_year * 15 + projects_active * 10, 60)
        service_score = min(training_count * 5 + 20, 30)
        total = teaching_score + research_score + service_score
        return {
            "academic_year": ay,
            "teaching_score": float(teaching_score),
            "research_score": float(research_score),
            "service_score": float(service_score),
            "total_api": float(total),
            "teaching_count": teaching_count,
            "publications_year": pubs_year,
            "projects_active": projects_active,
            "training_count": training_count,
        }

    @r.get("/faculty/{fid}/api")
    async def get_api(fid: str, user: dict = Depends(get_current_user)):
        db = get_db()
        if not await _can_view_faculty(db, user, fid):
            raise HTTPException(403, "Cannot view this faculty")
        iid = _tenant_of(user)
        latest = await db.api_scores.find_one(
            {"tenant_id": iid, "faculty_id": fid},
            {"_id": 0}, sort=[("computed_at", -1)])
        if latest:
            return latest
        return await _compute_api(db, iid, fid)

    @r.post("/faculty/{fid}/api/compute")
    async def compute_api(fid: str, user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        data = await _compute_api(db, iid, fid)
        rec = {
            "id": str(uuid.uuid4()), "tenant_id": iid, "faculty_id": fid,
            "academic_year": data["academic_year"],
            "teaching_score": data["teaching_score"],
            "research_score": data["research_score"],
            "service_score": data["service_score"],
            "total_api": data["total_api"],
            "computed_at": _now(),
        }
        await db.api_scores.insert_one(rec)
        rec.pop("_id", None)
        return rec

    # ============================== TRAINING
    @r.get("/training")
    async def my_training(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        if user["role"] in ADMIN_ROLES:
            return await db.training_records.find(
                {"tenant_id": iid}, {"_id": 0}).sort("completion_date", -1).to_list(500)
        if not fp:
            return []
        return await db.training_records.find(
            {"tenant_id": iid, "faculty_id": fp["id"]}, {"_id": 0}
        ).sort("completion_date", -1).to_list(500)

    @r.post("/training")
    async def add_training(body: TrainingBody,
                            user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.training_type not in TRAINING_TYPES:
            raise HTTPException(400, f"training_type must be one of {sorted(TRAINING_TYPES)}")
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "faculty_id": body.faculty_id or (fp or {}).get("id"),
            "training_type": body.training_type, "title": body.title,
            "organiser": body.organiser,
            "duration_days": int(body.duration_days or 1),
            "completion_date": body.completion_date,
            "certificate_url": body.certificate_url,
            "platform": body.platform, "created_at": _now(),
        }
        if not doc["faculty_id"]:
            raise HTTPException(400, "faculty_id required (or login as faculty)")
        await db.training_records.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.delete("/training/{tid}")
    async def delete_training(tid: str, user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        res = await db.training_records.delete_one({"id": tid, "tenant_id": iid})
        if res.deleted_count == 0:
            raise HTTPException(404, "Training not found")
        return {"ok": True}

    # ============================== DEVELOPMENT PLAN
    @r.post("/faculty/{fid}/development-plan")
    async def gen_dev_plan(fid: str, body: DevPlanBody,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        if not await _can_view_faculty(db, user, fid):
            raise HTTPException(403, "Cannot view this faculty")
        fp = await db.faculty_profiles.find_one(
            {"id": fid, "tenant_id": iid}, {"_id": 0})
        if not fp:
            raise HTTPException(404, "Faculty not found")
        api_data = await _compute_api(db, iid, fid)
        training_list = [t["title"] for t in await db.training_records.find(
            {"tenant_id": iid, "faculty_id": fid}, {"_id": 0, "title": 1}
        ).limit(20).to_list(20)]
        pub_count = api_data["publications_year"]
        # Years experience
        join_year = None
        if fp.get("joining_date"):
            try:
                join_year = int(str(fp["joining_date"])[:4])
            except (ValueError, TypeError):
                pass
        years_exp = datetime.now(timezone.utc).year - join_year if join_year else 5

        dept = ""
        if fp.get("department_id"):
            d = await db.departments.find_one({"id": fp["department_id"]}, {"_id": 0, "name": 1})
            dept = (d or {}).get("name") or ""

        prompt = (
            f"Generate a professional development plan for a faculty member.\n"
            f"Designation: {fp.get('designation', 'Faculty')}. "
            f"Experience: {years_exp} years. Dept: {dept}.\n"
            f"Current API: {api_data['total_api']}/140. "
            f"Training records this year: {training_list}.\n"
            f"Publications this year: {pub_count}.\n\n"
            "Provide: (1) 3 development goals for next academic year, "
            "(2) Specific SWAYAM/NPTEL courses to complete (name 2-3 real courses), "
            "(3) Research direction suggestion, "
            "(4) One service activity recommendation.\n"
            "Return ONLY valid JSON: "
            "{\"goals\":[str,str,str],\"courses\":[str,str],\"research_tip\":str,\"service\":str}"
        )
        try:
            raw = await generate_text(
                system_message="You are a faculty development advisor. Strict JSON only.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"people-devplan-{fid}", max_tokens=900,
            )
            data = _safe_json(raw)
        except Exception as e:
            logger.warning("Dev plan LLM failed: %s", e)
            data = {
                "goals": [
                    f"Publish at least {max(1, pub_count + 1)} indexed paper in your domain",
                    "Complete an FDP on emerging pedagogy",
                    "Lead one funded student project",
                ],
                "courses": ["NPTEL: Outcome Based Education", "SWAYAM: Research Methodology"],
                "research_tip": "Identify one student team to co-author a conference paper.",
                "service": "Mentor 2 final-year project groups this academic year.",
            }
        ay = body.academic_year or api_data["academic_year"]
        rec = {
            "id": str(uuid.uuid4()), "tenant_id": iid, "faculty_id": fid,
            "academic_year": ay, "goals": data, "status": "ACTIVE",
            "created_at": _now(),
        }
        await db.faculty_development_plans.insert_one(rec)
        rec.pop("_id", None)
        return rec

    @r.get("/faculty/{fid}/development-plan")
    async def get_dev_plan(fid: str, user: dict = Depends(get_current_user)):
        db = get_db()
        if not await _can_view_faculty(db, user, fid):
            raise HTTPException(403, "Cannot view this faculty")
        iid = _tenant_of(user)
        rec = await db.faculty_development_plans.find_one(
            {"tenant_id": iid, "faculty_id": fid},
            {"_id": 0}, sort=[("created_at", -1)])
        if not rec:
            raise HTTPException(404, "No plan yet")
        return rec

    # ============================== WORKLOAD + STATS
    @r.get("/workload/me")
    async def workload_me(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        if not fp:
            return {"teaching_hours_week": 0, "courses_count": 0, "students_count": 0}
        courses = await db.courses.find(
            {"institution_id": iid, "faculty_user_id": fp.get("user_id")},
            {"_id": 0, "id": 1, "credits": 1}).to_list(50)
        course_ids = [c["id"] for c in courses]
        hours = sum(int(c.get("credits") or 3) for c in courses)
        student_count = await db.course_enrollments.count_documents(
            {"tenant_id": iid, "course_id": {"$in": course_ids}}) if course_ids else 0
        return {
            "teaching_hours_week": hours,
            "courses_count": len(courses),
            "students_count": student_count,
        }

    @r.get("/stats")
    async def stats(user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        total = await db.faculty_profiles.count_documents(
            {"tenant_id": iid, "is_active": {"$ne": False}})
        # average API across most recent scores
        scores = await db.api_scores.find(
            {"tenant_id": iid}, {"_id": 0, "total_api": 1}).to_list(2000)
        avg_api = round(sum(s["total_api"] for s in scores) / len(scores), 1) if scores else 0.0
        phd_holders = await db.faculty_profiles.count_documents(
            {"tenant_id": iid, "qualification": {"$regex": "phd|ph\\.d", "$options": "i"}})
        year_now = datetime.now(timezone.utc).year
        trained_this_year = await db.training_records.count_documents({
            "tenant_id": iid,
            "completion_date": {"$regex": f"^{year_now}"},
        })
        return {
            "total_faculty": total, "avg_api": avg_api,
            "phd_holders": phd_holders, "trained_this_year": trained_this_year,
        }

    return r
