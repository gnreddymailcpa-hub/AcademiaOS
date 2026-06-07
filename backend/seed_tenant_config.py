"""Tenant configuration seed.

- VCE gets the legacy code names (VEDA/ARISE/NEXUS/…) so the existing
  branding stays intact.
- ISB stays on canonical Claros names (no overrides).
- Both get a branding row with a primary colour and platform display name.
"""
from datetime import datetime, timezone
import hashlib

VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


VCE_NAMES = {
    "claros-ai": ("VEDA", "VEDA"),
    "claros-enroll": ("ARISE", "ARISE"),
    "claros-core": ("NEXUS", "NEXUS"),
    "claros-learn": ("ILLUMINATE", "ILM"),
    "claros-launch": ("PATHFINDER", "PATH"),
    "claros-research": ("PRISM", "PRISM"),
    "claros-comply": ("COMPASS", "COMPS"),
    "claros-safe": ("GUARDIAN", "GUARD"),
    "claros-alumni": ("ALUMNI360", "ALM360"),
    "claros-green": ("GREENIQ", "GIQ"),
    "claros-people": ("FACULTY+", "FAC+"),
    "claros-insights": ("COMMAND", "CMD"),
}

VCE_BRANDING = {
    "platform_display_name": "VCE Intelligent Campus",
    "primary_color": "#1565C0",
    "accent_color": "#006064",
    "font": "Sora",
}

ISB_BRANDING = {
    "platform_display_name": "ISB Digital Campus",
    "primary_color": "#2563EB",
    "accent_color": "#0EA5E9",
    "font": "Plus Jakarta Sans",
}


def _det(*p):
    h = hashlib.md5(":".join(p).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso():
    return datetime.now(timezone.utc).isoformat()


async def seed_tenant_config(db, logger):
    counts = {"modules": 0, "branding": 0}

    # VCE — write all module overrides
    for mid, (dn, sn) in VCE_NAMES.items():
        rid = _det("tmc", VCE_ID, mid)
        await db.tenant_module_configs.update_one(
            {"id": rid},
            {"$setOnInsert": {
                "id": rid, "tenant_id": VCE_ID, "module_id": mid,
                "display_name": dn, "short_name": sn,
                "enabled": True, "icon_override": None,
                "created_at": _iso(),
            }},
            upsert=True,
        )
        counts["modules"] += 1

    # Branding rows for both tenants
    for iid, brand in [(VCE_ID, VCE_BRANDING), (ISB_ID, ISB_BRANDING)]:
        bid = _det("tbrand", iid)
        await db.tenant_branding.update_one(
            {"id": bid},
            {"$setOnInsert": {
                "id": bid, "tenant_id": iid, **brand,
                "created_at": _iso(),
            }},
            upsert=True,
        )
        counts["branding"] += 1

    logger.info("Tenant config seeded · %s", counts)
