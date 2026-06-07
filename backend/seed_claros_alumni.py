"""Claros Alumni — idempotent seed of alumni profiles, jobs, and events.

Bootstraps the new tenant_id-keyed collections from the legacy alumni_directory
records when available.
"""
from datetime import datetime, timezone, timedelta
import hashlib
import random

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _det(*parts):
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso():
    return datetime.now(timezone.utc).isoformat()


SEED_PROFILES = [
    {"name": "Aishwarya Rao", "batch_year": 2018, "program_name": "B.Tech CSE",
     "current_company": "Microsoft India", "current_role": "Senior SDE",
     "current_location": "Hyderabad",
     "is_mentor": True, "mentor_domains": ["Cloud", "Distributed Systems", "Career Growth"],
     "bio": "8 years in cloud + distributed systems. Happy to mentor on interview prep "
            "and senior engineering paths."},
    {"name": "Karthik Yadav", "batch_year": 2019, "program_name": "B.Tech ECE",
     "current_company": "Texas Instruments", "current_role": "Mixed-Signal Engineer",
     "current_location": "Bangalore",
     "is_mentor": True, "mentor_domains": ["VLSI", "Analog Design", "Higher Studies"],
     "bio": "Worked across automotive and consumer analog. Open to mentoring on VLSI track."},
    {"name": "Sneha Reddy", "batch_year": 2017, "program_name": "MBA",
     "current_company": "McKinsey & Company", "current_role": "Engagement Manager",
     "current_location": "Mumbai",
     "is_mentor": True, "mentor_domains": ["Consulting", "Strategy", "Career Pivot"],
     "bio": "Strategy consultant focused on consumer and tech sectors. Loves coaching juniors."},
    {"name": "Vikram Singh", "batch_year": 2020, "program_name": "B.Tech CSE",
     "current_company": "Zerodha", "current_role": "Backend Engineer",
     "current_location": "Bangalore",
     "is_mentor": False, "mentor_domains": [],
     "bio": "Building order-management infra at Zerodha."},
    {"name": "Priya Sharma", "batch_year": 2016, "program_name": "B.Tech CSE",
     "current_company": "Stripe", "current_role": "Staff Engineer",
     "current_location": "Bengaluru / Remote",
     "is_mentor": True, "mentor_domains": ["Payments", "Distributed Systems", "Open Source"],
     "bio": "Staff engineer at Stripe, ex-Google. Mentors first-gen engineers."},
]

SEED_JOBS = [
    {"title": "Software Engineer — New Grad", "company_name": "Microsoft",
     "location": "Hyderabad", "package_lpa": 28.0,
     "skills_required": ["DSA", "System Design", "Python or C++"],
     "description": "New grad rotational program across Azure and M365.",
     "deadline_offset": 30, "posted_by_idx": 0},
    {"title": "Analog Design Intern (6 months)", "company_name": "Texas Instruments",
     "location": "Bangalore", "package_lpa": 8.4,
     "skills_required": ["Cadence Virtuoso", "Analog circuits"],
     "description": "6-month internship designing power-management ICs.",
     "deadline_offset": 14, "posted_by_idx": 1},
    {"title": "Junior Consultant", "company_name": "McKinsey & Company",
     "location": "Multiple Indian cities", "package_lpa": 18.0,
     "skills_required": ["Problem solving", "Communication", "Excel"],
     "description": "Entry-level consulting role open to top-quartile graduates.",
     "deadline_offset": 45, "posted_by_idx": 2},
]

SEED_EVENTS = [
    {"title": "Alumni Networking Meetup — Hyderabad",
     "event_type": "MEETUP", "description": "Quarterly meetup with industry talks.",
     "event_date_offset": 21, "event_time": "18:30",
     "location_or_link": "T-Hub, Hyderabad"},
    {"title": "Career Pivot Webinar — From Engineering to Consulting",
     "event_type": "WEBINAR", "description": "Webinar by senior alumni working in consulting.",
     "event_date_offset": 10, "event_time": "19:00",
     "location_or_link": "https://meet.example.edu/career-pivot"},
]


async def seed_claros_alumni(db, logger):
    counts = {"profiles": 0, "jobs": 0, "events": 0}
    now = datetime.now(timezone.utc)
    for iid in [VCE_ID, ISB_ID]:
        # Profiles
        for p in SEED_PROFILES:
            pid = _det("alumprof", iid, p["name"])
            await db.alumni_profiles.update_one(
                {"id": pid},
                {"$setOnInsert": {
                    "id": pid, "tenant_id": iid, "user_id": None,
                    "name": p["name"], "email": "",
                    "batch_year": p["batch_year"],
                    "program_name": p["program_name"],
                    "department_name": p["program_name"].split()[-1],
                    "current_company": p["current_company"],
                    "current_role": p["current_role"],
                    "current_location": p["current_location"],
                    "linkedin_url": "",
                    "is_mentor": p["is_mentor"],
                    "mentor_domains": p["mentor_domains"],
                    "bio": p["bio"],
                    "is_verified": True,
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["profiles"] += 1

        # Build list of profile ids in same order for job posting attribution
        ordered_ids = [_det("alumprof", iid, p["name"]) for p in SEED_PROFILES]

        for j in SEED_JOBS:
            jid = _det("alumjob", iid, j["title"])
            deadline = (now + timedelta(days=j["deadline_offset"])).strftime("%Y-%m-%d")
            await db.alumni_jobs.update_one(
                {"id": jid},
                {"$setOnInsert": {
                    "id": jid, "tenant_id": iid,
                    "posted_by": ordered_ids[j["posted_by_idx"]],
                    "title": j["title"], "company_name": j["company_name"],
                    "location": j["location"],
                    "description": j["description"],
                    "skills_required": j["skills_required"],
                    "package_lpa": j["package_lpa"],
                    "application_url": "https://careers.example.com/apply",
                    "deadline": deadline, "is_active": True,
                    "posted_at": _iso(),
                }},
                upsert=True,
            )
            counts["jobs"] += 1

        for e in SEED_EVENTS:
            eid = _det("alumevent", iid, e["title"])
            ed = (now + timedelta(days=e["event_date_offset"])).strftime("%Y-%m-%d")
            await db.alumni_events.update_one(
                {"id": eid},
                {"$setOnInsert": {
                    "id": eid, "tenant_id": iid,
                    "title": e["title"], "event_type": e["event_type"],
                    "description": e["description"],
                    "event_date": ed, "event_time": e["event_time"],
                    "location_or_link": e["location_or_link"],
                    "organiser_id": ordered_ids[0],
                    "is_active": True, "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["events"] += 1
    logger.info("Claros Alumni seeded · %s", counts)
