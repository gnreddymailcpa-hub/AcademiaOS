"""
Claros Core — Campus ERP routes.

Provides the canonical campus-ERP surface area used by 7 downstream modules.
Endpoints live under /api/v1/core/* and operate on the following collections:

  departments, programs, academic_years, students, faculty_profiles,
  courses, timetable_slots, attendance_records, fee_components,
  fee_payments, notices

Auth: every endpoint is tenant-scoped via the caller's institution_id.
Cross-tenant access is denied except for super_admin.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_STATUSES = {"ACTIVE", "GRADUATED", "DROPPED", "SUSPENDED"}
ATTENDANCE_STATUSES = {"PRESENT", "ABSENT", "LATE", "EXCUSED"}
PAYMENT_STATUSES = {"PAID", "PENDING", "OVERDUE"}
NOTICE_CATEGORIES = {"ACADEMIC", "EXAM", "PLACEMENT", "GENERAL", "FEE", "HOSTEL"}

ROLE_FACULTY = {"super_admin", "institution_admin", "faculty", "instructor",
                "hod", "programme_manager", "registrar"}
ROLE_ADMIN = {"super_admin", "institution_admin", "registrar", "hod"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_iid(user: dict, requested_iid: Optional[str]) -> str:
    """Resolve the institution id to operate on. Non-super-admin users are
    locked to their own institution_id. Super admins must pass ?iid=… ."""
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


# ---------------------------------------------------------------------------
# Pydantic request bodies
# ---------------------------------------------------------------------------

class AttendanceRecord(BaseModel):
    student_id: str
    status: str  # PRESENT | ABSENT | LATE | EXCUSED


class MarkAttendanceBody(BaseModel):
    course_id: str
    class_date: str  # ISO yyyy-mm-dd
    records: List[AttendanceRecord]


class FeePaymentBody(BaseModel):
    student_id: str
    academic_year_id: Optional[str] = None
    component_id: Optional[str] = None
    amount_paid: float
    transaction_ref: str = ""
    payment_mode: str = "MOCK"


class NoticeBody(BaseModel):
    title: str
    body: str
    category: str = "GENERAL"
    target_roles: List[str] = Field(default_factory=lambda: ["STUDENT", "FACULTY"])
    expires_at: Optional[str] = None


class StudentUpdateBody(BaseModel):
    status: Optional[str] = None
    cgpa: Optional[float] = None
    current_semester: Optional[int] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None


# ---------------------------------------------------------------------------
# Router builder
# ---------------------------------------------------------------------------

def build_claros_core_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/v1/core", tags=["claros-core"])

    # -----------------------------------------------------------------------
    # Helpers (closure over get_db)
    # -----------------------------------------------------------------------
    async def _current_year_id(db, iid: str) -> Optional[str]:
        y = await db.academic_years.find_one(
            {"tenant_id": iid, "is_current": True}, {"_id": 0, "id": 1}
        )
        return y["id"] if y else None

    async def _student_of(db, iid: str, user_id: str) -> Optional[dict]:
        return await db.students.find_one(
            {"tenant_id": iid, "user_id": user_id}, {"_id": 0}
        )

    async def _faculty_of(db, iid: str, user_id: str) -> Optional[dict]:
        return await db.faculty_profiles.find_one(
            {"tenant_id": iid, "user_id": user_id}, {"_id": 0}
        )

    async def _compute_attendance_pct(db, iid: str, student_id: str,
                                     course_id: Optional[str] = None) -> dict:
        q = {"tenant_id": iid, "student_id": student_id}
        if course_id:
            q["course_id"] = course_id
        total = await db.attendance_records.count_documents(q)
        present = await db.attendance_records.count_documents(
            {**q, "status": {"$in": ["PRESENT", "LATE"]}}
        )
        absent = await db.attendance_records.count_documents(
            {**q, "status": "ABSENT"}
        )
        pct = round((present / total) * 100, 1) if total else 0.0
        return {"total": total, "present": present, "absent": absent, "pct": pct}

    async def _fee_summary(db, iid: str, student_id: str) -> dict:
        student = await db.students.find_one(
            {"id": student_id, "tenant_id": iid}, {"_id": 0}
        )
        if not student:
            return {"total_due": 0.0, "total_paid": 0.0, "balance": 0.0, "status": "PAID"}
        year_id = await _current_year_id(db, iid)
        comps = await db.fee_components.find(
            {"tenant_id": iid, "program_id": student["program_id"],
             "academic_year_id": year_id}, {"_id": 0}
        ).to_list(50)
        total_due = sum(float(c.get("amount", 0)) for c in comps)
        pays = await db.fee_payments.find(
            {"tenant_id": iid, "student_id": student_id,
             "academic_year_id": year_id}, {"_id": 0}
        ).to_list(200)
        total_paid = sum(float(p.get("amount_paid", 0)) for p in pays)
        balance = total_due - total_paid
        status = "PAID" if balance <= 0 else ("OVERDUE" if balance > total_due * 0.5 else "PENDING")
        return {
            "total_due": round(total_due, 2),
            "total_paid": round(total_paid, 2),
            "balance": round(balance, 2),
            "status": status,
        }

    # -----------------------------------------------------------------------
    # STUDENTS
    # -----------------------------------------------------------------------
    @router.get("/students")
    async def list_students(
        iid: Optional[str] = None,
        department_id: Optional[str] = None,
        program_id: Optional[str] = None,
        status: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        iid = _coerce_iid(user, iid)
        # Students see only themselves
        if user["role"] == "student":
            s = await _student_of(db, iid, user["id"])
            return {"items": [s] if s else [], "total": 1 if s else 0}
        flt = {"tenant_id": iid}
        if department_id:
            flt["department_id"] = department_id
        if program_id:
            flt["program_id"] = program_id
        if status:
            flt["status"] = status
        if q:
            flt["$or"] = [
                {"roll_number": {"$regex": q, "$options": "i"}},
                {"display_name": {"$regex": q, "$options": "i"}},
            ]
        total = await db.students.count_documents(flt)
        rows = await db.students.find(flt, {"_id": 0}) \
            .sort("roll_number", 1) \
            .skip(max(0, (page - 1) * page_size)) \
            .limit(min(200, page_size)) \
            .to_list(min(200, page_size))
        # Enrich with attendance %
        for r in rows:
            att = await _compute_attendance_pct(db, iid, r["id"])
            r["attendance_pct"] = att["pct"]
        return {"items": rows, "total": total, "page": page, "page_size": page_size}

    @router.get("/students/me")
    async def my_student_profile(user: dict = Depends(get_current_user)):
        db = get_db()
        if user["role"] != "student":
            raise HTTPException(403, "Only students can call /students/me")
        iid = user["institution_id"]
        s = await _student_of(db, iid, user["id"])
        if not s:
            raise HTTPException(404, "Student profile not found")
        s["attendance"] = await _compute_attendance_pct(db, iid, s["id"])
        s["fees"] = await _fee_summary(db, iid, s["id"])
        return s

    @router.get("/students/{student_id}")
    async def get_student(student_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        s = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not s:
            raise HTTPException(404, "Student not found")
        iid = _coerce_iid(user, s["tenant_id"])
        if user["role"] == "student" and s.get("user_id") != user["id"]:
            raise HTTPException(403, "Cross-student denied")
        s["attendance"] = await _compute_attendance_pct(db, iid, s["id"])
        s["fees"] = await _fee_summary(db, iid, s["id"])
        return s

    @router.put("/students/{student_id}")
    async def update_student(student_id: str, body: StudentUpdateBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_ADMIN:
            raise HTTPException(403, "Admins only")
        db = get_db()
        s = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not s:
            raise HTTPException(404, "Student not found")
        _coerce_iid(user, s["tenant_id"])
        patch = {k: v for k, v in body.dict().items() if v is not None}
        if "status" in patch and patch["status"] not in ALLOWED_STATUSES:
            raise HTTPException(400, "Invalid status")
        patch["updated_at"] = _now()
        await db.students.update_one({"id": student_id}, {"$set": patch})
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": s["tenant_id"],
            "action": "core.student.update",
            "target": student_id,
            "actor": user["email"],
            "ts": _now(),
        })
        return {"ok": True, **patch}

    # -----------------------------------------------------------------------
    # ATTENDANCE
    # -----------------------------------------------------------------------
    @router.post("/attendance/mark")
    async def mark_attendance(body: MarkAttendanceBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_FACULTY:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        course = await db.courses.find_one({"id": body.course_id}, {"_id": 0})
        if not course:
            raise HTTPException(404, "Course not found")
        iid = _coerce_iid(user, course["tenant_id"])
        faculty = await _faculty_of(db, iid, user["id"])
        marked_by = faculty["id"] if faculty else user["id"]
        created = 0
        updated = 0
        for r in body.records:
            if r.status not in ATTENDANCE_STATUSES:
                raise HTTPException(400, f"Invalid status {r.status}")
            existing = await db.attendance_records.find_one({
                "tenant_id": iid,
                "course_id": body.course_id,
                "student_id": r.student_id,
                "class_date": body.class_date,
            })
            if existing:
                await db.attendance_records.update_one(
                    {"id": existing["id"]},
                    {"$set": {"status": r.status, "marked_by": marked_by,
                              "marked_at": _now()}},
                )
                updated += 1
            else:
                await db.attendance_records.insert_one({
                    "id": str(uuid.uuid4()),
                    "tenant_id": iid,
                    "student_id": r.student_id,
                    "course_id": body.course_id,
                    "class_date": body.class_date,
                    "status": r.status,
                    "marked_by": marked_by,
                    "marked_at": _now(),
                })
                created += 1
        return {"ok": True, "created": created, "updated": updated}

    @router.get("/attendance/report")
    async def attendance_report(
        student_id: Optional[str] = None,
        course_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        iid: Optional[str] = None,
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        # Students can only see their own report
        if user["role"] == "student":
            s = await _student_of(db, user["institution_id"], user["id"])
            if not s:
                raise HTTPException(404, "Student profile missing")
            student_id = s["id"]
            iid = user["institution_id"]
        else:
            iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid}
        if student_id:
            flt["student_id"] = student_id
        if course_id:
            flt["course_id"] = course_id
        if date_from or date_to:
            df = {}
            if date_from:
                df["$gte"] = date_from
            if date_to:
                df["$lte"] = date_to
            flt["class_date"] = df
        rows = await db.attendance_records.find(flt, {"_id": 0}).to_list(5000)
        # Aggregate by (student_id, course_id)
        agg = {}
        for r in rows:
            key = (r["student_id"], r["course_id"])
            d = agg.setdefault(key, {"student_id": r["student_id"],
                                    "course_id": r["course_id"],
                                    "present": 0, "absent": 0, "late": 0, "excused": 0,
                                    "total": 0})
            d["total"] += 1
            if r["status"] == "PRESENT":
                d["present"] += 1
            elif r["status"] == "ABSENT":
                d["absent"] += 1
            elif r["status"] == "LATE":
                d["late"] += 1
            elif r["status"] == "EXCUSED":
                d["excused"] += 1
        # Compute pct + enrich with course name
        out = []
        course_cache = {}
        for d in agg.values():
            cid = d["course_id"]
            if cid not in course_cache:
                c = await db.courses.find_one({"id": cid}, {"_id": 0,
                                                              "code": 1, "name": 1})
                course_cache[cid] = c or {}
            d["course_code"] = course_cache[cid].get("code", "")
            d["course_name"] = course_cache[cid].get("name", "")
            counted = d["present"] + d["late"]
            d["pct"] = round((counted / d["total"]) * 100, 1) if d["total"] else 0.0
            out.append(d)
        return {"items": out, "row_count": len(rows)}

    @router.get("/attendance/summary/me")
    async def my_attendance_summary(user: dict = Depends(get_current_user)):
        db = get_db()
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        iid = user["institution_id"]
        s = await _student_of(db, iid, user["id"])
        if not s:
            raise HTTPException(404, "Student profile missing")
        # Pull all courses for the student's program + current semester
        year_id = await _current_year_id(db, iid)
        courses = await db.courses.find({
            "tenant_id": iid, "program_id": s["program_id"],
            "semester": s.get("current_semester", 1),
            "academic_year_id": year_id,
        }, {"_id": 0}).to_list(50)
        out = []
        for c in courses:
            att = await _compute_attendance_pct(db, iid, s["id"], c["id"])
            out.append({**att, "course_id": c["id"],
                        "course_code": c.get("code"), "course_name": c.get("name")})
        overall = await _compute_attendance_pct(db, iid, s["id"])
        return {"per_course": out, "overall": overall}

    # -----------------------------------------------------------------------
    # TIMETABLE
    # -----------------------------------------------------------------------
    @router.get("/timetable/me")
    async def my_timetable(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = user["institution_id"]
        year_id = await _current_year_id(db, iid)
        if user["role"] == "student":
            s = await _student_of(db, iid, user["id"])
            if not s:
                return {"slots": []}
            courses = await db.courses.find({
                "tenant_id": iid, "program_id": s["program_id"],
                "semester": s.get("current_semester", 1),
                "academic_year_id": year_id,
            }, {"_id": 0}).to_list(50)
        else:
            faculty = await _faculty_of(db, iid, user["id"])
            if not faculty:
                return {"slots": []}
            courses = await db.courses.find({
                "tenant_id": iid, "faculty_id": faculty["id"],
                "academic_year_id": year_id,
            }, {"_id": 0}).to_list(50)
        course_ids = [c["id"] for c in courses]
        course_map = {c["id"]: c for c in courses}
        slots = await db.timetable_slots.find({
            "tenant_id": iid, "academic_year_id": year_id,
            "course_id": {"$in": course_ids},
        }, {"_id": 0}).sort([("day_of_week", 1), ("start_time", 1)]).to_list(200)
        for s in slots:
            c = course_map.get(s["course_id"], {})
            s["course_code"] = c.get("code", "")
            s["course_name"] = c.get("name", "")
        return {"slots": slots}

    # -----------------------------------------------------------------------
    # FEES
    # -----------------------------------------------------------------------
    @router.get("/fees/me")
    async def my_fees(user: dict = Depends(get_current_user)):
        db = get_db()
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        iid = user["institution_id"]
        s = await _student_of(db, iid, user["id"])
        if not s:
            raise HTTPException(404, "Student profile missing")
        return await _fee_detail(db, iid, s["id"])

    async def _fee_detail(db, iid: str, student_id: str) -> dict:
        student = await db.students.find_one({"id": student_id, "tenant_id": iid},
                                             {"_id": 0})
        if not student:
            raise HTTPException(404, "Student not found")
        year_id = await _current_year_id(db, iid)
        comps = await db.fee_components.find({
            "tenant_id": iid, "program_id": student["program_id"],
            "academic_year_id": year_id,
        }, {"_id": 0}).to_list(50)
        pays = await db.fee_payments.find({
            "tenant_id": iid, "student_id": student_id,
            "academic_year_id": year_id,
        }, {"_id": 0}).sort("payment_date", -1).to_list(200)
        # Map payments by component
        paid_by_comp = {}
        for p in pays:
            cid = p.get("component_id") or "_other"
            paid_by_comp[cid] = paid_by_comp.get(cid, 0.0) + float(p.get("amount_paid", 0))
        items = []
        for c in comps:
            amt = float(c.get("amount", 0))
            paid = paid_by_comp.get(c["id"], 0.0)
            balance = amt - paid
            status = "PAID" if balance <= 0 else "PENDING"
            items.append({
                "component_id": c["id"],
                "component_name": c.get("component_name"),
                "amount": amt,
                "paid": round(paid, 2),
                "balance": round(balance, 2),
                "status": status,
            })
        summary = await _fee_summary(db, iid, student_id)
        return {
            "student_id": student_id,
            "roll_number": student.get("roll_number"),
            "components": items,
            "payments": pays,
            "summary": summary,
        }

    @router.get("/fees/student/{student_id}")
    async def student_fees(student_id: str, user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_FACULTY:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        s = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not s:
            raise HTTPException(404, "Student not found")
        _coerce_iid(user, s["tenant_id"])
        return await _fee_detail(db, s["tenant_id"], student_id)

    @router.post("/fees/payment")
    async def record_payment(body: FeePaymentBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_ADMIN:
            raise HTTPException(403, "Admins only")
        db = get_db()
        s = await db.students.find_one({"id": body.student_id}, {"_id": 0})
        if not s:
            raise HTTPException(404, "Student not found")
        iid = _coerce_iid(user, s["tenant_id"])
        year_id = body.academic_year_id or await _current_year_id(db, iid)
        doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": iid,
            "student_id": body.student_id,
            "academic_year_id": year_id,
            "component_id": body.component_id,
            "amount_paid": float(body.amount_paid),
            "payment_date": _now().split("T")[0],
            "transaction_ref": body.transaction_ref or f"MOCK-{uuid.uuid4().hex[:8].upper()}",
            "payment_mode": body.payment_mode,
            "status": "PAID",
            "recorded_by": user["id"],
            "created_at": _now(),
        }
        await db.fee_payments.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/fees/report")
    async def fees_report(iid: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_FACULTY:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _coerce_iid(user, iid)
        year_id = await _current_year_id(db, iid)
        comps = await db.fee_components.find({
            "tenant_id": iid, "academic_year_id": year_id,
        }, {"_id": 0}).to_list(200)
        students = await db.students.find({
            "tenant_id": iid, "status": "ACTIVE",
        }, {"_id": 0}).to_list(2000)
        # Compute expected per program
        comp_by_program = {}
        for c in comps:
            comp_by_program.setdefault(c["program_id"], 0.0)
            comp_by_program[c["program_id"]] += float(c.get("amount", 0))
        total_expected = sum(comp_by_program.get(s["program_id"], 0.0) for s in students)
        pays = await db.fee_payments.find({
            "tenant_id": iid, "academic_year_id": year_id,
        }, {"_id": 0}).to_list(5000)
        total_collected = sum(float(p.get("amount_paid", 0)) for p in pays)
        defaulters = 0
        paid_by_student = {}
        for p in pays:
            paid_by_student[p["student_id"]] = paid_by_student.get(
                p["student_id"], 0.0) + float(p.get("amount_paid", 0))
        for s in students:
            expected = comp_by_program.get(s["program_id"], 0.0)
            paid = paid_by_student.get(s["id"], 0.0)
            if paid < expected * 0.5:
                defaulters += 1
        pct = round((total_collected / total_expected) * 100, 1) if total_expected else 0.0
        return {
            "total_expected": round(total_expected, 2),
            "total_collected": round(total_collected, 2),
            "collection_pct": pct,
            "defaulters": defaulters,
            "active_students": len(students),
        }

    # -----------------------------------------------------------------------
    # NOTICES
    # -----------------------------------------------------------------------
    @router.get("/notices")
    async def list_notices(category: Optional[str] = None,
                            iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid, "is_active": True}
        if category and category != "ALL":
            flt["category"] = category
        rows = await db.notices.find(flt, {"_id": 0}).sort(
            "published_at", -1).limit(100).to_list(100)
        # Role filter — admins/HOD/registrar see everything; students see STUDENT-targeted; faculty see FACULTY-targeted
        if user["role"] in ROLE_ADMIN:
            return {"items": rows}
        if user["role"] == "student":
            role_label = "STUDENT"
        elif user["role"] in ("faculty", "instructor", "hod"):
            role_label = "FACULTY"
        else:
            role_label = user["role"].upper()
        filtered = [r for r in rows if not r.get("target_roles") or
                    role_label in r["target_roles"] or "ALL" in r["target_roles"]]
        return {"items": filtered}

    @router.post("/notices")
    async def create_notice(body: NoticeBody,
                            user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_FACULTY:
            raise HTTPException(403, "Faculty/Admin only")
        if body.category not in NOTICE_CATEGORIES:
            raise HTTPException(400, f"Invalid category. Allowed: {NOTICE_CATEGORIES}")
        db = get_db()
        iid = user["institution_id"]
        doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": iid,
            "title": body.title,
            "body": body.body,
            "category": body.category,
            "target_roles": body.target_roles,
            "published_by": user["id"],
            "published_by_email": user["email"],
            "published_at": _now(),
            "expires_at": body.expires_at,
            "is_active": True,
        }
        await db.notices.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.delete("/notices/{notice_id}")
    async def delete_notice(notice_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        n = await db.notices.find_one({"id": notice_id}, {"_id": 0})
        if not n:
            raise HTTPException(404, "Notice not found")
        if user["role"] not in ROLE_ADMIN and n.get("published_by") != user["id"]:
            raise HTTPException(403, "Only the publisher or an admin can delete")
        await db.notices.delete_one({"id": notice_id})
        return {"ok": True}

    # -----------------------------------------------------------------------
    # ADMIN STATS
    # -----------------------------------------------------------------------
    @router.get("/stats")
    async def core_stats(iid: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        year = await db.academic_years.find_one(
            {"tenant_id": iid, "is_current": True}, {"_id": 0})
        total_students = await db.students.count_documents(
            {"tenant_id": iid, "status": "ACTIVE"})
        total_faculty = await db.faculty_profiles.count_documents(
            {"tenant_id": iid, "is_active": True})
        depts = await db.departments.count_documents({"tenant_id": iid})
        # Average attendance
        all_recs = await db.attendance_records.aggregate([
            {"$match": {"tenant_id": iid}},
            {"$group": {"_id": None,
                        "total": {"$sum": 1},
                        "present": {"$sum": {"$cond": [
                            {"$in": ["$status", ["PRESENT", "LATE"]]}, 1, 0]}}}},
        ]).to_list(1)
        avg_att = 0.0
        if all_recs and all_recs[0].get("total"):
            avg_att = round(
                (all_recs[0]["present"] / all_recs[0]["total"]) * 100, 1)
        # Fee collection
        fee = await fees_report(iid=iid, user=user) if user["role"] in ROLE_FACULTY else None
        return {
            "total_students": total_students,
            "total_faculty": total_faculty,
            "avg_attendance_pct": avg_att,
            "fee_collection_pct": fee["collection_pct"] if fee else None,
            "departments_count": depts,
            "current_year": year.get("label") if year else None,
        }

    # -----------------------------------------------------------------------
    # READ-ONLY LOOKUPS (used by frontend dropdowns)
    # -----------------------------------------------------------------------
    @router.get("/departments")
    async def list_departments(iid: Optional[str] = None,
                                user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        rows = await db.departments.find({"tenant_id": iid}, {"_id": 0}).to_list(100)
        return rows

    @router.get("/programs")
    async def list_programs(iid: Optional[str] = None,
                             department_id: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid, "is_active": True}
        if department_id:
            flt["department_id"] = department_id
        rows = await db.programs.find(flt, {"_id": 0}).to_list(100)
        return rows

    @router.get("/courses")
    async def list_courses(iid: Optional[str] = None,
                            program_id: Optional[str] = None,
                            semester: Optional[int] = None,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        year_id = await _current_year_id(db, iid)
        flt = {"tenant_id": iid, "academic_year_id": year_id}
        if program_id:
            flt["program_id"] = program_id
        if semester:
            flt["semester"] = semester
        # Faculty: show courses they teach
        if user["role"] in ("faculty", "instructor", "hod") and user["role"] != "super_admin":
            faculty = await _faculty_of(db, iid, user["id"])
            if faculty:
                flt["faculty_id"] = faculty["id"]
        rows = await db.courses.find(flt, {"_id": 0}).sort("code", 1).to_list(200)
        return rows

    @router.get("/courses/{course_id}/roster")
    async def course_roster(course_id: str, user: dict = Depends(get_current_user)):
        if user["role"] not in ROLE_FACULTY:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        c = await db.courses.find_one({"id": course_id}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Course not found")
        _coerce_iid(user, c["tenant_id"])
        # Students = same program + matching semester + ACTIVE
        students = await db.students.find({
            "tenant_id": c["tenant_id"],
            "program_id": c["program_id"],
            "current_semester": c.get("semester"),
            "status": "ACTIVE",
        }, {"_id": 0}).sort("roll_number", 1).to_list(500)
        return {"course": c, "students": students}

    return router
