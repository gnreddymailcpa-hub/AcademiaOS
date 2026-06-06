"""
Phase-2 seed data — diversifies the demo dataset across branches so the
cross-platform glue (mentor-match by branch, AQAR live totals, etc.)
demonstrates well during NAAC visits.

This module is idempotent: each insert is guarded by an existence check so
re-runs (after a code reload or fresh deployment) do not duplicate data.
"""
from datetime import datetime, timezone
from uuid import uuid4


def _now():
    return datetime.now(timezone.utc).isoformat()


# 12 alumni across 6 branches, 8 available for mentorship
ALUMNI_SEED = [
    # CSE
    {"name": "Ravi Kumar",      "email": "ravi.cse19@alumni.vaagdevi.edu.in",   "graduation_year": 2019, "branch": "CSE",  "company": "Google",      "role": "SDE-III",                   "location": "Hyderabad", "available_for_mentorship": True},
    {"name": "Sneha Reddy",     "email": "sneha.cse17@alumni.vaagdevi.edu.in",  "graduation_year": 2017, "branch": "CSE",  "company": "Microsoft",   "role": "Senior Software Engineer",  "location": "Bengaluru", "available_for_mentorship": True},
    # AIML
    {"name": "Aditya Sharma",   "email": "aditya.aiml20@alumni.vaagdevi.edu.in","graduation_year": 2020, "branch": "AIML", "company": "OpenAI",      "role": "ML Engineer",               "location": "Remote",     "available_for_mentorship": True},
    {"name": "Priya Iyer",      "email": "priya.aiml21@alumni.vaagdevi.edu.in", "graduation_year": 2021, "branch": "AIML", "company": "Nvidia",      "role": "Deep Learning Researcher",  "location": "Bengaluru", "available_for_mentorship": True},
    # ECE
    {"name": "Karthik Naidu",   "email": "karthik.ece18@alumni.vaagdevi.edu.in","graduation_year": 2018, "branch": "ECE",  "company": "Qualcomm",    "role": "Embedded Systems Lead",     "location": "Hyderabad", "available_for_mentorship": True},
    {"name": "Lakshmi Bhanu",   "email": "lakshmi.ece16@alumni.vaagdevi.edu.in","graduation_year": 2016, "branch": "ECE",  "company": "Texas Instruments", "role": "Analog Design Engineer", "location": "Bengaluru", "available_for_mentorship": False},
    # EEE
    {"name": "Vinay Goud",      "email": "vinay.eee19@alumni.vaagdevi.edu.in",  "graduation_year": 2019, "branch": "EEE",  "company": "Tata Power",  "role": "Grid Operations Manager",   "location": "Mumbai",    "available_for_mentorship": True},
    # MECH
    {"name": "Ramesh Yadav",    "email": "ramesh.mech17@alumni.vaagdevi.edu.in","graduation_year": 2017, "branch": "MECH", "company": "Tata Motors", "role": "Lead Design Engineer",      "location": "Pune",      "available_for_mentorship": True},
    {"name": "Anil Reddy",      "email": "anil.mech15@alumni.vaagdevi.edu.in",  "graduation_year": 2015, "branch": "MECH", "company": "Ashok Leyland","role": "VP Manufacturing",         "location": "Chennai",   "available_for_mentorship": False},
    # CIV
    {"name": "Suresh Babu",     "email": "suresh.civ18@alumni.vaagdevi.edu.in", "graduation_year": 2018, "branch": "CIV",  "company": "L&T",         "role": "Project Manager (Metro)",   "location": "Mumbai",    "available_for_mentorship": True},
    # DS
    {"name": "Manasa Rao",      "email": "manasa.ds22@alumni.vaagdevi.edu.in",  "graduation_year": 2022, "branch": "DS",   "company": "Razorpay",    "role": "Data Scientist",            "location": "Bengaluru", "available_for_mentorship": True},
    {"name": "Naveen Krishna",  "email": "naveen.ds21@alumni.vaagdevi.edu.in",  "graduation_year": 2021, "branch": "DS",   "company": "Flipkart",    "role": "Senior Data Scientist",     "location": "Bengaluru", "available_for_mentorship": False},
]

PUBLICATION_SEED = [
    {"title": "Deep Learning for Industrial IoT", "venue": "IEEE TII",       "year": 2024, "citations": 42, "authors": ["Hari", "Sundar"]},
    {"title": "Edge AI on Resource-Constrained Devices", "venue": "ACM MobiSys", "year": 2024, "citations": 28, "authors": ["Hari", "Aravind"]},
    {"title": "Vision Transformers for Manufacturing QC", "venue": "CVPR Workshop", "year": 2023, "citations": 35, "authors": ["Sundar", "Priya"]},
    {"title": "Federated Learning in Smart Campus Networks", "venue": "IEEE IoT-J", "year": 2023, "citations": 19, "authors": ["Hari"]},
    {"title": "Energy-Efficient ML at the Edge",  "venue": "MLSys", "year": 2022, "citations": 67, "authors": ["Sundar", "Hari", "Aravind"]},
    {"title": "Adaptive Quizzes via RAG",         "venue": "L@S",   "year": 2024, "citations": 12, "authors": ["Priya"]},
    {"title": "OBE Outcome Mapping with LLMs",    "venue": "IEEE TLT", "year": 2023, "citations": 24, "authors": ["Hari", "Priya"]},
]

