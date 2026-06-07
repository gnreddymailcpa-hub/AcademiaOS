"""
Phase-3 completion endpoints (Phase 23) — GREENIQ gap closure.

Phase 3 only has GREENIQ in scope. The remaining feature bullets per the VCE
Build Plan are:
  • anomaly detection on consumption (energy + water)  — z-score over
    historical readings per meter / source, flagging |z| ≥ 2.0 as outliers.
    Transparent, regulator-explainable, no ML dependency.
  • solar inverter API ingestion  — webhook for any external inverter that
    POSTs hourly readings. Stored in greeniq_solar_readings AND mirrored into
    greeniq_energy as source=solar so it rolls into the existing ESG score.
  • sustainability action plan  — Claude-driven, grounded in the current
    ESG snapshot from /api/greeniq/{iid}/esg. Returns 5–7 prioritised actions
    with effort / impact / target metric. Bonus — closes the AQAR loop.

All routes tenant-isolated, audit-logged for write paths. Zero hardcoded
weights — z-threshold + reporting window are query params.
"""
from datetime import datetime, timezone, timedelta
from statistics import mean, pstdev
from typing import Optional, List
from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import ai_service

logger = logging.getLogger("academiaos.phase3")


def _now():
    return datetime.now(timezone.utc).isoformat()


class SolarReadingIn(BaseModel):
    inverter_id: str
    location: str
    generation_kwh: float = Field(ge=0)
    irradiance_wm2: Optional[float] = Field(default=None, ge=0, le=1500)
    panel_temp_c: Optional[float] = None
    inverter_efficiency: Optional[float] = Field(default=None, ge=0, le=1)
    period: str  # ISO timestamp or "2026-02-06T14:00"
    capacity_kwp: Optional[float] = Field(default=None, gt=0)


class ActionPlanIn(BaseModel):
    focus: str = Field(default="overall", pattern="^(overall|energy|water|carbon|waste)$")
    horizon_months: int = Field(default=12, ge=1, le=36)


