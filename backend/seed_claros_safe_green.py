"""Claros Safe + Green — combined seed for visitors, incidents, energy, metrics."""
from datetime import datetime, timezone, timedelta
import hashlib
import random
import secrets

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _det(*parts):
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso():
    return datetime.now(timezone.utc).isoformat()


VISITORS = [
    {"visitor_name": "S. Padmanabhan", "phone": "+91-98765 11220",
     "purpose": "NAAC peer team visit", "status": "EXPECTED"},
    {"visitor_name": "Dr. Anjali Mehta", "phone": "+91-90123 44455",
     "purpose": "Guest lecture — Cybersecurity", "status": "CHECKED_IN"},
    {"visitor_name": "Ravi Verma (Vendor)", "phone": "+91-87654 33221",
     "purpose": "UPS battery servicing", "status": "CHECKED_OUT"},
]

INCIDENTS = [
    {"incident_type": "UNAUTHORIZED_ACCESS", "severity": "MEDIUM",
     "description": "Unbadged person spotted in CSE-Block 3rd floor at 21:15. "
                    "Security escorted them out.",
     "location": "CSE-Block, 3F", "status": "RESOLVED",
     "resolution_notes": "Person was a delivery courier; access badge issued."},
    {"incident_type": "DAMAGE", "severity": "LOW",
     "description": "Glass panel cracked in seminar hall — possibly accidental.",
     "location": "Seminar Hall A", "status": "INVESTIGATING"},
    {"incident_type": "INJURY", "severity": "HIGH",
     "description": "Student slipped on staircase during rain — first aid given, "
                    "advised hospital follow-up.",
     "location": "Main Block staircase", "status": "OPEN"},
]


async def seed_claros_safe_and_green(db, logger):
    counts = {"visitors": 0, "incidents": 0, "energy_readings": 0, "metrics": 0}
    now = datetime.now(timezone.utc)
    rng = random.Random(42)

    for iid in [VCE_ID, ISB_ID]:
        host_user = await db.users.find_one(
            {"institution_id": iid, "role": "institution_admin"},
            {"_id": 0, "id": 1})
        host_id = host_user["id"] if host_user else "system"

        # SAFE — visitors today
        today = now.strftime("%Y-%m-%d")
        for i, v in enumerate(VISITORS):
            vid = _det("visitor", iid, v["visitor_name"], today)
            doc = {
                "id": vid, "tenant_id": iid,
                "visitor_name": v["visitor_name"], "phone": v["phone"],
                "purpose": v["purpose"], "host_user_id": host_id,
                "visit_date": today,
                "id_type": "Aadhaar", "id_number": "XXXX-XXXX-" + str(1000 + i),
                "visitor_pass_code": secrets.token_hex(3).upper(),
                "status": v["status"],
                "check_in_time": _iso() if v["status"] in ("CHECKED_IN", "CHECKED_OUT") else None,
                "check_out_time": _iso() if v["status"] == "CHECKED_OUT" else None,
                "created_by": host_id, "created_at": _iso(),
            }
            await db.visitors.update_one(
                {"id": vid}, {"$setOnInsert": doc}, upsert=True,
            )
            counts["visitors"] += 1

        # SAFE — incidents
        for i, inc in enumerate(INCIDENTS):
            iid_id = _det("incident", iid, inc["description"][:30])
            offset = (i + 1) * 36
            await db.incidents.update_one(
                {"id": iid_id},
                {"$setOnInsert": {
                    "id": iid_id, "tenant_id": iid,
                    "reported_by": host_id,
                    "incident_type": inc["incident_type"],
                    "description": inc["description"],
                    "location": inc["location"],
                    "incident_datetime": (now - timedelta(hours=offset)).isoformat(),
                    "severity": inc["severity"],
                    "status": inc["status"],
                    "attachments": [],
                    "resolved_at": _iso() if inc["status"] == "RESOLVED" else None,
                    "resolution_notes": inc.get("resolution_notes"),
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["incidents"] += 1

        # GREEN — 30 days of energy readings (MAIN + SOLAR)
        for d in range(30):
            day = (now - timedelta(days=d)).strftime("%Y-%m-%d")
            for meter, src, base in (
                ("Main-Block", "MAIN", 380),
                ("Solar-Roof", "SOLAR", 95),
            ):
                rid = _det("energy", iid, meter, day)
                kwh = base + rng.uniform(-30, 30)
                # Solar reduced on weekends, never <40
                if src == "SOLAR":
                    kwh = max(40.0, kwh + rng.uniform(-20, 30))
                await db.energy_readings.update_one(
                    {"id": rid},
                    {"$setOnInsert": {
                        "id": rid, "tenant_id": iid,
                        "meter_name": meter, "building": meter.split("-")[0],
                        "reading_kwh": round(kwh, 2),
                        "reading_datetime": (now - timedelta(days=d)).replace(hour=22, minute=0).isoformat(),
                        "source": src, "created_by": host_id,
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )
                counts["energy_readings"] += 1

        # GREEN — sustainability metrics (water, waste, carbon)
        for m in [
            {"metric_name": "Water consumption", "category": "WATER",
             "value": 124000, "unit": "litres"},
            {"metric_name": "Waste segregated", "category": "WASTE",
             "value": 78, "unit": "%"},
            {"metric_name": "Carbon offset via solar", "category": "CARBON",
             "value": 2.3, "unit": "tCO2e"},
        ]:
            mid = _det("metric", iid, m["metric_name"], today)
            await db.sustainability_metrics.update_one(
                {"id": mid},
                {"$setOnInsert": {
                    "id": mid, "tenant_id": iid,
                    **m, "recorded_date": today, "notes": "",
                    "created_by": host_id, "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["metrics"] += 1

    logger.info("Claros Safe+Green seeded · %s", counts)
