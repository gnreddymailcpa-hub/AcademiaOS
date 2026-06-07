"""
Claros Core — idempotent seed for all 4 demo tenants.

Seeds:
  - 3 departments per tenant (CSE, ECE, MBA)
  - 2 programs per dept (where applicable)
  - 1 current academic year (2025-26)
  - 20 students per tenant (roll numbers: {TENANT}{DEPT}001..020)
  - 8 faculty profiles per tenant
  - 5 courses per program (current semester)
  - Timetable slots (Mon-Fri, 5 slots/day) for current week
  - 4 fee components per program
  - 5 sample notices per tenant
  - ~30 days of attendance records per student per course
  - ~70% paid fee payments to make defaulter math meaningful

All IDs are derived deterministically from (tenant_id, code) so repeat runs
are no-ops.
"""
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict
import hashlib
import random
import uuid


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"

TENANTS = [
    {"id": VCE_ID, "short": "VCE", "roll_prefix": "22"},
    {"id": ISB_ID, "short": "ISB", "roll_prefix": "PGP24"},
    {"id": EAIC_ID, "short": "EAIC", "roll_prefix": "CDT26"},
    {"id": UOB_ID, "short": "UOB", "roll_prefix": "BR24"},
]

DEPARTMENTS = [
    {"code": "CSE", "name": "Computer Science & Engineering"},
    {"code": "ECE", "name": "Electronics & Communication"},
    {"code": "MBA", "name": "Management Studies"},
]

PROGRAMS_BY_DEPT = {
    "CSE": [
        {"code": "BTECH-CSE", "name": "B.Tech · Computer Science", "duration": 4},
        {"code": "MTECH-CSE", "name": "M.Tech · Computer Science", "duration": 2},
    ],
    "ECE": [
        {"code": "BTECH-ECE", "name": "B.Tech · Electronics", "duration": 4},
        {"code": "MTECH-ECE", "name": "M.Tech · VLSI Design", "duration": 2},
    ],
    "MBA": [
        {"code": "MBA-GEN", "name": "MBA · General Management", "duration": 2},
        {"code": "MBA-ANL", "name": "MBA · Business Analytics", "duration": 2},
    ],
}

CSE_COURSES = [
    ("CS501", "Advanced Algorithms"),
    ("CS502", "Distributed Systems"),
    ("CS503", "Machine Learning"),
    ("CS504", "Cloud Architecture"),
    ("CS505", "Software Engineering"),
]
ECE_COURSES = [
    ("EC501", "VLSI Design"),
    ("EC502", "Embedded Systems"),
    ("EC503", "Digital Signal Processing"),
    ("EC504", "Microprocessor Architecture"),
    ("EC505", "Communication Networks"),
]
MBA_COURSES = [
    ("MB501", "Strategic Management"),
    ("MB502", "Financial Analytics"),
    ("MB503", "Marketing Analytics"),
    ("MB504", "Operations Research"),
    ("MB505", "Leadership & Ethics"),
]
COURSES_BY_DEPT = {"CSE": CSE_COURSES, "ECE": ECE_COURSES, "MBA": MBA_COURSES}

FEE_COMPONENTS = [
    ("Tuition Fee", 80000),
    ("Lab & Library Fee", 15000),
    ("Examination Fee", 5000),
    ("Student Welfare Fee", 3000),
]

NOTICES = [
    {"title": "Mid-Sem Exams · Schedule Released",
     "category": "EXAM",
     "body": "Mid-semester examinations will commence Mar 18, 2026. The detailed timetable is now on the academic portal. Bring your ID card; reporting time is 15 minutes before the exam.",
     "target_roles": ["STUDENT", "FACULTY"]},
    {"title": "Placement Drive · Top Tier 1 Recruiters",
     "category": "PLACEMENT",
     "body": "Microsoft, Amazon, Adobe, and Goldman Sachs visit the campus on Feb 28. All final-year students must register on the placement portal by Feb 25.",
     "target_roles": ["STUDENT"]},
    {"title": "Faculty Development Programme · Cloud-Native AI",
     "category": "ACADEMIC",
     "body": "A 3-day FDP on Cloud-Native AI Architectures will be held Mar 10-12. Faculty members are encouraged to register. CRE credits applicable.",
     "target_roles": ["FACULTY"]},
    {"title": "Library — Extended Hours During Exam Week",
     "category": "GENERAL",
     "body": "The central library will remain open 24x7 from Mar 15 to Mar 30. Reservation required for the silent reading hall.",
     "target_roles": ["STUDENT", "FACULTY"]},
    {"title": "Tuition Fee · Final Reminder",
     "category": "FEE",
     "body": "Students with outstanding fees for the current semester must clear them before Mar 5. A late fee of ₹500/week applies thereafter.",
     "target_roles": ["STUDENT"]},
]