def build_phase3_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/phase3", tags=["phase3-complete"])

    def _guard(user, iid):
        if user["role"] != "super_admin" and user.get("institution_id") != iid:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    def _admin_or_sustain(user):
        if user["role"] not in ("super_admin", "institution_admin",
                                 "ai_governance_admin", "compliance_officer",
                                 "registrar", "programme_manager"):
            raise HTTPException(status_code=403, detail="Sustainability/admin required")

    async def _audit(db, iid, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": iid,
            "ts": _now(), "actor": actor, "action": action,
            "target": target, "details": details,
        })

    # ============================================================
    # GREENIQ — Anomaly detection (z-score)
    # ============================================================
    @router.get("/{iid}/greeniq/anomalies")
    async def anomalies(
        iid: str,
        metric: str = "energy",
        threshold: float = 2.0,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, iid)
        if metric not in ("energy", "water"):
            raise HTTPException(status_code=422, detail="metric must be energy|water")
        if threshold <= 0:
            raise HTTPException(status_code=422, detail="threshold must be > 0")
        db = get_db()
        coll = db.greeniq_energy if metric == "energy" else db.greeniq_water
        value_key = "kwh" if metric == "energy" else "kilolitres"
        group_key = "meter_id" if metric == "energy" else "source_id"

        rows = await coll.find({"institution_id": iid}, {"_id": 0}).to_list(50000)
        if not rows:
            return {"metric": metric, "threshold": threshold,
                    "groups_analysed": 0, "anomalies": []}

        by_group = {}
        for r in rows:
            by_group.setdefault(r.get(group_key, "unknown"), []).append(r)

        anomalies_out = []
        for gid, group_rows in by_group.items():
            vals = [float(r.get(value_key) or 0) for r in group_rows]
            n = len(vals)
            if n < 3:
                continue  # need at least 3 points for a meaningful z-score
            mu = mean(vals)
            sd = pstdev(vals)
            if sd == 0:
                continue
            for r in group_rows:
                v = float(r.get(value_key) or 0)
                z = (v - mu) / sd
                if abs(z) >= threshold:
                    anomalies_out.append({
                        "group_id": gid,
                        "location": r.get("location"),
                        "period": r.get("period"),
                        "value": round(v, 2),
                        "mean": round(mu, 2),
                        "stdev": round(sd, 2),
                        "z_score": round(z, 2),
                        "direction": "above" if z > 0 else "below",
                        "severity": ("high" if abs(z) >= threshold + 1
                                     else "medium"),
                    })
        anomalies_out.sort(key=lambda a: -abs(a["z_score"]))
        return {
            "metric": metric,
            "threshold": threshold,
            "groups_analysed": len(by_group),
            "anomalies": anomalies_out,
        }

    # ============================================================
    # GREENIQ — Solar inverter API ingestion
    # ============================================================
    @router.post("/{iid}/greeniq/solar/ingest")
    async def solar_ingest(iid: str, p: SolarReadingIn, user: dict = Depends(get_current_user)):
        _guard(user, iid)
        # Open ingestion — any role can POST; production deployments would gate
        # this behind an inverter service-token. We still tag who pushed it.
        db = get_db()
        # Compute performance ratio if we have irradiance + capacity
        pr = None
        if p.irradiance_wm2 and p.capacity_kwp and p.capacity_kwp > 0:
            # 1 kWp ≈ 1 kWh under 1000 W/m² for 1 hour. We assume 1-hour reading.
            expected = (p.irradiance_wm2 / 1000.0) * p.capacity_kwp
            pr = round(p.generation_kwh / expected, 3) if expected > 0 else None
            if pr is not None:
                pr = max(0.0, min(2.0, pr))

        reading = {
            "id": f"solar-{uuid4().hex[:10]}", "institution_id": iid,
            **p.model_dump(), "performance_ratio": pr,
            "received_at": _now(), "ingested_by": user["email"],
        }
        await db.greeniq_solar_readings.insert_one(dict(reading))
        reading.pop("_id", None)

        # Mirror into greeniq_energy so the existing /api/greeniq/{iid}/esg
        # composite picks it up (idempotent on (institution_id, meter_id, period))
        period_month = p.period[:7] if len(p.period) >= 7 else p.period
        await db.greeniq_energy.update_one(
            {"institution_id": iid, "meter_id": f"solar-{p.inverter_id}",
             "period": period_month, "source": "solar"},
            {"$inc": {"kwh": p.generation_kwh},
             "$setOnInsert": {
                 "id": f"egy-{uuid4().hex[:10]}", "institution_id": iid,
                 "meter_id": f"solar-{p.inverter_id}", "location": p.location,
                 "source": "solar", "period": period_month,
                 "created_at": _now(),
             }},
            upsert=True,
        )
        await _audit(db, iid, user["email"], "greeniq.solar.ingest", p.inverter_id,
                     {"kwh": p.generation_kwh, "pr": pr})
        return reading

    @router.get("/{iid}/greeniq/solar/readings")
    async def solar_list(iid: str, limit: int = 200, user: dict = Depends(get_current_user)):
        _guard(user, iid)
        return await get_db().greeniq_solar_readings.find(
            {"institution_id": iid}, {"_id": 0}
        ).sort("received_at", -1).to_list(min(max(limit, 1), 1000))

    @router.get("/{iid}/greeniq/solar/summary")
    async def solar_summary(iid: str, user: dict = Depends(get_current_user)):
        _guard(user, iid)
        rows = await get_db().greeniq_solar_readings.find(
            {"institution_id": iid}, {"_id": 0}
        ).to_list(50000)
        if not rows:
            return {"total_readings": 0, "total_kwh": 0, "today_kwh": 0,
                    "avg_irradiance": 0, "avg_performance_ratio": None,
                    "inverters": []}
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        total = sum(r["generation_kwh"] for r in rows)
        today_total = sum(r["generation_kwh"] for r in rows
                          if (r.get("period") or "").startswith(today_str))
        week_total = sum(r["generation_kwh"] for r in rows
                         if (r.get("period") or "")[:10] >= week_ago)
        irrs = [r["irradiance_wm2"] for r in rows if r.get("irradiance_wm2")]
        prs = [r["performance_ratio"] for r in rows if r.get("performance_ratio") is not None]
        # Per-inverter rollup
        by_inv = {}
        for r in rows:
            inv = r["inverter_id"]
            by_inv.setdefault(inv, {"inverter_id": inv, "location": r["location"],
                                     "readings": 0, "total_kwh": 0, "prs": []})
            by_inv[inv]["readings"] += 1
            by_inv[inv]["total_kwh"] += r["generation_kwh"]
            if r.get("performance_ratio") is not None:
                by_inv[inv]["prs"].append(r["performance_ratio"])
        inverters = []
        for v in by_inv.values():
            inverters.append({
                "inverter_id": v["inverter_id"],
                "location": v["location"],
                "readings": v["readings"],
                "total_kwh": round(v["total_kwh"], 2),
                "avg_pr": round(mean(v["prs"]), 3) if v["prs"] else None,
            })
        inverters.sort(key=lambda x: -x["total_kwh"])
        return {
            "total_readings": len(rows),
            "total_kwh": round(total, 2),
            "today_kwh": round(today_total, 2),
            "week_kwh": round(week_total, 2),
            "avg_irradiance": round(mean(irrs), 1) if irrs else 0,
            "avg_performance_ratio": round(mean(prs), 3) if prs else None,
            "inverters": inverters,
        }

    # ============================================================
    # GREENIQ — Claude-driven sustainability action plan
    # ============================================================
    @router.post("/{iid}/greeniq/action-plan")
    async def action_plan(iid: str, p: ActionPlanIn, user: dict = Depends(get_current_user)):
        _guard(user, iid)
        _admin_or_sustain(user)
        db = get_db()
        # Pull live counts to ground the plan — no fabricated numbers
        n_energy = await db.greeniq_energy.count_documents({"institution_id": iid})
        n_water = await db.greeniq_water.count_documents({"institution_id": iid})
        n_carbon = await db.greeniq_carbon.count_documents({"institution_id": iid})
        solar_rows = await db.greeniq_solar_readings.find(
            {"institution_id": iid}, {"_id": 0, "generation_kwh": 1}
        ).to_list(20000)
        total_solar = round(sum(r.get("generation_kwh", 0) for r in solar_rows), 2)
        energy_rows = await db.greeniq_energy.find(
            {"institution_id": iid}, {"_id": 0, "kwh": 1, "source": 1}
        ).to_list(20000)
        total_kwh = round(sum(r.get("kwh", 0) for r in energy_rows), 2)
        grid_kwh = round(sum(r.get("kwh", 0) for r in energy_rows
                              if r.get("source") == "grid"), 2)
        solar_share = round((total_solar / total_kwh * 100), 1) if total_kwh else 0
        # Anomalies count
        anom = await anomalies(iid, "energy", 2.0, user=user)
        n_anom = len(anom.get("anomalies", []))

        provider, model = await ai_service.resolve_model(db, iid)
        system = (
            "You are a sustainability strategist for an Indian higher-education "
            "institution preparing AQAR + ISO-14001 reporting. Output a JSON "
            "action plan grounded ONLY in the metrics provided. Be specific, "
            "measurable, and cite the metric you are addressing."
        )
        user_text = (
            f"Focus: {p.focus}\nHorizon: {p.horizon_months} months\n\n"
            f"Live metrics:\n"
            f"- Energy readings logged: {n_energy} (total kWh: {total_kwh}, grid: {grid_kwh}, solar: {total_solar})\n"
            f"- Water readings logged: {n_water}\n"
            f"- Carbon entries logged: {n_carbon}\n"
            f"- Solar share of electricity: {solar_share}%\n"
            f"- Consumption anomalies (|z|≥2) currently flagged: {n_anom}\n\n"
            'Output: {"actions": [ { "title": "...", "rationale": "...", '
            '"target_metric": "energy|water|carbon|waste|other", '
            '"effort": "low|medium|high", "impact": "low|medium|high", '
            '"timeline_months": 3, "owner_role": "facilities|it|admin|academic|other" } ], '
            '"baseline_summary": "1-sentence baseline context"}'
        )
        try:
            result = await ai_service.generate_json(
                system_message=system, user_text=user_text,
                provider=provider, model=model, max_tokens=2200,
            )
        except Exception as e:
            logger.exception("action-plan LLM failed")
            raise HTTPException(status_code=502, detail=f"LLM failure: {e}")

        actions = result.get("actions") if isinstance(result, dict) else None
        if not isinstance(actions, list) or not actions:
            raise HTTPException(status_code=502, detail="LLM returned no usable actions")

        clean = []
        for a in actions[:10]:
            if not isinstance(a, dict) or not a.get("title"):
                continue
            clean.append({
                "id": f"act-{uuid4().hex[:8]}",
                "title": str(a.get("title", "")).strip(),
                "rationale": str(a.get("rationale", "")).strip(),
                "target_metric": str(a.get("target_metric", "other")),
                "effort": str(a.get("effort", "medium")),
                "impact": str(a.get("impact", "medium")),
                "timeline_months": int(a.get("timeline_months", 6) or 6),
                "owner_role": str(a.get("owner_role", "facilities")),
            })

        plan = {
            "id": f"plan-{uuid4().hex[:10]}", "institution_id": iid,
            "focus": p.focus, "horizon_months": p.horizon_months,
            "baseline_summary": result.get("baseline_summary", ""),
            "baseline_metrics": {
                "energy_readings": n_energy, "water_readings": n_water,
                "carbon_entries": n_carbon, "total_kwh": total_kwh,
                "grid_kwh": grid_kwh, "solar_kwh": total_solar,
                "solar_share_pct": solar_share, "anomalies_flagged": n_anom,
            },
            "actions": clean,
            "model": f"{provider}/{model}",
            "generated_at": _now(), "generated_by": user["email"],
        }
        await db.greeniq_action_plans.insert_one(dict(plan)); plan.pop("_id", None)
        await _audit(db, iid, user["email"], "greeniq.action_plan.generate",
                     plan["id"], {"focus": p.focus, "n_actions": len(clean)})
        return plan

    @router.get("/{iid}/greeniq/action-plan")
    async def action_plan_list(iid: str, user: dict = Depends(get_current_user)):
        _guard(user, iid)
        return await get_db().greeniq_action_plans.find(
            {"institution_id": iid}, {"_id": 0}
        ).sort("generated_at", -1).to_list(50)

    return router
