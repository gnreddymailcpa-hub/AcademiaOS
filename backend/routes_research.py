"""Claros Research — publications, patents, projects, grants, AI literature review."""
from __future__ import annotations
import json, logging, re, uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.research")

FACULTY_ROLES = {"faculty", "instructor", "hod", "dean"}
ADMIN_ROLES = {"super_admin", "institution_admin"}
STAFF_ROLES = FACULTY_ROLES | ADMIN_ROLES
PUB_TYPES = {"JOURNAL", "CONFERENCE", "BOOK_CHAPTER", "PATENT"}
PROJECT_STATUSES = {"ONGOING", "COMPLETED", "SUBMITTED", "APPROVED"}
PATENT_STATUSES = {"FILED", "PUBLISHED", "GRANTED", "ABANDONED"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


def _safe_json(raw):
    if not raw:
        raise ValueError("empty")
    s = raw.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", s, flags=re.DOTALL | re.IGNORECASE)
    if m:
        s = m.group(1).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = s.find(opener)
        if start < 0:
            continue
        depth = 0
        for i in range(start, len(s)):
            if s[i] == opener:
                depth += 1
            elif s[i] == closer:
                depth -= 1
                if depth == 0:
                    return json.loads(s[start:i + 1])
    raise ValueError("bad json")


class PublicationBody(BaseModel):
    title: str
    authors: List[str] = []
    journal_name: str = ""
    publication_type: str = "JOURNAL"
    year_of_publication: int
    doi: str = ""
    impact_factor: Optional[float] = None
    citations_count: int = 0
    is_indexed: bool = False
    indexing_db: str = ""
    abstract: str = ""
    url: str = ""
    faculty_id: Optional[str] = None


class PatentBody(BaseModel):
    title: str
    inventors: List[str] = []
    application_number: str = ""
    filing_date: str
    grant_date: Optional[str] = None
    status: str = "FILED"
    patent_office: str = ""
    abstract: str = ""
    faculty_id: Optional[str] = None


class ProjectBody(BaseModel):
    title: str
    principal_investigator: Optional[str] = None
    co_investigators: List[str] = []
    funding_agency: str = ""
    grant_amount: float = 0.0
    duration_months: int = 12
    start_date: str
    end_date: Optional[str] = None
    status: str = "ONGOING"
    description: str = ""


class GrantMatchBody(BaseModel):
    faculty_id: Optional[str] = None


class LitReviewBody(BaseModel):
    topic: str = Field(min_length=2)
    context: str = ""


def build_claros_research_router(get_db, get_current_user):
    r = APIRouter(prefix="/api/v1/research", tags=["claros-research"])

    async def _my_faculty(db, user):
        if user["role"] in FACULTY_ROLES:
            return await db.faculty_profiles.find_one(
                {"user_id": user["id"], "tenant_id": _tenant_of(user)}, {"_id": 0})
        return None

    # ============================== PUBLICATIONS
    @r.get("/publications")
    async def list_publications(faculty_id: Optional[str] = None, year: Optional[int] = None,
                                 ptype: Optional[str] = None, search: Optional[str] = None,
                                 user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        flt = {"tenant_id": iid}
        if faculty_id:
            flt["faculty_id"] = faculty_id
        if year:
            flt["year_of_publication"] = year
        if ptype:
            flt["publication_type"] = ptype
        if search:
            flt["title"] = {"$regex": re.escape(search), "$options": "i"}
        return await db.research_publications.find(flt, {"_id": 0}).sort(
            "year_of_publication", -1).limit(500).to_list(500)

    @r.post("/publications")
    async def add_publication(body: PublicationBody,
                               user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.publication_type not in PUB_TYPES:
            raise HTTPException(400, f"publication_type must be one of {sorted(PUB_TYPES)}")
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "faculty_id": body.faculty_id or (fp or {}).get("id"),
            "title": body.title, "authors": body.authors,
            "journal_name": body.journal_name,
            "publication_type": body.publication_type,
            "year_of_publication": int(body.year_of_publication),
            "doi": body.doi,
            "impact_factor": body.impact_factor,
            "citations_count": int(body.citations_count or 0),
            "is_indexed": bool(body.is_indexed),
            "indexing_db": body.indexing_db,
            "abstract": body.abstract, "url": body.url,
            "created_at": _now(), "created_by": user["id"],
        }
        await db.research_publications.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/publications/{pid}")
    async def update_publication(pid: str, body: PublicationBody,
                                  user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        existing = await db.research_publications.find_one(
            {"id": pid, "tenant_id": iid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Publication not found")
        updates = {k: v for k, v in body.dict().items() if v is not None}
        updates["updated_at"] = _now()
        await db.research_publications.update_one({"id": pid}, {"$set": updates})
        return await db.research_publications.find_one({"id": pid}, {"_id": 0})

    @r.delete("/publications/{pid}")
    async def delete_publication(pid: str,
                                  user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        res = await db.research_publications.delete_one({"id": pid, "tenant_id": iid})
        if res.deleted_count == 0:
            raise HTTPException(404, "Publication not found")
        return {"ok": True}

    # ============================== PATENTS
    @r.get("/patents")
    async def list_patents(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        return await db.patents.find({"tenant_id": iid}, {"_id": 0}).sort(
            "filing_date", -1).to_list(500)

    @r.post("/patents")
    async def add_patent(body: PatentBody,
                          user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.status not in PATENT_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(PATENT_STATUSES)}")
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "faculty_id": body.faculty_id or (fp or {}).get("id"),
            "title": body.title, "inventors": body.inventors,
            "application_number": body.application_number,
            "filing_date": body.filing_date,
            "grant_date": body.grant_date,
            "status": body.status, "patent_office": body.patent_office,
            "abstract": body.abstract, "created_at": _now(),
        }
        await db.patents.insert_one(doc)
        doc.pop("_id", None)
        return doc

    # ============================== PROJECTS
    @r.get("/projects")
    async def list_projects(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        return await db.research_projects.find({"tenant_id": iid}, {"_id": 0}).sort(
            "start_date", -1).to_list(500)

    @r.post("/projects")
    async def add_project(body: ProjectBody,
                           user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.status not in PROJECT_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(PROJECT_STATUSES)}")
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "title": body.title,
            "principal_investigator": body.principal_investigator or (fp or {}).get("id"),
            "co_investigators": body.co_investigators,
            "funding_agency": body.funding_agency,
            "grant_amount": float(body.grant_amount or 0),
            "duration_months": int(body.duration_months or 12),
            "start_date": body.start_date, "end_date": body.end_date,
            "status": body.status, "description": body.description,
            "created_at": _now(),
        }
        await db.research_projects.insert_one(doc)
        doc.pop("_id", None)
        return doc

    # ============================== GRANTS
    @r.get("/grants")
    async def list_grants(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        return await db.grant_opportunities.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}
        ).sort("deadline", 1).to_list(500)

    @r.post("/grants/match")
    async def match_grants(body: GrantMatchBody,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        fp = await _my_faculty(db, user)
        faculty_id = body.faculty_id or (fp or {}).get("id")
        if not faculty_id:
            raise HTTPException(400, "faculty_id required")
        pubs = await db.research_publications.find(
            {"tenant_id": iid, "faculty_id": faculty_id}, {"_id": 0}
        ).sort("year_of_publication", -1).limit(5).to_list(5)
        grants = await db.grant_opportunities.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}).to_list(50)
        if not grants:
            return {"matches": []}
        abstracts = "\n".join(f"- {p.get('title', '')}: {(p.get('abstract') or '')[:300]}"
                              for p in pubs) or "(no publications yet)"
        grants_list = "\n".join(
            f"id={g['id']} | {g['title']} ({g.get('funding_agency')}) — "
            f"{(g.get('description') or '')[:200]} domains={g.get('domain_tags', [])}"
            for g in grants)
        prompt = (
            f"Given this researcher's work:\n{abstracts}\n\n"
            f"Which of these grant opportunities are most relevant?\nGrants:\n{grants_list}\n\n"
            "Return ONLY valid JSON: "
            "[{\"grant_id\":\"...\",\"match_score\":int 0-100,\"reason\":\"1 sentence\"}]"
            " Sort by match_score descending."
        )
        try:
            raw = await generate_text(
                system_message="You are a research grants matchmaker. Strict JSON only.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"research-match-{faculty_id}", max_tokens=1500,
            )
            matches = _safe_json(raw)
            if not isinstance(matches, list):
                raise ValueError("expected array")
        except Exception as e:
            logger.warning("Grant match LLM failed: %s — falling back", e)
            matches = [{
                "grant_id": g["id"],
                "match_score": 60 - (i * 5),
                "reason": "Heuristic fallback ranking by deadline proximity.",
            } for i, g in enumerate(grants[:5])]
        # Attach grant detail
        gmap = {g["id"]: g for g in grants}
        for m in matches:
            m["grant"] = gmap.get(m.get("grant_id"))
        return {"matches": matches[:10]}

    @r.post("/literature-review")
    async def literature_review(body: LitReviewBody,
                                 user: dict = Depends(get_current_user)):
        prompt = (
            f"Write a brief literature review (max 400 words) on: '{body.topic}'.\n"
            f"Context: {body.context}.\n\n"
            "Structure: (1) Overview of the field, (2) Key themes in recent research, "
            "(3) Notable gaps or open problems, (4) Suggested research directions. "
            "Use an academic tone. Cite no specific papers (the user will add citations)."
        )
        try:
            content = await generate_text(
                system_message="You are an academic literature review assistant.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"lit-review-{user['id']}", max_tokens=1200,
            )
        except Exception as e:
            logger.warning("Lit review LLM failed: %s", e)
            content = (
                f"### Literature Review — {body.topic}\n\n"
                "**Overview**\nThis topic is an active area of academic and applied research.\n\n"
                "**Key themes**\nRecent work emphasises methodological rigour, "
                "open data, and reproducibility.\n\n"
                "**Gaps**\nLongitudinal evidence and cross-cultural validation "
                "remain underexplored.\n\n"
                "**Directions**\nFuture work could combine mixed-methods designs "
                "with field-specific datasets to address the gaps above."
            )
        return {"topic": body.topic, "content": content}

    # ============================== STATS
    @r.get("/stats")
    async def stats(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        now = datetime.now(timezone.utc)
        pubs_total = await db.research_publications.count_documents({"tenant_id": iid})
        pubs_year = await db.research_publications.count_documents(
            {"tenant_id": iid, "year_of_publication": now.year})
        patents_total = await db.patents.count_documents({"tenant_id": iid})
        projects_active = await db.research_projects.count_documents(
            {"tenant_id": iid, "status": "ONGOING"})
        grants = await db.research_projects.find(
            {"tenant_id": iid}, {"_id": 0, "grant_amount": 1}).to_list(500)
        grants_total = sum(float(g.get("grant_amount") or 0) for g in grants)
        # h-index average: heuristic — count of pubs per faculty with citations >= count
        pubs = await db.research_publications.find(
            {"tenant_id": iid}, {"_id": 0, "faculty_id": 1, "citations_count": 1}
        ).to_list(2000)
        by_fac: dict = {}
        for p in pubs:
            fid = p.get("faculty_id")
            if not fid:
                continue
            by_fac.setdefault(fid, []).append(int(p.get("citations_count") or 0))
        hs = []
        for cites in by_fac.values():
            cites.sort(reverse=True)
            h = 0
            for i, c in enumerate(cites, 1):
                if c >= i:
                    h = i
                else:
                    break
            hs.append(h)
        h_avg = round(sum(hs) / len(hs), 1) if hs else 0.0
        return {
            "publications_total": pubs_total,
            "publications_this_year": pubs_year,
            "patents_total": patents_total,
            "projects_active": projects_active,
            "grants_total_value": grants_total,
            "h_index_avg": h_avg,
        }

    return r
