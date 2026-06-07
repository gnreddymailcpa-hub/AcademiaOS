"""Claros Green — energy + sustainability metrics + AI report."""
from __future__ import annotations
import logging, uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.green")

ADMIN_ROLES = {"super_admin", "institution_admin"}
ENERGY_SOURCES = {"MAIN", "SOLAR", "GENERATOR"}
METRIC_CATEGORIES = {"ENERGY", "WATER", "WASTE", "CARBON"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


class ReadingBody(BaseModel):
    meter_name: str
    building: str = ""
    reading_kwh: float
    reading_datetime: Optional[str] = None
    source: str = "MAIN"


class MetricBody(BaseModel):
    metric_name: str
    category: str
    value: float
    unit: str = ""
    recorded_date: str
    notes: str = ""


def build_claros_green_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/green", tags=["claros-green"])

    @r.get("/energy/current")
    async def current_energy(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        # latest reading per meter
        meters = await db.energy_readings.distinct("meter_name", {"tenant_id": iid})
        out = []
        for m in meters:
            latest = await db.energy_readings.find_one(
                {"tenant_id": iid, "meter_name": m},
                {"_id": 0}, sort=[("reading_datetime", -1)])
            if latest:
                out.append(latest)
        return out

    @r.get("/energy/trends")
    async def energy_trends(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        now = datetime.now(timezone.utc)
        rows = []
        for i in range(29, -1, -1):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            day_rows = await db.energy_readings.find(
                {"tenant_id": iid, "reading_datetime": {"$regex": f"^{day}"}},
                {"_id": 0}).to_list(500)
            main = sum(float(x.get("reading_kwh") or 0) for x in day_rows
                       if (x.get("source") or "MAIN") == "MAIN")
            solar = sum(float(x.get("reading_kwh") or 0) for x in day_rows
                        if (x.get("source") or "") == "SOLAR")
            gen = sum(float(x.get("reading_kwh") or 0) for x in day_rows
                      if (x.get("source") or "") == "GENERATOR")
            rows.append({"date": day, "main_kwh": round(main, 2),
                         "solar_kwh": round(solar, 2),
                         "generator_kwh": round(gen, 2),
                         "total_kwh": round(main + solar + gen, 2)})
        return rows

    @r.post("/energy/reading")
    async def add_reading(body: ReadingBody,
                           user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES and user["role"] not in {"hod", "dean", "security"}:
            raise HTTPException(403, "Admin/HOD/Dean only")
        if body.source not in ENERGY_SOURCES:
            raise HTTPException(400, f"source must be one of {sorted(ENERGY_SOURCES)}")
        db = get_db()
        iid = _tenant_of(user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "meter_name": body.meter_name, "building": body.building,
            "reading_kwh": float(body.reading_kwh),
            "reading_datetime": body.reading_datetime or _now(),
            "source": body.source, "created_by": user["id"],
            "created_at": _now(),
        }
        await db.energy_readings.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/metrics")
    async def list_metrics(category: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid}
        if category:
            flt["category"] = category
        return await db.sustainability_metrics.find(flt, {"_id": 0}).sort(
            "recorded_date", -1).limit(500).to_list(500)

    @r.post("/metrics")
    async def add_metric(body: MetricBody,
                          user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES and user["role"] not in {"hod", "dean"}:
            raise HTTPException(403, "Admin/HOD/Dean only")
        if body.category not in METRIC_CATEGORIES:
            raise HTTPException(400, f"category must be one of {sorted(METRIC_CATEGORIES)}")
        db = get_db()
        iid = _tenant_of(user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "metric_name": body.metric_name, "category": body.category,
            "value": float(body.value), "unit": body.unit,
            "recorded_date": body.recorded_date, "notes": body.notes,
            "created_by": user["id"], "created_at": _now(),
        }
        await db.sustainability_metrics.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/stats")
    async def stats(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        # this month
        rows = await db.energy_readings.find(
            {"tenant_id": iid, "reading_datetime": {"$gte": month_start}},
            {"_id": 0}).to_list(5000)
        total = sum(float(x.get("reading_kwh") or 0) for x in rows)
        solar = sum(float(x.get("reading_kwh") or 0) for x in rows
                    if (x.get("source") or "") == "SOLAR")
        solar_pct = round((solar / total) * 100, 1) if total else 0.0
        # carbon estimate: 0.82 kg CO2 per kWh of grid (India avg)
        grid_kwh = total - solar
        carbon_tonnes = round((max(grid_kwh, 0) * 0.82) / 1000, 2)
        # last month for delta
        if now.month == 1:
            last_month_start = now.replace(year=now.year - 1, month=12, day=1)
        else:
            last_month_start = now.replace(month=now.month - 1, day=1)
        last_month_end = now.replace(day=1) - timedelta(seconds=1)
        last_rows = await db.energy_readings.find(
            {"tenant_id": iid,
             "reading_datetime": {
                 "$gte": last_month_start.strftime("%Y-%m-%d"),
                 "$lte": last_month_end.strftime("%Y-%m-%d") + " 23:59:59",
             }},
            {"_id": 0}).to_list(5000)
        last_total = sum(float(x.get("reading_kwh") or 0) for x in last_rows)
        vs_last = round(((total - last_total) / last_total) * 100, 1) if last_total else 0.0
        return {
            "monthly_kwh": round(total, 2),
            "solar_pct": solar_pct,
            "carbon_tonnes_est": carbon_tonnes,
            "vs_last_month_pct": vs_last,
        }

    @r.post("/report/generate")
    async def generate_report(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        inst = await db.institutions.find_one({"id": iid}, {"_id": 0, "name": 1})
        tenant_name = (inst or {}).get("name") or "the Institution"
        # Pull live stats
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        rows = await db.energy_readings.find(
            {"tenant_id": iid, "reading_datetime": {"$gte": month_start}},
            {"_id": 0}).to_list(5000)
        kwh_total = round(sum(float(x.get("reading_kwh") or 0) for x in rows), 2)
        solar = sum(float(x.get("reading_kwh") or 0) for x in rows
                    if (x.get("source") or "") == "SOLAR")
        solar_pct = round((solar / kwh_total) * 100, 1) if kwh_total else 0.0
        metrics = await db.sustainability_metrics.find(
            {"tenant_id": iid}, {"_id": 0}).sort("recorded_date", -1).limit(20).to_list(20)
        metrics_list = "; ".join(f"{m['metric_name']}: {m['value']} {m.get('unit', '')}"
                                  for m in metrics) or "no auxiliary metrics yet"
        prompt = (
            f"Generate a monthly sustainability report for {tenant_name}.\n"
            f"Energy data: {kwh_total} kWh consumed, {solar_pct}% from solar.\n"
            f"Other metrics: {metrics_list}.\n"
            "Include: (1) Energy consumption summary, (2) Renewable energy highlight, "
            "(3) Carbon footprint estimate, (4) 3 recommendations to improve.\n"
            "Max 300 words. Formal but positive tone."
        )
        try:
            content = await generate_text(
                system_message="You are a sustainability analyst writing formal yet "
                               "uplifting monthly reports.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"green-report-{iid}-{now.year}-{now.month}",
                max_tokens=800,
            )
        except Exception as e:
            logger.warning("Green report LLM failed: %s", e)
            content = (
                f"# Sustainability Report — {tenant_name}\n"
                f"## Period: {now.strftime('%B %Y')}\n\n"
                f"### Energy Consumption\nTotal {kwh_total} kWh used this month, "
                f"with {solar_pct}% sourced from on-campus solar.\n\n"
                "### Renewable Energy\nSolar generation supplements grid usage, "
                "directly reducing scope-2 emissions.\n\n"
                "### Carbon Footprint\nEstimated ~"
                f"{round((kwh_total * (1 - solar_pct/100) * 0.82)/1000, 2)} tCO₂e "
                "this month from grid electricity.\n\n"
                "### Recommendations\n"
                "- Shift HVAC schedules to align with solar peak hours.\n"
                "- Pilot LED retrofit in remaining lecture halls.\n"
                "- Begin sub-metering for top-3 buildings to surface anomalies.\n"
            )
        return {"content": content, "period": now.strftime("%B %Y"),
                "kwh_total": kwh_total, "solar_pct": solar_pct}

    return r