DRIVE_SEED = [
    {"company": "Microsoft", "role": "SDE",       "package_lpa": 22, "eligibility_branches": ["CSE","AIML","DS"], "eligibility_cgpa": 7.5,  "scheduled_date": "2026-03-12"},
    {"company": "Amazon",    "role": "SDE",       "package_lpa": 18, "eligibility_branches": ["CSE","AIML","DS","ECE"], "eligibility_cgpa": 7.0, "scheduled_date": "2026-03-20"},
    {"company": "Nvidia",    "role": "ML Engineer","package_lpa": 28, "eligibility_branches": ["CSE","AIML"], "eligibility_cgpa": 8.0, "scheduled_date": "2026-04-02"},
    {"company": "L&T",       "role": "Site Engineer","package_lpa": 9, "eligibility_branches": ["CIV","MECH","EEE"], "eligibility_cgpa": 6.5, "scheduled_date": "2026-04-10"},
]

ENERGY_SEED = [
    {"meter_id": "M-BL1",   "location": "Block 1",   "kwh": 12000, "source": "grid",   "period": "2025-10"},
    {"meter_id": "M-BL2",   "location": "Block 2",   "kwh": 9800,  "source": "grid",   "period": "2025-10"},
    {"meter_id": "M-SOLAR", "location": "Rooftop A", "kwh": 4500,  "source": "solar",  "period": "2025-10"},
    {"meter_id": "M-BL1",   "location": "Block 1",   "kwh": 12500, "source": "grid",   "period": "2025-11"},
    {"meter_id": "M-SOLAR", "location": "Rooftop A", "kwh": 5200,  "source": "solar",  "period": "2025-11"},
    {"meter_id": "M-BL1",   "location": "Block 1",   "kwh": 11800, "source": "grid",   "period": "2025-12"},
    {"meter_id": "M-SOLAR", "location": "Rooftop A", "kwh": 4900,  "source": "solar",  "period": "2025-12"},
]

EF_KWH = {"grid": 0.82, "solar": 0.04, "wind": 0.04, "diesel": 0.96, "other": 0.82}


async def seed_phase2_demo(db, institution_id: str, logger):
    """Idempotently seed diverse alumni / PRISM pubs / PATHFINDER drives /
    GREENIQ energy data for the demo tenant."""

    # 1. Alumni — guard by email uniqueness
    inserted_alumni = 0
    for a in ALUMNI_SEED:
        existing = await db.alumni_directory.find_one(
            {"institution_id": institution_id, "email": a["email"]}, {"_id": 1}
        )
        if existing:
            continue
        doc = {"id": f"al-{uuid4().hex[:10]}", "institution_id": institution_id,
               **a, "created_at": _now()}
        await db.alumni_directory.insert_one(doc)
        inserted_alumni += 1

    # 2. PRISM publications — guard by title
    inserted_pubs = 0
    for p in PUBLICATION_SEED:
        existing = await db.prism_publications.find_one(
            {"institution_id": institution_id, "title": p["title"]}, {"_id": 1}
        )
        if existing:
            continue
        doc = {"id": f"pub-{uuid4().hex[:10]}", "institution_id": institution_id,
               **p, "open_access": False, "doi": None,
               "created_at": _now(), "added_by": "seed@academiaos.ai"}
        await db.prism_publications.insert_one(doc)
        inserted_pubs += 1

    # 3. PATHFINDER drives — guard by (company, role, scheduled_date)
    inserted_drives = 0
    for d in DRIVE_SEED:
        existing = await db.placement_drives.find_one(
            {"institution_id": institution_id, "company": d["company"],
             "role": d["role"], "scheduled_date": d["scheduled_date"]}, {"_id": 1}
        )
        if existing:
            continue
        doc = {"id": f"drv-{uuid4().hex[:10]}", "institution_id": institution_id,
               **d, "description": "Seeded for demo", "status": "scheduled",
               "applicants": [], "selected": [],
               "created_by": "seed@academiaos.ai", "created_at": _now()}
        await db.placement_drives.insert_one(doc)
        inserted_drives += 1

    # 4. GREENIQ energy readings — guard by (meter_id, period)
    inserted_energy = 0
    for e in ENERGY_SEED:
        existing = await db.greeniq_energy.find_one(
            {"institution_id": institution_id, "meter_id": e["meter_id"],
             "period": e["period"]}, {"_id": 1}
        )
        if existing:
            continue
        tco2e = round(e["kwh"] * EF_KWH.get(e["source"], 0.82) / 1000, 3)
        doc = {"id": f"en-{uuid4().hex[:10]}", "institution_id": institution_id,
               **e, "tco2e": tco2e, "logged_at": _now(), "logged_by": "seed@academiaos.ai"}
        await db.greeniq_energy.insert_one(doc)
        inserted_energy += 1

    if inserted_alumni or inserted_pubs or inserted_drives or inserted_energy:
        logger.info(
            "Phase-2 demo seed for %s: +%d alumni · +%d pubs · +%d drives · +%d energy",
            institution_id, inserted_alumni, inserted_pubs, inserted_drives, inserted_energy,
        )
