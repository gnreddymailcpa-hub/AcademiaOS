"""
Phase 6 seed data — Agentic Workflow templates and a few sample runs so the
Workflow Run Monitor / Approval Queue / Audit Trail dashboards are never empty.
"""
import uuid
from datetime import datetime, timezone, timedelta

from seed_data import ISB_ID, EAIC_ID, UOB_ID


def _iso(d):
    return d.replace(tzinfo=timezone.utc).isoformat() if d.tzinfo is None else d.isoformat()


# ---------------------------------------------------------------------------
# Workflow templates per institution
# ---------------------------------------------------------------------------
# Step kinds:
#   - auto : executes a deterministic tool
#   - llm  : executes an LLM-backed tool (uses tenant-resolved provider/model)
#   - hitl : pauses the run until a human approves / rejects
def _step(key, name, kind, tool, *, undoable=False, role="Auto"):
    return {
        "key": key,
        "name": name,
        "kind": kind,
        "tool": tool,
        "undoable": undoable,
        "role": role,
    }


def _tpl(prefix, inst_id, key, name, description, category, steps):
    return {
        "id": f"wf-{prefix}-{key}",
        "institution_id": inst_id,
        "key": key,
        "name": name,
        "description": description,
        "category": category,
        "version": 1,
        "created_at": _iso(datetime.now(timezone.utc)),
        "steps": steps,
    }


def _templates_for(inst_id, prefix, *, tenant_examples):
    """Returns the 4 standard workflow templates per tenant.

    `tenant_examples` is a dict with localised names that show up in run cards.
    """
    return [
        _tpl(
            prefix, inst_id,
            "learner_enrolment",
            tenant_examples["enrol_name"],
            tenant_examples["enrol_desc"],
            "operations",
            [
                _step("validate", "Validate learner profile", "auto", "validate_input"),
                _step("eligibility", "Check programme eligibility", "auto", "aggregate_data"),
                _step("hitl_review", "Programme office review", "hitl", "noop", role="Programme Office"),
                _step("enrol", "Create enrolment record", "auto", "enrol_learner", undoable=True),
                _step("notify", "Notify learner & advisor", "auto", "send_notification"),
            ],
        ),
        _tpl(
            prefix, inst_id,
            "certificate_issuance",
            tenant_examples["cert_name"],
            tenant_examples["cert_desc"],
            "operations",
            [
                _step("aggregate", "Aggregate learner results", "auto", "aggregate_data"),
                _step("hitl_dean", "Dean sign-off", "hitl", "noop", role="Dean"),
                _step("pdf", "Generate certificate PDF", "auto", "generate_pdf", undoable=True),
                _step("notify", "Email certificate to learner", "auto", "send_notification"),
            ],
        ),
        _tpl(
            prefix, inst_id,
            "compliance_report",
            tenant_examples["comp_name"],
            tenant_examples["comp_desc"],
            "governance",
            [
                _step("collect", "Collect tenant metrics", "auto", "aggregate_data"),
                _step("summarise", "LLM compliance narrative", "llm", "llm_summarise"),
                _step("hitl_compliance", "Compliance officer review", "hitl", "noop", role="Compliance Officer"),
                _step("publish", "Publish to dashboard", "auto", "publish_report", undoable=True),
            ],
        ),
        _tpl(
            prefix, inst_id,
            "at_risk_escalation",
            tenant_examples["risk_name"],
            tenant_examples["risk_desc"],
            "learner_success",
            [
                _step("aggregate", "Read psychometric signals", "auto", "aggregate_data"),
                _step("triage", "AI triage notes", "llm", "llm_summarise"),
                _step("hitl_advisor", "Advisor approves outreach", "hitl", "noop", role="Advisor"),
                _step("escalate", "Open faculty ticket", "auto", "escalate_to_faculty", undoable=True),
                _step("notify", "Notify learner with resources", "auto", "send_notification"),
            ],
        ),
    ]


