"""Claros Launch — idempotent seed: 15 companies + 8 drives + skills + 5 mocks per VCE."""
from datetime import datetime, timezone, timedelta, date
import hashlib
import random
import uuid


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"

COMPANIES = [
    {"name": "TCS", "industry": "IT Services", "avg": 4.5, "max": 9.0,
     "roles": ["Systems Engineer", "Digital Specialist"], "skills": ["Java", "SQL", "Python", "DSA"],
     "rounds": 3, "types": ["aptitude", "technical", "hr"],
     "tips": "Strong aptitude foundation + verbal English. TCS NQT is the gateway."},
    {"name": "Infosys", "industry": "IT Services", "avg": 5.0, "max": 10.0,
     "roles": ["Power Programmer", "Systems Engineer"], "skills": ["Java", "Python", "AWS", "OOP"],
     "rounds": 3, "types": ["aptitude", "technical", "hr"],
     "tips": "Polished communication + applied coding rounds. Practice on InfyTQ."},
    {"name": "Wipro", "industry": "IT Services", "avg": 3.5, "max": 6.5,
     "roles": ["Project Engineer"], "skills": ["C", "Java", "SQL"], "rounds": 3,
     "types": ["aptitude", "technical", "hr"], "tips": "Strong fundamentals + clear thought process."},
    {"name": "Amazon", "industry": "E-commerce / Cloud", "avg": 18.0, "max": 44.0,
     "roles": ["SDE-1", "Data Engineer"], "skills": ["DSA", "System Design", "Python", "Java", "AWS"],
     "rounds": 5, "types": ["online_test", "technical", "system_design", "hr", "bar_raiser"],
     "tips": "Master DSA + 16 leadership principles. STAR stories with quantified outcomes."},
    {"name": "Microsoft", "industry": "Software / Cloud", "avg": 22.0, "max": 45.0,
     "roles": ["SDE", "Program Manager"], "skills": ["DSA", "C++", "C#", "Azure", "System Design"],
     "rounds": 4, "types": ["online_test", "technical", "design", "hr"],
     "tips": "Strong CS fundamentals + design + collaboration mindset."},
    {"name": "Google", "industry": "Software", "avg": 28.0, "max": 65.0,
     "roles": ["Software Engineer", "Data Scientist"], "skills": ["DSA", "System Design", "Python", "Go"],
     "rounds": 5, "types": ["online_test", "technical", "technical", "design", "Googleyness"],
     "tips": "Advanced DSA + clean problem decomposition + strong communication."},
    {"name": "Adobe", "industry": "Software", "avg": 18.0, "max": 35.0,
     "roles": ["MTS-1"], "skills": ["DSA", "C++", "Python", "OS"], "rounds": 4,
     "types": ["online_test", "technical", "technical", "hr"], "tips": "DSA + OS fundamentals."},
    {"name": "Deloitte", "industry": "Consulting", "avg": 6.5, "max": 13.0,
     "roles": ["Analyst", "Consultant"], "skills": ["SQL", "Excel", "Communication", "Business Analysis"],
     "rounds": 3, "types": ["aptitude", "case_study", "hr"],
     "tips": "Case-study practice + structured frameworks (MECE, SWOT)."},
    {"name": "Accenture", "industry": "Consulting", "avg": 4.5, "max": 11.0,
     "roles": ["ASE"], "skills": ["Java", "SQL", "Cloud"], "rounds": 3,
     "types": ["aptitude", "technical", "hr"], "tips": "Practice cognitive + tech assessment."},
    {"name": "Capgemini", "industry": "IT Services", "avg": 4.0, "max": 8.0,
     "roles": ["Analyst"], "skills": ["Java", "Python", "SQL"], "rounds": 3,
     "types": ["aptitude", "tech_mcq", "hr"], "tips": "Strong logical reasoning."},
    {"name": "Goldman Sachs", "industry": "Financial Services", "avg": 18.0, "max": 32.0,
     "roles": ["Analyst", "Engineer"], "skills": ["DSA", "Finance", "Statistics", "Python"],
     "rounds": 4, "types": ["online_test", "technical", "behavioural", "hypermatrix"],
     "tips": "DSA + finance concepts + behavioural depth."},
    {"name": "Cognizant", "industry": "IT Services", "avg": 4.5, "max": 9.0,
     "roles": ["Programmer Analyst"], "skills": ["Java", "Python", "SQL"], "rounds": 3,
     "types": ["aptitude", "technical", "hr"], "tips": "CTS aptitude focus."},
    {"name": "HCL", "industry": "IT Services", "avg": 4.0, "max": 8.5,
     "roles": ["Software Engineer"], "skills": ["Java", "Cloud", "SQL"], "rounds": 3,
     "types": ["aptitude", "technical", "hr"], "tips": "Tech essentials + soft skills."},
    {"name": "ZS Associates", "industry": "Consulting", "avg": 12.0, "max": 22.0,
     "roles": ["BTSA", "Decision Analytics Associate"],
     "skills": ["SQL", "Python", "Excel", "Statistics", "Business Analysis"],
     "rounds": 4, "types": ["aptitude", "case_study", "technical", "hr"],
     "tips": "Strong case-study + SQL skills."},
    {"name": "EY", "industry": "Consulting", "avg": 6.0, "max": 13.0,
     "roles": ["Analyst", "Consultant"], "skills": ["Excel", "SQL", "Communication"],
     "rounds": 3, "types": ["aptitude", "case_study", "hr"], "tips": "Practice frameworks + numerical reasoning."},
]

