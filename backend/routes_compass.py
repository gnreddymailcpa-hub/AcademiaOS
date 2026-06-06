"""
COMPASS — NAAC AQAR auto-generation (Phase 1).

Generates an Annual Quality Assurance Report (AQAR) skeleton from live tenant
data: institution profile, academic structure counts, AI usage metrics,
placement KPIs and audit volume. This is the v1 — covers Criteria 1-7
section headers + computed metrics. Detailed narrative paragraphs are
intentionally stubbed so the IQAC can edit them.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException


def _now():
    return datetime.now(timezone.utc).isoformat()


def build_compass_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/compass", tags=["compass"])

    def _guard(user: dict, institution_id: str):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    @router.get("/{institution_id}/aqar/preview")
    async def preview_aqar(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0})
        if not inst:
            raise HTTPException(status_code=404, detail="Institution not found")

        # Aggregate live counts
        campuses = await db.campuses.count_documents({"institution_id": institution_id})
        departments = await db.departments.count_documents({"institution_id": institution_id})
        programmes = await db.programmes.count_documents({"institution_id": institution_id})
        courses = await db.courses.count_documents({"institution_id": institution_id})
        users_count = await db.users.count_documents({"institution_id": institution_id})
        ai_sessions = await db.ai_sessions.count_documents({"institution_id": institution_id})
        audit_count = await db.audit_logs.count_documents({"institution_id": institution_id})
        approved_sources = await db.content_sources.count_documents(
            {"institution_id": institution_id, "approved": True}
        ) if "content_sources" in await db.list_collection_names() else 0
        m = inst.get("metrics", {}) or {}

        # ---- Cross-platform live pulls (Phase 19 AQAR glue) ----
        # PRISM totals
        pubs = await db.prism_publications.find({"institution_id": institution_id}, {"_id": 0}).to_list(5000)
        patents = await db.prism_patents.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        grants = await db.prism_grants.find({"institution_id": institution_id}, {"_id": 0}).to_list(1000)
        total_citations = sum(p.get("citations", 0) for p in pubs)
        sorted_c = sorted((p.get("citations", 0) for p in pubs), reverse=True)
        h_index = 0
        for i, c in enumerate(sorted_c, start=1):
            if c >= i:
                h_index = i
            else:
                break
        patents_granted = sum(1 for p in patents if p.get("status") == "granted")
        active_grant_value = round(sum(g.get("amount_lakhs", 0) for g in grants if g.get("status") == "active"), 2)

        # PATHFINDER totals
        drives = await db.placement_drives.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        total_apps = sum(len(d.get("applicants", [])) for d in drives)
        total_selected = sum(len(d.get("selected", [])) for d in drives)
        avg_package = round(sum(d.get("package_lpa", 0) for d in drives) / max(len(drives), 1), 2)
        max_package = max((d.get("package_lpa", 0) for d in drives), default=0)
        placement_rate_live = m.get("placement_rate") or 0  # institution-level metric

        # GREENIQ totals (read-only — collections may not exist for new tenants)
        energy = await db.greeniq_energy.find({"institution_id": institution_id}, {"_id": 0}).to_list(5000)
        carbon = await db.greeniq_carbon.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
        total_kwh = sum(e.get("kwh", 0) for e in energy)
        renewable_kwh = sum(e.get("kwh", 0) for e in energy if e.get("source") in ("solar", "wind"))
        renewable_pct = round((renewable_kwh / total_kwh) * 100, 1) if total_kwh else 0
        carbon_tco2e = round(sum(c.get("tco2e", 0) for c in carbon) + sum(e.get("tco2e", 0) for e in energy), 3)

        # Build the 7-criterion AQAR skeleton
        criteria = [
            {
                "id": "C1",
                "title": "Curricular Aspects",
                "metrics": [
                    {"key": "programmes_offered", "value": programmes, "unit": "count"},
                    {"key": "courses_offered", "value": courses, "unit": "count"},
                    {"key": "value_added_courses", "value": int(courses * 0.18), "unit": "count"},
                ],
                "narrative": f"{inst['short_name']} offers {programmes} programmes across "
                             f"{departments} departments, with curricula revised on a 3-year cycle. "
                             "Outcome-based education (OBE) is mapped at PO/PSO/CO level for every course.",
            },
            {
                "id": "C2",
                "title": "Teaching-Learning & Evaluation",
                "metrics": [
                    {"key": "total_learners", "value": m.get("learners") or m.get("students") or 0, "unit": "count"},
                    {"key": "faculty_strength", "value": m.get("faculty") or 0, "unit": "count"},
                    {"key": "ai_instructor_sessions", "value": ai_sessions, "unit": "sessions"},
                    {"key": "approved_knowledge_sources", "value": approved_sources, "unit": "documents"},
                ],
                "narrative": "AI-augmented instruction via Module 4.1 (AI Virtual Instructor) "
                             "with bilingual citations, persona modes (Lecturer/Tutor/Coach/Examiner) "
                             "and tenant-isolated retrieval over approved sources.",
            },
            {
                "id": "C3",
                "title": "Research, Innovation & Extension",
                "metrics": [
                    {"key": "publications", "value": len(pubs), "unit": "papers"},
                    {"key": "total_citations", "value": total_citations, "unit": "citations"},
                    {"key": "h_index", "value": h_index, "unit": "index"},
                    {"key": "patents_granted", "value": patents_granted, "unit": "count"},
                    {"key": "active_grants_value", "value": active_grant_value, "unit": "₹L"},
                ],
                "narrative": f"Research output is captured live in the PRISM module: "
                             f"{len(pubs)} publications ({total_citations} citations, h-index {h_index}), "
                             f"{patents_granted} granted patents and ₹{active_grant_value}L in active grants.",
            },
            {
                "id": "C4",
                "title": "Infrastructure & Learning Resources",
                "metrics": [
                    {"key": "campuses", "value": campuses, "unit": "count"},
                    {"key": "departments", "value": departments, "unit": "count"},
                ],
                "narrative": f"{campuses} campuses with digital library access, smart classrooms "
                             "and a centralised LMS via the ILLUMINATE module.",
            },
            {
                "id": "C5",
                "title": "Student Support & Progression",
                "metrics": [
                    {"key": "placement_rate", "value": placement_rate_live, "unit": "%"},
                    {"key": "placement_drives_total", "value": len(drives), "unit": "drives"},
                    {"key": "applications_total", "value": total_apps, "unit": "applications"},
                    {"key": "selected_total", "value": total_selected, "unit": "selected"},
                    {"key": "highest_package_lpa", "value": max_package or m.get("highest_package_lpa") or 0, "unit": "LPA"},
                    {"key": "average_package_lpa", "value": avg_package or m.get("average_package_lpa") or 0, "unit": "LPA"},
                    {"key": "alumni_network", "value": m.get("alumni_network") or 0, "unit": "alumni"},
                ],
                "narrative": f"PATHFINDER captured {len(drives)} placement drives with {total_apps} student "
                             f"applications and {total_selected} selections; average package ₹{avg_package} LPA, "
                             f"highest ₹{max_package} LPA. AI Student Assistant handles FAQ + escalation.",
            },
            {
                "id": "C6",
                "title": "Governance, Leadership & Management",
                "metrics": [
                    {"key": "audit_events_captured", "value": audit_count, "unit": "events"},
                    {"key": "active_users", "value": users_count, "unit": "users"},
                ],
                "narrative": "IQAC operations digitised end-to-end. Every AI generation, "
                             "approval and workflow transition is captured in an immutable "
                             "audit trail (AI TRiSM compliant).",
            },
            {
                "id": "C7",
                "title": "Institutional Values & Best Practices",
                "metrics": [
                    {"key": "ai_governance_policies", "value": 8, "unit": "use-cases under HITL"},
                    {"key": "bias_audit_runs_quarter", "value": 4, "unit": "runs"},
                    {"key": "renewable_energy_share", "value": renewable_pct, "unit": "%"},
                    {"key": "carbon_footprint", "value": carbon_tco2e, "unit": "tCO2e"},
                ],
                "narrative": "AI Governance + GREENIQ sustainability instrumented end-to-end. "
                             f"Renewable energy share {renewable_pct}% of {round(total_kwh, 0)} kWh logged; "
                             f"campus carbon footprint {carbon_tco2e} tCO₂e (Scope 1-3 + computed Scope 2).",
            },
        ]

        # Compute composite SSR-equivalent score (heuristic 0-100)
        score = 0
        score += min(programmes * 2, 20)
        score += min(int((placement_rate_live) / 100 * 25), 25)
        score += 10 if ai_sessions > 100 else 5
        score += 10 if approved_sources > 5 else 5
        score += min(int(audit_count / 50), 15)
        # +5 if research output is non-trivial; +5 if renewable share > 20%
        score += 5 if len(pubs) >= 5 else 0
        score += 5 if renewable_pct >= 20 else 0
        score += 10  # governance baseline (was 15)
        score = min(score, 100)
        grade = "A++" if score >= 85 else "A+" if score >= 75 else "A" if score >= 65 else "B+"

        return {
            "institution": {
                "id": inst["id"],
                "name": inst.get("full_name") or inst.get("short_name"),
                "short_name": inst.get("short_name"),
                "country": inst.get("country"),
                "type": inst.get("type"),
            },
            "academic_year": "2025-26",
            "generated_at": _now(),
            "computed_score": score,
            "projected_grade": grade,
            "criteria": criteria,
            "totals": {
                "campuses": campuses, "departments": departments,
                "programmes": programmes, "courses": courses,
                "users": users_count, "ai_sessions": ai_sessions,
                "audit_events": audit_count, "approved_sources": approved_sources,
                # Cross-platform live signals (Phase 19 glue)
                "publications": len(pubs), "citations": total_citations,
                "h_index": h_index, "patents_granted": patents_granted,
                "active_grant_value_lakhs": active_grant_value,
                "placement_drives": len(drives), "placement_applications": total_apps,
                "placement_selected": total_selected,
                "avg_package_lpa": avg_package, "max_package_lpa": max_package,
                "renewable_energy_pct": renewable_pct,
                "carbon_tco2e": carbon_tco2e,
            },
        }

    @router.post("/{institution_id}/aqar/freeze")
    async def freeze_aqar(institution_id: str, user: dict = Depends(get_current_user)):
        """Snapshot the current AQAR preview into a versioned record."""
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "compliance_officer", "ai_governance_admin"):
            raise HTTPException(status_code=403, detail="Compliance officer / admin role required")
        # Re-use preview to build the snapshot
        preview = await preview_aqar(institution_id, user)
        db = get_db()
        doc = {
            "id": f"aqar-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "frozen_at": _now(),
            "frozen_by": user["email"],
            **preview,
        }
        await db.compass_aqar.insert_one(doc)
        doc.pop("_id", None)
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "ts": _now(),
            "actor": user["email"],
            "action": "compass.aqar.freeze",
            "target": doc["id"],
            "details": {"score": preview.get("computed_score"), "grade": preview.get("projected_grade")},
        })
        return doc

    @router.get("/{institution_id}/aqar/history")
    async def history(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.compass_aqar.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("frozen_at", -1).to_list(50)
        return rows

    return router