SEED_WORKFLOW_TEMPLATES = (
    _templates_for(ISB_ID, "isb", tenant_examples={
        "enrol_name": "PGP Learner Enrolment",
        "enrol_desc": "Automated enrolment workflow for the Post-Graduate Programme with Programme Office sign-off.",
        "cert_name": "Executive Certificate Issuance",
        "cert_desc": "Generate and dispatch executive-education certificates after Dean sign-off.",
        "comp_name": "AACSB Compliance Snapshot",
        "comp_desc": "Compile a tenant-wide compliance narrative for the AACSB review committee.",
        "risk_name": "At-risk PGP Learner Escalation",
        "risk_desc": "Triage psychometric signals and route to advisors with HITL approval.",
    })
    + _templates_for(EAIC_ID, "eaic", tenant_examples={
        "enrol_name": "Cadet Cohort Enrolment",
        "enrol_desc": "Onboard a new cadet cohort into the citizenship training programme.",
        "cert_name": "Cadet Completion Certificate",
        "cert_desc": "Issue cadet certificates after Commandant sign-off.",
        "comp_name": "ICAO / Federal Compliance Report",
        "comp_desc": "Generate the federal compliance snapshot for ICAO and ministry review.",
        "risk_name": "Cadet Wellbeing Escalation",
        "risk_desc": "Escalate cadets exceeding fatigue / stress thresholds to the wellbeing officer.",
    })
    + _templates_for(UOB_ID, "uob", tenant_examples={
        "enrol_name": "MSc Programme Enrolment",
        "enrol_desc": "Enrol a postgraduate student into a Bradford MSc programme.",
        "cert_name": "Degree Award Workflow",
        "cert_desc": "Generate degree award documents after Senate sign-off.",
        "comp_name": "QAA Compliance Pack",
        "comp_desc": "Compile the UK QAA compliance narrative for periodic review.",
        "risk_name": "At-risk Undergraduate Escalation",
        "risk_desc": "Triage at-risk undergraduates and route to personal tutors.",
    })
)


# ---------------------------------------------------------------------------
# A handful of sample runs so dashboards / approval queue load non-empty.
# Each run mirrors the schema produced by `routes_workflows.start_run`.
# ---------------------------------------------------------------------------
def _run_id(prefix, n):
    return f"run-{prefix}-{n}"


def _run_step(step_def, status, *, output=None, approved_by=None, ts=None):
    s = {
        "key": step_def["key"],
        "name": step_def["name"],
        "kind": step_def["kind"],
        "tool": step_def["tool"],
        "undoable": step_def.get("undoable", False),
        "status": status,
        "output": output,
        "error": None,
    }
    if approved_by:
        s["approved_by"] = approved_by
    if ts:
        s["started_at"] = ts
        s["completed_at"] = ts
    return s


def _build_run(prefix, n, inst_id, template, *, status, context, actor, age_hours,
               steps_status):
    """steps_status: list[tuple(status, output_summary|None, approved_by|None)] same len as template['steps']"""
    base_ts = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    audit = [{"ts": _iso(base_ts), "actor": actor, "message": "Run started"}]
    steps = []
    current_idx = 0
    for i, (sd, (st, summary, approved_by)) in enumerate(zip(template["steps"], steps_status)):
        ts = _iso(base_ts + timedelta(minutes=2 * i))
        output = {"summary": summary, "data": {}} if summary else None
        step = _run_step(sd, st, output=output, approved_by=approved_by, ts=ts)
        if st == "awaiting_approval":
            current_idx = i
        elif st in ("completed", "rolled_back", "completed_irreversible"):
            current_idx = i + 1
        steps.append(step)
        if summary:
            audit.append({"ts": ts, "actor": "system" if st == "completed" else actor,
                          "message": f"{sd['name']}: {summary}"})

    completed_at = None
    if status in ("completed", "rejected", "rolled_back"):
        completed_at = _iso(base_ts + timedelta(minutes=2 * len(template["steps"]) + 1))

    return {
        "id": _run_id(prefix, n),
        "institution_id": inst_id,
        "workflow_id": template["id"],
        "workflow_name": template["name"],
        "category": template["category"],
        "started_by": actor.split("@")[0].replace(".", " ").title(),
        "started_at": _iso(base_ts),
        "completed_at": completed_at,
        "context": context,
        "current_step_index": current_idx,
        "status": status,
        "steps": steps,
        "audit": audit,
    }


