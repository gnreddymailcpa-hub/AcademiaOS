"""Claros Alumni — directory, mentorship, jobs, events, AI outreach."""
from __future__ import annotations
import logging, re, uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.claros_alumni")

FACULTY_ROLES = {"faculty", "instructor", "hod", "dean"}
ADMIN_ROLES = {"super_admin", "institution_admin"}
MENTORSHIP_STATUSES = {"PENDING", "ACCEPTED", "DECLINED", "COMPLETED"}
EVENT_TYPES = {"MEETUP", "WEBINAR", "CAMPUS_VISIT", "NETWORKING"}
OUTREACH_PURPOSES = {"MENTORSHIP", "JOB", "EVENT", "FUNDRAISING"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


class AlumniProfileBody(BaseModel):
    batch_year: int
    program_name: str = ""
    department_name: str = ""
    current_company: str = ""
    current_role: str = ""
    current_location: str = ""
    linkedin_url: str = ""
    is_mentor: bool = False
    mentor_domains: List[str] = []
    bio: str = ""


class MentorshipRequestBody(BaseModel):
    alumni_id: str
    message: str = ""
    domain_sought: str = ""


class MentorshipUpdate(BaseModel):
    status: str


class JobBody(BaseModel):
    title: str
    company_name: str = ""
    location: str = ""
    description: str = ""
    skills_required: List[str] = []
    package_lpa: Optional[float] = None
    application_url: str = ""
    deadline: Optional[str] = None


class EventBody(BaseModel):
    title: str
    event_type: str = "MEETUP"
    description: str = ""
    event_date: str
    event_time: str = "18:00"
    location_or_link: str = ""


class OutreachBody(BaseModel):
    alumni_id: str
    purpose: str = "MENTORSHIP"


def build_claros_alumni_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/alumni", tags=["claros-alumni"])

    async def _my_alumni(db, user, iid):
        return await db.alumni_profiles.find_one(
            {"user_id": user["id"], "tenant_id": iid}, {"_id": 0})

    async def _student_of(db, user, iid):
        if user["role"] == "student":
            return await db.students.find_one(
                {"user_id": user["id"], "tenant_id": iid}, {"_id": 0})
        return None

    @r.get("/profiles")
    async def list_profiles(search: Optional[str] = None, batch_year: Optional[int] = None,
                             company: Optional[str] = None, domain: Optional[str] = None,
                             mentors_only: bool = False,
                             user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid}
        if batch_year:
            flt["batch_year"] = batch_year
        if mentors_only:
            flt["is_mentor"] = True
        if company:
            flt["current_company"] = {"$regex": re.escape(company), "$options": "i"}
        if domain:
            flt["mentor_domains"] = {"$in": [domain]}
        rows = await db.alumni_profiles.find(flt, {"_id": 0}).limit(500).to_list(500)
        if search:
            rx = re.compile(re.escape(search), re.I)
            rows = [a for a in rows if rx.search(a.get("name") or a.get("display_name") or "")]
        return rows

    @r.get("/profiles/{aid}")
    async def get_profile(aid: str, user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        a = await db.alumni_profiles.find_one(
            {"id": aid, "tenant_id": iid}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Alumni not found")
        return a

    @r.post("/profiles")
    async def register_alumni(body: AlumniProfileBody,
                               user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        existing = await _my_alumni(db, user, iid)
        if existing:
            raise HTTPException(400, "Profile already exists — use PUT /profiles/me")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid, "user_id": user["id"],
            "name": user.get("display_name") or user.get("email", ""),
            "email": user.get("email", ""),
            "batch_year": int(body.batch_year),
            "program_name": body.program_name, "department_name": body.department_name,
            "current_company": body.current_company, "current_role": body.current_role,
            "current_location": body.current_location,
            "linkedin_url": body.linkedin_url,
            "is_mentor": bool(body.is_mentor),
            "mentor_domains": body.mentor_domains, "bio": body.bio,
            "is_verified": False, "created_at": _now(),
        }
        await db.alumni_profiles.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/profiles/me")
    async def update_my_profile(body: AlumniProfileBody,
                                 user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        existing = await _my_alumni(db, user, iid)
        if not existing:
            raise HTTPException(404, "No profile — POST /profiles first")
        updates = {k: v for k, v in body.dict().items() if v is not None}
        updates["updated_at"] = _now()
        await db.alumni_profiles.update_one({"id": existing["id"]}, {"$set": updates})
        return await db.alumni_profiles.find_one({"id": existing["id"]}, {"_id": 0})

    @r.get("/mentors")
    async def list_mentors(domain: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid, "is_mentor": True}
        if domain:
            flt["mentor_domains"] = {"$in": [domain]}
        return await db.alumni_profiles.find(flt, {"_id": 0}).limit(200).to_list(200)

    @r.post("/mentorship/request")
    async def request_mentorship(body: MentorshipRequestBody,
                                  user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        iid = _tenant_of(user)
        st = await _student_of(db, user, iid)
        if not st:
            raise HTTPException(403, "No student record")
        alumni = await db.alumni_profiles.find_one(
            {"id": body.alumni_id, "tenant_id": iid}, {"_id": 0})
        if not alumni:
            raise HTTPException(404, "Alumni not found")
        if not alumni.get("is_mentor"):
            raise HTTPException(400, "Alumni is not available as a mentor")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "student_id": st["id"], "alumni_id": body.alumni_id,
            "message": body.message, "domain_sought": body.domain_sought,
            "status": "PENDING", "created_at": _now(), "responded_at": None,
        }
        await db.mentorship_requests.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/mentorship/requests")
    async def my_requests(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        if user["role"] == "student":
            st = await _student_of(db, user, iid)
            if not st:
                return []
            rows = await db.mentorship_requests.find(
                {"tenant_id": iid, "student_id": st["id"]}, {"_id": 0}
            ).sort("created_at", -1).to_list(200)
            aids = list({r_["alumni_id"] for r_ in rows})
            amap = {a["id"]: a for a in await db.alumni_profiles.find(
                {"id": {"$in": aids}, "tenant_id": iid}, {"_id": 0}).to_list(200)}
            for row in rows:
                a = amap.get(row["alumni_id"], {})
                row["alumni_name"] = a.get("name")
                row["alumni_company"] = a.get("current_company")
            return rows
        alum = await _my_alumni(db, user, iid)
        if not alum:
            return []
        rows = await db.mentorship_requests.find(
            {"tenant_id": iid, "alumni_id": alum["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        sids = list({r_["student_id"] for r_ in rows})
        smap = {s["id"]: s for s in await db.students.find(
            {"id": {"$in": sids}, "tenant_id": iid},
            {"_id": 0, "id": 1, "display_name": 1, "roll_number": 1}).to_list(200)}
        for row in rows:
            s = smap.get(row["student_id"], {})
            row["student_name"] = s.get("display_name") or s.get("roll_number")
        return rows

    @r.put("/mentorship/{mid}")
    async def update_mentorship(mid: str, body: MentorshipUpdate,
                                 user: dict = Depends(get_current_user)):
        if body.status not in MENTORSHIP_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(MENTORSHIP_STATUSES)}")
        db = get_db()
        iid = _tenant_of(user)
        m = await db.mentorship_requests.find_one(
            {"id": mid, "tenant_id": iid}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Request not found")
        alum = await _my_alumni(db, user, iid)
        if user["role"] not in ADMIN_ROLES and not (alum and alum["id"] == m["alumni_id"]):
            raise HTTPException(403, "Not allowed")
        await db.mentorship_requests.update_one(
            {"id": mid},
            {"$set": {"status": body.status, "responded_at": _now()}})
        return await db.mentorship_requests.find_one({"id": mid}, {"_id": 0})

    @r.get("/jobs")
    async def list_jobs(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        rows = await db.alumni_jobs.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}
        ).sort("posted_at", -1).to_list(200)
        aids = list({j["posted_by"] for j in rows if j.get("posted_by")})
        amap = {a["id"]: a for a in await db.alumni_profiles.find(
            {"id": {"$in": aids}, "tenant_id": iid}, {"_id": 0}).to_list(200)}
        for j in rows:
            a = amap.get(j.get("posted_by"), {})
            j["posted_by_name"] = a.get("name")
        return rows

    @r.post("/jobs")
    async def post_job(body: JobBody, user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        alum = await _my_alumni(db, user, iid)
        if not alum and user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Only alumni/admin can post jobs")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "posted_by": (alum or {}).get("id"),
            "title": body.title, "company_name": body.company_name,
            "location": body.location, "description": body.description,
            "skills_required": body.skills_required,
            "package_lpa": body.package_lpa,
            "application_url": body.application_url,
            "deadline": body.deadline, "is_active": True,
            "posted_at": _now(),
        }
        await db.alumni_jobs.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/events")
    async def list_events(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        return await db.alumni_events.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}
        ).sort("event_date", 1).to_list(200)

    @r.post("/events")
    async def create_event(body: EventBody, user: dict = Depends(get_current_user)):
        if body.event_type not in EVENT_TYPES:
            raise HTTPException(400, f"event_type must be one of {sorted(EVENT_TYPES)}")
        db = get_db()
        iid = _tenant_of(user)
        alum = await _my_alumni(db, user, iid)
        if not alum and user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Only alumni/admin can create events")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "title": body.title, "event_type": body.event_type,
            "description": body.description,
            "event_date": body.event_date, "event_time": body.event_time,
            "location_or_link": body.location_or_link,
            "organiser_id": (alum or {}).get("id"),
            "is_active": True, "created_at": _now(),
        }
        await db.alumni_events.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/stats")
    async def stats(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        total = await db.alumni_profiles.count_documents({"tenant_id": iid})
        verified = await db.alumni_profiles.count_documents(
            {"tenant_id": iid, "is_verified": True})
        mentors = await db.alumni_profiles.count_documents(
            {"tenant_id": iid, "is_mentor": True})
        jobs = await db.alumni_jobs.count_documents(
            {"tenant_id": iid, "is_active": True})
        batches = await db.alumni_profiles.distinct("batch_year", {"tenant_id": iid})
        return {
            "total_alumni": total, "verified_count": verified,
            "active_mentors": mentors, "jobs_posted": jobs,
            "batches_represented": len(batches),
        }

    @r.post("/outreach/generate")
    async def gen_outreach(body: OutreachBody,
                            user: dict = Depends(get_current_user)):
        if body.purpose not in OUTREACH_PURPOSES:
            raise HTTPException(400, f"purpose must be one of {sorted(OUTREACH_PURPOSES)}")
        db = get_db()
        iid = _tenant_of(user)
        alumni = await db.alumni_profiles.find_one(
            {"id": body.alumni_id, "tenant_id": iid}, {"_id": 0})
        if not alumni:
            raise HTTPException(404, "Alumni not found")
        st = await _student_of(db, user, iid)
        inst = await db.institutions.find_one({"id": iid}, {"_id": 0, "name": 1})
        tenant_name = (inst or {}).get("name") or "the Institution"
        student_name = (st or {}).get("display_name") or user.get("email", "a student")
        student_year = (st or {}).get("year_of_admission") or datetime.now(timezone.utc).year
        student_program = (st or {}).get("program_name") or "Engineering"
        prompt = (
            f"Write a warm, personalised message from {student_name} ({student_program}, "
            f"batch {student_year}) to {alumni.get('name')} "
            f"({alumni.get('current_company') or 'their company'}, "
            f"{alumni.get('current_role') or 'their role'}, "
            f"batch {alumni.get('batch_year')}) at {tenant_name}.\n"
            f"Purpose: {body.purpose}.\n"
            "Keep it under 100 words. Reference shared college connection. "
            "Be genuine, not generic. Output ONLY the message text."
        )
        try:
            content = await generate_text(
                system_message="You write warm, professional alumni outreach messages.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"outreach-{user['id']}-{body.alumni_id}", max_tokens=400,
            )
        except Exception as e:
            logger.warning("Outreach LLM failed: %s", e)
            content = (
                f"Hi {alumni.get('name', 'there').split()[0]},\n\n"
                f"I'm {student_name}, currently in {student_program} at {tenant_name} "
                f"(batch {student_year}). I noticed you're a fellow alum (batch "
                f"{alumni.get('batch_year')}). I'd really value 15 minutes of your time to "
                f"learn from your journey at {alumni.get('current_company', 'your firm')}. "
                f"Would you be open to a quick chat?\n\nBest,\n{student_name}"
            )
        return {"message": content.strip(),
                "alumni_name": alumni.get("name"),
                "purpose": body.purpose}

    return r
