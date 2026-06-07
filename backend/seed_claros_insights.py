"""Claros Insights — idempotent seed: 3 alert rules + 1 triggered event + 1 sample report per active tenant."""
from datetime import datetime, timezone
import hashlib


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


ALERT_RULES = [
    {"rule_name": "Low Attendance Watch",
     "metric_key": "avg_attendance_pct",
     "threshold": 75.0, "comparison": "LT", "severity": "WARNING"},
    {"rule_name": "Placement Rate Below Target",
     "metric_key": "placement_rate",
     "threshold": 80.0, "comparison": "LT", "severity": "CRITICAL"},
    {"rule_name": "NAAC Readiness Slip",
     "metric_key": "naac_readiness_pct",
     "threshold": 70.0, "comparison": "LT", "severity": "WARNING"},
]


def _det_uuid(*parts: str) -> str:
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_claros_insights(db, logger):
    counts = {"rules": 0, "events": 0, "reports": 0}
    for iid in [VCE_ID, ISB_ID]:
        admin = await db.users.find_one(
            {"institution_id": iid, "role": "institution_admin"},
            {"_id": 0, "id": 1, "email": 1},
        )
        admin_id = admin["id"] if admin else "system"
        inst = await db.institutions.find_one({"id": iid}, {"_id": 0, "name": 1})
        tenant_name = (inst or {}).get("name") or "Institution"

        rule_ids: dict = {}
        for r in ALERT_RULES:
            rid = _det_uuid("alert-rule", iid, r["metric_key"])
            await db.alert_rules.update_one(
                {"id": rid},
                {"$setOnInsert": {
                    "id": rid, "tenant_id": iid,
                    "rule_name": r["rule_name"],
                    "metric_key": r["metric_key"],
                    "threshold": r["threshold"],
                    "comparison": r["comparison"],
                    "severity": r["severity"],
                    "is_active": True,
                    "created_by": admin_id,
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            rule_ids[r["metric_key"]] = rid
            counts["rules"] += 1

        # 1 triggered alert — attendance at 72% on the low-attendance rule
        ev_rule_id = rule_ids.get("avg_attendance_pct")
        if ev_rule_id:
            eid = _det_uuid("alert-event", iid, ev_rule_id, "demo")
            await db.alert_events.update_one(
                {"id": eid},
                {"$setOnInsert": {
                    "id": eid, "tenant_id": iid, "rule_id": ev_rule_id,
                    "triggered_at": _iso(),
                    "metric_value": 72.0,
                    "resolved_at": None,
                    "message": "avg_attendance_pct=72.0 LT 75.0 — student cohort tracking below threshold",
                }},
                upsert=True,
            )
            counts["events"] += 1

        # 1 sample generated report (current month)
        now = datetime.now(timezone.utc)
        period_label = now.strftime("%B %Y")
        rep_id = _det_uuid("insights-report", iid, str(now.year), str(now.month))
        sample = (
            f"# Monthly Performance Report — {tenant_name}\n"
            f"## Period: {period_label}\n\n"
            "### 1. Executive Summary\n"
            "Institutional operations remain stable across academic, admissions and placement verticals. "
            "Attendance is the most pressing watch-point; placement velocity is healthy; "
            "NAAC evidence aggregation continues to progress.\n\n"
            "### 2. Academic Performance\nAttendance trend is steady; mid-semester pulse "
            "indicates mild dip in 2nd-year cohorts that warrants targeted outreach.\n\n"
            "### 3. Placement Highlights\nDrives concluded on schedule; package distribution "
            "shows healthy median improvement YoY. Tier-1 conversion remains a focus.\n\n"
            "### 4. Admissions\nLead funnel is converting predictably from APPLIED to ENROLLED "
            "with no anomaly in source distribution.\n\n"
            "### 5. Compliance Status\nNAAC readiness is within target band; "
            "criterion-3 (Research) is the lagging cluster.\n\n"
            "### 6. Action Items\n"
            "- Run a defaulter-attendance reach-out within 2 weeks.\n"
            "- Prioritise Tier-1 recruiter scheduling for the next quarter.\n"
            "- Close 5 evidence gaps under NAAC Criterion 3 before AQAR cycle.\n"
        )
        await db.generated_reports.update_one(
            {"id": rep_id},
            {"$setOnInsert": {
                "id": rep_id, "tenant_id": iid,
                "report_type": "MONTHLY",
                "period_label": period_label,
                "month": now.month, "year": now.year,
                "content": sample,
                "generated_by": admin_id,
                "created_at": _iso(),
            }},
            upsert=True,
        )
        counts["reports"] += 1
    logger.info("Claros Insights seeded · %s", counts)
