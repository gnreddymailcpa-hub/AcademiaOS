"""
Tenant configuration — canonical/display name resolution for multi-tenant
white-label.

Persists tenant display names + branding in `tenant_module_configs` (one row
per tenant×module) and `tenant_branding` (one row per tenant). Canonical
defaults are immutable in code and applied when a tenant has no override.

Read endpoint is callable by any authenticated user of the tenant (so the
frontend can resolve display names without admin rights). Write endpoints
require admin.
"""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("academiaos.tenant_config")

ADMIN_ROLES = {"super_admin", "institution_admin"}


# ---------------------------------------------------------------------------
# Canonical module catalogue (immutable in code)
# ---------------------------------------------------------------------------
CANONICAL_MODULES: List[Dict] = [
    {"id": "claros-ai", "code": "AI",
     "canonical_name": "Claros AI", "canonical_short": "AI",
     "category": "Intelligence",
     "tagline": "AI assistant, knowledge layer, and conversation interface",
     "api_path": "/api/v1/ai/"},
    {"id": "claros-enroll", "code": "ENR",
     "canonical_name": "Claros Enroll", "canonical_short": "Enroll",
     "category": "Enrollment",
     "tagline": "Admissions CRM, lead scoring, applicant journey",
     "api_path": "/api/v1/enroll/"},
    {"id": "claros-core", "code": "CORE",
     "canonical_name": "Claros Core", "canonical_short": "Core",
     "category": "Operations",
     "tagline": "Campus ERP — students, attendance, fees, timetables",
     "api_path": "/api/v1/core/"},
    {"id": "claros-learn", "code": "LRN",
     "canonical_name": "Claros Learn", "canonical_short": "Learn",
     "category": "Academic",
     "tagline": "Adaptive LMS — courses, assessments, OBE tracking",
     "api_path": "/api/v1/learn/"},
    {"id": "claros-launch", "code": "LCH",
     "canonical_name": "Claros Launch", "canonical_short": "Launch",
     "category": "Career",
     "tagline": "Career placement intelligence — skill gap, mock interviews",
     "api_path": "/api/v1/launch/"},
    {"id": "claros-research", "code": "RES",
     "canonical_name": "Claros Research", "canonical_short": "Research",
     "category": "Research",
     "tagline": "Research intelligence — grants, publications, patents",
     "api_path": "/api/v1/research/"},
    {"id": "claros-comply", "code": "COM",
     "canonical_name": "Claros Comply", "canonical_short": "Comply",
     "category": "Compliance",
     "tagline": "Accreditation and quality management — NAAC, NBA",
     "api_path": "/api/v1/comply/"},
    {"id": "claros-safe", "code": "SAFE",
     "canonical_name": "Claros Safe", "canonical_short": "Safe",
     "category": "Safety",
     "tagline": "Smart campus safety — visitors, incidents, alerts",
     "api_path": "/api/v1/safe/"},
    {"id": "claros-alumni", "code": "ALM",
     "canonical_name": "Claros Alumni", "canonical_short": "Alumni",
     "category": "Community",
     "tagline": "Alumni engagement — mentorship, jobs, giving",
     "api_path": "/api/v1/alumni/"},
    {"id": "claros-green", "code": "GRN",
     "canonical_name": "Claros Green", "canonical_short": "Green",
     "category": "Sustainability",
     "tagline": "Sustainability intelligence — energy, carbon, water",
     "api_path": "/api/v1/green/"},
    {"id": "claros-people", "code": "PPL",
     "canonical_name": "Claros People", "canonical_short": "People",
     "category": "Faculty",
     "tagline": "Faculty development — API index, training, growth",
     "api_path": "/api/v1/people/"},
    {"id": "claros-insights", "code": "INS",
     "canonical_name": "Claros Insights", "canonical_short": "Insights",
     "category": "Analytics",
     "tagline": "Executive analytics — real-time KPIs, board reporting",
     "api_path": "/api/v1/insights/"},
]
CANONICAL_BY_ID = {m["id"]: m for m in CANONICAL_MODULES}


