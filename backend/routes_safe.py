"""Claros Safe — visitor management + incident log."""
from __future__ import annotations
import logging, secrets, uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("academiaos.safe")

ADMIN_ROLES = {"super_admin", "institution_admin"}
STAFF_VIEW_ROLES = ADMIN_ROLES | {"security", "faculty", "instructor", "hod", "dean"}
VISITOR_STATUSES = {"EXPECTED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW", "DENIED"}
INCIDENT_TYPES = {"THEFT", "INJURY", "RAGGING", "UNAUTHORIZED_ACCESS", "DAMAGE", "OTHER"}
SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
INCIDENT_STATUSES = {"OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


class VisitorBody(BaseModel):
    visitor_name: str
    phone: str = ""
    purpose: str = ""
    host_user_id: Optional[str] = None
    visit_date: str
    id_type: str = ""
    id_number: str = ""


class IncidentBody(BaseModel):
    incident_type: str
    description: str
    location: str = ""
    incident_datetime: Optional[str] = None
    severity: str = "MEDIUM"
    attachments: List[str] = []


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


def build_claros_safe_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/safe", tags=["claros-safe"])

    # ============================== VISITORS
    @r.post("/visitors")
    async def add_visitor(body: VisitorBody,
                           user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        pass_code = secrets.token_hex(3).upper()
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "visitor_name": body.visitor_name, "phone": body.phone,
            "purpose": body.purpose,
            "host_user_id": body.host_user_id or user["id"],
            "visit_date": body.visit_date,
            "id_type": body.id_type, "id_number": body.id_number,
            "visitor_pass_code": pass_code,
            "status": "EXPECTED",
            "check_in_time": None, "check_out_time": None,
            "created_by": user["id"], "created_at": _now(),
        }
        await db.visitors.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/visitors")
    async def list_visitors(date_filter: Optional[str] = None,
                             status: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_VIEW_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        flt = {"tenant_id": iid, "visit_date": date_filter or today}
        if status:
            flt["status"] = status
        return await db.visitors.find(flt, {"_id": 0}).sort("visit_date", -1).to_list(500)

    @r.put("/visitors/{vid}/checkin")
    async def checkin(vid: str, user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_VIEW_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        v = await db.visitors.find_one({"id": vid, "tenant_id": iid}, {"_id": 0})
        if not v:
            raise HTTPException(404, "Visitor not found")
        await db.visitors.update_one(
            {"id": vid},
            {"$set": {"status": "CHECKED_IN", "check_in_time": _now()}})
        return await db.visitors.find_one({"id": vid}, {"_id": 0})

    @r.put("/visitors/{vid}/checkout")
    async def checkout(vid: str, user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_VIEW_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        v = await db.visitors.find_one({"id": vid, "tenant_id": iid}, {"_id": 0})
        if not v:
            raise HTTPException(404, "Visitor not found")
        await db.visitors.update_one(
            {"id": vid},
            {"$set": {"status": "CHECKED_OUT", "check_out_time": _now()}})
        return await db.visitors.find_one({"id": vid}, {"_id": 0})

    # ============================== INCIDENTS
    @r.post("/incidents")
    async def report_incident(body: IncidentBody,
                               user: dict = Depends(get_current_user)):
        if body.incident_type not in INCIDENT_TYPES:
            raise HTTPException(400, f"incident_type must be one of {sorted(INCIDENT_TYPES)}")
        if body.severity not in SEVERITIES:
            raise HTTPException(400, f"severity must be one of {sorted(SEVERITIES)}")
        db = get_db()
        iid = _tenant_of(user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "reported_by": user["id"],
            "incident_type": body.incident_type,
            "description": body.description,
            "location": body.location,
            "incident_datetime": body.incident_datetime or _now(),
            "severity": body.severity,
            "status": "OPEN",
            "attachments": body.attachments,
            "resolved_at": None, "resolution_notes": None,
            "created_at": _now(),
        }
        await db.incidents.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/incidents")
    async def list_incidents(incident_type: Optional[str] = None,
                              severity: Optional[str] = None,
                              status: Optional[str] = None,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_VIEW_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid}
        if incident_type:
            flt["incident_type"] = incident_type
        if severity:
            flt["severity"] = severity
        if status:
            flt["status"] = status
        return await db.incidents.find(flt, {"_id": 0}).sort(
            "incident_datetime", -1).to_list(500)

    @r.put("/incidents/{iid}")
    async def update_incident(iid: str, body: IncidentUpdate,
                               user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES and user["role"] not in {"hod", "dean", "security"}:
            raise HTTPException(403, "Admin/HOD/Dean/Security only")
        db = get_db()
        tid = _tenant_of(user)
        incident = await db.incidents.find_one(
            {"id": iid, "tenant_id": tid}, {"_id": 0})
        if not incident:
            raise HTTPException(404, "Incident not found")
        updates: dict = {}
        if body.status:
            if body.status not in INCIDENT_STATUSES:
                raise HTTPException(400, f"status must be one of {sorted(INCIDENT_STATUSES)}")
            updates["status"] = body.status
            if body.status in ("RESOLVED", "CLOSED"):
                updates["resolved_at"] = _now()
        if body.resolution_notes is not None:
            updates["resolution_notes"] = body.resolution_notes
        if updates:
            await db.incidents.update_one({"id": iid}, {"$set": updates})
        return await db.incidents.find_one({"id": iid}, {"_id": 0})

    @r.get("/stats")
    async def stats(user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_VIEW_ROLES:
            raise HTTPException(403, "Staff only")
        db = get_db()
        iid = _tenant_of(user)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        visitors_today = await db.visitors.count_documents(
            {"tenant_id": iid, "visit_date": today})
        checked_in = await db.visitors.count_documents(
            {"tenant_id": iid, "visit_date": today, "status": "CHECKED_IN"})
        open_incidents = await db.incidents.count_documents(
            {"tenant_id": iid, "status": {"$in": ["OPEN", "INVESTIGATING"]}})
        critical_open = await db.incidents.count_documents(
            {"tenant_id": iid, "severity": "CRITICAL",
             "status": {"$in": ["OPEN", "INVESTIGATING"]}})
        return {
            "visitors_today": visitors_today,
            "checked_in_now": checked_in,
            "open_incidents": open_incidents,
            "critical_open": critical_open,
        }

    return r