DRIVES = [
    {"company": "TCS", "offset_days": 7, "package": 4.5, "role": "Systems Engineer", "status": "UPCOMING", "min_cgpa": 6.0},
    {"company": "Infosys", "offset_days": 10, "package": 5.5, "role": "Power Programmer", "status": "UPCOMING", "min_cgpa": 7.0},
    {"company": "Amazon", "offset_days": 15, "package": 22.0, "role": "SDE-1", "status": "UPCOMING", "min_cgpa": 7.5},
    {"company": "Deloitte", "offset_days": 20, "package": 7.5, "role": "Analyst", "status": "UPCOMING", "min_cgpa": 6.5},
    {"company": "Accenture", "offset_days": 25, "package": 4.5, "role": "ASE", "status": "UPCOMING", "min_cgpa": 6.0},
    {"company": "Wipro", "offset_days": -20, "package": 3.75, "role": "Project Engineer", "status": "COMPLETED", "min_cgpa": 6.0},
    {"company": "Cognizant", "offset_days": -35, "package": 4.0, "role": "Programmer Analyst", "status": "COMPLETED", "min_cgpa": 6.0},
    {"company": "HCL", "offset_days": -50, "package": 4.25, "role": "Software Engineer", "status": "COMPLETED", "min_cgpa": 6.0},
]

SAMPLE_SKILLS = [
    ("Python", "PROGRAMMING", 4), ("Java", "PROGRAMMING", 3), ("DSA", "TECHNICAL", 3),
    ("SQL", "TECHNICAL", 4), ("AWS", "TOOL", 2), ("Communication", "SOFT", 4),
    ("System Design", "TECHNICAL", 2), ("Git", "TOOL", 4),
]


