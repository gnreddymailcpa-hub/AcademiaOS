"""
Claros Comply — idempotent seed of NAAC metrics, sample evidence, and AICTE PO12.
"""
from datetime import datetime, timezone
import hashlib
import uuid


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"

# Tenants that get the full NAAC seed (only Indian-aligned tenants)
NAAC_TENANTS = [VCE_ID, ISB_ID]

# ---------------------------------------------------------------------------
# Sample metrics (only criterion 1, 3, 5 per spec — others stay empty)
# ---------------------------------------------------------------------------
METRICS_BY_CRIT_CODE = {
    1: [
        ("1.1.1", "Curricular revision cycle (years)", 3.0, 2.0, "years"),
        ("1.2.1", "Programmes with CBCS adoption", 100.0, 95.0, "%"),
        ("1.3.1", "Courses with cross-cutting issues", 60.0, 48.0, "%"),
        ("1.4.1", "Stakeholder feedback frequency", 4.0, 3.0, "per year"),
    ],
    3: [
        ("3.1.1", "Avg research grant per teacher", 5.0, 3.2, "₹ Lakh"),
        ("3.2.1", "Patents filed (5-yr cumulative)", 30.0, 18.0, "count"),
        ("3.3.1", "Research papers (peer-reviewed)", 200.0, 156.0, "count"),
        ("3.4.1", "Outreach programmes / year", 15.0, 11.0, "count"),
    ],
    5: [
        ("5.1.1", "Students benefiting scholarships", 60.0, 52.0, "%"),
        ("5.2.1", "Placement rate (avg)", 90.0, 86.5, "%"),
        ("5.3.1", "Sports / cultural awards", 25.0, 17.0, "count"),
        ("5.4.1", "Active alumni chapters", 8.0, 5.0, "count"),
    ],
}

SAMPLE_EVIDENCE = [
    {"criterion_code": 1, "title": "Academic Council resolutions · curriculum revision 2024",
     "description": "Minutes of the Academic Council meeting approving curriculum changes."},
    {"criterion_code": 3, "title": "Annual Research Report 2024-25",
     "description": "Departmental research outputs and IPR filings consolidated."},
    {"criterion_code": 5, "title": "Placement summary report 2024-25",
     "description": "Department-wise placement statistics with offer letters appendix."},
    {"criterion_code": 5, "title": "Scholarship disbursement records 2024-25",
     "description": "Government + institutional scholarship payments to students."},
    {"criterion_code": 1, "title": "Stakeholder feedback analysis 2024",
     "description": "Student, faculty, alumni, employer feedback collated and analysed."},
]

# AICTE PO1-PO12 (standard for engineering programmes)
AICTE_POs = [
    ("PO1", "Engineering knowledge: Apply mathematics, science, engineering fundamentals."),
    ("PO2", "Problem analysis: Identify, formulate, review research literature, analyse complex engineering problems."),
    ("PO3", "Design/development of solutions: Design solutions for complex engineering problems."),
    ("PO4", "Conduct investigations of complex problems using research-based knowledge."),
    ("PO5", "Modern tool usage: Use modern engineering and IT tools."),
    ("PO6", "The engineer and society: Assess societal, health, safety, legal, cultural issues."),
    ("PO7", "Environment and sustainability: Understand the impact of engineering solutions."),
    ("PO8", "Ethics: Apply ethical principles and commit to professional ethics."),
    ("PO9", "Individual and team work: Function effectively as individual and in teams."),
    ("PO10", "Communication: Communicate effectively on complex engineering activities."),
    ("PO11", "Project management and finance: Apply engineering and management principles."),
    ("PO12", "Life-long learning: Recognise need for and engage in independent and life-long learning."),
]


def _det_uuid(*parts: str) -> str:
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_claros_comply(db, logger):
    """Seed metrics + sample evidence + AICTE PO12 across Indian tenants."""
    # Resolve criteria
    criteria = await db.naac_criteria.find({}, {"_id": 0}).to_list(20)
    crit_by_code = {c["code"]: c for c in criteria}

    counts = {"metrics": 0, "evidence": 0, "pos": 0, "cos": 0}
    for iid in NAAC_TENANTS:
        # ---- Metrics ----
        for code, metrics in METRICS_BY_CRIT_CODE.items():
            crit = crit_by_code.get(code)
            if not crit:
                continue
            for metric_code, name, target, current, unit in metrics:
                mid = _det_uuid("metric", iid, str(code), metric_code)
                await db.naac_metrics.update_one(
                    {"id": mid},
                    {"$setOnInsert": {
                        "id": mid, "tenant_id": iid,
                        "criterion_id": crit["id"],
                        "metric_code": metric_code,
                        "metric_name": name,
                        "target_value": float(target),
                        "current_value": float(current),
                        "unit": unit,
                        "data_source": "manual",
                        "last_updated": _iso(),
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )
                counts["metrics"] += 1

        # ---- Evidence ----
        admin = await db.users.find_one(
            {"institution_id": iid, "role": "institution_admin"},
            {"_id": 0, "id": 1, "email": 1},
        )
        admin_id = admin["id"] if admin else "system"
        admin_email = admin.get("email") if admin else "system"
        for e in SAMPLE_EVIDENCE:
            crit = crit_by_code.get(e["criterion_code"])
            if not crit:
                continue
            ev_id = _det_uuid("evidence", iid, e["title"])
            await db.evidence_documents.update_one(
                {"id": ev_id},
                {"$setOnInsert": {
                    "id": ev_id, "tenant_id": iid,
                    "criterion_id": crit["id"],
                    "metric_id": None,
                    "title": e["title"],
                    "description": e["description"],
                    "file_url": None,
                    "filename": None,
                    "academic_year": "2025-26",
                    "uploaded_by": admin_id,
                    "uploaded_by_email": admin_email,
                    "is_verified": True,
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["evidence"] += 1

        # ---- OBE PO12 for CSE B.Tech program ----
        cse_prog = await db.programs.find_one(
            {"tenant_id": iid, "code": "BTECH-CSE"}, {"_id": 0}
        )
        if not cse_prog:
            continue
        for idx, (po_code, desc) in enumerate(AICTE_POs):
            po_id = _det_uuid("po", iid, cse_prog["id"], po_code)
            await db.obe_program_outcomes.update_one(
                {"id": po_id},
                {"$setOnInsert": {
                    "id": po_id, "tenant_id": iid,
                    "program_id": cse_prog["id"],
                    "po_number": idx + 1,
                    "po_code": po_code,
                    "description": desc,
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["pos"] += 1

        # ---- COs for first 5 courses, 3 COs each ----
        cse_courses = await db.courses.find(
            {"tenant_id": iid, "program_id": cse_prog["id"]}, {"_id": 0}
        ).limit(5).to_list(5)
        for c in cse_courses:
            for n in range(1, 4):
                co_id = _det_uuid("co", iid, c["id"], str(n))
                await db.obe_course_outcomes.update_one(
                    {"id": co_id},
                    {"$setOnInsert": {
                        "id": co_id, "tenant_id": iid,
                        "course_id": c["id"],
                        "co_number": n,
                        "co_code": f"{c['code']}-CO{n}",
                        "description": f"After completing {c['name']}, students will be able to "
                                       f"{'analyse' if n == 1 else 'design' if n == 2 else 'evaluate'} "
                                       f"key concepts in this domain.",
                        "created_at": _iso(),
                    }},
                    upsert=True,
                )
                counts["cos"] += 1

    logger.info("Claros Comply seeded · %s", counts)
