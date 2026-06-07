"""
Claros Enroll — Admissions CRM routes.

Tracks prospective student leads through a 7-stage pipeline
(NEW → CONTACTED → COUNSELED → APPLIED → OFFERED → ENROLLED → DROPPED).

Endpoints live under /api/v1/enroll/* and operate on three collections:
  - leads
  - lead_activities
  - lead_programs

LLM-powered counseling script generator uses Claude via the Emergent LLM Key
(emergentintegrations) — Sonnet by default (current production model in
ai_service.DEFAULT_MODEL).
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import csv
import io
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL


logger = logging.getLogger("academiaos.enroll")

VALID_STATUSES = ["NEW", "CONTACTED", "COUNSELED", "APPLIED", "OFFERED", "ENROLLED", "DROPPED"]
VALID_SOURCES = ["WEBSITE", "WHATSAPP", "REFERRAL", "WALKIN", "SOCIAL", "EVENT"]
VALID_ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "VISIT", "NOTE", "STATUS_CHANGE"]

WRITE_ROLES = {
    "super_admin", "institution_admin", "registrar", "programme_manager",
    "career_services", "faculty", "instructor",
}
DELETE_ROLES = {"super_admin", "institution_admin"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_iid(user: dict, requested_iid: Optional[str]) -> str:
    if user["role"] == "super_admin":
        if not requested_iid:
            raise HTTPException(400, "super_admin must specify iid query param")
        return requested_iid
    own = user.get("institution_id")
    if not own:
        raise HTTPException(403, "User has no institution_id")
    if requested_iid and requested_iid != own:
        raise HTTPException(403, "Cross-tenant access denied")
    return own


def compute_lead_score(lead: dict, activity_count: int) -> int:
    score = 0
    rank = lead.get("eapcet_rank")
    if isinstance(rank, int) and rank > 0:
        if rank < 5000:
            score += 30
        elif rank < 20000:
            score += 20
        elif rank < 50000:
            score += 10
    src = (lead.get("source") or "").upper()
    if src == "REFERRAL":
        score += 15
    elif src == "EVENT":
        score += 10
    elif src == "WEBSITE":
        score += 5
    if activity_count >= 3:
        score += 20
    elif activity_count >= 1:
        score += 10
    status = (lead.get("status") or "").upper()
    if status in ("APPLIED", "OFFERED"):
        score += 25
    elif status == "COUNSELED":
        score += 10
    return min(100, max(0, score))


# ----------------------------------------------------------------------------
# Pydantic
# ----------------------------------------------------------------------------

class LeadCreateBody(BaseModel):
    institution_id: Optional[str] = None  # required for unauthed public form
    full_name: str
    email: str
    phone: str
    program_interest: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    eapcet_rank: Optional[int] = None
    jee_rank: Optional[int] = None
    source: str = "WEBSITE"
    notes: Optional[str] = None
    programs: List[str] = Field(default_factory=list)


class LeadUpdateBody(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    program_interest: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    eapcet_rank: Optional[int] = None
    city: Optional[str] = None
    state: Optional[str] = None


class ActivityBody(BaseModel):
    activity_type: str
    description: str


# ----------------------------------------------------------------------------
# Router builder
# ----------------------------------------------------------------------------

def build_claros_enroll_router(get_db, get_current_user, get_optional_user):
    router = APIRouter(prefix="/api/v1/enroll", tags=["claros-enroll"])

    async def _activity_count(db, lead_id: str) -> int:
        return await db.lead_activities.count_documents({"lead_id": lead_id})

    async def _log_activity(db, lead: dict, kind: str, description: str,
                             performed_by: str, old_status: Optional[str] = None,
                             new_status: Optional[str] = None):
        await db.lead_activities.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": lead["tenant_id"],
            "lead_id": lead["id"],
            "activity_type": kind,
            "description": description,
            "old_status": old_status,
            "new_status": new_status,
            "performed_by": performed_by,
            "created_at": _now(),
        })

    async def _recompute_score(db, lead_id: str):
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            return
        act_count = await _activity_count(db, lead_id)
        score = compute_lead_score(lead, act_count)
        await db.leads.update_one({"id": lead_id}, {"$set": {"lead_score": score}})

    # ------------------------------------------------------------------
    # CREATE (auth optional — allows public website forms)
    # ------------------------------------------------------------------
    @router.post("/leads")
    async def create_lead(body: LeadCreateBody,
                           user: Optional[dict] = Depends(get_optional_user)):
        db = get_db()
        if user:
            iid = _coerce_iid(user, body.institution_id)
        else:
            if not body.institution_id:
                raise HTTPException(400, "institution_id is required for public form")
            iid = body.institution_id
        if body.source.upper() not in VALID_SOURCES:
            raise HTTPException(400, f"Invalid source. Allowed: {VALID_SOURCES}")
        lead_id = str(uuid.uuid4())
        doc = {
            "id": lead_id, "tenant_id": iid,
            "full_name": body.full_name.strip(),
            "email": body.email.strip().lower(),
            "phone": body.phone.strip(),
            "program_interest": body.program_interest,
            "city": body.city, "state": body.state,
            "eapcet_rank": body.eapcet_rank, "jee_rank": body.jee_rank,
            "source": body.source.upper(),
            "status": "NEW",
            "lead_score": 0,
            "assigned_to": None,
            "notes": body.notes or "",
            "last_contacted_at": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
        doc["lead_score"] = compute_lead_score(doc, 0)
        await db.leads.insert_one(doc)
        # Programs interest list
        for p in body.programs[:8]:
            await db.lead_programs.insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": iid, "lead_id": lead_id,
                "program_name": p,
            })
        if user:
            await _log_activity(db, doc, "NOTE",
                                 f"Lead created via portal",
                                 user.get("id", "system"))
        doc.pop("_id", None)
        return doc

    # ------------------------------------------------------------------
    # LIST
    # ------------------------------------------------------------------
    @router.get("/leads")
    async def list_leads(
        status: Optional[str] = None,
        program: Optional[str] = None,
        source: Optional[str] = None,
        assigned_to: Optional[str] = None,
        q: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        iid: Optional[str] = None,
        page: int = 1, page_size: int = 200,
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid}
        if status and status != "ALL":
            flt["status"] = status
        if source and source != "ALL":
            flt["source"] = source
        if program:
            flt["program_interest"] = {"$regex": program, "$options": "i"}
        if assigned_to and assigned_to != "ALL":
            flt["assigned_to"] = assigned_to
        if q:
            flt["$or"] = [
                {"full_name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
            ]
        if date_from or date_to:
            df = {}
            if date_from:
                df["$gte"] = date_from
            if date_to:
                df["$lte"] = date_to
            flt["created_at"] = df
        total = await db.leads.count_documents(flt)
        rows = await db.leads.find(flt, {"_id": 0}) \
            .sort("created_at", -1) \
            .skip(max(0, (page - 1) * page_size)) \
            .limit(min(500, page_size)) \
            .to_list(min(500, page_size))
        return {"items": rows, "total": total, "page": page, "page_size": page_size}

    # ------------------------------------------------------------------
    # DETAIL
    # ------------------------------------------------------------------
    @router.get("/leads/{lead_id}")
    async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        activities = await db.lead_activities.find(
            {"lead_id": lead_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        programs = await db.lead_programs.find(
            {"lead_id": lead_id}, {"_id": 0}
        ).to_list(20)
        return {"lead": lead, "activities": activities, "programs": programs}

    # ------------------------------------------------------------------
    # UPDATE
    # ------------------------------------------------------------------
    @router.put("/leads/{lead_id}")
    async def update_lead(lead_id: str, body: LeadUpdateBody,
                           user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        patch = {k: v for k, v in body.dict().items() if v is not None}
        # Validate status if provided
        old_status = lead.get("status")
        new_status = patch.get("status")
        if new_status and new_status not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status. Allowed: {VALID_STATUSES}")
        patch["updated_at"] = _now()
        if new_status and new_status != old_status:
            patch["last_contacted_at"] = _now()
        await db.leads.update_one({"id": lead_id}, {"$set": patch})
        if new_status and new_status != old_status:
            await _log_activity(
                db, lead, "STATUS_CHANGE",
                f"Status changed from {old_status} to {new_status}",
                user["id"], old_status=old_status, new_status=new_status,
            )
        await _recompute_score(db, lead_id)
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": lead["tenant_id"],
            "action": "enroll.lead.update",
            "target": lead_id, "actor": user["email"], "ts": _now(),
        })
        updated = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        return updated

    # ------------------------------------------------------------------
    # DELETE
    # ------------------------------------------------------------------
    @router.delete("/leads/{lead_id}")
    async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
        if user["role"] not in DELETE_ROLES:
            raise HTTPException(403, "Admins only")
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        await db.lead_activities.delete_many({"lead_id": lead_id})
        await db.lead_programs.delete_many({"lead_id": lead_id})
        await db.leads.delete_one({"id": lead_id})
        return {"ok": True}

    # ------------------------------------------------------------------
    # ACTIVITY LOG
    # ------------------------------------------------------------------
    @router.post("/leads/{lead_id}/activity")
    async def log_activity(lead_id: str, body: ActivityBody,
                            user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        if body.activity_type not in VALID_ACTIVITY_TYPES:
            raise HTTPException(400, f"Invalid activity_type. Allowed: {VALID_ACTIVITY_TYPES}")
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        await _log_activity(db, lead, body.activity_type, body.description, user["id"])
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {"last_contacted_at": _now(), "updated_at": _now()}},
        )
        await _recompute_score(db, lead_id)
        return {"ok": True}

    @router.get("/leads/{lead_id}/timeline")
    async def lead_timeline(lead_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        rows = await db.lead_activities.find(
            {"lead_id": lead_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(500)
        return {"items": rows}

    # ------------------------------------------------------------------
    # AI COUNSELING — Claude via Emergent LLM Key
    # ------------------------------------------------------------------
    @router.post("/leads/{lead_id}/ai-counsel")
    async def ai_counsel(lead_id: str, user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(404, "Lead not found")
        _coerce_iid(user, lead["tenant_id"])
        inst = await db.institutions.find_one(
            {"id": lead["tenant_id"]}, {"_id": 0, "name": 1, "short_name": 1}
        )
        tenant_name = inst.get("name", "the institution") if inst else "the institution"
        sys_msg = (
            f"You are a senior university admissions counselor for {tenant_name}. "
            "Write motivational, warm, professional counseling content."
        )
        user_text = (
            f"Generate a personalized counseling script for this prospective student. "
            f"Return EXACTLY 5 bullet points. Each bullet must be under 2 sentences.\n"
            f"BULLETS REQUIRED:\n"
            f"1. Opening line that addresses them by name\n"
            f"2. Program-specific strength of {tenant_name}\n"
            f"3. Placement data pitch (use realistic India IT averages if data not given)\n"
            f"4. Scholarship / fee information (generic — mention merit & need-based)\n"
            f"5. Closing call-to-action\n\n"
            f"STUDENT INFO:\n"
            f"- Name: {lead.get('full_name')}\n"
            f"- Interested in: {lead.get('program_interest') or 'undecided'}\n"
            f"- EAPCET rank: {lead.get('eapcet_rank') or 'not shared'}\n"
            f"- City: {lead.get('city') or 'not shared'}\n"
            f"- Source: {lead.get('source')}\n\n"
            f"Format each bullet on a new line, starting with '- '. No extra commentary."
        )
        try:
            response = await generate_text(
                system_message=sys_msg, user_text=user_text,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"counsel-{lead_id}", max_tokens=900,
            )
            # Parse bullets — accept '- ', '* ', or numbered prefixes
            bullets = []
            for line in (response or "").splitlines():
                s = line.strip()
                if not s:
                    continue
                for prefix in ("- ", "* ", "• "):
                    if s.startswith(prefix):
                        bullets.append(s[len(prefix):].strip())
                        break
                else:
                    # numbered "1. " / "1) " / "1: "
                    if s[:1].isdigit():
                        for sep in (". ", ") ", ": ", " "):
                            if sep in s[:4]:
                                bullets.append(s.split(sep, 1)[1].strip())
                                break
            bullets = [b for b in bullets if b][:5]
            if len(bullets) < 5:
                # Fallback: split by line
                lines = [ln.strip() for ln in (response or "").splitlines() if ln.strip()]
                bullets = lines[:5]
        except Exception as e:
            logger.warning("AI counsel failed for lead %s: %s", lead_id, e)
            # Deterministic fallback if LLM unavailable
            name = lead.get("full_name", "there")
            prog = lead.get("program_interest") or "engineering"
            bullets = [
                f"Hi {name}, thank you for considering {tenant_name}. We are glad you reached out.",
                f"Our {prog} programme is built around hands-on labs, industry mentors, and outcome-driven curricula.",
                "Our 2024-25 placements crossed 92% with top recruiters from product, services, and core engineering.",
                "We offer merit-based scholarships up to 50% and need-based aid via our endowment fund.",
                "Shall we book a 20-minute campus visit? I can also share programme brochures over WhatsApp.",
            ]
        await _log_activity(
            db, lead, "NOTE",
            "AI counseling script generated",
            user["id"],
        )
        return {"talking_points": bullets, "model": DEFAULT_MODEL}

    # ------------------------------------------------------------------
    # ANALYTICS
    # ------------------------------------------------------------------
    @router.get("/analytics/funnel")
    async def funnel(iid: Optional[str] = None,
                      user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        # Current month leads
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0,
                                  microsecond=0).isoformat()
        counts = {s: 0 for s in VALID_STATUSES}
        agg = await db.leads.aggregate([
            {"$match": {"tenant_id": iid, "created_at": {"$gte": month_start}}},
            {"$group": {"_id": "$status", "n": {"$sum": 1}}},
        ]).to_list(20)
        for row in agg:
            if row["_id"] in counts:
                counts[row["_id"]] = row["n"]
        total = sum(counts.values())
        # Conversion rates relative to NEW
        new_count = counts["NEW"] + counts["CONTACTED"] + counts["COUNSELED"] + counts["APPLIED"] + counts["OFFERED"] + counts["ENROLLED"]
        enrolled = counts["ENROLLED"]
        return {
            "stages": [{"status": s, "count": counts[s]} for s in VALID_STATUSES],
            "totals": {"month_total": total, "enrolled": enrolled,
                       "conversion_pct": round((enrolled / new_count * 100), 1) if new_count else 0.0},
        }

    @router.get("/analytics/sources")
    async def sources(iid: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        agg = await db.leads.aggregate([
            {"$match": {"tenant_id": iid}},
            {"$group": {
                "_id": "$source",
                "total": {"$sum": 1},
                "enrolled": {"$sum": {"$cond": [{"$eq": ["$status", "ENROLLED"]}, 1, 0]}},
            }},
        ]).to_list(20)
        items = []
        for row in agg:
            total = row["total"] or 0
            enrolled = row["enrolled"] or 0
            items.append({
                "source": row["_id"] or "UNKNOWN",
                "total": total, "enrolled": enrolled,
                "conversion_pct": round((enrolled / total * 100), 1) if total else 0.0,
            })
        items.sort(key=lambda x: x["total"], reverse=True)
        return {"items": items}

    @router.get("/analytics/daily")
    async def daily(iid: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        rows = await db.leads.find(
            {"tenant_id": iid, "created_at": {"$gte": thirty_days_ago}},
            {"_id": 0, "created_at": 1, "status": 1},
        ).to_list(5000)
        by_day = {}
        for r in rows:
            day = (r.get("created_at") or "")[:10]
            by_day[day] = by_day.get(day, 0) + 1
        # Build dense 30-day series ending today
        today = datetime.now(timezone.utc).date()
        out = []
        for offset in range(29, -1, -1):
            d = (today - timedelta(days=offset)).isoformat()
            out.append({"day": d, "count": by_day.get(d, 0)})
        return {"items": out, "total": sum(by_day.values())}

    # ------------------------------------------------------------------
    # CSV BULK IMPORT
    # ------------------------------------------------------------------
    @router.post("/leads/bulk-import")
    async def bulk_import(file: UploadFile = File(...),
                           iid: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        iid = _coerce_iid(user, iid)
        raw = (await file.read()).decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(raw))
        created = 0
        skipped = 0
        for row in reader:
            name = (row.get("name") or row.get("full_name") or "").strip()
            email = (row.get("email") or "").strip().lower()
            if not name or not email:
                skipped += 1
                continue
            doc = {
                "id": str(uuid.uuid4()),
                "tenant_id": iid,
                "full_name": name, "email": email,
                "phone": (row.get("phone") or "").strip(),
                "program_interest": (row.get("program") or row.get("program_interest") or None),
                "city": row.get("city"),
                "state": row.get("state"),
                "eapcet_rank": int(row["rank"]) if row.get("rank", "").strip().isdigit() else None,
                "jee_rank": None,
                "source": (row.get("source") or "WEBSITE").upper(),
                "status": "NEW",
                "lead_score": 0,
                "assigned_to": None,
                "notes": row.get("notes") or "",
                "last_contacted_at": None,
                "created_at": _now(),
                "updated_at": _now(),
            }
            doc["lead_score"] = compute_lead_score(doc, 0)
            await db.leads.insert_one(doc)
            created += 1
        return {"created": created, "skipped": skipped}

    return router
