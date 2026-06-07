"""
Claros Comply — NAAC accreditation intelligence routes.

Endpoints live under /api/v1/comply/* and track all 7 NAAC criteria,
evidence documents, OBE PO/CO mapping, and accreditation readiness.

LLM-powered AQAR section drafting uses Claude via the Emergent LLM Key.
"""
from datetime import datetime, timezone
from typing import List, Optional
import logging
import os
import uuid

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, UploadFile,
)
from pydantic import BaseModel, Field

from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL


logger = logging.getLogger("academiaos.comply")

ADMIN_ROLES = {"super_admin", "institution_admin", "compliance_officer",
               "ai_governance_admin", "registrar", "iqac_coordinator"}
WRITE_ROLES = ADMIN_ROLES | {"faculty", "instructor", "hod", "programme_manager"}

UPLOAD_DIR = "/app/backend/uploads/comply"
os.makedirs(UPLOAD_DIR, exist_ok=True)


NAAC_CRITERIA_SEED = [
    {"code": 1, "name": "Curricular Aspects", "max_score": 150,
     "description": "Curriculum design, development, deployment and quality."},
    {"code": 2, "name": "Teaching-Learning and Evaluation", "max_score": 350,
     "description": "Pedagogy, assessment, faculty efficacy, ICT-enabled learning."},
    {"code": 3, "name": "Research, Innovations and Extension", "max_score": 250,
     "description": "Research output, patents, consultancy, community engagement."},
    {"code": 4, "name": "Infrastructure and Learning Resources", "max_score": 100,
     "description": "Physical, library, ICT, sports and maintenance."},
    {"code": 5, "name": "Student Support and Progression", "max_score": 100,
     "description": "Scholarships, placements, alumni, grievance handling."},
    {"code": 6, "name": "Governance, Leadership and Management", "max_score": 100,
     "description": "Vision, strategy, internal QA, financial management."},
    {"code": 7, "name": "Institutional Values and Best Practices", "max_score": 100,
     "description": "Gender equity, environmental consciousness, inclusive practices."},
]


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


def projected_grade(pct: float) -> str:
    if pct >= 90:
        return "A++"
    if pct >= 80:
        return "A+"
    if pct >= 65:
        return "A"
    if pct >= 55:
        return "B++"
    if pct >= 45:
        return "B+"
    if pct >= 35:
        return "B"
    return "C"


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------

class MetricUpdateBody(BaseModel):
    current_value: float


class AqarGenerateBody(BaseModel):
    criterion_id: str
    academic_year: str = "2025-26"


class CoPoMappingBody(BaseModel):
    course_outcome_id: str
    program_outcome_id: str
    level: int = Field(ge=0, le=3)


# ---------------------------------------------------------------------------
# Seed helpers (called from server startup)
# ---------------------------------------------------------------------------

