"""Claros Launch — Career & Placement Intelligence routes (/api/v1/launch/*)."""
from datetime import datetime, timezone, date
from typing import List, Optional
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.launch")

ADMIN_ROLES = {"super_admin", "institution_admin", "registrar", "career_services", "programme_manager"}
WRITE_ROLES = ADMIN_ROLES | {"faculty", "instructor", "hod"}
APP_STATUSES = {"APPLIED", "SHORTLISTED", "TEST_CLEARED", "INTERVIEW_CLEARED", "SELECTED", "REJECTED", "WITHDRAWN"}
SKILL_CATEGORIES = {"TECHNICAL", "PROGRAMMING", "TOOL", "SOFT", "DOMAIN", "LANGUAGE"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_iid(user: dict, requested_iid: Optional[str]) -> str:
    if user["role"] == "super_admin":
        if not requested_iid:
            raise HTTPException(400, "super_admin must specify iid query param")
        return requested_iid
    own = user.get("institution_id")
    if not own:
        raise HTTPException(403, "User has no institution_id")
    if requested_iid and requested_iid != own:
        raise HTTPException(403, "Cross-tenant access denied")
    return own


class SkillBody(BaseModel):
    skill_name: str
    category: str = "TECHNICAL"
    proficiency_level: int = Field(ge=1, le=5)


class QuestionGenBody(BaseModel):
    company_id: Optional[str] = None
    target_role: str
    question_type: str = "TECHNICAL"  # TECHNICAL | HR | APTITUDE


class EvaluateBody(BaseModel):
    question: str
    answer: str
    role: str
    company_name: str = ""
    company_id: Optional[str] = None


def build_claros_launch_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/v1/launch", tags=["claros-launch"])

    async def _my_student(db, user) -> Optional[dict]:
        if user["role"] != "student":
            return None
        return await db.students.find_one({"tenant_id": user["institution_id"], "user_id": user["id"]}, {"_id": 0})

    # ---------------- ADMIN WRITE FLOWS ----------------
    ADMIN_ROLES = {"super_admin", "institution_admin", "placement_officer"}

    class _CompanyBody(BaseModel):
        name: str
        industry: str = ""
        website: str = ""
        avg_package: float = 0.0
        max_package: float = 0.0
        typical_roles: List[str] = []
        skills_required: List[str] = []
        interview_types: List[str] = []
        is_active: bool = True

    class _DriveBody(BaseModel):
        company_id: str
        drive_date: str
        status: str = "UPCOMING"  # UPCOMING | OPEN | CLOSED | CANCELLED
        eligible_programs: List[str] = []
        min_cgpa: float = 0.0
        package_offered: float = 0.0
        roles: List[str] = []
        notes: str = ""

    @router.post("/companies")
    async def create_company(body: _CompanyBody,
                              iid: Optional[str] = None,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Placement admin only")
        db = get_db()
        iid = _coerce_iid(user, iid)
        if not body.name.strip():
            raise HTTPException(400, "name required")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "name": body.name.strip(),
            "industry": body.industry, "website": body.website,
            "avg_package": float(body.avg_package or 0),
            "max_package": float(body.max_package or 0),
            "typical_roles": body.typical_roles,
            "skills_required": body.skills_required,
            "interview_types": body.interview_types,
            "is_active": bool(body.is_active),
            "created_by": user["id"], "created_at": _now(),
        }
        await db.companies.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.post("/drives")
    async def create_drive(body: _DriveBody,
                            iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Placement admin only")
        db = get_db()
        iid = _coerce_iid(user, iid)
        company = await db.companies.find_one(
            {"id": body.company_id, "tenant_id": iid}, {"_id": 0})
        if not company:
            raise HTTPException(404, "Company not found")
        if body.status not in {"UPCOMING", "OPEN", "CLOSED", "CANCELLED"}:
            raise HTTPException(400, "Invalid status")
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "company_id": body.company_id,
            "company_name": company.get("name"),
            "drive_date": body.drive_date,
            "status": body.status,
            "eligible_programs": body.eligible_programs,
            "min_cgpa": float(body.min_cgpa or 0),
            "package_offered": float(body.package_offered or 0),
            "roles": body.roles, "notes": body.notes,
            "created_by": user["id"], "created_at": _now(),
        }
        await db.placement_drives.insert_one(doc)
        doc.pop("_id", None)
        return doc

    # ---------------- COMPANIES ----------------
    @router.get("/companies")
    async def list_companies(iid: Optional[str] = None, user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        rows = await db.companies.find({"tenant_id": iid, "is_active": True}, {"_id": 0}).sort("name", 1).to_list(200)
        return {"items": rows}

    @router.get("/companies/{cid}")
    async def get_company(cid: str, user: dict = Depends(get_current_user)):
        db = get_db()
        c = await db.companies.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Company not found")
        _coerce_iid(user, c["tenant_id"])
        drives = await db.placement_drives.find({"company_id": cid}, {"_id": 0}).sort("drive_date", -1).limit(20).to_list(20)
        return {"company": c, "drives": drives}

    # ---------------- DRIVES ----------------
    @router.get("/drives")
    async def list_drives(status: Optional[str] = None, eligible_for_me: bool = False,
                           iid: Optional[str] = None, user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid}
        if status and status != "ALL":
            flt["status"] = status
        rows = await db.placement_drives.find(flt, {"_id": 0}).sort("drive_date", -1).to_list(200)
        # Enrich with company name
        cids = list({r["company_id"] for r in rows})
        companies = await db.companies.find({"id": {"$in": cids}}, {"_id": 0, "id": 1, "name": 1, "industry": 1}).to_list(200)
        c_map = {c["id"]: c for c in companies}
        for r in rows:
            cc = c_map.get(r["company_id"], {})
            r["company_name"] = cc.get("name")
            r["industry"] = cc.get("industry")
        if eligible_for_me and user["role"] == "student":
            s = await _my_student(db, user)
            if s:
                prog = await db.programs.find_one({"id": s["program_id"]}, {"_id": 0, "code": 1})
                rows = [r for r in rows if (
                    (not r.get("eligible_programs")) or prog["code"] in r.get("eligible_programs", [])
                ) and float(s.get("cgpa", 0)) >= float(r.get("min_cgpa", 0))]
        return {"items": rows}

    @router.get("/drives/{drive_id}/eligible")
    async def check_eligibility(drive_id: str, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        drive = await db.placement_drives.find_one({"id": drive_id}, {"_id": 0})
        if not drive:
            raise HTTPException(404, "Drive not found")
        s = await _my_student(db, user)
        if not s:
            return {"eligible": False, "reasons": ["No student profile linked"]}
        reasons = []
        if float(s.get("cgpa", 0)) < float(drive.get("min_cgpa", 0)):
            reasons.append(f"CGPA {s.get('cgpa')} below minimum {drive.get('min_cgpa')}")
        prog = await db.programs.find_one({"id": s["program_id"]}, {"_id": 0, "code": 1})
        eligible_progs = drive.get("eligible_programs") or []
        if eligible_progs and prog and prog["code"] not in eligible_progs:
            reasons.append(f"Program {prog['code']} not in eligible list")
        return {"eligible": len(reasons) == 0, "reasons": reasons}

    @router.post("/drives/{drive_id}/apply")
    async def apply_to_drive(drive_id: str, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        drive = await db.placement_drives.find_one({"id": drive_id}, {"_id": 0})
        if not drive:
            raise HTTPException(404, "Drive not found")
        s = await _my_student(db, user)
        if not s:
            raise HTTPException(404, "Student profile missing")
        existing = await db.drive_applications.find_one(
            {"drive_id": drive_id, "student_id": s["id"]}, {"_id": 0})
        if existing:
            return existing
        app_id = str(uuid.uuid4())
        doc = {
            "id": app_id, "tenant_id": drive["tenant_id"],
            "drive_id": drive_id, "student_id": s["id"],
            "status": "APPLIED",
            "applied_at": _now(), "updated_at": _now(),
        }
        await db.drive_applications.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/applications/me")
    async def my_applications(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            return {"items": []}
        apps = await db.drive_applications.find({"student_id": s["id"]}, {"_id": 0}).sort("applied_at", -1).to_list(100)
        # enrich
        dids = list({a["drive_id"] for a in apps})
        drives = await db.placement_drives.find({"id": {"$in": dids}}, {"_id": 0}).to_list(100)
        d_map = {d["id"]: d for d in drives}
        cids = list({d["company_id"] for d in drives})
        companies = await db.companies.find({"id": {"$in": cids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        c_map = {c["id"]: c for c in companies}
        for a in apps:
            d = d_map.get(a["drive_id"], {})
            a["drive"] = d
            a["company_name"] = c_map.get(d.get("company_id", ""), {}).get("name")
        return {"items": apps}

    # ---------------- SKILLS ----------------
    @router.get("/skills/me")
    async def my_skills(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            return {"items": []}
        rows = await db.student_skills.find({"student_id": s["id"]}, {"_id": 0}).to_list(200)
        return {"items": rows}

    @router.post("/skills")
    async def upsert_skill(body: SkillBody, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            raise HTTPException(404, "Student profile missing")
        key = {"tenant_id": s["tenant_id"], "student_id": s["id"], "skill_name": body.skill_name.strip()}
        existing = await db.student_skills.find_one(key, {"_id": 0})
        if existing:
            await db.student_skills.update_one(key, {"$set": {
                "category": body.category, "proficiency_level": body.proficiency_level}})
            return {"ok": True, "updated": True}
        doc = {
            "id": str(uuid.uuid4()), **key,
            "category": body.category, "proficiency_level": body.proficiency_level,
            "assessed_by": "SELF", "created_at": _now(),
        }
        await db.student_skills.insert_one(doc)
        return {"ok": True, "created": True, "id": doc["id"]}

    @router.delete("/skills/{skill_id}")
    async def delete_skill(skill_id: str, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        sk = await db.student_skills.find_one({"id": skill_id}, {"_id": 0})
        if not sk:
            raise HTTPException(404, "Skill not found")
        s = await _my_student(db, user)
        if not s or sk["student_id"] != s["id"]:
            raise HTTPException(403, "Cross-student denied")
        await db.student_skills.delete_one({"id": skill_id})
        return {"ok": True}

    @router.get("/skills/gaps")
    async def skill_gaps(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            return {"items": []}
        my_skills = await db.student_skills.find({"student_id": s["id"]}, {"_id": 0}).to_list(50)
        prog = await db.programs.find_one({"id": s["program_id"]}, {"_id": 0, "name": 1})
        companies = await db.companies.find({"tenant_id": s["tenant_id"], "is_active": True}, {"_id": 0, "name": 1, "skills_required": 1}).limit(5).to_list(5)
        company_skills = list({sk for c in companies for sk in (c.get("skills_required") or [])})[:25]
        skills_str = ", ".join(f"{sk['skill_name']} (L{sk['proficiency_level']})" for sk in my_skills) or "none recorded"
        prompt = (
            f"A {prog.get('name','engineering') if prog else 'student'} has these skills: {skills_str}.\n"
            f"Top hiring companies need: {', '.join(company_skills) if company_skills else 'general tech skills'}.\n"
            "Return ONLY valid JSON array (no markdown fences) with up to 5 objects:\n"
            "[{\"skill\": str, \"urgency\": \"HIGH\"|\"MEDIUM\"|\"LOW\", \"gap_description\": str, \"learn_in_weeks\": int, \"resources\": [str]}]"
        )
        try:
            text = await generate_text(
                system_message="You are a career coach. Return strictly JSON.",
                user_text=prompt, provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"gaps-{s['id']}", max_tokens=900,
            )
            # extract JSON
            t = text.strip()
            if t.startswith("```"):
                t = t.split("```", 2)[1]
                if t.startswith("json"):
                    t = t[4:]
            start = t.find("[")
            end = t.rfind("]")
            if start >= 0 and end > start:
                gaps = json.loads(t[start:end + 1])
            else:
                gaps = []
        except Exception as e:
            logger.warning("Skill-gap LLM failed: %s", e)
            # Deterministic fallback
            have = {sk["skill_name"].lower() for sk in my_skills}
            gaps = []
            for cs in company_skills:
                if cs.lower() not in have and len(gaps) < 5:
                    gaps.append({
                        "skill": cs, "urgency": "HIGH" if len(gaps) < 2 else "MEDIUM",
                        "gap_description": f"Top recruiters expect proficiency in {cs}",
                        "learn_in_weeks": 6, "resources": ["YouTube tutorials", "Coursera"],
                    })
        return {"items": gaps[:5], "company_skills_sampled": company_skills}

    # ---------------- MOCK INTERVIEW ----------------
    @router.post("/interview/question")
    async def gen_question(body: QuestionGenBody, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        industry = "tech"
        if body.company_id:
            c = await db.companies.find_one({"id": body.company_id}, {"_id": 0, "industry": 1})
            if c:
                industry = c.get("industry", "tech")
        prompt = (
            f"Generate exactly 1 {body.question_type} interview question for a {body.target_role} "
            f"position at a {industry} company. Medium difficulty. Return just the question text, "
            f"no preamble, no quotes."
        )
        try:
            q = (await generate_text(
                system_message="You generate concise interview questions.",
                user_text=prompt, provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"qgen-{user['id']}", max_tokens=200,
            )).strip()
        except Exception:
            qbank = {
                "TECHNICAL": f"Explain how you would design a scalable {body.target_role} system handling 1M req/day.",
                "HR": "Tell me about a time you led a team through a challenging deadline.",
                "APTITUDE": "If a train travels 60 km in 45 minutes, what is its average speed?",
            }
            q = qbank.get(body.question_type.upper(), qbank["TECHNICAL"])
        return {"question": q, "question_type": body.question_type, "target_role": body.target_role}

    @router.post("/interview/evaluate")
    async def evaluate_answer(body: EvaluateBody, user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            raise HTTPException(404, "Student profile missing")
        prompt = (
            f"Evaluate this interview answer for {body.role} at {body.company_name or 'a top tech company'}.\n"
            f"Question: {body.question}\nAnswer: {body.answer}\n\n"
            "Return ONLY valid JSON (no markdown fences):\n"
            "{\"score\": int 1-10, \"strengths\": [str], \"improvements\": [str], \"model_answer_hint\": str}"
        )
        try:
            text = await generate_text(
                system_message="You are a senior interview coach. Return strict JSON.",
                user_text=prompt, provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"eval-{s['id']}", max_tokens=900,
            )
            t = text.strip()
            if t.startswith("```"):
                t = t.split("```", 2)[1]
                if t.startswith("json"):
                    t = t[4:]
            start = t.find("{")
            end = t.rfind("}")
            ev = json.loads(t[start:end + 1]) if start >= 0 else {}
        except Exception as e:
            logger.warning("Evaluation LLM failed: %s", e)
            length = len(body.answer.strip())
            ev = {
                "score": min(10, max(3, length // 40)),
                "strengths": ["Attempted the question", "Clear communication"],
                "improvements": ["Add specific examples", "Quantify impact", "Structure with STAR method"],
                "model_answer_hint": "A strong answer addresses problem, approach, decisions, and outcomes with quantified metrics.",
            }
        # persist
        rec = {
            "id": str(uuid.uuid4()),
            "tenant_id": s["tenant_id"], "student_id": s["id"],
            "company_id": body.company_id, "target_role": body.role,
            "question_text": body.question, "answer_text": body.answer,
            "ai_score": int(ev.get("score", 5)),
            "ai_feedback": ev.get("model_answer_hint", ""),
            "ai_strengths": ev.get("strengths", []),
            "ai_improvements": ev.get("improvements", []),
            "created_at": _now(),
        }
        await db.mock_interviews.insert_one(rec)
        rec.pop("_id", None)
        return rec

    @router.get("/interview/history")
    async def interview_history(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            return {"items": []}
        rows = await db.mock_interviews.find({"student_id": s["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        return {"items": rows}

    # ---------------- READINESS ----------------
    @router.get("/readiness-score")
    async def readiness(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        s = await _my_student(db, user)
        if not s:
            return {"score": 0}
        cgpa = float(s.get("cgpa", 0))
        cgpa_score = min(30, (cgpa / 10) * 30)
        sk_count = await db.student_skills.count_documents({"student_id": s["id"]})
        skills_score = min(25, sk_count * 2.5)
        ints = await db.mock_interviews.find({"student_id": s["id"]}, {"_id": 0, "ai_score": 1}).to_list(50)
        avg_int = (sum(i["ai_score"] for i in ints) / len(ints)) if ints else 0
        mock_score = (avg_int / 10) * 25
        apps_count = await db.drive_applications.count_documents({"student_id": s["id"]})
        apps_score = min(20, apps_count * 4)
        total = round(cgpa_score + skills_score + mock_score + apps_score, 1)
        return {
            "score": total,
            "breakdown": {
                "cgpa": round(cgpa_score, 1), "skills": round(skills_score, 1),
                "mock_interview": round(mock_score, 1), "applications": round(apps_score, 1),
            },
            "metrics": {
                "cgpa": cgpa, "skill_count": sk_count,
                "interview_avg": round(avg_int, 1), "applications": apps_count,
            },
        }

    # ---------------- ADMIN STATS ----------------
    @router.get("/stats")
    async def admin_stats(iid: Optional[str] = None, user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES | {"faculty", "instructor", "hod"}:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        iid = _coerce_iid(user, iid)
        placed_count = await db.placements.count_documents({"tenant_id": iid})
        students_active = await db.students.count_documents({"tenant_id": iid, "status": "ACTIVE"})
        placement_pct = round((placed_count / students_active * 100), 1) if students_active else 0.0
        pls = await db.placements.find({"tenant_id": iid}, {"_id": 0}).to_list(2000)
        avg_pkg = round(sum(float(p.get("package_offered", 0)) for p in pls) / len(pls), 2) if pls else 0
        max_pkg = max((float(p.get("package_offered", 0)) for p in pls), default=0)
        by_company = {}
        for p in pls:
            n = p.get("company_name", "Unknown")
            by_company[n] = by_company.get(n, 0) + 1
        top_recruiters = sorted(by_company.items(), key=lambda x: -x[1])[:8]
        return {
            "placed_count": placed_count,
            "active_students": students_active,
            "placement_pct": placement_pct,
            "avg_package": avg_pkg, "max_package": max_pkg,
            "top_recruiters": [{"company": k, "count": v} for k, v in top_recruiters],
        }

    return router
