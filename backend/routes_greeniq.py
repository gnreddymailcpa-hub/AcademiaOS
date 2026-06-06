"""
GREENIQ — Sustainability backend (Phase 3 · final platform).

Phase-3 MVP scope:
  - Energy readings (kWh per meter / location, by date)
  - Water readings (kL per source / location, by date)
  - Carbon emissions (scope_1 / 2 / 3, period-tagged, computed in tCO2e)
  - Composite ESG score across 5 dimensions with grade projection
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class EnergyIn(BaseModel):
    meter_id: str
    location: str
    kwh: float
    source: str = Field(default="grid", pattern="^(grid|solar|wind|diesel|other)$")
    period: str  # "2026-02" or "2026-W06"


class WaterIn(BaseModel):
    source_id: str
    location: str
    kilolitres: float
    source: str = Field(default="municipal", pattern="^(municipal|borewell|rainwater|recycled|other)$")
    period: str


class CarbonIn(BaseModel):
    scope: int = Field(ge=1, le=3)  # Scope 1, 2, or 3 GHG
    activity: str  # "diesel generator", "purchased electricity", "business travel"
    tco2e: float
    period: str
    note: Optional[str] = ""


# Indicative emission factors (kg CO2e per unit) — preview pod placeholders;
# production should hook into a verified Scope-2 grid-intensity source like CEA.
EF_GRID_KWH = 0.82  # India grid average ~0.82 kgCO2e/kWh
EF_SOLAR_KWH = 0.04
EF_DIESEL_KWH = 0.96


def _kwh_to_co2e(source: str, kwh: float) -> float:
    f = {"grid": EF_GRID_KWH, "solar": EF_SOLAR_KWH, "wind": EF_SOLAR_KWH,
         "diesel": EF_DIESEL_KWH, "other": EF_GRID_KWH}.get(source, EF_GRID_KWH)
    return round(kwh * f / 1000, 3)  # tCO2e


def build_greeniq_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/greeniq", tags=["greeniq"])

    def _guard(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    def _ops_guard(user):
        if user["role"] not in ("super_admin", "institution_admin", "facilities_admin",
                                "sustainability_admin", "registrar"):
            raise HTTPException(status_code=403, detail="Sustainability / facilities role required")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ----- ENERGY -----
    @router.post("/{institution_id}/energy")
    async def add_energy(institution_id: str, payload: EnergyIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        doc = {"id": f"en-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(),
               "tco2e": _kwh_to_co2e(payload.source, payload.kwh),
               "logged_at": _now(), "logged_by": user["email"]}
        await db.greeniq_energy.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "greeniq.energy.add", doc["id"],
                     {"kwh": payload.kwh, "source": payload.source})
        return doc

    @router.get("/{institution_id}/energy")
    async def list_energy(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.greeniq_energy.find({"institution_id": institution_id}, {"_id": 0}).sort("period", -1).to_list(1000)

    # ----- WATER -----
    @router.post("/{institution_id}/water")
    async def add_water(institution_id: str, payload: WaterIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        doc = {"id": f"wa-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "logged_at": _now(), "logged_by": user["email"]}
        await db.greeniq_water.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "greeniq.water.add", doc["id"],
                     {"kilolitres": payload.kilolitres, "source": payload.source})
        return doc

    @router.get("/{institution_id}/water")
    async def list_water(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.greeniq_water.find({"institution_id": institution_id}, {"_id": 0}).sort("period", -1).to_list(1000)

    # ----- CARBON -----
    @router.post("/{institution_id}/carbon")
    async def add_carbon(institution_id: str, payload: CarbonIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        doc = {"id": f"co-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "logged_at": _now(), "logged_by": user["email"]}
        await db.greeniq_carbon.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "greeniq.carbon.add", doc["id"],
                     {"scope": payload.scope, "tco2e": payload.tco2e})
        return doc

    @router.get("/{institution_id}/carbon")
    async def list_carbon(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.greeniq_carbon.find({"institution_id": institution_id}, {"_id": 0}).sort("period", -1).to_list(1000)

    # ----- ESG REPORT CARD -----
    @router.get("/{institution_id}/esg")
    async def esg(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        energy = await db.greeniq_energy.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        water = await db.greeniq_water.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        carbon = await db.greeniq_carbon.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)

        total_kwh = sum(e.get("kwh", 0) for e in energy)
        renewable_kwh = sum(e.get("kwh", 0) for e in energy if e.get("source") in ("solar", "wind"))
        renewable_pct = round((renewable_kwh / total_kwh) * 100, 1) if total_kwh else 0

        total_kl = sum(w.get("kilolitres", 0) for w in water)
        recycled_kl = sum(w.get("kilolitres", 0) for w in water if w.get("source") in ("recycled", "rainwater"))
        recycled_pct = round((recycled_kl / total_kl) * 100, 1) if total_kl else 0

        # Aggregate emissions: explicit carbon rows + computed from energy
        carbon_total = sum(c.get("tco2e", 0) for c in carbon) + sum(e.get("tco2e", 0) for e in energy)
        carbon_total = round(carbon_total, 3)

        # ESG dimensions (each 0-100)
        e_dim = min(renewable_pct + (50 if renewable_pct > 0 else 0), 100)
        w_dim = min(recycled_pct + 30, 100) if recycled_pct > 0 else 30
        c_dim = max(0, 100 - min(carbon_total * 2, 100))  # less carbon = higher score
        # Governance: count of governance audit events as proxy
        gov_count = await db.audit_logs.count_documents({"institution_id": institution_id, "action": {"$regex": "^(governance|workflows|compass)"}})
        gov_dim = min(50 + gov_count // 5, 100)
        # Social: alumni mentorships + ALUMNI / FACULTY counts
        social_proxy = await db.alumni_mentorships.count_documents({"institution_id": institution_id})
        s_dim = min(40 + social_proxy * 6, 100)

        composite = round(e_dim * 0.30 + s_dim * 0.20 + gov_dim * 0.20 + c_dim * 0.20 + w_dim * 0.10, 1)
        grade = "A++" if composite >= 85 else "A+" if composite >= 75 else "A" if composite >= 65 else "B+" if composite >= 50 else "B"

        # Per-period trend (latest 6 periods of energy)
        by_period = {}
        for e in energy:
            by_period.setdefault(e["period"], 0)
            by_period[e["period"]] += e.get("kwh", 0)
        periods = sorted(by_period.keys())[-6:]
        energy_trend = [{"period": p, "kwh": round(by_period[p], 1)} for p in periods]

        return {
            "composite": composite,
            "grade": grade,
            "dimensions": [
                {"name": "Environmental (Energy)", "value": round(e_dim, 1), "weight": 30},
                {"name": "Social", "value": round(s_dim, 1), "weight": 20},
                {"name": "Governance", "value": round(gov_dim, 1), "weight": 20},
                {"name": "Carbon", "value": round(c_dim, 1), "weight": 20},
                {"name": "Water Stewardship", "value": round(w_dim, 1), "weight": 10},
            ],
            "totals": {
                "energy_kwh": round(total_kwh, 1),
                "renewable_pct": renewable_pct,
                "water_kl": round(total_kl, 1),
                "recycled_pct": recycled_pct,
                "carbon_tco2e": carbon_total,
            },
            "energy_trend": energy_trend,
        }

    return router