def _det_uuid(*parts: str) -> str:
    """Deterministic UUID5 from any number of string parts."""
    seed = ":".join(parts)
    h = hashlib.md5(seed.encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_claros_core(db, logger):
    """Idempotent seed across all 4 demo tenants."""
    # Resolve canonical user_ids for each tenant role we'll link to
    # (faculty role users + student user). Falls back to synthetic uuid.
    async def _user_id(email: str) -> str:
        u = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
        return u["id"] if u else _det_uuid("syn-user", email)

    # ----- Per-tenant seed -----
    for t in TENANTS:
        iid = t["id"]
        short = t["short"]

        # ---- Academic year (current) ----
        year_id = _det_uuid("year", iid, "2025-26")
        await db.academic_years.update_one(
            {"id": year_id},
            {"$set": {
                "id": year_id,
                "tenant_id": iid,
                "label": "2025-26",
                "start_date": "2025-08-01",
                "end_date": "2026-05-31",
                "is_current": True,
                "created_at": _iso(),
            }},
            upsert=True,
        )
        # Mark every other year non-current for this tenant
        await db.academic_years.update_many(
            {"tenant_id": iid, "id": {"$ne": year_id}},
            {"$set": {"is_current": False}},
        )

        # ---- Departments ----
        dept_ids: Dict[str, str] = {}
        for d in DEPARTMENTS:
            dept_id = _det_uuid("dept", iid, d["code"])
            dept_ids[d["code"]] = dept_id
            await db.departments.update_one(
                {"id": dept_id},
                {"$set": {
                    "id": dept_id, "tenant_id": iid,
                    "code": d["code"], "name": d["name"],
                    "hod_user_id": None,
                    "created_at": _iso(),
                }},
                upsert=True,
            )

        # ---- Programs ----
        program_ids: Dict[str, str] = {}  # code → program_id
        for dept_code, prog_list in PROGRAMS_BY_DEPT.items():
            for p in prog_list:
                pid = _det_uuid("prog", iid, p["code"])
                program_ids[p["code"]] = pid
                await db.programs.update_one(
                    {"id": pid},
                    {"$set": {
                        "id": pid, "tenant_id": iid,
                        "department_id": dept_ids[dept_code],
                        "name": p["name"], "code": p["code"],
                        "duration_years": p["duration"],
                        "is_active": True,
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )

        # ---- Faculty profiles (8 per tenant) ----
        # Link 1 to real faculty user when possible (VCE: prof.suresh)
        real_emails = {
            "VCE": "prof.suresh@vaagdevi.edu.in",
            "ISB": "shankar.dean@isb.edu",
            "EAIC": "khalid.exec@eaic.gov.ae",
            "UOB": "emma.admin@bradford.ac.uk",
        }
        faculty_ids: List[str] = []
        for i in range(8):
            fid = _det_uuid("faculty", iid, str(i))
            faculty_ids.append(fid)
            dept_code = ["CSE", "CSE", "CSE", "ECE", "ECE", "MBA", "MBA", "CSE"][i]
            email = real_emails[short] if i == 0 else f"faculty{i+1}.{short.lower()}@demo.claros"
            uid = await _user_id(email)
            await db.faculty_profiles.update_one(
                {"id": fid},
                {"$set": {
                    "id": fid, "tenant_id": iid,
                    "user_id": uid,
                    "department_id": dept_ids[dept_code],
                    "employee_code": f"{short}-F{i+1:03d}",
                    "designation": ["Professor", "Assoc. Professor", "Asst. Professor"][i % 3],
                    "qualification": "Ph.D" if i < 4 else "M.Tech",
                    "specialisation": ["AI/ML", "Distributed Systems", "Embedded",
                                       "VLSI", "Strategy", "Finance",
                                       "Operations", "Cybersecurity"][i],
                    "joining_date": f"20{15+i}-08-01",
                    "is_active": True,
                    "display_name": f"Dr. Faculty {short} {i+1}" if i == 0 else f"Prof. {short} F{i+1}",
                    "created_at": _iso(),
                }},
                upsert=True,
            )

        # ---- Courses (5 per dept's first program) ----
        course_ids_by_program: Dict[str, List[str]] = {}
        for dept_code, courses in COURSES_BY_DEPT.items():
            # Map to first program of that dept (under-graduate B.Tech/MBA)
            prog_code = PROGRAMS_BY_DEPT[dept_code][0]["code"]
            prog_id = program_ids[prog_code]
            course_ids_by_program.setdefault(prog_id, [])
            for idx, (code, name) in enumerate(courses):
                cid = _det_uuid("course", iid, code)
                course_ids_by_program[prog_id].append(cid)
                # Assign cyclically to first 3 faculty of matching dept
                fac_idx = idx % 3 if dept_code == "CSE" else (3 + idx % 2 if dept_code == "ECE" else 5 + idx % 2)
                await db.courses.update_one(
                    {"id": cid},
                    {"$set": {
                        "id": cid, "tenant_id": iid,
                        "department_id": dept_ids[dept_code],
                        "code": code, "name": name,
                        "credits": 3 + (idx % 2),
                        "semester": 5,  # all current-semester courses
                        "program_id": prog_id,
                        "faculty_id": faculty_ids[fac_idx],
                        "academic_year_id": year_id,
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )

        # ---- Timetable slots (Mon-Fri, 5 slots per day across courses) ----
        # Slots: 9-10, 10-11, 11-12, 14-15, 15-16
        slot_times = [
            ("09:00", "10:00"),
            ("10:00", "11:00"),
            ("11:00", "12:00"),
            ("14:00", "15:00"),
            ("15:00", "16:00"),
        ]
        for prog_id, course_ids in course_ids_by_program.items():
            for idx, cid in enumerate(course_ids):
                # Each course gets 3 slots/week across Mon-Fri
                for day_offset in range(3):
                    day = (idx + day_offset) % 5  # 0..4 Mon-Fri
                    start, end = slot_times[(idx + day_offset) % len(slot_times)]
                    sid = _det_uuid("slot", iid, cid, str(day), start)
                    await db.timetable_slots.update_one(
                        {"id": sid},
                        {"$set": {
                            "id": sid, "tenant_id": iid,
                            "course_id": cid,
                            "day_of_week": day,
                            "start_time": start,
                            "end_time": end,
                            "room": f"{'CSE' if 'CS' in cid else 'ECE' if 'EC' in cid else 'MBA'}-{200 + (idx % 5)}",
                            "academic_year_id": year_id,
                            "created_at": _iso(),
                        }},
                        upsert=True,
                    )

        # ---- Students (20 per tenant: 12 CSE B.Tech, 4 ECE B.Tech, 4 MBA) ----
        rng = random.Random(iid)
        # Anchor one student record to the real "manikanta" user for VCE
        real_student_emails = {
            "VCE": "manikanta.cse@vaagdevi.edu.in",
        }
        student_ids: List[str] = []
        for i in range(20):
            if i < 12:
                dept_code = "CSE"
                prog_code = "BTECH-CSE"
                roll_prefix = f"{t['roll_prefix']}CSE"
            elif i < 16:
                dept_code = "ECE"
                prog_code = "BTECH-ECE"
                roll_prefix = f"{t['roll_prefix']}ECE"
            else:
                dept_code = "MBA"
                prog_code = "MBA-GEN"
                roll_prefix = f"{t['roll_prefix']}MBA"
            roll_number = f"{roll_prefix}{i+1:03d}"
            student_id = _det_uuid("student", iid, roll_number)
            student_ids.append(student_id)
            # Anchor first VCE student to real user
            email = real_student_emails.get(short) if (short == "VCE" and i == 0) else f"student.{roll_number.lower()}@demo.claros"
            uid = await _user_id(email)
            cgpa = round(6.0 + rng.random() * 4.0, 2)  # 6.0–10.0
            await db.students.update_one(
                {"id": student_id},
                {"$set": {
                    "id": student_id, "tenant_id": iid,
                    "user_id": uid,
                    "roll_number": roll_number,
                    "display_name": f"Student {short} {i+1}" if not (short == "VCE" and i == 0) else "Manikanta T.",
                    "department_id": dept_ids[dept_code],
                    "program_id": program_ids[prog_code],
                    "admission_year": 2022,
                    "current_semester": 5,
                    "cgpa": cgpa,
                    "status": "ACTIVE",
                    "parent_email": f"parent.{roll_number.lower()}@example.com",
                    "parent_phone": f"+91-9{rng.randint(100000000, 999999999)}",
                    "created_at": _iso(),
                }},
                upsert=True,
            )

        # ---- Fee components (4 per program × all programs) ----
        for prog_code, prog_id in program_ids.items():
            scale = 1.5 if prog_code.startswith("MTECH") else 2.0 if prog_code.startswith("MBA") else 1.0
            for comp_name, base_amount in FEE_COMPONENTS:
                cid = _det_uuid("feecomp", iid, prog_code, comp_name)
                await db.fee_components.update_one(
                    {"id": cid},
                    {"$set": {
                        "id": cid, "tenant_id": iid,
                        "program_id": prog_id,
                        "academic_year_id": year_id,
                        "component_name": comp_name,
                        "amount": round(base_amount * scale, 2),
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )

        # ---- Fee payments (~70% students fully paid, 20% partial, 10% none) ----
        admin_user = await db.users.find_one(
            {"institution_id": iid, "role": "institution_admin"},
            {"_id": 0, "id": 1},
        )
        admin_id = admin_user["id"] if admin_user else _det_uuid("admin-syn", iid)
        for idx, sid in enumerate(student_ids):
            # Determine pay-state from idx so it's deterministic
            bucket = idx % 10
            student = await db.students.find_one({"id": sid}, {"_id": 0})
            prog_comps = await db.fee_components.find({
                "tenant_id": iid,
                "program_id": student["program_id"],
                "academic_year_id": year_id,
            }, {"_id": 0}).to_list(20)
            if bucket < 7:
                # Full pay
                to_pay = prog_comps
            elif bucket < 9:
                # Partial — pay first 2 components only
                to_pay = prog_comps[:2]
            else:
                to_pay = []
            for ci, c in enumerate(to_pay):
                pid = _det_uuid("feepay", iid, sid, c["id"])
                await db.fee_payments.update_one(
                    {"id": pid},
                    {"$set": {
                        "id": pid, "tenant_id": iid,
                        "student_id": sid,
                        "academic_year_id": year_id,
                        "component_id": c["id"],
                        "amount_paid": float(c["amount"]),
                        "payment_date": "2025-09-01",
                        "transaction_ref": f"TXN-{pid[:8].upper()}",
                        "payment_mode": "NETBANKING",
                        "status": "PAID",
                        "recorded_by": admin_id,
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )

        # ---- Attendance records (30 class days, per student × course) ----
        today = date.today()
        # Pull all course IDs for this tenant (just current semester ones)
        all_courses = await db.courses.find(
            {"tenant_id": iid, "academic_year_id": year_id},
            {"_id": 0, "id": 1, "program_id": 1},
        ).to_list(50)
        # Cap attendance volume for speed: 10 most recent days per (student, course)
        for sid in student_ids:
            student = await db.students.find_one(
                {"id": sid}, {"_id": 0, "program_id": 1}
            )
            student_courses = [c for c in all_courses
                              if c["program_id"] == student["program_id"]]
            for c in student_courses:
                for day_offset in range(1, 11):
                    cd = (today - timedelta(days=day_offset)).isoformat()
                    arec_id = _det_uuid("att", iid, sid, c["id"], cd)
                    # Status biased to PRESENT
                    r = rng.random()
                    status = "PRESENT" if r < 0.78 else ("LATE" if r < 0.85 else "ABSENT")
                    await db.attendance_records.update_one(
                        {"id": arec_id},
                        {"$setOnInsert": {
                            "id": arec_id, "tenant_id": iid,
                            "student_id": sid,
                            "course_id": c["id"],
                            "class_date": cd,
                            "status": status,
                            "marked_by": faculty_ids[0],
                            "marked_at": _iso(),
                        }},
                        upsert=True,
                    )

        # ---- Notices (5 sample) ----
        principal_user = await db.users.find_one(
            {"institution_id": iid, "role": "institution_admin"},
            {"_id": 0, "id": 1, "email": 1},
        )
        publisher_id = principal_user["id"] if principal_user else admin_id
        publisher_email = principal_user.get("email") if principal_user else "admin@demo.claros"
        for n in NOTICES:
            nid = _det_uuid("notice", iid, n["title"])
            await db.notices.update_one(
                {"id": nid},
                {"$setOnInsert": {
                    "id": nid, "tenant_id": iid,
                    "title": n["title"], "body": n["body"],
                    "category": n["category"],
                    "target_roles": n["target_roles"],
                    "published_by": publisher_id,
                    "published_by_email": publisher_email,
                    "published_at": _iso(),
                    "expires_at": None,
                    "is_active": True,
                    "created_at": _iso(),
                }},
                upsert=True,
            )

    logger.info(
        "Claros Core seeded · 4 tenants · departments + programs + 80 students + 32 faculty + courses + timetable + fees + notices + attendance"
    )
