"""Claros Research — idempotent seed."""
from datetime import datetime, timezone, timedelta
import hashlib

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _det(*parts):
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso():
    return datetime.now(timezone.utc).isoformat()


PUBLICATIONS = [
    {"title": "Federated Learning for Edge Intelligence in Smart Campuses",
     "journal_name": "IEEE Internet of Things Journal", "publication_type": "JOURNAL",
     "year_of_publication": 2025, "impact_factor": 10.2, "citations_count": 22,
     "is_indexed": True, "indexing_db": "SCI",
     "abstract": "We propose a federated learning framework that aggregates "
                 "client gradients while preserving privacy, demonstrated on a "
                 "smart-campus testbed.", "doi": "10.1109/IOT.2025.001"},
    {"title": "Graph Neural Networks for Curriculum Recommendation",
     "journal_name": "ACM Transactions on Knowledge Discovery", "publication_type": "JOURNAL",
     "year_of_publication": 2024, "impact_factor": 4.6, "citations_count": 9,
     "is_indexed": True, "indexing_db": "SCOPUS",
     "abstract": "A GNN approach to course-to-skill alignment for adaptive curricula.",
     "doi": "10.1145/TKD.2024.045"},
    {"title": "Energy-Efficient HVAC Control via Reinforcement Learning",
     "journal_name": "IEEE TPAMI Workshop", "publication_type": "CONFERENCE",
     "year_of_publication": 2025, "impact_factor": None, "citations_count": 3,
     "is_indexed": True, "indexing_db": "SCOPUS",
     "abstract": "An RL agent learns HVAC schedules that cut energy by 18%.",
     "doi": ""},
]

PATENTS = [
    {"title": "Adaptive Solar Panel Cleaning System Using Computer Vision",
     "inventors": ["Dr. Suresh K", "R. Manikanta"],
     "application_number": "IN202541098765", "filing_date": "2025-08-12",
     "status": "PUBLISHED", "patent_office": "Indian Patent Office",
     "abstract": "A vision-guided robotic cleaner that triggers cleaning cycles "
                 "when soiling exceeds a learned threshold."},
]

PROJECTS = [
    {"title": "AI for NAAC-Aligned Outcome-Based Assessment",
     "funding_agency": "AICTE RPS", "grant_amount": 1850000, "duration_months": 24,
     "start_date": "2025-04-01", "status": "ONGOING",
     "description": "Develops an OBE assessment platform mapping COs to POs "
                    "with AI-driven question-paper validation."},
    {"title": "Solar-First Microgrid Optimisation for Tier-2 Campuses",
     "funding_agency": "DST-SERB", "grant_amount": 2400000, "duration_months": 36,
     "start_date": "2024-08-15", "status": "ONGOING",
     "description": "Develops microgrid control software optimised for variable "
                    "solar generation."},
]

GRANTS = [
    {"title": "AICTE RPS 2026 — Engineering Innovation",
     "funding_agency": "AICTE",
     "description": "Research promotion scheme funding undergraduate-led innovation projects.",
     "eligibility_criteria": "All NBA-accredited engineering institutions.",
     "max_grant_amount": 2500000, "deadline_offset_days": 45,
     "domain_tags": ["AI", "IoT", "Renewable Energy"],
     "url": "https://www.aicte-india.org/schemes/rps"},
    {"title": "DST FIST Programme 2026",
     "funding_agency": "DST",
     "description": "Departmental infrastructure support for science and engineering.",
     "eligibility_criteria": "Recognised university departments.",
     "max_grant_amount": 12000000, "deadline_offset_days": 75,
     "domain_tags": ["Infrastructure", "Equipment"],
     "url": "https://dst.gov.in/scientific-programmes/st-and-s/fist"},
    {"title": "Anusandhan National Research Fellowship",
     "funding_agency": "ANRF",
     "description": "Senior research fellowships for early-career faculty.",
     "eligibility_criteria": "Faculty with ≤7 years experience.",
     "max_grant_amount": 1200000, "deadline_offset_days": 25,
     "domain_tags": ["ECR", "Multidisciplinary"],
     "url": "https://anrf.res.in/programmes/fellowship"},
]


async def seed_claros_research(db, logger):
    counts = {"publications": 0, "patents": 0, "projects": 0, "grants": 0}
    now = datetime.now(timezone.utc)
    for iid in [VCE_ID, ISB_ID]:
        faculty = await db.faculty_profiles.find_one(
            {"tenant_id": iid}, {"_id": 0, "id": 1})
        if not faculty:
            continue
        fid = faculty["id"]
        for i, p in enumerate(PUBLICATIONS):
            pid = _det("pub", iid, p["title"])
            await db.research_publications.update_one(
                {"id": pid},
                {"$setOnInsert": {
                    "id": pid, "tenant_id": iid, "faculty_id": fid,
                    **p, "authors": ["Dr. Suresh K"],
                    "url": "", "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["publications"] += 1
        for p in PATENTS:
            pid = _det("patent", iid, p["title"])
            await db.patents.update_one(
                {"id": pid},
                {"$setOnInsert": {
                    "id": pid, "tenant_id": iid, "faculty_id": fid,
                    **p, "grant_date": None, "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["patents"] += 1
        for p in PROJECTS:
            pid = _det("project", iid, p["title"])
            await db.research_projects.update_one(
                {"id": pid},
                {"$setOnInsert": {
                    "id": pid, "tenant_id": iid,
                    "principal_investigator": fid, "co_investigators": [],
                    **p, "end_date": None, "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["projects"] += 1
        for g in GRANTS:
            gid = _det("grant", iid, g["title"])
            deadline = (now + timedelta(days=g["deadline_offset_days"])).strftime("%Y-%m-%d")
            data = {k: v for k, v in g.items() if k != "deadline_offset_days"}
            await db.grant_opportunities.update_one(
                {"id": gid},
                {"$setOnInsert": {
                    "id": gid, "tenant_id": iid, **data,
                    "deadline": deadline, "is_active": True,
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["grants"] += 1
    logger.info("Claros Research seeded · %s", counts)