def _det_uuid(*parts: str) -> str:
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_claros_launch(db, logger):
    today = date.today()
    # Seed companies + drives in all 4 tenants
    counts = {"companies": 0, "drives": 0, "skills": 0, "mocks": 0, "placements": 0}
    for iid in [VCE_ID, ISB_ID, EAIC_ID, UOB_ID]:
        # Companies
        for c in COMPANIES:
            cid = _det_uuid("company", iid, c["name"])
            await db.companies.update_one({"id": cid}, {"$setOnInsert": {
                "id": cid, "tenant_id": iid, "name": c["name"], "industry": c["industry"],
                "website": f"https://{c['name'].lower().replace(' ','')}.com",
                "avg_package": c["avg"], "max_package": c["max"],
                "typical_roles": c["roles"], "skills_required": c["skills"],
                "interview_rounds": c["rounds"], "interview_types": c["types"],
                "prep_tips": c["tips"], "is_active": True, "created_at": _iso(),
            }}, upsert=True)
            counts["companies"] += 1
        # Pick CSE program for eligibility
        cse_prog = await db.programs.find_one({"tenant_id": iid, "code": "BTECH-CSE"}, {"_id": 0, "id": 1, "code": 1})
        eligible_codes = [cse_prog["code"], "BTECH-ECE", "MTECH-CSE"] if cse_prog else []
        # Drives — only seed for VCE & ISB (career drives are India context)
        if iid not in [VCE_ID, ISB_ID]:
            continue
        admin = await db.users.find_one({"institution_id": iid, "role": "institution_admin"}, {"_id": 0, "id": 1})
        admin_id = admin["id"] if admin else "system"
        for d in DRIVES:
            cid = _det_uuid("company", iid, d["company"])
            did = _det_uuid("drive", iid, d["company"], str(d["offset_days"]))
            drive_date = (today + timedelta(days=d["offset_days"])).isoformat()
            await db.placement_drives.update_one({"id": did}, {"$setOnInsert": {
                "id": did, "tenant_id": iid, "company_id": cid,
                "drive_date": drive_date,
                "registration_deadline": (today + timedelta(days=max(d["offset_days"] - 3, -60))).isoformat(),
                "package_offered": d["package"], "job_role": d["role"],
                "eligible_programs": eligible_codes, "min_cgpa": d["min_cgpa"],
                "max_backlogs": 0,
                "description": f"{d['company']} on-campus drive for {d['role']} position.",
                "status": d["status"], "created_by": admin_id, "created_at": _iso(),
            }}, upsert=True)
            counts["drives"] += 1
            # If completed, add some placements
            if d["status"] == "COMPLETED":
                # Pick 3 students randomly (deterministic)
                students = await db.students.find({"tenant_id": iid, "status": "ACTIVE"}, {"_id": 0, "id": 1}).limit(20).to_list(20)
                rng = random.Random(f"{iid}-{d['company']}")
                picks = rng.sample(students, min(3, len(students))) if students else []
                for sp in picks:
                    pid = _det_uuid("place", iid, did, sp["id"])
                    await db.placements.update_one({"id": pid}, {"$setOnInsert": {
                        "id": pid, "tenant_id": iid, "student_id": sp["id"], "drive_id": did,
                        "package_offered": d["package"], "job_role": d["role"],
                        "company_name": d["company"], "offer_date": drive_date,
                        "joining_date": (today + timedelta(days=180)).isoformat(),
                        "placement_type": "CAMPUS", "created_at": _iso(),
                    }}, upsert=True)
                    counts["placements"] += 1
        # Skills — seed for first 5 students per tenant
        sids = await db.students.find({"tenant_id": iid, "status": "ACTIVE"}, {"_id": 0, "id": 1}).limit(5).to_list(5)
        for st in sids:
            rng = random.Random(f"{iid}-skills-{st['id']}")
            for sk_name, cat, base in SAMPLE_SKILLS:
                level = max(1, min(5, base + rng.randint(-1, 1)))
                key = {"tenant_id": iid, "student_id": st["id"], "skill_name": sk_name}
                await db.student_skills.update_one(key, {"$setOnInsert": {
                    "id": str(uuid.uuid4()), **key, "category": cat,
                    "proficiency_level": level, "assessed_by": "SELF",
                    "created_at": _iso(),
                }}, upsert=True)
                counts["skills"] += 1
        # Mocks — for first student only
        if sids:
            first = sids[0]
            for k in range(5):
                mid = _det_uuid("mock", iid, first["id"], str(k))
                await db.mock_interviews.update_one({"id": mid}, {"$setOnInsert": {
                    "id": mid, "tenant_id": iid, "student_id": first["id"],
                    "company_id": None, "target_role": ["SDE-1", "Analyst", "Engineer", "Consultant", "Programmer"][k],
                    "question_text": [
                        "Explain dynamic programming with an example.",
                        "Tell me about a time you handled conflict on a team.",
                        "Design a URL shortener like bit.ly.",
                        "Why do you want to join consulting?",
                        "What is the time complexity of merge sort?",
                    ][k],
                    "answer_text": "Demo seed answer — replace via UI.",
                    "ai_score": [7, 6, 8, 5, 9][k],
                    "ai_feedback": "Solid foundation; add specific quantified examples and STAR structure.",
                    "ai_strengths": ["Clear narrative", "Logical flow"],
                    "ai_improvements": ["Add metrics", "Use STAR format"],
                    "created_at": _iso(),
                }}, upsert=True)
                counts["mocks"] += 1
    logger.info("Claros Launch seeded · %s", counts)
