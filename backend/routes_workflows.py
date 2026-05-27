"""
Phase 6 — Agentic Workflows (Module 4.8) + Audit explorer endpoint.

Workflow templates are pre-defined per tenant. A *run* is a stateful
execution that pauses on `hitl` steps until a human approves or rejects.
Every state transition writes to `audit_logs`.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field

from ai_service import resolve_model, generate_text, now_iso

logger = logging.getLogger("academiaos.workflows")


class StartRunRequest(BaseModel):
    institution_id: str
    workflow_id: str
    context: Dict[str, Any] = Field(default_factory=dict)


class TemplateCreate(BaseModel):
    institution_id: str
    key: str
    name: str
    description: str
    category: str = "operations"
    steps: List[Dict[str, Any]]


# ----- Deterministic tool executors (demo) ---------------------------------
async def _exec_tool(db, tool: str, step: dict, run: dict) -> dict:
    """Each tool returns a dict with at least {summary, data}."""
    ctx = run.get("context", {})
    inst = run.get("institution_id")
    if tool == "validate_input":
        return {"summary": f"Inputs validated for {ctx.get('entity_name','target')}.", "data": ctx}
    if tool == "aggregate_data":
        # cheap aggregate
        counts = {
            "users": await db.users.count_documents({"institution_id": inst}),
            "programmes": await db.programmes.count_documents({"institution_id": inst}),
            "attempts": await db.assessment_attempts.count_documents({"institution_id": inst}),
        }
        return {"summary": "Aggregated tenant counters.", "data": counts}
    if tool == "generate_pdf":
        return {
            "summary": f"PDF certificate generated for {ctx.get('entity_name','learner')}.",
            "data": {"file_ref": f"cert-{uuid.uuid4().hex[:10]}.pdf"},
        }
    if tool == "send_notification":
        return {
            "summary": f"Notification dispatched to {ctx.get('entity_name','recipient')}.",
            "data": {"channel": "email"},
        }
    if tool == "enrol_learner":
        return {
            "summary": f"Enrolled {ctx.get('entity_name','learner')} in {ctx.get('programme','programme')}.",
            "data": {"programme": ctx.get("programme"), "enrolled_at": now_iso()},
        }
    if tool == "escalate_to_faculty":
        return {
            "summary": f"Escalated {ctx.get('entity_name','case')} to programme office.",
            "data": {"ticket_id": f"TCK-{uuid.uuid4().hex[:6].upper()}"},
        }
    if tool == "llm_summarise":
        provider, model = await resolve_model(db, inst, "workflows")
        try:
            text = await generate_text(
                system_message="You are AcademiaOS Compliance Reporter — concise, factual.",
                user_text=f"Summarise this dataset for the compliance team in 3 sentences: {ctx.get('aggregate') or ctx}",
                provider=provider, model=model, max_tokens=300,
            )
        except Exception as e:
            text = f"(LLM summary unavailable: {e})"
        return {"summary": "LLM compliance summary generated.", "data": {"text": text, "model": f"{provider}/{model}"}}
    if tool == "publish_report":
        return {"summary": "Report published to the Compliance dashboard.", "data": {}}
    if tool == "noop":
        return {"summary": step.get("name", "Step completed."), "data": {}}
    return {"summary": f"Unknown tool '{tool}' — no-op.", "data": {}}


async def _audit(db, *, institution_id: str, action: str, target: str, actor: str, **extra):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "institution_id": institution_id,
        "action": action,
        "target": target,
        "actor": actor,
        "ts": now_iso(),
        **extra,
    })


async def _notify_approvers(db, run: dict, step: dict):
    """Email institution admins when a run pauses for approval AND
    create an in-app notification routed to the role that owns the gate."""
    # in-app notification — broadcast to the approver role for this tenant
    role_map = {
        "Programme Office": "programme_manager",
        "Dean": "dean",
        "Commandant": "executive_leadership",
        "Compliance Officer": "compliance_officer",
        "Advisor": "career_services",
        "Approver": "institution_admin",
    }
    target_role = role_map.get(step.get("role") or "Approver", "institution_admin")
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": run["institution_id"],
            "user_id": None,
            "role": target_role,
            "kind": "workflow.approval",
            "title": f"Approval needed · {run['workflow_name']}",
            "body": f"Step: {step.get('name')} · started by {run.get('started_by')}",
            "link": "/workflows",
            "ts": now_iso(),
            "read": False,
            "actor": "system",
        })
    except Exception:
        logger.exception("notify (in-app) failed")
    # email — best effort
    try:
        from email_service import send_email
        admins = await db.users.find(
            {"institution_id": run["institution_id"], "role": {"$in": [target_role, "institution_admin"]}},
            {"_id": 0, "email": 1, "name": 1},
        ).to_list(20)
        if not admins:
            return
        subject = f"AcademiaOS · Approval needed: {run['workflow_name']}"
        text = (
            f"A workflow run is paused at '{step.get('name')}' "
            f"and is awaiting {step.get('role') or 'human'} approval.\n\n"
            f"Workflow: {run['workflow_name']}\n"
            f"Started by: {run.get('started_by')}\n"
            f"Tenant: {run['institution_id']}\n"
            f"Run id: {run['id']}\n\n"
            f"Review it in the Approval Queue at /workflows."
        )
        for a in admins:
            await send_email(db, run["institution_id"], a["email"], subject=subject, text=text)
    except Exception:
        logger.exception("notify_approvers (email) failed (non-fatal)")


async def _advance(db, run: dict, user: dict) -> dict:
    """Advance a run past auto / llm steps until completion or a hitl gate."""
    while run["status"] in ("running",):
        idx = run["current_step_index"]
        if idx >= len(run["steps"]):
            run["status"] = "completed"
            run["completed_at"] = now_iso()
            await _audit(db, institution_id=run["institution_id"], action="workflow.complete",
                         target=run["id"], actor=user["email"])
            break
        step = run["steps"][idx]
        if step["kind"] == "hitl":
            step["status"] = "awaiting_approval"
            run["status"] = "awaiting_approval"
            await _audit(db, institution_id=run["institution_id"], action="workflow.pause_for_approval",
                         target=run["id"], actor=user["email"], step=step["key"])
            await _notify_approvers(db, run, step)
            break
        # Execute auto / llm step
        step["status"] = "running"
        step["started_at"] = now_iso()
        try:
            out = await _exec_tool(db, step.get("tool", "noop"), step, run)
            step["output"] = out
            step["status"] = "completed"
            step["completed_at"] = now_iso()
            run["audit"].append({"ts": now_iso(), "actor": "system", "message": f"{step['name']}: {out['summary']}"})
            run["current_step_index"] = idx + 1
        except Exception as e:
            step["status"] = "failed"
            step["error"] = str(e)
            run["status"] = "failed"
            await _audit(db, institution_id=run["institution_id"], action="workflow.fail",
                         target=run["id"], actor=user["email"], step=step["key"], error=str(e))
            break
    return run


def build_workflows_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/workflows")

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    # ---------- Templates ----------
    @router.get("/{institution_id}/templates")
    async def list_templates(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        items = await db.workflow_templates.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("name", 1).to_list(50)
        return items

    @router.get("/templates/{template_id}")
    async def get_template(template_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        t = await db.workflow_templates.find_one({"id": template_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Not found")
        await _scope(user, t["institution_id"])
        return t

    def _validate_steps(steps):
        if not steps:
            raise HTTPException(422, "At least one step is required")
        clean = []
        seen_keys = set()
        for i, s in enumerate(steps):
            kind = s.get("kind", "auto")
            if kind not in ("auto", "llm", "hitl"):
                raise HTTPException(422, f"Step {i}: invalid kind '{kind}'")
            key = s.get("key") or f"step_{i + 1}"
            if key in seen_keys:
                raise HTTPException(422, f"Step {i}: duplicate key '{key}'")
            seen_keys.add(key)
            clean.append({
                "key": key,
                "name": s.get("name") or f"Step {i + 1}",
                "kind": kind,
                "tool": s.get("tool") or ("noop" if kind == "hitl" else "aggregate_data"),
                "undoable": bool(s.get("undoable", False)),
                "role": s.get("role") or ("Approver" if kind == "hitl" else "Auto"),
            })
        return clean

    @router.post("/{institution_id}/templates")
    async def create_template(
        institution_id: str,
        payload: TemplateCreate = Body(...),
        user: dict = Depends(get_current_user),
    ):
        await _scope(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin"):
            raise HTTPException(403, "Only admins can author workflow templates")
        if payload.institution_id != institution_id:
            raise HTTPException(400, "institution_id mismatch")
        db = get_db()
        steps = _validate_steps(payload.steps)
        doc = {
            "id": f"wf-{uuid.uuid4().hex[:12]}",
            "institution_id": institution_id,
            "key": payload.key,
            "name": payload.name,
            "description": payload.description,
            "category": payload.category or "operations",
            "version": 1,
            "created_at": now_iso(),
            "created_by": user["email"],
            "steps": steps,
        }
        await db.workflow_templates.insert_one(dict(doc))
        await _audit(
            db, institution_id=institution_id, action="workflow.template.create",
            target=doc["id"], actor=user["email"], name=doc["name"], steps=len(steps),
        )
        return doc

    @router.patch("/templates/{template_id}")
    async def update_template(
        template_id: str,
        payload: Dict[str, Any] = Body(...),
        user: dict = Depends(get_current_user),
    ):
        db = get_db()
        t = await db.workflow_templates.find_one({"id": template_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Not found")
        await _scope(user, t["institution_id"])
        if user["role"] not in ("super_admin", "institution_admin"):
            raise HTTPException(403, "Only admins can edit workflow templates")
        update = {}
        for k in ("name", "description", "category", "key"):
            if k in payload:
                update[k] = payload[k]
        if "steps" in payload:
            update["steps"] = _validate_steps(payload["steps"])
        update["version"] = (t.get("version", 1) or 1) + 1
        update["updated_at"] = now_iso()
        update["updated_by"] = user["email"]
        await db.workflow_templates.update_one({"id": template_id}, {"$set": update})
        await _audit(
            db, institution_id=t["institution_id"], action="workflow.template.update",
            target=template_id, actor=user["email"], fields=list(update.keys()),
        )
        return await db.workflow_templates.find_one({"id": template_id}, {"_id": 0})

    @router.delete("/templates/{template_id}")
    async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        t = await db.workflow_templates.find_one({"id": template_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Not found")
        await _scope(user, t["institution_id"])
        if user["role"] not in ("super_admin", "institution_admin"):
            raise HTTPException(403, "Only admins can delete workflow templates")
        await db.workflow_templates.delete_one({"id": template_id})
        await _audit(
            db, institution_id=t["institution_id"], action="workflow.template.delete",
            target=template_id, actor=user["email"], name=t.get("name"),
        )
        return {"ok": True}

    # ---------- Runs ----------
    @router.get("/{institution_id}/runs")
    async def list_runs(institution_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        q = {"institution_id": institution_id}
        if status:
            q["status"] = status
        return await db.workflow_runs.find(q, {"_id": 0}).sort("started_at", -1).limit(60).to_list(60)

    @router.get("/runs/{run_id}")
    async def get_run(run_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        r = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
        if not r:
            raise HTTPException(404, "Not found")
        await _scope(user, r["institution_id"])
        return r

    @router.post("/{institution_id}/runs")
    async def start_run(institution_id: str, payload: StartRunRequest = Body(...), user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        t = await db.workflow_templates.find_one({"id": payload.workflow_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Template not found")
        run_id = str(uuid.uuid4())
        run = {
            "id": run_id,
            "institution_id": institution_id,
            "workflow_id": t["id"],
            "workflow_name": t["name"],
            "category": t.get("category", "operations"),
            "started_by": user["name"],
            "started_at": now_iso(),
            "completed_at": None,
            "context": payload.context,
            "current_step_index": 0,
            "status": "running",
            "steps": [
                {
                    "key": s["key"], "name": s["name"], "kind": s["kind"],
                    "tool": s.get("tool", "noop"), "undoable": s.get("undoable", False),
                    "role": s.get("role"),
                    "status": "pending", "output": None, "error": None,
                }
                for s in t["steps"]
            ],
            "audit": [{"ts": now_iso(), "actor": user["email"], "message": "Run started"}],
        }
        await db.workflow_runs.insert_one(dict(run))
        await _audit(db, institution_id=institution_id, action="workflow.start",
                     target=run_id, actor=user["email"], workflow=t["id"])
        run = await _advance(db, run, user)
        await db.workflow_runs.update_one({"id": run_id}, {"$set": run})
        return run

    @router.post("/runs/{run_id}/approve")
    async def approve_step(run_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
        if not run:
            raise HTTPException(404, "Not found")
        await _scope(user, run["institution_id"])
        if run["status"] != "awaiting_approval":
            raise HTTPException(400, "Run is not awaiting approval")
        idx = run["current_step_index"]
        step = run["steps"][idx]
        # Execute the HITL step body and advance
        out = await _exec_tool(db, step.get("tool", "noop"), step, run)
        step["status"] = "completed"
        step["output"] = out
        step["approved_by"] = user["name"]
        step["completed_at"] = now_iso()
        run["audit"].append({"ts": now_iso(), "actor": user["email"], "message": f"Approved: {step['name']} · {out['summary']}"})
        run["current_step_index"] = idx + 1
        run["status"] = "running"
        await _audit(db, institution_id=run["institution_id"], action="workflow.approve",
                     target=run_id, actor=user["email"], step=step["key"])
        run = await _advance(db, run, user)
        await db.workflow_runs.update_one({"id": run_id}, {"$set": run})
        return run

    @router.post("/runs/{run_id}/reject")
    async def reject_step(run_id: str, payload: Dict[str, Any] = Body(default={}), user: dict = Depends(get_current_user)):
        db = get_db()
        run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
        if not run:
            raise HTTPException(404, "Not found")
        await _scope(user, run["institution_id"])
        if run["status"] != "awaiting_approval":
            raise HTTPException(400, "Run is not awaiting approval")
        idx = run["current_step_index"]
        step = run["steps"][idx]
        step["status"] = "rejected"
        step["rejected_by"] = user["name"]
        step["completed_at"] = now_iso()
        reason = (payload or {}).get("reason", "")
        run["status"] = "rejected"
        run["completed_at"] = now_iso()
        run["audit"].append({"ts": now_iso(), "actor": user["email"], "message": f"Rejected: {step['name']}{' · ' + reason if reason else ''}"})
        await _audit(db, institution_id=run["institution_id"], action="workflow.reject",
                     target=run_id, actor=user["email"], step=step["key"], reason=reason)
        await db.workflow_runs.update_one({"id": run_id}, {"$set": run})
        return run

    @router.post("/runs/{run_id}/rollback")
    async def rollback(run_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
        if not run:
            raise HTTPException(404, "Not found")
        await _scope(user, run["institution_id"])
        if run["status"] not in ("completed", "rejected", "failed"):
            raise HTTPException(400, "Only finished runs can be rolled back")
        # Mark each completed step as rolled_back (or kept if not undoable)
        rolled_back = 0
        for step in run["steps"]:
            if step["status"] == "completed":
                if step.get("undoable", False):
                    step["status"] = "rolled_back"
                    rolled_back += 1
                else:
                    step["status"] = "completed_irreversible"
        run["status"] = "rolled_back"
        run["rolled_back_by"] = user["name"]
        run["rolled_back_at"] = now_iso()
        run["audit"].append({"ts": now_iso(), "actor": user["email"], "message": f"Rolled back · {rolled_back} step(s) reversed"})
        await db.workflow_runs.update_one({"id": run_id}, {"$set": run})
        await _audit(db, institution_id=run["institution_id"], action="workflow.rollback",
                     target=run_id, actor=user["email"], rolled_back=rolled_back)
        return run

    @router.get("/{institution_id}/approvals")
    async def approvals(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        runs = await db.workflow_runs.find(
            {"institution_id": institution_id, "status": "awaiting_approval"}, {"_id": 0}
        ).sort("started_at", -1).to_list(100)
        return runs

    @router.get("/{institution_id}/summary")
    async def summary(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        templates = await db.workflow_templates.count_documents({"institution_id": institution_id})
        running = await db.workflow_runs.count_documents({"institution_id": institution_id, "status": "running"})
        awaiting = await db.workflow_runs.count_documents({"institution_id": institution_id, "status": "awaiting_approval"})
        completed = await db.workflow_runs.count_documents({"institution_id": institution_id, "status": "completed"})
        rolled_back = await db.workflow_runs.count_documents({"institution_id": institution_id, "status": "rolled_back"})
        rejected = await db.workflow_runs.count_documents({"institution_id": institution_id, "status": "rejected"})
        return {"templates": templates, "running": running, "awaiting_approval": awaiting,
                "completed": completed, "rolled_back": rolled_back, "rejected": rejected}

    return router


# ---------------------------------------------------------------------------
# Audit explorer endpoint (mounted under /api/audit/*)
# ---------------------------------------------------------------------------
def build_audit_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/audit")

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    @router.get("/{institution_id}")
    async def list_audit(
        institution_id: str,
        action: Optional[str] = None,
        actor: Optional[str] = None,
        target: Optional[str] = None,
        q: Optional[str] = Query(default=None, description="Free text on action/target/actor"),
        since: Optional[str] = None,
        limit: int = 200,
        user: dict = Depends(get_current_user),
    ):
        await _scope(user, institution_id)
        db = get_db()
        filt: Dict[str, Any] = {"institution_id": institution_id}
        if action:
            filt["action"] = {"$regex": action, "$options": "i"}
        if actor:
            filt["actor"] = {"$regex": actor, "$options": "i"}
        if target:
            filt["target"] = {"$regex": target, "$options": "i"}
        if since:
            filt["ts"] = {"$gte": since}
        if q:
            filt["$or"] = [
                {"action": {"$regex": q, "$options": "i"}},
                {"actor": {"$regex": q, "$options": "i"}},
                {"target": {"$regex": q, "$options": "i"}},
            ]
        items = await db.audit_logs.find(filt, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)
        # facets for filter UI
        actions = await db.audit_logs.distinct("action", {"institution_id": institution_id})
        actors = await db.audit_logs.distinct("actor", {"institution_id": institution_id})
        return {"items": items, "actions": sorted(actions), "actors": sorted(actors), "count": len(items)}

    @router.get("/{institution_id}/event/{event_id}")
    async def get_event(institution_id: str, event_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        ev = await db.audit_logs.find_one({"id": event_id, "institution_id": institution_id}, {"_id": 0})
        if not ev:
            raise HTTPException(404, "Not found")
        return ev

    return router
