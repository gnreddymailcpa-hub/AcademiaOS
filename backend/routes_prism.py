"""
PRISM — Research Intelligence backend (Phase 2).

Phase-2 MVP scope:
  - Publications (title, venue, year, citations, authors)
  - Patents (title, status: filed/granted, inventors, year)
  - Grants (agency, amount_lakhs, PI, status, start/end)
  - Aggregate: total citations, h-index proxy, grant value, patents granted
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


class PublicationIn(BaseModel):
    title: str
    venue: str  # Journal / conference name
    year: int
    citations: int = 0
    authors: List[str] = Field(default_factory=list)
    doi: Optional[str] = None
    open_access: bool = False


class PatentIn(BaseModel):
    title: str
    status: str = Field(default="filed", pattern="^(filed|granted|abandoned)$")
    year: int
    inventors: List[str] = Field(default_factory=list)
    patent_number: Optional[str] = None


class GrantIn(BaseModel):
    agency: str
    title: str
    amount_lakhs: float
    pi: str
    status: str = Field(default="active", pattern="^(active|completed|proposed)$")
    start_year: int
    end_year: Optional[int] = None


def _h_index(citations: List[int]) -> int:
    """Compute h-index from a list of citation counts."""
    sorted_c = sorted(citations, reverse=True)
    h = 0
    for i, c in enumerate(sorted_c, start=1):
        if c >= i:
            h = i
        else:
            break
    return h


def build_prism_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/prism", tags=["prism"])

    def _guard(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    def _writer_guard(user):
        if user["role"] not in ("super_admin", "institution_admin", "faculty", "instructor", "research_admin"):
            raise HTTPException(status_code=403, detail="Faculty / research role required")

    async def _audit(db, institution_id, actor, action, target, details):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}", "institution_id": institution_id,
            "ts": _now(), "actor": actor, "action": action, "target": target, "details": details,
        })

    # ----- Publications -----
    @router.get("/{institution_id}/publications")
    async def list_pubs(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.prism_publications.find({"institution_id": institution_id}, {"_id": 0}).sort("year", -1).to_list(1000)

    @router.get("/{institution_id}/publications-by-author")
    async def pubs_by_author(institution_id: str, author: str, user: dict = Depends(get_current_user)):
        """Return publications where any author entry matches `author`.

        Used by FACULTY+ profile cards to surface a researcher's PRISM output
        without forcing an explicit author_id join — the heuristic matches by
        token overlap on the author's display name (typical academic
        convention where the same researcher appears under multiple name
        variants like "Dr Hari", "Hari S.", "S Hari"). We split the query on
        whitespace, strip trailing periods, drop very short / common
        academic prefixes, and consider a paper a match if ANY query token
        is a substring of ANY author string (case-insensitive).
        """
        _guard(user, institution_id)
        db = get_db()
        STOPWORDS = {"dr", "dr.", "prof", "prof.", "mr", "mrs", "ms", "the", "and", "of"}
        tokens = [
            t.strip(".").lower()
            for t in author.split()
            if t and t.strip(".").lower() not in STOPWORDS and len(t.strip(".")) >= 3
        ]
        if not tokens:
            return []
        rows = await db.prism_publications.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("year", -1).to_list(2000)
        return [
            r for r in rows
            if any(
                any(tok in (a or "").lower() for a in r.get("authors", []))
                for tok in tokens
            )
        ]

    @router.post("/{institution_id}/publications")
    async def add_pub(institution_id: str, payload: PublicationIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _writer_guard(user)
        db = get_db()
        doc = {"id": f"pub-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now(), "added_by": user["email"]}
        await db.prism_publications.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "prism.publication.add", doc["id"], {"year": payload.year})
        return doc

    # ----- Patents -----
    @router.get("/{institution_id}/patents")
    async def list_patents(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.prism_patents.find({"institution_id": institution_id}, {"_id": 0}).sort("year", -1).to_list(500)

    @router.post("/{institution_id}/patents")
    async def add_patent(institution_id: str, payload: PatentIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _writer_guard(user)
        db = get_db()
        doc = {"id": f"pat-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now()}
        await db.prism_patents.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "prism.patent.add", doc["id"], {"status": payload.status})
        return doc

    # ----- Grants -----
    @router.get("/{institution_id}/grants")
    async def list_grants(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        return await db.prism_grants.find({"institution_id": institution_id}, {"_id": 0}).sort("start_year", -1).to_list(500)

    @router.post("/{institution_id}/grants")
    async def add_grant(institution_id: str, payload: GrantIn, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        _writer_guard(user)
        db = get_db()
        doc = {"id": f"grt-{uuid4().hex[:10]}", "institution_id": institution_id,
               **payload.model_dump(), "created_at": _now()}
        await db.prism_grants.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "prism.grant.add", doc["id"], {"amount": payload.amount_lakhs})
        return doc

    # ----- Aggregate -----
    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        pubs = await db.prism_publications.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        pats = await db.prism_patents.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        grts = await db.prism_grants.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        total_citations = sum(p.get("citations", 0) for p in pubs)
        h_idx = _h_index([p.get("citations", 0) for p in pubs])
        granted = sum(1 for p in pats if p.get("status") == "granted")
        grant_value = sum(g.get("amount_lakhs", 0) for g in grts if g.get("status") == "active")
        # Per-year publication trend (last 5 years)
        cur = datetime.now(timezone.utc).year
        by_year = []
        for y in range(cur - 4, cur + 1):
            by_year.append({"year": y, "count": sum(1 for p in pubs if p.get("year") == y)})
        return {
            "publications": len(pubs),
            "total_citations": total_citations,
            "h_index": h_idx,
            "patents_filed": len(pats),
            "patents_granted": granted,
            "active_grants": sum(1 for g in grts if g.get("status") == "active"),
            "grant_value_lakhs": round(grant_value, 2),
            "publications_by_year": by_year,
        }

    return router
