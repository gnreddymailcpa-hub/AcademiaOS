"""
Platform Module Registry — admin-configurable module catalog (Phase 1 implementation).

Defines the 12 platforms (VEDA, ARISE, NEXUS, ILLUMINATE, PATHFINDER, PRISM,
COMPASS, GUARDIAN, ALUMNI360, FACULTY+, GREENIQ, COMMAND) as platform-wide
capabilities. Each tenant can enable / disable / mark each module 'coming_soon'.

API surface
-----------
GET   /api/modules/catalog                       — full catalog (12 platforms)
GET   /api/modules/{institution_id}              — per-tenant status map
PATCH /api/modules/{institution_id}/{code}       — admin toggles a single module
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Body

# ---------------------------------------------------------------------------
# Static catalog — the 12 platforms from the build plan.
# Pages already in the codebase map to a `route` so the sidebar can gate them.
# ---------------------------------------------------------------------------
PLATFORM_CATALOG = [
    {"code": "VEDA",       "phase": 1, "domain": "AI Core",
     "name": "AI Engine & Digital Assistant",
     "tagline": "Multi-role RAG chatbot, multilingual NLP, proactive alerts.",
     "route": "/ai-instructor", "default_status": "active",
     "depends_on": [], "icon": "Cpu"},
    {"code": "ARISE",      "phase": 1, "domain": "Admissions",
     "name": "AI Recruitment & Enrolment Suite",
     "tagline": "Lead scoring, drip campaigns, EAPCET predictor, B-cat workflow.",
     "route": "/admissions", "default_status": "active",
     "depends_on": ["VEDA"], "icon": "Users"},
    {"code": "NEXUS",      "phase": 1, "domain": "Campus ERP",
     "name": "Next-Gen Campus Management",
     "tagline": "Attendance, fees, hostel, library, certificates, parent portal.",
     "route": "/academic-structure", "default_status": "active",
     "depends_on": ["VEDA"], "icon": "Database"},
    {"code": "COMPASS",    "phase": 1, "domain": "Compliance",
     "name": "Compliance & Accreditation",
     "tagline": "NAAC AQAR auto-gen, OBE attainment, NBA, NIRF, ISO 21001.",
     "route": "/compliance", "default_status": "active",
     "depends_on": ["NEXUS"], "icon": "Award"},
    {"code": "PATHFINDER", "phase": 1, "domain": "Career",
     "name": "AI Career & Placement Intelligence",
     "tagline": "Skill gap analyser, mock interview, resume scoring, drive mgmt.",
     "route": "/student-assistant", "default_status": "active",
     "depends_on": ["VEDA", "NEXUS"], "icon": "Briefcase"},
    {"code": "COMMAND",    "phase": 1, "domain": "Analytics",
     "name": "Executive Analytics Command Centre",
     "tagline": "Live KPIs, predictive enrolment, anomaly alerts, NIRF tracker.",
     "route": "/analytics", "default_status": "active",
     "depends_on": ["NEXUS", "ARISE", "PATHFINDER", "COMPASS"], "icon": "BarChart2"},
    # Phase 2 — present in catalog but default to coming_soon for new tenants
    {"code": "ILLUMINATE", "phase": 2, "domain": "Learning",
     "name": "Intelligent LMS & Assessment",
     "tagline": "Adaptive paths, quiz gen, plagiarism, OBE CO/PO/PSO tracking.",
     "route": "/content-studio", "default_status": "coming_soon",
     "depends_on": ["NEXUS", "VEDA", "COMPASS"], "icon": "BookOpen"},
    {"code": "PRISM",      "phase": 2, "domain": "Research",
     "name": "Research & Innovation Management",
     "tagline": "Scopus sync, patent portfolio, grant finder, citation analytics.",
     "route": "/governance", "default_status": "coming_soon",
     "depends_on": ["VEDA", "COMPASS"], "icon": "Search"},
    {"code": "GUARDIAN",   "phase": 2, "domain": "Campus Safety",
     "name": "Campus Safety & Smart Infrastructure",
     "tagline": "YOLOv8 CCTV, NFC access, ANPR, predictive maintenance.",
     "route": None, "default_status": "coming_soon",
     "depends_on": ["NEXUS"], "icon": "Shield"},
    {"code": "ALUMNI360",  "phase": 2, "domain": "Alumni",
     "name": "Alumni Engagement & Network",
     "tagline": "Mentorship match, alumni job board, regional chapters, giving.",
     "route": None, "default_status": "coming_soon",
     "depends_on": ["NEXUS", "PATHFINDER"], "icon": "Network"},
    {"code": "FACULTY",    "phase": 2, "domain": "Faculty",
     "name": "Faculty Development & Excellence",
     "tagline": "Automated API computation, dev roadmap, workload optimiser.",
     "route": "/users-roles", "default_status": "coming_soon",
     "depends_on": ["NEXUS", "COMPASS"], "icon": "GraduationCap"},
    {"code": "GREENIQ",    "phase": 3, "domain": "Sustainability",
     "name": "Energy & Sustainability Intelligence",
     "tagline": "Real-time energy, solar yield, carbon footprint, NAAC green.",
     "route": None, "default_status": "coming_soon",
     "depends_on": ["GUARDIAN"], "icon": "Leaf"},
]

CODE_INDEX = {p["code"]: p for p in PLATFORM_CATALOG}
ALLOWED_STATUS = {"active", "coming_soon", "disabled"}


def _now():
    return datetime.now(timezone.utc).isoformat()


def build_modules_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/modules", tags=["modules"])

    @router.get("/catalog")
    async def catalog(_: dict = Depends(get_current_user)):
        return PLATFORM_CATALOG

    @router.get("/{institution_id}")
    async def list_for_tenant(institution_id: str, user: dict = Depends(get_current_user)):
        # All tenant members can read the module status (it powers sidebar gating)
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant read denied")
        db = get_db()
        rows = await db.platform_modules.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).to_list(50)
        by_code = {r["code"]: r for r in rows}
        # Fill in any catalog entries the tenant doesn't yet have a row for
        out = []
        for spec in PLATFORM_CATALOG:
            row = by_code.get(spec["code"])
            out.append({
                **spec,
                "status": (row or {}).get("status", spec["default_status"]),
                "configured_at": (row or {}).get("configured_at"),
                "configured_by": (row or {}).get("configured_by"),
            })
        return out

    @router.patch("/{institution_id}/{code}")
    async def update_module(
        institution_id: str,
        code: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ):
        if code not in CODE_INDEX:
            raise HTTPException(status_code=404, detail=f"Unknown module {code}")
        if user["role"] not in ("super_admin", "institution_admin"):
            raise HTTPException(status_code=403, detail="Admin role required")
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant write denied")
        status = payload.get("status")
        if status not in ALLOWED_STATUS:
            raise HTTPException(status_code=400, detail=f"status must be one of {ALLOWED_STATUS}")
        db = get_db()
        # Dependency check: cannot activate if any dependency is not active
        if status == "active":
            spec = CODE_INDEX[code]
            for dep in spec.get("depends_on", []):
                dep_row = await db.platform_modules.find_one(
                    {"institution_id": institution_id, "code": dep}, {"_id": 0}
                )
                dep_status = (
                    (dep_row or {}).get("status") or CODE_INDEX[dep]["default_status"]
                )
                if dep_status != "active":
                    raise HTTPException(
                        status_code=409,
                        detail=f"Cannot activate {code}: dependency {dep} is {dep_status}",
                    )
        await db.platform_modules.update_one(
            {"institution_id": institution_id, "code": code},
            {"$set": {
                "institution_id": institution_id,
                "code": code,
                "status": status,
                "configured_at": _now(),
                "configured_by": user["email"],
            }},
            upsert=True,
        )
        await db.audit_logs.insert_one({
            "id": f"audit-{_now()}-{code}",
            "institution_id": institution_id,
            "ts": _now(),
            "actor": user["email"],
            "action": "module.update",
            "target": code,
            "details": {"status": status},
        })
        return {"ok": True, "code": code, "status": status}

    return router