def _runs_for(inst_id, prefix, templates, names):
    """Build 5 sample runs covering each major status."""
    enrol_tpl = templates[0]
    cert_tpl = templates[1]
    comp_tpl = templates[2]
    risk_tpl = templates[3]
    return [
        # 1) completed enrolment
        _build_run(
            prefix, 1, inst_id, enrol_tpl, status="completed",
            context={"entity_name": names["learner"], "programme": names["programme"]},
            actor=names["admin_email"], age_hours=70,
            steps_status=[
                ("completed", "Inputs validated.", None),
                ("completed", "Eligibility confirmed.", None),
                ("completed", "Approved by programme office.", names["officer"]),
                ("completed", f"Enrolled {names['learner']} in {names['programme']}.", None),
                ("completed", f"Notification sent to {names['learner']}.", None),
            ],
        ),
        # 2) awaiting approval — certificate
        _build_run(
            prefix, 2, inst_id, cert_tpl, status="awaiting_approval",
            context={"entity_name": names["learner"], "programme": names["programme"]},
            actor=names["admin_email"], age_hours=6,
            steps_status=[
                ("completed", "Aggregated tenant counters.", None),
                ("awaiting_approval", None, None),
                ("pending", None, None),
                ("pending", None, None),
            ],
        ),
        # 3) awaiting approval — at-risk escalation
        _build_run(
            prefix, 3, inst_id, risk_tpl, status="awaiting_approval",
            context={"entity_name": names["at_risk"], "programme": names["programme"]},
            actor=names["advisor_email"], age_hours=2,
            steps_status=[
                ("completed", "Aggregated psychometric signals.", None),
                ("completed", "AI triage drafted.", None),
                ("awaiting_approval", None, None),
                ("pending", None, None),
                ("pending", None, None),
            ],
        ),
        # 4) rejected — compliance
        _build_run(
            prefix, 4, inst_id, comp_tpl, status="rejected",
            context={"entity_name": "Q1 Compliance"},
            actor=names["admin_email"], age_hours=120,
            steps_status=[
                ("completed", "Aggregated tenant counters.", None),
                ("completed", "LLM compliance narrative generated.", None),
                ("rejected", "Rejected — narrative not aligned with framework.", names["officer"]),
                ("pending", None, None),
            ],
        ),
        # 5) rolled back — certificate (irreversible PDF kept, others reverted)
        _build_run(
            prefix, 5, inst_id, cert_tpl, status="rolled_back",
            context={"entity_name": names["learner"], "programme": names["programme"]},
            actor=names["admin_email"], age_hours=200,
            steps_status=[
                ("completed_irreversible", "Aggregated tenant counters.", None),
                ("completed_irreversible", "Approved by dean.", names["officer"]),
                ("rolled_back", "Generated certificate PDF.", None),
                ("rolled_back", "Email certificate to learner.", None),
            ],
        ),
    ]


SEED_WORKFLOW_RUNS = (
    _runs_for(
        ISB_ID, "isb", _templates_for(ISB_ID, "isb", tenant_examples={
            "enrol_name": "PGP Learner Enrolment",
            "enrol_desc": "",
            "cert_name": "Executive Certificate Issuance",
            "cert_desc": "",
            "comp_name": "AACSB Compliance Snapshot",
            "comp_desc": "",
            "risk_name": "At-risk PGP Learner Escalation",
            "risk_desc": "",
        }),
        names={
            "learner": "Vikram Singh",
            "at_risk": "Riya Patel",
            "programme": "PGP Class of 2026",
            "officer": "Prof. Ananya Rao",
            "admin_email": "admin@isb.edu",
            "advisor_email": "advisor@isb.edu",
        },
    )
    + _runs_for(
        EAIC_ID, "eaic", _templates_for(EAIC_ID, "eaic", tenant_examples={
            "enrol_name": "Cadet Cohort Enrolment",
            "enrol_desc": "",
            "cert_name": "Cadet Completion Certificate",
            "cert_desc": "",
            "comp_name": "ICAO / Federal Compliance Report",
            "comp_desc": "",
            "risk_name": "Cadet Wellbeing Escalation",
            "risk_desc": "",
        }),
        names={
            "learner": "Cadet Saif Al Marri",
            "at_risk": "Cadet Mohammed Al Mansoori",
            "programme": "Border Inspection Programme",
            "officer": "Commandant Khalid",
            "admin_email": "admin@eaic.gov.ae",
            "advisor_email": "advisor@eaic.gov.ae",
        },
    )
    + _runs_for(
        UOB_ID, "uob", _templates_for(UOB_ID, "uob", tenant_examples={
            "enrol_name": "MSc Programme Enrolment",
            "enrol_desc": "",
            "cert_name": "Degree Award Workflow",
            "cert_desc": "",
            "comp_name": "QAA Compliance Pack",
            "comp_desc": "",
            "risk_name": "At-risk Undergraduate Escalation",
            "risk_desc": "",
        }),
        names={
            "learner": "Emma Thompson",
            "at_risk": "Liam Carter",
            "programme": "MSc Data Science",
            "officer": "Dr. James Holloway",
            "admin_email": "admin@bradford.ac.uk",
            "advisor_email": "advisor@bradford.ac.uk",
        },
    )
)