# claros-ai always enabled — it powers other modules.
NEVER_DISABLE = {"claros-ai"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


def _require_admin(user: dict):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Admin only")


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------
class ModuleUpdate(BaseModel):
    display_name: Optional[str] = None
    short_name: Optional[str] = None
    enabled: Optional[bool] = None
    icon_override: Optional[str] = None


class BrandingUpdate(BaseModel):
    platform_display_name: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    font: Optional[str] = None
    custom_domain: Optional[str] = None
    powered_by_label: Optional[str] = None  # Footer tagline, e.g. "Powered by Claros" or "" to hide


# ---------------------------------------------------------------------------
# Helper used internally + by other routers/seeds
# ---------------------------------------------------------------------------
async def get_tenant_config(db, iid: str) -> Dict:
    """Returns the full resolved tenant configuration with canonical fallbacks."""
    inst = await db.institutions.find_one({"id": iid}, {"_id": 0})
    branding = await db.tenant_branding.find_one({"tenant_id": iid}, {"_id": 0}) or {}
    overrides = {}
    async for row in db.tenant_module_configs.find({"tenant_id": iid}, {"_id": 0}):
        overrides[row["module_id"]] = row

    modules = {}
    for m in CANONICAL_MODULES:
        ov = overrides.get(m["id"], {})
        modules[m["id"]] = {
            "canonical_name": m["canonical_name"],
            "canonical_short": m["canonical_short"],
            "code": m["code"],
            "category": m["category"],
            "tagline": m["tagline"],
            "api_path": m["api_path"],
            "display_name": ov.get("display_name") or m["canonical_name"],
            "short_name": ov.get("short_name") or m["canonical_short"],
            "enabled": ov.get("enabled", True),
            "icon_override": ov.get("icon_override"),
            "is_overridden": bool(ov.get("display_name")
                                  or ov.get("short_name")
                                  or ov.get("icon_override")),
        }
    return {
        "tenant_id": iid,
        "tenant_name": (inst or {}).get("name") or "",
        "short_name": (inst or {}).get("short_name") or "",
        "platform_display_name": branding.get("platform_display_name")
            or (inst or {}).get("name") or "Claros Platform",
        "primary_color": branding.get("primary_color") or "#2563EB",
        "accent_color": branding.get("accent_color") or "#0EA5E9",
        "logo_url": branding.get("logo_url"),
        "favicon_url": branding.get("favicon_url"),
        "font": branding.get("font") or "Plus Jakarta Sans",
        "custom_domain": branding.get("custom_domain"),
        "powered_by_label": branding.get("powered_by_label")
            if branding.get("powered_by_label") is not None
            else "Powered by Claros",
        "modules": modules,
    }


def build_tenant_config_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/tenants", tags=["tenant-config"])

    @r.get("/canonical/modules")
    async def canonical_modules():
        """Public canonical catalogue — useful for docs & admin UIs."""
        return CANONICAL_MODULES

    @r.get("/me/config")
    async def my_config(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        return await get_tenant_config(db, iid)

    @r.put("/me/config/modules/{module_id}")
    async def update_module(module_id: str, body: ModuleUpdate,
                             user: dict = Depends(get_current_user)):
        _require_admin(user)
        if module_id not in CANONICAL_BY_ID:
            raise HTTPException(404, f"Unknown module: {module_id}")
        if body.enabled is False and module_id in NEVER_DISABLE:
            raise HTTPException(400, f"{module_id} cannot be disabled")
        db = get_db()
        iid = _tenant_of(user)
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, "No changes")
        # Length / sanity checks
        if "display_name" in updates and not (1 <= len(updates["display_name"]) <= 30):
            raise HTTPException(400, "display_name must be 1-30 chars")
        if "short_name" in updates and not (1 <= len(updates["short_name"]) <= 10):
            raise HTTPException(400, "short_name must be 1-10 chars")
        updates["updated_at"] = _now()
        updates["updated_by"] = user["id"]
        await db.tenant_module_configs.update_one(
            {"tenant_id": iid, "module_id": module_id},
            {"$set": updates,
             "$setOnInsert": {"id": str(uuid.uuid4()),
                              "tenant_id": iid, "module_id": module_id,
                              "created_at": _now()}},
            upsert=True,
        )
        return await get_tenant_config(db, iid)

    @r.put("/me/config/branding")
    async def update_branding(body: BrandingUpdate,
                               user: dict = Depends(get_current_user)):
        _require_admin(user)
        db = get_db()
        iid = _tenant_of(user)
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, "No changes")
        updates["updated_at"] = _now()
        updates["updated_by"] = user["id"]
        await db.tenant_branding.update_one(
            {"tenant_id": iid},
            {"$set": updates,
             "$setOnInsert": {"id": str(uuid.uuid4()), "tenant_id": iid,
                              "created_at": _now()}},
            upsert=True,
        )
        return await get_tenant_config(db, iid)

    @r.post("/me/config/reset")
    async def reset_to_canonical(user: dict = Depends(get_current_user)):
        """Wipe all module overrides and branding for the current tenant."""
        _require_admin(user)
        db = get_db()
        iid = _tenant_of(user)
        await db.tenant_module_configs.delete_many({"tenant_id": iid})
        await db.tenant_branding.delete_many({"tenant_id": iid})
        return await get_tenant_config(db, iid)

    @r.post("/me/config/modules/{module_id}/reset")
    async def reset_module(module_id: str,
                            user: dict = Depends(get_current_user)):
        """Reset one module override. If the tenant had a seeded label
        (e.g. VCE → 'VEDA' for claros-ai), the seed value is re-applied.
        Otherwise the canonical name takes over."""
        _require_admin(user)
        if module_id not in CANONICAL_BY_ID:
            raise HTTPException(404, f"Unknown module: {module_id}")
        db = get_db()
        iid = _tenant_of(user)
        await db.tenant_module_configs.delete_one(
            {"tenant_id": iid, "module_id": module_id})
        # Re-apply seed if the tenant has one (idempotent via the seed helper)
        try:
            from seed_tenant_config import VCE_NAMES, VCE_ID, _det, _iso
            if iid == VCE_ID and module_id in VCE_NAMES:
                dn, sn = VCE_NAMES[module_id]
                rid = _det("tmc", iid, module_id)
                await db.tenant_module_configs.update_one(
                    {"id": rid},
                    {"$setOnInsert": {
                        "id": rid, "tenant_id": iid, "module_id": module_id,
                        "display_name": dn, "short_name": sn,
                        "enabled": True, "icon_override": None,
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )
        except Exception:
            pass
        return await get_tenant_config(db, iid)

    return r