async def seed_naac_criteria(db, logger):
    """Idempotently seed the 7 canonical NAAC criteria."""
    inserted = 0
    for c in NAAC_CRITERIA_SEED:
        # deterministic UUID per code
        cid = str(uuid.uuid5(uuid.NAMESPACE_OID, f"naac-criterion-{c['code']}"))
        existing = await db.naac_criteria.find_one({"id": cid}, {"id": 1})
        if existing:
            continue
        await db.naac_criteria.insert_one({
            "id": cid,
            "code": c["code"],
            "name": c["name"],
            "max_score": c["max_score"],
            "description": c["description"],
            "created_at": _now(),
        })
        inserted += 1
    logger.info("NAAC criteria seeded · %s new (total %s)", inserted,
                len(NAAC_CRITERIA_SEED))


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def build_claros_comply_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/v1/comply", tags=["claros-comply"])

    async def _criteria_map(db):
        rows = await db.naac_criteria.find({}, {"_id": 0}).sort("code", 1).to_list(20)
        return rows

    async def _criterion_score(db, iid: str, criterion: dict) -> dict:
        """Compute current_score = ratio of (sum of current/target) × max_score."""
        metrics = await db.naac_metrics.find(
            {"tenant_id": iid, "criterion_id": criterion["id"]}, {"_id": 0}
        ).to_list(100)
        if not metrics:
            return {
                "criterion_id": criterion["id"],
                "code": criterion["code"], "name": criterion["name"],
                "current_score": 0.0, "max_score": float(criterion["max_score"]),
                "metric_count": 0, "evidence_count": 0,
                "readiness_pct": 0.0,
            }
        ratios = []
        for m in metrics:
            tgt = float(m.get("target_value") or 0)
            cur = float(m.get("current_value") or 0)
            if tgt > 0:
                ratios.append(min(1.0, cur / tgt))
        avg_ratio = sum(ratios) / len(ratios) if ratios else 0.0
        current_score = round(avg_ratio * float(criterion["max_score"]), 2)
        evidence_count = await db.evidence_documents.count_documents(
            {"tenant_id": iid, "criterion_id": criterion["id"]}
        )
        # boost for evidence saturation (cap +5% of max if ≥3 evidence docs)
        if evidence_count >= 3:
            current_score = min(float(criterion["max_score"]),
                                current_score + 0.05 * float(criterion["max_score"]))
        return {
            "criterion_id": criterion["id"],
            "code": criterion["code"], "name": criterion["name"],
            "current_score": round(current_score, 2),
            "max_score": float(criterion["max_score"]),
            "metric_count": len(metrics),
            "evidence_count": evidence_count,
            "readiness_pct": round(current_score / float(criterion["max_score"]) * 100, 1) if criterion["max_score"] else 0.0,
        }

    # ----------------------------------------------------------- DASHBOARD
    @router.get("/dashboard")
    async def dashboard(iid: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        criteria = await _criteria_map(db)
        out = []
        for c in criteria:
            out.append(await _criterion_score(db, iid, c))
        return {"items": out}

    # ----------------------------------------------------------- READINESS
    @router.get("/readiness")
    async def readiness(iid: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        criteria = await _criteria_map(db)
        per = []
        total_current = 0.0
        total_max = 0.0
        for c in criteria:
            row = await _criterion_score(db, iid, c)
            per.append(row)
            total_current += row["current_score"]
            total_max += row["max_score"]
            # Cache readiness row
            await db.accreditation_readiness.update_one(
                {"tenant_id": iid, "criterion_id": c["id"]},
                {"$set": {
                    "id": f"{iid}-{c['id']}",
                    "tenant_id": iid, "criterion_id": c["id"],
                    "computed_score": row["current_score"],
                    "max_score": row["max_score"],
                    "evidence_count": row["evidence_count"],
                    "computed_at": _now(),
                }},
                upsert=True,
            )
        overall_pct = round((total_current / total_max) * 100, 1) if total_max else 0.0
        return {
            "overall_score": round(total_current, 2),
            "max_score": round(total_max, 2),
            "overall_pct": overall_pct,
            "per_criterion": per,
            "grade_projection": projected_grade(overall_pct),
        }

    # ----------------------------------------------------------- CRITERIA
    @router.get("/criteria")
    async def list_criteria(user: dict = Depends(get_current_user)):
        db = get_db()
        return await _criteria_map(db)

    @router.get("/criteria/{criterion_id}")
    async def get_criterion(criterion_id: str,
                             iid: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        c = await db.naac_criteria.find_one({"id": criterion_id}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Criterion not found")
        metrics = await db.naac_metrics.find(
            {"tenant_id": iid, "criterion_id": criterion_id}, {"_id": 0}
        ).sort("metric_code", 1).to_list(100)
        evidence = await db.evidence_documents.find(
            {"tenant_id": iid, "criterion_id": criterion_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        score = await _criterion_score(db, iid, c)
        return {"criterion": c, "metrics": metrics, "evidence": evidence,
                "score": score}

    # ----------------------------------------------------------- METRICS
    @router.get("/metrics")
    async def list_metrics(criterion_id: Optional[str] = None,
                            iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid}
        if criterion_id:
            flt["criterion_id"] = criterion_id
        rows = await db.naac_metrics.find(flt, {"_id": 0}) \
            .sort("metric_code", 1).to_list(500)
        return {"items": rows}

    @router.put("/metrics/{metric_id}")
    async def update_metric(metric_id: str, body: MetricUpdateBody,
                             user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Admin/IQAC only")
        db = get_db()
        m = await db.naac_metrics.find_one({"id": metric_id}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Metric not found")
        _coerce_iid(user, m["tenant_id"])
        await db.naac_metrics.update_one(
            {"id": metric_id},
            {"$set": {"current_value": float(body.current_value),
                      "last_updated": _now()}},
        )
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": m["tenant_id"],
            "action": "comply.metric.update",
            "target": metric_id, "actor": user["email"], "ts": _now(),
        })
        updated = await db.naac_metrics.find_one({"id": metric_id}, {"_id": 0})
        return updated

    # ----------------------------------------------------------- EVIDENCE
    @router.post("/evidence/upload")
    async def upload_evidence(
        criterion_id: str = Form(...),
        title: str = Form(...),
        academic_year: str = Form("2025-26"),
        description: str = Form(""),
        metric_id: Optional[str] = Form(None),
        file: UploadFile = File(...),
        user: dict = Depends(get_current_user),
    ):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        iid = user["institution_id"]
        criterion = await db.naac_criteria.find_one({"id": criterion_id}, {"_id": 0})
        if not criterion:
            raise HTTPException(404, "Criterion not found")
        # Save to disk
        ev_id = str(uuid.uuid4())
        safe_name = "".join(ch for ch in file.filename if ch.isalnum() or ch in "._-")
        path = os.path.join(UPLOAD_DIR, f"{ev_id}-{safe_name}")
        with open(path, "wb") as fp:
            fp.write(await file.read())
        doc = {
            "id": ev_id, "tenant_id": iid,
            "criterion_id": criterion_id,
            "metric_id": metric_id,
            "title": title.strip(),
            "description": description,
            "academic_year": academic_year,
            "file_url": f"/uploads/comply/{ev_id}-{safe_name}",
            "filename": safe_name,
            "uploaded_by": user["id"],
            "uploaded_by_email": user["email"],
            "is_verified": False,
            "created_at": _now(),
        }
        await db.evidence_documents.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/evidence")
    async def list_evidence(criterion_id: Optional[str] = None,
                             academic_year: Optional[str] = None,
                             iid: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        flt = {"tenant_id": iid}
        if criterion_id:
            flt["criterion_id"] = criterion_id
        if academic_year:
            flt["academic_year"] = academic_year
        rows = await db.evidence_documents.find(flt, {"_id": 0}) \
            .sort("created_at", -1).to_list(500)
        return {"items": rows}

    @router.delete("/evidence/{evidence_id}")
    async def delete_evidence(evidence_id: str,
                                user: dict = Depends(get_current_user)):
        if user["role"] not in ADMIN_ROLES:
            raise HTTPException(403, "Admin only")
        db = get_db()
        ev = await db.evidence_documents.find_one({"id": evidence_id}, {"_id": 0})
        if not ev:
            raise HTTPException(404, "Evidence not found")
        _coerce_iid(user, ev["tenant_id"])
        # Best-effort file removal
        if ev.get("file_url"):
            path = os.path.join(UPLOAD_DIR, ev["file_url"].rsplit("/", 1)[-1])
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except OSError:
                pass
        await db.evidence_documents.delete_one({"id": evidence_id})
        return {"ok": True}

    # ----------------------------------------------------------- AQAR
    @router.post("/aqar/generate")
    async def aqar_generate(body: AqarGenerateBody,
                             user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        iid = user["institution_id"]
        criterion = await db.naac_criteria.find_one({"id": body.criterion_id}, {"_id": 0})
        if not criterion:
            raise HTTPException(404, "Criterion not found")
        metrics = await db.naac_metrics.find(
            {"tenant_id": iid, "criterion_id": body.criterion_id}, {"_id": 0}
        ).to_list(50)
        evidence = await db.evidence_documents.find(
            {"tenant_id": iid, "criterion_id": body.criterion_id,
             "academic_year": body.academic_year}, {"_id": 0, "title": 1}
        ).to_list(50)
        inst = await db.institutions.find_one(
            {"id": iid}, {"_id": 0, "name": 1, "short_name": 1})
        tenant_name = inst.get("name", "the institution") if inst else "the institution"
        # Build metrics table
        metrics_block = "\n".join(
            f"- {m.get('metric_name','?')}: target {m.get('target_value','?')}{m.get('unit','')}, "
            f"current {m.get('current_value','?')}{m.get('unit','')}"
            for m in metrics
        ) or "(no metrics recorded)"
        evidence_block = "\n".join(f"- {e['title']}" for e in evidence) or "(no evidence yet)"
        sys_msg = (
            f"You are an experienced NAAC accreditation specialist drafting "
            f"the AQAR (Annual Quality Assurance Report) for {tenant_name}."
        )
        user_text = (
            f"Generate the AQAR section for NAAC Criterion {criterion['code']}: "
            f"{criterion['name']} for {tenant_name}, academic year {body.academic_year}.\n\n"
            f"METRICS DATA:\n{metrics_block}\n\n"
            f"EVIDENCE AVAILABLE:\n{evidence_block}\n\n"
            f"Write in formal NAAC AQAR style. Include specific data. Max 500 words. "
            f"Structure: 1) Brief intro (1 paragraph), 2) Key metrics with data, "
            f"3) Initiatives taken, 4) Outcomes, 5) Future plans."
        )
        try:
            text = await generate_text(
                system_message=sys_msg, user_text=user_text,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"aqar-{body.criterion_id}", max_tokens=1200,
            )
        except Exception as e:
            logger.warning("AQAR generation LLM failed: %s", e)
            text = (
                f"## NAAC Criterion {criterion['code']}: {criterion['name']}\n\n"
                f"**Institution**: {tenant_name}  •  **AY**: {body.academic_year}\n\n"
                f"### Overview\n{criterion.get('description','')}\n\n"
                f"### Key Metrics\n{metrics_block}\n\n"
                f"### Evidence on file\n{evidence_block}\n\n"
                f"### Initiatives & Outcomes\n"
                f"During {body.academic_year}, the institution made measurable "
                f"progress on this criterion. Detailed initiatives and outcomes "
                f"are documented in the supporting evidence above."
            )
        wc = len((text or "").split())
        return {
            "criterion_code": criterion["code"],
            "criterion_name": criterion["name"],
            "academic_year": body.academic_year,
            "generated_text": text,
            "word_count": wc,
            "model": DEFAULT_MODEL,
        }

    # ----------------------------------------------------------- OBE
    @router.get("/obe/programs")
    async def obe_programs(iid: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _coerce_iid(user, iid)
        programs = await db.programs.find(
            {"tenant_id": iid, "is_active": True}, {"_id": 0}
        ).to_list(100)
        out = []
        for p in programs:
            po_count = await db.obe_program_outcomes.count_documents(
                {"tenant_id": iid, "program_id": p["id"]})
            co_count = await db.obe_course_outcomes.count_documents(
                {"tenant_id": iid})
            map_count = await db.obe_co_po_mapping.count_documents({"tenant_id": iid})
            out.append({
                **p,
                "po_count": po_count,
                "co_count": co_count,
                "mapping_count": map_count,
                "completion_pct": min(100, round((po_count / 12) * 100, 1)),
            })
        return {"items": out}

    @router.get("/obe/{program_id}/outcomes")
    async def obe_outcomes(program_id: str,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        prog = await db.programs.find_one({"id": program_id}, {"_id": 0})
        if not prog:
            raise HTTPException(404, "Program not found")
        _coerce_iid(user, prog["tenant_id"])
        pos = await db.obe_program_outcomes.find(
            {"tenant_id": prog["tenant_id"], "program_id": program_id}, {"_id": 0}
        ).sort("po_number", 1).to_list(50)
        courses = await db.courses.find(
            {"tenant_id": prog["tenant_id"], "program_id": program_id}, {"_id": 0}
        ).to_list(100)
        course_ids = [c["id"] for c in courses]
        cos = await db.obe_course_outcomes.find(
            {"tenant_id": prog["tenant_id"], "course_id": {"$in": course_ids}}, {"_id": 0}
        ).sort("co_number", 1).to_list(200)
        mappings = await db.obe_co_po_mapping.find(
            {"tenant_id": prog["tenant_id"]}, {"_id": 0}
        ).to_list(2000)
        return {
            "program": prog,
            "program_outcomes": pos,
            "courses": courses,
            "course_outcomes": cos,
            "mappings": mappings,
        }

    @router.post("/obe/mapping")
    async def upsert_mapping(body: CoPoMappingBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in WRITE_ROLES:
            raise HTTPException(403, "Insufficient role")
        db = get_db()
        # Find tenant from one of the related rows
        co = await db.obe_course_outcomes.find_one(
            {"id": body.course_outcome_id}, {"_id": 0, "tenant_id": 1})
        if not co:
            raise HTTPException(404, "Course outcome not found")
        _coerce_iid(user, co["tenant_id"])
        key = {"tenant_id": co["tenant_id"],
               "course_outcome_id": body.course_outcome_id,
               "program_outcome_id": body.program_outcome_id}
        await db.obe_co_po_mapping.update_one(
            key,
            {"$set": {**key, "mapping_level": int(body.level),
                      "updated_at": _now()},
             "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now()}},
            upsert=True,
        )
        return {"ok": True}

    return router
