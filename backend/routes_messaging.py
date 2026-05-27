"""Notifications + Support Tickets — tenant-scoped, RBAC-aware.

Notifications are produced automatically by workflow events (pause for
approval, completion, rollback) and also by support ticket creation.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class NotificationCreate(BaseModel):
    institution_id: str
    user_id: Optional[str] = None  # if None, broadcast to a role
    role: Optional[str] = None     # broadcast to all users with this role
    kind: str                      # "workflow.approval" | "ticket.update" | etc
    title: str
    body: Optional[str] = None
    link: Optional[str] = None     # frontend route to deep-link into


class SupportTicketCreate(BaseModel):
    institution_id: str
    subject: str
    body: str
    category: str = "general"      # enrolment / timetable / assessment / certificate / general
    severity: str = "normal"       # low / normal / high
    source: str = "student_assistant"


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
def build_notifications_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/notifications", tags=["notifications"])

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    @router.get("")
    async def list_for_me(
        limit: int = 30,
        unread_only: bool = False,
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        q = {
            "institution_id": user.get("institution_id"),
            "$or": [{"user_id": user["id"]}, {"role": user["role"]}, {"role": "*"}],
        }
        if unread_only:
            q["read"] = False
        items = await db.notifications.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)
        unread = await db.notifications.count_documents({**q, "read": False})
        return {"items": items, "unread": unread}

    @router.post("/{notification_id}/read")
    async def mark_read(notification_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        await db.notifications.update_one(
            {
                "id": notification_id,
                "institution_id": user.get("institution_id"),
                "$or": [{"user_id": user["id"]}, {"role": user["role"]}, {"role": "*"}],
            },
            {"$set": {"read": True, "read_at": _now()}},
        )
        return {"ok": True}

    @router.post("/read-all")
    async def mark_all_read(user: dict = Depends(get_current_user)):
        db = get_db()
        await db.notifications.update_many(
            {
                "institution_id": user.get("institution_id"),
                "$or": [{"user_id": user["id"]}, {"role": user["role"]}, {"role": "*"}],
                "read": False,
            },
            {"$set": {"read": True, "read_at": _now()}},
        )
        return {"ok": True}

    @router.post("")
    async def create(payload: NotificationCreate = Body(...), user: dict = Depends(get_current_user)):
        # Only admins / system can publish notifications via this route.
        if user["role"] not in ("super_admin", "institution_admin", "compliance_officer"):
            raise HTTPException(403, "Forbidden")
        await _scope(user, payload.institution_id)
        db = get_db()
        doc = {
            "id": str(uuid.uuid4()),
            "institution_id": payload.institution_id,
            "user_id": payload.user_id,
            "role": payload.role,
            "kind": payload.kind,
            "title": payload.title,
            "body": payload.body,
            "link": payload.link,
            "ts": _now(),
            "read": False,
            "actor": user["email"],
        }
        await db.notifications.insert_one(dict(doc))
        return doc

    return router


def build_tickets_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/tickets", tags=["support_tickets"])

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    @router.get("/{institution_id}")
    async def list_tickets(
        institution_id: str,
        status: Optional[str] = None,
        user: dict = Depends(get_current_user),
    ):
        await _scope(user, institution_id)
        db = get_db()
        q = {"institution_id": institution_id}
        # students see only their own tickets; staff see all
        if user["role"] == "student":
            q["learner_id"] = user["id"]
        if status:
            q["status"] = status
        items = await db.support_tickets.find(q, {"_id": 0}).sort("ts", -1).limit(100).to_list(100)
        return items

    @router.post("")
    async def create_ticket(payload: SupportTicketCreate = Body(...), user: dict = Depends(get_current_user)):
        await _scope(user, payload.institution_id)
        db = get_db()
        ticket = {
            "id": str(uuid.uuid4()),
            "institution_id": payload.institution_id,
            "learner_id": user["id"],
            "learner_name": user["name"],
            "learner_email": user["email"],
            "subject": payload.subject,
            "body": payload.body,
            "category": payload.category,
            "severity": payload.severity,
            "source": payload.source,
            "status": "open",
            "ts": _now(),
            "thread": [],
        }
        await db.support_tickets.insert_one(dict(ticket))
        # Notify the registrar + institution admin role
        for role in ("registrar", "institution_admin"):
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "institution_id": payload.institution_id,
                "user_id": None,
                "role": role,
                "kind": "ticket.new",
                "title": f"New support ticket · {payload.category}",
                "body": payload.subject,
                "link": "/student-assistant#tickets",
                "ts": _now(),
                "read": False,
                "actor": user["email"],
            })
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": payload.institution_id,
            "action": "ticket.create",
            "target": ticket["id"],
            "actor": user["email"],
            "category": payload.category,
            "severity": payload.severity,
            "ts": _now(),
        })
        return ticket

    @router.patch("/{ticket_id}")
    async def update_ticket(
        ticket_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        t = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Not found")
        await _scope(user, t["institution_id"])
        update = {k: v for k, v in payload.items() if k in ("status", "severity", "assignee", "category")}
        if "reply" in payload and payload["reply"]:
            await db.support_tickets.update_one(
                {"id": ticket_id},
                {
                    "$push": {
                        "thread": {
                            "ts": _now(),
                            "actor": user["email"],
                            "actor_name": user["name"],
                            "actor_role": user["role"],
                            "message": payload["reply"],
                        }
                    }
                },
            )
        if update:
            await db.support_tickets.update_one({"id": ticket_id}, {"$set": update})
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": t["institution_id"],
            "action": "ticket.update",
            "target": ticket_id,
            "actor": user["email"],
            "fields": list(update.keys()) + (["reply"] if payload.get("reply") else []),
            "ts": _now(),
        })
        return await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})

    return router
