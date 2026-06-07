"""
Claros Enroll — idempotent seed of 30 demo leads per tenant.

Distribution:
- Statuses: NEW 8, CONTACTED 6, COUNSELED 5, APPLIED 4, OFFERED 3, ENROLLED 3, DROPPED 1
- Sources: WEBSITE 15, REFERRAL 7, EVENT 5, WALKIN 3
- EAPCET ranks: 500 .. 80000
- Lead scores auto-computed per spec formula

All leads use deterministic UUID5 so re-runs are no-ops.
"""
from datetime import datetime, timedelta, timezone
from typing import List
import hashlib
import random
import uuid

from routes_enroll import compute_lead_score


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"

TENANTS = [
    {"id": VCE_ID, "short": "VCE", "city": "Hyderabad", "state": "Telangana",
     "programs": ["B.Tech CSE", "B.Tech ECE", "B.Tech AI&ML", "MBA"]},
    {"id": ISB_ID, "short": "ISB", "city": "Hyderabad", "state": "Telangana",
     "programs": ["PGP General", "PGP Analytics", "MFAB", "Executive MBA"]},
    {"id": EAIC_ID, "short": "EAIC", "city": "Abu Dhabi", "state": "UAE",
     "programs": ["AI Strategy", "Policy Lab", "Executive Fellowship"]},
    {"id": UOB_ID, "short": "UOB", "city": "Bradford", "state": "UK",
     "programs": ["BSc Computing", "MSc Data Science", "MBA"]},
]

FIRST_NAMES_BY_TENANT = {
    "VCE": ["Aarav", "Ananya", "Sai", "Pranav", "Divya", "Rohit", "Sneha",
            "Vikram", "Tara", "Nitin", "Pooja", "Karthik", "Manish", "Lakshmi",
            "Rahul", "Anjali", "Aditya", "Ishita", "Harsha", "Meera",
            "Suresh", "Kavya", "Arjun", "Riya", "Naveen", "Priya", "Kiran",
            "Sruthi", "Vamsi", "Shreya"],
    "ISB": ["Rajiv", "Neha", "Aakash", "Sonal", "Akshay", "Divya", "Manoj",
            "Tanvi", "Kunal", "Priyanka", "Siddharth", "Rohini", "Aman",
            "Geet", "Yash", "Sneha", "Karan", "Aditi", "Vivek", "Mansi",
            "Ankit", "Garima", "Rohit", "Ishita", "Nikhil", "Aaradhya",
            "Sahil", "Tarini", "Devansh", "Niharika"],
    "EAIC": ["Khalid", "Aisha", "Faisal", "Maryam", "Omar", "Nadia",
             "Yousef", "Sara", "Hassan", "Layla", "Tariq", "Hala", "Rashid",
             "Reem", "Saif", "Mona", "Bilal", "Yasmin", "Ahmed", "Salma",
             "Nasser", "Dana", "Sultan", "Lulu", "Hamdan", "Fatima",
             "Ibrahim", "Noor", "Talal", "Mariam"],
    "UOB": ["Emma", "Oliver", "Sophie", "Liam", "Amelia", "Noah", "Mia",
            "James", "Isla", "Benjamin", "Charlotte", "Henry", "Grace",
            "George", "Harper", "Leo", "Lily", "Jack", "Alice", "Joshua",
            "Eva", "Theo", "Maya", "Edward", "Phoebe", "Daniel", "Ruby",
            "Alfie", "Florence", "Sebastian"],
}

LAST_NAMES = {
    "VCE": ["Sharma", "Reddy", "Naidu", "Rao", "Kumar", "Patel", "Iyer",
            "Menon", "Singh", "Chowdary"],
    "ISB": ["Sharma", "Mehta", "Kapoor", "Khanna", "Gupta", "Verma",
            "Bansal", "Agarwal", "Mehrotra", "Shroff"],
    "EAIC": ["Al-Mansoori", "Al-Hashimi", "Al-Mazrouei", "Al-Suwaidi",
             "Al-Nuaimi", "Al-Falasi", "Al-Awadi", "Al-Qubaisi"],
    "UOB": ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Davies",
            "Evans", "Thomas", "Roberts", "Johnson"],
}

SOURCES_DIST = ["WEBSITE"] * 15 + ["REFERRAL"] * 7 + ["EVENT"] * 5 + ["WALKIN"] * 3
STATUSES_DIST = (
    ["NEW"] * 8 + ["CONTACTED"] * 6 + ["COUNSELED"] * 5 +
    ["APPLIED"] * 4 + ["OFFERED"] * 3 + ["ENROLLED"] * 3 + ["DROPPED"] * 1
)
ACTIVITY_TYPES_FREE = ["CALL", "EMAIL", "WHATSAPP", "VISIT", "NOTE"]
SAMPLE_NOTES = [
    "Inquired about scholarships and merit aid.",
    "Asked about hostel availability for first-years.",
    "Wants to discuss programme curriculum in detail.",
    "Parent joined the call — both keen on placements.",
    "Visited campus during open house.",
    "Asked about international exchange tie-ups.",
    "Interested in the AI/ML specialization track.",
    "Already shortlisted, awaiting fee structure email.",
]


