"""Claros People — idempotent seed of training records + API scores."""
from datetime import datetime, timezone, timedelta
import hashlib

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _det(*parts):
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso():
    return datetime.now(timezone.utc).isoformat()


TRAINING_RECORDS = [
    {"training_type": "FDP", "title": "Outcome-Based Education Workshop",
     "organiser": "AICTE", "duration_days": 5, "platform": "AICTE"},
    {"training_type": "ONLINE_COURSE",
     "title": "NPTEL: Research Methodology and Publication Ethics",
     "organiser": "NPTEL/IIT Madras", "duration_days": 28, "platform": "NPTEL"},
    {"training_type": "WORKSHOP",
     "title": "Cybersecurity for Faculty",
     "organiser": "MeitY", "duration_days": 3, "platform": "Offline"},
]


async def seed_claros_people(db, logger):
    counts = {"training": 0, "api_scores": 0}
    now = datetime.now(timezone.utc)
    for iid in [VCE_ID, ISB_ID]:
        faculty_list = await db.faculty_profiles.find(
            {"tenant_id": iid}, {"_id": 0, "id": 1}).limit(20).to_list(20)
        if not faculty_list:
            continue
        for f in faculty_list[:5]:
            for i, t in enumerate(TRAINING_RECORDS):
                tid = _det("training", iid, f["id"], t["title"])
                completion = (now - timedelta(days=30 * (i + 1))).strftime("%Y-%m-%d")
                await db.training_records.update_one(
                    {"id": tid},
                    {"$setOnInsert": {
                        "id": tid, "tenant_id": iid, "faculty_id": f["id"],
                        **t, "completion_date": completion,
                        "certificate_url": "",
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )
                counts["training"] += 1
            # Seed an API score with placeholder values so the dashboard never blanks
            sid = _det("api", iid, f["id"], "current")
            ay = f"{now.year - 1}-{str(now.year)[-2:]}"
            await db.api_scores.update_one(
                {"id": sid},
                {"$setOnInsert": {
                    "id": sid, "tenant_id": iid, "faculty_id": f["id"],
                    "academic_year": ay,
                    "teaching_score": 40.0, "research_score": 35.0,
                    "service_score": 25.0, "total_api": 100.0,
                    "computed_at": _iso(),
                }},
                upsert=True,
            )
            counts["api_scores"] += 1
    logger.info("Claros People seeded · %s", counts)
