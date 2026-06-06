"""
GUARDIAN — Campus Safety & Smart Infrastructure backend (Phase 2).

Phase-2 MVP scope (lightweight detection-event ingestion + monitoring rollup —
the actual YOLOv8 / ANPR / NFC reader integrations are out-of-scope in the
preview pod; this layer is the system-of-record they would push to):

  - Incidents (CCTV / YOLOv8 detection events): camera_id, location,
    detection_type (intrusion, crowd, fire, fall, weapon), severity, snapshot_ref
  - Access events (NFC / Smart-card scans): user_id, name, zone, direction
  - Vehicle entries (ANPR): plate, vehicle_type, entry / exit timestamps
  - Asset health (predictive maintenance): asset_id, asset_type, score 0-100,
    status auto-derived (operational / warning / critical / down)
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class IncidentIn(BaseModel):
    camera_id: str
    location: str
    detection_type: str = Field(pattern="^(intrusion|crowd|fire|fall|weapon|loitering|other)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    confidence: float = Field(default=0.85, ge=0, le=1)
    snapshot_ref: Optional[str] = None
    note: Optional[str] = ""


class AccessEventIn(BaseModel):
    card_id: str
    user_id: Optional[str] = None
    user_name: str
    zone: str
    direction: str = Field(default="in", pattern="^(in|out)$")


class VehicleIn(BaseModel):
    plate: str
    vehicle_type: str = Field(default="car", pattern="^(car|bike|bus|truck|auto|other)$")
    direction: str = Field(default="in", pattern="^(in|out)$")
    gate: str = "Main Gate"


class AssetIn(BaseModel):
    asset_id: str
    asset_type: str  # "HVAC", "Generator", "Lift", "CCTV-Camera", "UPS", etc.
    location: str
    health_score: float = Field(ge=0, le=100)
    last_serviced: Optional[str] = None  # YYYY-MM-DD


def _asset_status(score: float) -> str:
    if score >= 80:
        return "operational"
    if score >= 60:
        return "warning"
    if score > 0:
        return "critical"
    return "down"


def build_guardian_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/guardian", tags=["guardian"])

    def _guard(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    def _ops_guard(user):
        if user["role"] not in ("super_admin", "institution_admin", "security_admin",
                                "facilities_admin", "registrar"):
            raise HTTPException(status_code=403, detail="Security / facilities role required")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ---------------- INCIDENTS ----------------
    @router.post("/{institution_id}/incidents")
    async def push_incident(institution_id: str, payload: IncidentIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        doc = {"id": f"inc-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "status": "open",
               "detected_at": _now(), "captured_by": user["email"]}
        await db.guardian_incidents.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "guardian.incident.push", doc["id"],
                     {"type": payload.detection_type, "severity": payload.severity, "location": payload.location})
        return doc

    @router.get("/{institution_id}/incidents")
    async def list_incidents(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.guardian_incidents.find({"institution_id": institution_id}, {"_id": 0}).sort("detected_at", -1).to_list(500)

    @router.patch("/{institution_id}/incidents/{incident_id}/resolve")
    async def resolve(institution_id: str, incident_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        r = await db.guardian_incidents.update_one(
            {"id": incident_id, "institution_id": institution_id},
            {"$set": {"status": "resolved", "resolved_at": _now(), "resolved_by": user["email"]}}
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="Incident not found")
        await _audit(db, institution_id, user["email"], "guardian.incident.resolve", incident_id, {})
        return {"ok": True}

    # ---------------- ACCESS EVENTS ----------------
    @router.post("/{institution_id}/access")
    async def push_access(institution_id: str, payload: AccessEventIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        doc = {"id": f"acc-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "ts": _now(), "captured_by": user["email"]}
        await db.guardian_access.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/{institution_id}/access")
    async def list_access(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.guardian_access.find({"institution_id": institution_id}, {"_id": 0}).sort("ts", -1).to_list(500)

    # ---------------- VEHICLES ----------------
    @router.post("/{institution_id}/vehicles")
    async def push_vehicle(institution_id: str, payload: VehicleIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        doc = {"id": f"veh-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "ts": _now(), "plate": payload.plate.upper().replace(" ", ""),
               "captured_by": user["email"]}
        await db.guardian_vehicles.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/{institution_id}/vehicles")
    async def list_vehicles(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.guardian_vehicles.find({"institution_id": institution_id}, {"_id": 0}).sort("ts", -1).to_list(500)

    # ---------------- ASSETS ----------------
    @router.post("/{institution_id}/assets")
    async def upsert_asset(institution_id: str, payload: AssetIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _ops_guard(user)
        db = get_db()
        status = _asset_status(payload.health_score)
        body = {**payload.model_dump(), "institution_id": institution_id,
                "status": status, "updated_at": _now(), "updated_by": user["email"]}
        await db.guardian_assets.update_one(
            {"institution_id": institution_id, "asset_id": payload.asset_id},
            {"$set": body, "$setOnInsert": {"id": f"ast-{uuid4().hex[:10]}", "created_at": _now()}},
            upsert=True,
        )
        await _audit(db, institution_id, user["email"], "guardian.asset.upsert", payload.asset_id,
                     {"health_score": payload.health_score, "status": status})
        return {"ok": True, **body}

    @router.get("/{institution_id}/assets")
    async def list_assets(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.guardian_assets.find({"institution_id": institution_id}, {"_id": 0}).sort("health_score", 1).to_list(500)

    # ---------------- SUMMARY ----------------
    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        incs = await db.guardian_incidents.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        access = await db.guardian_access.find({"institution_id": institution_id}, {"_id": 0}).to_list(5000)
        vehs = await db.guardian_vehicles.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        assets = await db.guardian_assets.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        today = datetime.now(timezone.utc).date().isoformat()
        # By severity for incidents
        by_severity = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for i in incs:
            by_severity[i.get("severity", "medium")] = by_severity.get(i.get("severity", "medium"), 0) + 1
        # Inside-now from access logs (in events not matched by out events for same user)
        net = {}
        for a in sorted(access, key=lambda x: x.get("ts", "")):
            net[a.get("user_name")] = net.get(a.get("user_name"), 0) + (1 if a.get("direction") == "in" else -1)
        inside_now = sum(1 for v in net.values() if v > 0)
        # Asset health rollup
        asset_status = {"operational": 0, "warning": 0, "critical": 0, "down": 0}
        for a in assets:
            asset_status[a.get("status", "operational")] = asset_status.get(a.get("status", "operational"), 0) + 1
        return {
            "incidents_total": len(incs),
            "incidents_open": sum(1 for i in incs if i.get("status") == "open"),
            "incidents_today": sum(1 for i in incs if (i.get("detected_at") or "").startswith(today)),
            "incidents_by_severity": by_severity,
            "access_events": len(access),
            "people_inside_now": inside_now,
            "vehicles_total": len(vehs),
            "vehicles_in_today": sum(1 for v in vehs if v.get("direction") == "in" and (v.get("ts") or "").startswith(today)),
            "assets_total": len(assets),
            "asset_status": asset_status,
            "assets_needing_attention": asset_status["warning"] + asset_status["critical"] + asset_status["down"],
        }

    return router
