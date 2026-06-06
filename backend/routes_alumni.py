"""
ALUMNI360 — Alumni network backend (Phase 2).

Phase-2 MVP scope:
  - Alumni directory (graduation_year, branch, company, role, location)
  - Mentorship pairings (alumni mentor <-> student mentee)
  - Giving / donations tracker (campaign, amount, donor)
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class AlumniIn(BaseModel):
    name: str
    email: str
    graduation_year: int
    branch: str
    company: Optional[str] = ""
    role: Optional[str] = ""
    location: Optional[str] = ""
    available_for_mentorship: bool = False


class MentorshipIn(BaseModel):
    mentor_alumni_id: str
    mentee_student_id: str
    mentee_name: str
    focus_area: str


class DonationIn(BaseModel):
    donor_alumni_id: str
    donor_name: str
    campaign: str
    amount_inr: float


def build_alumni_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/alumni", tags=["alumni"])

    def _guard(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ----- Directory -----
    @router.get("/{institution_id}/directory")
    async def directory(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.alumni_directory.find({"institution_id": institution_id}, {"_id": 0}).sort("graduation_year", -1).to_list(2000)

    @router.get("/{institution_id}/mentor-match")
    async def mentor_match(
        institution_id: str,
        branch: Optional[str] = None,
        role: Optional[str] = None,
        limit: int = 5,
        user: dict = Depends(get_current_user),
    ):
        """Surface up to `limit` available mentors ranked by branch + role match.

        Used by the Student Assistant aside to recommend alumni mentors to
        students based on their branch and target career role. Scoring:
          + 50 for exact branch match
          + 30 for case-insensitive substring match on company OR role
          + 0.5 per year since graduation (capped at 10 → experience proxy)
        Only returns alumni with `available_for_mentorship=True`.
        """
        _guard(user, institution_id)
        db = get_db()
        rows = await db.alumni_directory.find(
            {"institution_id": institution_id, "available_for_mentorship": True},
            {"_id": 0},
        ).to_list(2000)
        b = (branch or "").strip().lower()
        r = (role or "").strip().lower()
        now_year = datetime.now(timezone.utc).year
        scored = []
        for a in rows:
            s = 0
            if b and (a.get("branch") or "").lower() == b:
                s += 50
            if r and (r in (a.get("role") or "").lower() or r in (a.get("company") or "").lower()):
                s += 30
            yrs = max(0, now_year - (a.get("graduation_year") or now_year))
            s += min(yrs * 0.5, 10)
            scored.append({**a, "match_score": round(s, 1)})
        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[: max(1, min(limit, 20))]

    @router.post("/{institution_id}/directory")
    async def add_alumnus(institution_id: str, payload: AlumniIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "registrar", "alumni_admin"):
            raise HTTPException(status_code=403, detail="Admin / alumni cell role required")
        db = get_db()
        doc = {"id": f"al-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now()}
        await db.alumni_directory.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "alumni.directory.add", doc["id"], {"year": payload.graduation_year})
        return doc

    # ----- Mentorship -----
    @router.get("/{institution_id}/mentorships")
    async def list_mentorships(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.alumni_mentorships.find({"institution_id": institution_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/{institution_id}/mentorships")
    async def add_mentorship(institution_id: str, payload: MentorshipIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        # Validate mentor exists and is available
        mentor = await db.alumni_directory.find_one(
            {"id": payload.mentor_alumni_id, "institution_id": institution_id}, {"_id": 0}
        )
        if not mentor:
            raise HTTPException(status_code=404, detail="Mentor alumni not found")
        if not mentor.get("available_for_mentorship"):
            raise HTTPException(status_code=400, detail="Mentor not available")
        doc = {"id": f"mp-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "mentor_name": mentor.get("name"),
               "status": "active", "created_at": _now(), "created_by": user["email"]}
        await db.alumni_mentorships.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "alumni.mentorship.pair", doc["id"],
                     {"mentor": mentor.get("name"), "mentee": payload.mentee_name})
        return doc

    # ----- Donations -----
    @router.get("/{institution_id}/donations")
    async def list_donations(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.alumni_donations.find({"institution_id": institution_id}, {"_id": 0}).sort("amount_inr", -1).to_list(500)

    @router.post("/{institution_id}/donations")
    async def add_donation(institution_id: str, payload: DonationIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "registrar", "alumni_admin"):
            raise HTTPException(status_code=403, detail="Admin / alumni cell role required")
        db = get_db()
        doc = {"id": f"dn-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "received_at": _now(), "recorded_by": user["email"]}
        await db.alumni_donations.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "alumni.donation.record", doc["id"],
                     {"campaign": payload.campaign, "amount": payload.amount_inr})
        return doc

    # ----- Summary -----
    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        alumni = await db.alumni_directory.find({"institution_id": institution_id}, {"_id": 0}).to_list(5000)
        mentorships = await db.alumni_mentorships.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        donations = await db.alumni_donations.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        total_giving = sum(d.get("amount_inr", 0) for d in donations)
        # Top campaigns by amount
        by_campaign = {}
        for d in donations:
            by_campaign[d["campaign"]] = by_campaign.get(d["campaign"], 0) + d.get("amount_inr", 0)
        campaigns = sorted(
            [{"campaign": k, "amount_inr": v} for k, v in by_campaign.items()],
            key=lambda x: x["amount_inr"], reverse=True
        )
        return {
            "alumni": len(alumni),
            "available_mentors": sum(1 for a in alumni if a.get("available_for_mentorship")),
            "active_mentorships": sum(1 for m in mentorships if m.get("status") == "active"),
            "total_donations": len(donations),
            "total_giving_inr": round(total_giving, 2),
            "top_campaigns": campaigns[:5],
        }

    return router