def _det_uuid(*parts: str) -> str:
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def seed_claros_enroll(db, logger):
    """Idempotent seed of 30 leads per tenant."""
    now = datetime.now(timezone.utc)
    counts = {}
    for t in TENANTS:
        iid = t["id"]
        firsts = FIRST_NAMES_BY_TENANT[t["short"]]
        lasts = LAST_NAMES[t["short"]]
        rng = random.Random(iid)  # deterministic
        created_n = 0
        # Pick admissions counselor user_id (anyone with role=registrar/career_services)
        counselor = await db.users.find_one(
            {"institution_id": iid, "role": {"$in": ["registrar", "career_services", "institution_admin"]}},
            {"_id": 0, "id": 1},
        )
        counselor_id = counselor["id"] if counselor else None

        for i in range(30):
            first = firsts[i % len(firsts)]
            last = lasts[i % len(lasts)]
            full_name = f"{first} {last}"
            lead_id = _det_uuid("enroll-lead", iid, full_name, str(i))
            # Skip if exists
            existing = await db.leads.find_one({"id": lead_id}, {"_id": 0, "id": 1})
            if existing:
                continue
            source = SOURCES_DIST[i % len(SOURCES_DIST)]
            status = STATUSES_DIST[i % len(STATUSES_DIST)]
            program = t["programs"][i % len(t["programs"])]
            # EAPCET rank only for VCE; for others just JEE-style or none
            if t["short"] == "VCE":
                eapcet_rank = rng.randint(500, 80000) if rng.random() < 0.85 else None
                jee_rank = None
            else:
                eapcet_rank = None
                jee_rank = rng.randint(1000, 60000) if rng.random() < 0.4 else None
            created_offset_days = rng.randint(0, 28)
            created_at = now - timedelta(days=created_offset_days)
            email_local = f"{first.lower()}.{last.lower().replace(chr(45),'').replace(' ', '')}"
            doc = {
                "id": lead_id,
                "tenant_id": iid,
                "full_name": full_name,
                "email": f"{email_local}{i}@demo.claros",
                "phone": f"+91-9{rng.randint(100000000, 999999999)}" if t["short"] == "VCE" else f"+1-{rng.randint(1000000000, 9999999999)}",
                "program_interest": program,
                "city": t["city"], "state": t["state"],
                "eapcet_rank": eapcet_rank, "jee_rank": jee_rank,
                "source": source,
                "status": status,
                "lead_score": 0,  # set below
                "assigned_to": counselor_id,
                "notes": SAMPLE_NOTES[i % len(SAMPLE_NOTES)],
                "last_contacted_at": _iso(created_at + timedelta(days=rng.randint(0, 3))) if status != "NEW" else None,
                "created_at": _iso(created_at),
                "updated_at": _iso(created_at),
            }
            # Seed activities — more activities for further-along leads
            act_target = {
                "NEW": 0, "CONTACTED": 1, "COUNSELED": 2,
                "APPLIED": 3, "OFFERED": 4, "ENROLLED": 5, "DROPPED": 2,
            }.get(status, 0)
            activities_to_insert: List[dict] = []
            for k in range(act_target):
                a_type = ACTIVITY_TYPES_FREE[k % len(ACTIVITY_TYPES_FREE)]
                aid = _det_uuid("enroll-act", lead_id, str(k))
                activities_to_insert.append({
                    "id": aid,
                    "tenant_id": iid,
                    "lead_id": lead_id,
                    "activity_type": a_type,
                    "description": SAMPLE_NOTES[(i + k) % len(SAMPLE_NOTES)],
                    "old_status": None, "new_status": None,
                    "performed_by": counselor_id or "system",
                    "created_at": _iso(created_at + timedelta(days=k + 1)),
                })
            # Compute score using activity count
            doc["lead_score"] = compute_lead_score(doc, len(activities_to_insert))
            # Insert programs list (2-3 of interest)
            programs_interest = rng.sample(t["programs"], min(2, len(t["programs"])))
            await db.leads.insert_one(doc)
            for p in programs_interest:
                pid = _det_uuid("enroll-prog", lead_id, p)
                await db.lead_programs.update_one(
                    {"id": pid},
                    {"$setOnInsert": {
                        "id": pid, "tenant_id": iid, "lead_id": lead_id,
                        "program_name": p,
                    }},
                    upsert=True,
                )
            if activities_to_insert:
                await db.lead_activities.insert_many(activities_to_insert)
            created_n += 1
        counts[t["short"]] = created_n
    logger.info("Claros Enroll seeded · %s new leads across 4 tenants", counts)
