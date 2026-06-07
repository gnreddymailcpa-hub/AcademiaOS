"""
Claros Insights — Executive Analytics Command Center.

Reads from all Claros modules (Core, Enroll, Comply, Launch, AI) to produce
KPIs, trend curves, NAAC readiness snapshots, alerts and AI-generated
board reports.

All endpoints under /api/v1/insights/* require ADMIN_ROLES (super_admin,
institution_admin — which is the platform's representation of the Principal /
Executive role).
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import calendar
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.insights")

# institution_admin == Principal in this platform's role taxonomy
ADMIN_ROLES = {"super_admin", "institution_admin"}
SEVERITIES = {"INFO", "WARNING", "CRITICAL"}
COMPARISONS = {"LT", "GT", "EQ", "LTE", "GTE"}
REPORT_TYPES = {"MONTHLY", "QUARTERLY"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_iid(user: dict, requested_iid: Optional[str]) -> str:
    if user["role"] == "super_admin":
        # Super admin must specify iid — but fall back to institution_id on the
        # token if present (set by the tenant switcher in the UI).
        target = requested_iid or user.get("institution_id")
        if not target:
            raise HTTPException(400, "super_admin must specify iid query param")
        return target
    own = user.get("institution_id")
    if not own:
        raise HTTPException(403, "User has no institution_id")
    if requested_iid and requested_iid != own:
        raise HTTPException(403, "Cross-tenant access denied")
    return own


def _require_admin(user: dict):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Admin/Principal access only")


def _month_label(d: datetime) -> str:
    return d.strftime("%b %Y")


def _compare(value: float, threshold: float, comparison: str) -> bool:
    if comparison == "LT":
        return value < threshold
    if comparison == "LTE":
        return value <= threshold
    if comparison == "GT":
        return value > threshold
    if comparison == "GTE":
        return value >= threshold
    if comparison == "EQ":
        return abs(value - threshold) < 1e-6
    return False


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class AlertRuleBody(BaseModel):
    rule_name: str = Field(min_length=1, max_length=200)
    metric_key: str = Field(min_length=1, max_length=100)
    threshold: float
    comparison: str = "LT"
    severity: str = "WARNING"
    is_active: bool = True


class GenerateReportBody(BaseModel):
    report_type: str = "MONTHLY"
    month: Optional[int] = None
    year: Optional[int] = None


# ---------------------------------------------------------------------------
# Core KPI helpers (live DB reads — NO hardcoded values)
# ---------------------------------------------------------------------------
async def _compute_overview(db, iid: str) -> dict:
    now = datetime.now(timezone.utc)
    today_iso = now.strftime("%Y-%m-%d")
    month_start_iso = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Students / faculty / departments
    total_students = await db.students.count_documents(
        {"tenant_id": iid, "status": {"$ne": "INACTIVE"}})
    # Faculty come from users with faculty-ish roles
    total_faculty = await db.users.count_documents({
        "institution_id": iid,
        "role": {"$in": ["faculty", "instructor", "hod", "dean", "professor"]},
    })
    departments = await db.departments.count_documents({"institution_id": iid})

    # Attendance % — rolling 12 months (aligned with the trend chart so the
    # KPI never diverges from the curve)
    twelve_mo_start = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    att_total = await db.attendance_records.count_documents(
        {"tenant_id": iid, "class_date": {"$gte": twelve_mo_start}})
    att_present = await db.attendance_records.count_documents(
        {"tenant_id": iid, "class_date": {"$gte": twelve_mo_start},
         "status": {"$in": ["PRESENT", "LATE"]}})
    avg_attendance_pct = round((att_present / att_total) * 100, 1) if att_total else 0.0

    # Fee collection % — sum of fee_payments vs sum of due (fee_components × students)
    pays = await db.fee_payments.find(
        {"tenant_id": iid}, {"_id": 0, "amount_paid": 1}).to_list(20000)
    total_paid = sum(float(p.get("amount_paid") or 0) for p in pays)
    comps = await db.fee_components.find(
        {"tenant_id": iid}, {"_id": 0, "amount": 1, "program_id": 1}).to_list(2000)
    # Estimate total due: sum amount per program × students per program (live counts)
    prog_student_counts: dict = {}
    if comps:
        async for st in db.students.find({"tenant_id": iid, "status": "ACTIVE"},
                                           {"_id": 0, "program_id": 1}):
            pid = st.get("program_id")
            if pid:
                prog_student_counts[pid] = prog_student_counts.get(pid, 0) + 1
    total_due = sum(float(c.get("amount") or 0) * prog_student_counts.get(c.get("program_id"), 0)
                    for c in comps)
    fee_collection_pct = round((total_paid / total_due) * 100, 1) if total_due else 0.0

    # Placement KPIs
    placed_count = await db.placements.count_documents({"tenant_id": iid})
    final_yr_students = await db.students.count_documents(
        {"tenant_id": iid, "status": "ACTIVE"})
    placement_rate = round((placed_count / final_yr_students) * 100, 1) if final_yr_students else 0.0
    pls = await db.placements.find({"tenant_id": iid}, {"_id": 0, "package_offered": 1}).to_list(5000)
    avg_package = round(sum(float(p.get("package_offered") or 0) for p in pls) / len(pls), 2) if pls else 0.0

    # NAAC readiness
    readiness_rows = await db.accreditation_readiness.find(
        {"tenant_id": iid}, {"_id": 0, "computed_score": 1, "max_score": 1}
    ).to_list(20)
    if readiness_rows:
        cur = sum(float(r.get("computed_score") or 0) for r in readiness_rows)
        mx = sum(float(r.get("max_score") or 0) for r in readiness_rows)
        naac_readiness_pct = round((cur / mx) * 100, 1) if mx else 0.0
    else:
        naac_readiness_pct = 0.0

    # Leads
    active_leads = await db.leads.count_documents({
        "tenant_id": iid,
        "status": {"$in": ["NEW", "CONTACTED", "COUNSELED", "APPLIED", "OFFERED"]},
    })

    # AI sessions today (kind=any)
    ai_sessions_today = await db.ai_sessions.count_documents({
        "institution_id": iid,
        "created_at": {"$regex": f"^{today_iso}"},
    })

    # Enrolled this month (leads moved to ENROLLED)
    enrolled_this_month = await db.leads.count_documents({
        "tenant_id": iid, "status": "ENROLLED",
        "updated_at": {"$gte": month_start_iso},
    })

    return {
        "total_students": total_students,
        "total_faculty": total_faculty,
        "departments": departments,
        "avg_attendance_pct": avg_attendance_pct,
        "fee_collection_pct": fee_collection_pct,
        "placed_count": placed_count,
        "placement_rate": placement_rate,
        "avg_package": avg_package,
        "naac_readiness_pct": naac_readiness_pct,
        "active_leads": active_leads,
        "ai_sessions_today": ai_sessions_today,
        "enrolled_this_month": enrolled_this_month,
    }


async def _trend_attendance(db, iid: str) -> List[dict]:
    """12-month attendance percent rolling window."""
    now = datetime.now(timezone.utc)
    out = []
    for i in range(11, -1, -1):
        first = (now.replace(day=1) - timedelta(days=30 * i))
        # Snap to first of month
        first = first.replace(day=1)
        last_day = calendar.monthrange(first.year, first.month)[1]
        start_d = first.strftime("%Y-%m-%d")
        end_d = first.replace(day=last_day).strftime("%Y-%m-%d")
        flt = {"tenant_id": iid, "class_date": {"$gte": start_d, "$lte": end_d}}
        total = await db.attendance_records.count_documents(flt)
        present = await db.attendance_records.count_documents(
            {**flt, "status": {"$in": ["PRESENT", "LATE"]}})
        pct = round((present / total) * 100, 1) if total else 0.0
        out.append({"month": _month_label(first), "avg_pct": pct, "sessions": total})
    return out


async def _trend_placements(db, iid: str) -> List[dict]:
    """4-year placement bar — by academic year derived from offer_date."""
    pls = await db.placements.find(
        {"tenant_id": iid}, {"_id": 0, "offer_date": 1, "package_offered": 1}
    ).to_list(20000)
    by_year: dict = {}
    for p in pls:
        od = p.get("offer_date") or ""
        try:
            y = int(od[:4])
        except (ValueError, TypeError):
            continue
        # academic year label: e.g. 2025 -> "2024-25"
        ay = f"{y - 1}-{str(y)[-2:]}"
        bucket = by_year.setdefault(ay, {"placed": 0, "sum_pkg": 0.0})
        bucket["placed"] += 1
        bucket["sum_pkg"] += float(p.get("package_offered") or 0)
    # Last 4 academic years ending with current calendar year
    current_year = datetime.now(timezone.utc).year
    labels = [f"{current_year - 1 - i}-{str(current_year - i)[-2:]}" for i in range(3, -1, -1)]
    rows = []
    for lab in labels:
        b = by_year.get(lab, {"placed": 0, "sum_pkg": 0.0})
        avg = round(b["sum_pkg"] / b["placed"], 2) if b["placed"] else 0.0
        rows.append({"year": lab, "placed": b["placed"], "avg_pkg": avg})
    return rows


async def _trend_enrollment(db, iid: str) -> List[dict]:
    """12-month enrollment funnel — leads_created vs converted (ENROLLED)."""
    now = datetime.now(timezone.utc)
    out = []
    for i in range(11, -1, -1):
        first = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        last_day = calendar.monthrange(first.year, first.month)[1]
        start = first.isoformat()
        end = first.replace(day=last_day, hour=23, minute=59, second=59).isoformat()
        leads_created = await db.leads.count_documents({
            "tenant_id": iid, "created_at": {"$gte": start, "$lte": end}})
        converted = await db.leads.count_documents({
            "tenant_id": iid, "status": "ENROLLED",
            "created_at": {"$gte": start, "$lte": end}})
        out.append({"month": _month_label(first), "leads_created": leads_created, "converted": converted})
    return out


async def _fees_breakdown(db, iid: str) -> List[dict]:
    """Per-program fee collection percentage."""
    progs = await db.programs.find({"tenant_id": iid}, {"_id": 0}).to_list(100)
    out = []
    for p in progs:
        comps = await db.fee_components.find(
            {"tenant_id": iid, "program_id": p["id"]}, {"_id": 0, "amount": 1}).to_list(50)
        per_student_due = sum(float(c.get("amount") or 0) for c in comps)
        student_ids = [s["id"] async for s in db.students.find(
            {"tenant_id": iid, "program_id": p["id"], "status": "ACTIVE"}, {"_id": 0, "id": 1})]
        total_due = per_student_due * len(student_ids)
        pays = await db.fee_payments.find(
            {"tenant_id": iid, "student_id": {"$in": student_ids}},
            {"_id": 0, "amount_paid": 1}).to_list(20000) if student_ids else []
        total_paid = sum(float(x.get("amount_paid") or 0) for x in pays)
        pct = round((total_paid / total_due) * 100, 1) if total_due else 0.0
        out.append({
            "program_name": p.get("name") or p.get("code") or "Programme",
            "total_due": round(total_due, 2),
            "total_collected": round(total_paid, 2),
            "pct": pct,
        })
    out.sort(key=lambda r: -r["pct"])
    return out


async def _naac_summary(db, iid: str) -> List[dict]:
    """Use Claros Comply data — NAAC criteria readiness + evidence count."""
    criteria = await db.naac_criteria.find({}, {"_id": 0}).sort("code", 1).to_list(20)
    out = []
    for c in criteria:
        metrics = await db.naac_metrics.find(
            {"tenant_id": iid, "criterion_id": c["id"]}, {"_id": 0}).to_list(100)
        if metrics:
            ratios = []
            for m in metrics:
                tgt = float(m.get("target_value") or 0)
                cur = float(m.get("current_value") or 0)
                if tgt > 0:
                    ratios.append(min(1.0, cur / tgt))
            pct = round((sum(ratios) / len(ratios)) * 100, 1) if ratios else 0.0
        else:
            pct = 0.0
        evidence_count = await db.evidence_documents.count_documents(
            {"tenant_id": iid, "criterion_id": c["id"]})
        out.append({
            "criterion_code": f"C{c['code']}",
            "name": c["name"],
            "pct": pct,
            "evidence_count": evidence_count,
        })
    return out


async def _ai_usage(db, iid: str) -> List[dict]:
    """30-day AI session usage."""
    now = datetime.now(timezone.utc)
    out = []
    for i in range(29, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        sessions = await db.ai_sessions.find(
            {"institution_id": iid, "created_at": {"$regex": f"^{d}"}},
            {"_id": 0, "user_id": 1}).to_list(5000)
        unique = len({s.get("user_id") for s in sessions if s.get("user_id")})
        out.append({"date": d, "query_count": len(sessions), "unique_users": unique})
    return out


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
def build_claros_insights_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/v1/insights", tags=["claros-insights"])

    # ------------------------------------------------------------- OVERVIEW
    @router.get("/overview")
    async def overview(iid: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _compute_overview(db, iid)

    # ------------------------------------------------------------- TRENDS
    @router.get("/trends/attendance")
    async def trends_attendance(iid: Optional[str] = None,
                                 user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _trend_attendance(db, iid)

    @router.get("/trends/placements")
    async def trends_placements(iid: Optional[str] = None,
                                 user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _trend_placements(db, iid)

    @router.get("/trends/enrollment")
    async def trends_enrollment(iid: Optional[str] = None,
                                 user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _trend_enrollment(db, iid)

    @router.get("/fees/breakdown")
    async def fees_breakdown(iid: Optional[str] = None,
                              user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _fees_breakdown(db, iid)

    @router.get("/naac/summary")
    async def naac_summary(iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _naac_summary(db, iid)

    @router.get("/ai/usage")
    async def ai_usage(iid: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        return await _ai_usage(db, iid)

    # ------------------------------------------------------------- ALERTS
    @router.get("/alerts")
    async def list_alerts(iid: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        rules = await db.alert_rules.find({"tenant_id": iid}, {"_id": 0}).to_list(200)
        rule_map = {r["id"]: r for r in rules}
        events = await db.alert_events.find(
            {"tenant_id": iid, "resolved_at": None},
            {"_id": 0}).sort("triggered_at", -1).to_list(200)
        for e in events:
            r = rule_map.get(e.get("rule_id"))
            if r:
                e["rule_name"] = r.get("rule_name")
                e["metric_key"] = r.get("metric_key")
                e["severity"] = r.get("severity")
                e["threshold"] = r.get("threshold")
        return {"items": events, "rules": rules}

    @router.post("/alerts/rules")
    async def create_rule(body: AlertRuleBody,
                           iid: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
        _require_admin(user)
        if body.comparison not in COMPARISONS:
            raise HTTPException(400, f"comparison must be one of {sorted(COMPARISONS)}")
        if body.severity not in SEVERITIES:
            raise HTTPException(400, f"severity must be one of {sorted(SEVERITIES)}")
        db = get_db()
        iid = _coerce_iid(user, iid)
        doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": iid,
            "rule_name": body.rule_name.strip(),
            "metric_key": body.metric_key.strip(),
            "threshold": float(body.threshold),
            "comparison": body.comparison,
            "severity": body.severity,
            "is_active": body.is_active,
            "created_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.alert_rules.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.post("/alerts/evaluate")
    async def evaluate_rules(iid: Optional[str] = None,
                              user: dict = Depends(get_current_user)):
        """Run all active rules against current overview KPIs and create
        alert_events for any rule whose threshold is breached. Idempotent —
        re-running won't duplicate unresolved alerts for the same rule."""
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        ov = await _compute_overview(db, iid)
        rules = await db.alert_rules.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}).to_list(200)
        triggered = []
        for r in rules:
            value = float(ov.get(r["metric_key"], 0) or 0)
            if _compare(value, float(r["threshold"]), r["comparison"]):
                existing = await db.alert_events.find_one(
                    {"tenant_id": iid, "rule_id": r["id"], "resolved_at": None},
                    {"_id": 0})
                if existing:
                    continue
                ev = {
                    "id": str(uuid.uuid4()),
                    "tenant_id": iid, "rule_id": r["id"],
                    "triggered_at": _now_iso(),
                    "metric_value": value,
                    "resolved_at": None,
                    "message": f"{r['rule_name']} — {r['metric_key']}={value} {r['comparison']} {r['threshold']}",
                }
                await db.alert_events.insert_one(ev)
                ev.pop("_id", None)
                triggered.append(ev)
        return {"triggered": triggered, "rule_count": len(rules)}

    # ------------------------------------------------------------- REPORTS
    @router.post("/reports/generate")
    async def generate_report(body: GenerateReportBody,
                               iid: Optional[str] = None,
                               user: dict = Depends(get_current_user)):
        _require_admin(user)
        if body.report_type not in REPORT_TYPES:
            raise HTTPException(400, f"report_type must be one of {sorted(REPORT_TYPES)}")
        db = get_db()
        iid = _coerce_iid(user, iid)
        inst = await db.institutions.find_one({"id": iid}, {"_id": 0, "name": 1})
        tenant_name = (inst or {}).get("name") or "the Institution"

        now = datetime.now(timezone.utc)
        month = body.month or now.month
        year = body.year or now.year
        if body.report_type == "QUARTERLY":
            q = (month - 1) // 3 + 1
            period_label = f"Q{q} FY {year}"
        else:
            period_label = f"{calendar.month_name[month]} {year}"

        overview = await _compute_overview(db, iid)
        att_trend = await _trend_attendance(db, iid)
        place_trend = await _trend_placements(db, iid)
        enrol_trend = await _trend_enrollment(db, iid)
        naac = await _naac_summary(db, iid)

        # Top recruiter
        pls = await db.placements.find(
            {"tenant_id": iid}, {"_id": 0, "company_name": 1}).to_list(5000)
        by_co: dict = {}
        for p in pls:
            n = p.get("company_name") or "Unknown"
            by_co[n] = by_co.get(n, 0) + 1
        top_recruiter = max(by_co.items(), key=lambda x: x[1])[0] if by_co else "N/A"

        kpis = {
            "tenant_name": tenant_name,
            "overview": overview,
            "top_recruiter": top_recruiter,
            "attendance_last_12mo": att_trend,
            "placements_last_4yr": place_trend,
            "enrolment_last_12mo": enrol_trend,
            "naac": naac,
        }

        prompt = (
            f"Generate a formal {body.report_type.lower()} institutional "
            f"performance report for {tenant_name}.\nPeriod: {period_label}.\n"
            f"Data: {kpis}.\n\n"
            "Structure exactly six sections with headings:\n"
            "1. Executive Summary (3 sentences, mention 3 headline numbers)\n"
            "2. Academic Performance (attendance, CGPA trends)\n"
            "3. Placement Highlights (placed count, avg package, top recruiter)\n"
            "4. Admissions (leads, conversion, enrolled)\n"
            "5. Compliance Status (NAAC readiness %)\n"
            "6. Action Items Recommended (3 specific, data-driven)\n"
            "Use formal tone. Max 600 words."
        )

        try:
            content = await generate_text(
                system_message="You are an institutional research analyst preparing a "
                               "board-grade performance report. Use the supplied data; "
                               "do not invent numbers.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER,
                model=DEFAULT_MODEL,
                session_id=f"insights-{iid}-{year}-{month}",
                max_tokens=1400,
            )
        except Exception as e:
            logger.warning("Report LLM generation failed: %s", e)
            ov = overview
            content = (
                f"# {body.report_type.title()} Performance Report — {tenant_name}\n"
                f"## Period: {period_label}\n\n"
                f"### 1. Executive Summary\n"
                f"{tenant_name} recorded {ov['total_students']} active students with an "
                f"average attendance of {ov['avg_attendance_pct']}%. "
                f"Placement throughput stood at {ov['placed_count']} offers with an "
                f"average package of ₹{ov['avg_package']} LPA. NAAC readiness is "
                f"tracking at {ov['naac_readiness_pct']}%.\n\n"
                f"### 2. Academic Performance\nAttendance: {ov['avg_attendance_pct']}%.\n\n"
                f"### 3. Placement Highlights\n{ov['placed_count']} placements; "
                f"avg ₹{ov['avg_package']} LPA; top recruiter {top_recruiter}.\n\n"
                f"### 4. Admissions\nActive leads: {ov['active_leads']}; "
                f"enrolled this month: {ov['enrolled_this_month']}.\n\n"
                f"### 5. Compliance Status\nNAAC readiness: {ov['naac_readiness_pct']}%.\n\n"
                f"### 6. Action Items\n"
                f"- Lift attendance toward 80% via targeted defaulter outreach.\n"
                f"- Strengthen upper-quartile placements via Tier-1 driver weeks.\n"
                f"- Close NAAC evidence gaps in lagging criteria.\n"
            )

        rid = str(uuid.uuid4())
        rec = {
            "id": rid,
            "tenant_id": iid,
            "report_type": body.report_type,
            "period_label": period_label,
            "month": month, "year": year,
            "content": content,
            "generated_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.generated_reports.insert_one(rec)
        rec.pop("_id", None)
        return {"report_id": rid, "content": content, "period_label": period_label}

    @router.get("/reports")
    async def list_reports(iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        rows = await db.generated_reports.find(
            {"tenant_id": iid}, {"_id": 0}
        ).sort("created_at", -1).limit(40).to_list(40)
        return {"items": rows}

    @router.get("/reports/{report_id}")
    async def get_report(report_id: str, user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        rep = await db.generated_reports.find_one({"id": report_id}, {"_id": 0})
        if not rep:
            raise HTTPException(404, "Report not found")
        _coerce_iid(user, rep["tenant_id"])
        return rep

    # --------------------------------------------------------- VEDA KPI
    # Resolution rate for the multi-pass VEDA pipeline. Sample: last N days
    # of `veda_message_traces`. A message counts as "resolved" when
    # `escalated == False` (some pass within MAX_PASSES satisfied the
    # verifier). Target: 85%+.
    @router.get("/veda/resolution-rate")
    async def veda_resolution_rate(iid: Optional[str] = None,
                                    days: int = 30,
                                    user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _coerce_iid(user, iid)
        from datetime import datetime, timezone, timedelta
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        q = {"institution_id": iid, "ts": {"$gte": since}}
        total = await db.veda_message_traces.count_documents(q)
        if total == 0:
            return {
                "window_days": days, "total": 0, "resolved": 0, "escalated": 0,
                "resolution_rate_pct": 0.0, "target_pct": 85.0,
                "resolved_by_pass": {"1": 0, "2": 0, "3": 0},
                "avg_pass_count": 0.0,
            }
        escalated = await db.veda_message_traces.count_documents({**q, "escalated": True})
        resolved = total - escalated
        by_pass = {"1": 0, "2": 0, "3": 0}
        sum_pc = 0
        n_pc = 0
        async for row in db.veda_message_traces.find(q, {"_id": 0, "resolved_in_pass": 1, "pass_count": 1}):
            rp = row.get("resolved_in_pass")
            if isinstance(rp, int) and 1 <= rp <= 3:
                by_pass[str(rp)] += 1
            pc = row.get("pass_count")
            if isinstance(pc, int) and pc > 0:
                sum_pc += pc
                n_pc += 1
        avg_pc = round(sum_pc / n_pc, 2) if n_pc else 0.0
        return {
            "window_days": days,
            "total": total,
            "resolved": resolved,
            "escalated": escalated,
            "resolution_rate_pct": round(resolved * 100.0 / total, 1),
            "target_pct": 85.0,
            "resolved_by_pass": by_pass,
            "avg_pass_count": avg_pc,
        }

    return router
