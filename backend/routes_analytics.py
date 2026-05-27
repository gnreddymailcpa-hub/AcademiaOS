"""
Phase 5 — Executive Analytics + Natural Language Analytics Console.

- Role-aware dashboards (Executive / Programme / Workforce / Compliance / AI Usage)
- NL Console: LLM resolves question → controlled intent → backend executes
  against tenant data → returns chart spec + narrative.
"""
import uuid
import logging
import random
from collections import defaultdict, Counter
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel

from ai_service import resolve_model, generate_json, now_iso

logger = logging.getLogger("academiaos.analytics")


class AskRequest(BaseModel):
    institution_id: str
    question: str
    language: str = "en"


# -------- Allowed NL intents --------
INTENT_CATALOG = {
    "completion_by_programme": "Per-programme completion percentages",
    "enrolment_by_programme": "Per-programme enrolment counts",
    "ai_sessions_by_module": "AI session count per module",
    "audit_volume_by_action": "Audit log volume grouped by action",
    "intervention_pipeline": "Pending vs approved vs rejected psychometric interventions",
    "fairness_status": "Latest fairness audit overall disparity per dimension",
    "assessment_scores_distribution": "Score distribution buckets for completed attempts",
    "workforce_readiness_by_role": "Average skill-gap reduction per target role",
    "at_risk_learners": "Number of learners flagged at risk (pending psychometric events)",
    "ai_provider_mix": "Use cases grouped by provider",
}


def build_analytics_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/analytics")

    async def _scope(user, institution_id):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(403, "Forbidden")

    # ---------------------------------------------------------------- Executive
    @router.get("/{institution_id}/executive")
    async def executive(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0})
        if not inst:
            raise HTTPException(404, "Institution not found")

        programmes = await db.programmes.find({"institution_id": institution_id}, {"_id": 0}).to_list(200)
        courses = await db.courses.count_documents({"institution_id": institution_id})
        users_count = await db.users.count_documents({"institution_id": institution_id})
        ai_sessions = await db.ai_sessions.count_documents({"institution_id": institution_id})
        ai_outputs = await db.ai_outputs.count_documents({"institution_id": institution_id})
        attempts = await db.assessment_attempts.find(
            {"institution_id": institution_id}, {"_id": 0, "score": 1, "completed_at": 1, "started_at": 1}
        ).to_list(1000)
        completed = [a for a in attempts if a.get("completed_at") and a.get("score") is not None]
        avg_score = round(sum(a["score"] for a in completed) / len(completed), 1) if completed else 0
        pass_rate = round(100 * sum(1 for a in completed if a["score"] >= 60) / len(completed), 1) if completed else 0
        pending_events = await db.psychometric_events.count_documents(
            {"institution_id": institution_id, "status": "pending_review"}
        )

        # Deterministic 12-month trend seeded by institution
        random.seed(hash(institution_id) & 0xFFFFFFFF)
        base = (inst.get("metrics") or {}).get("students") or (inst.get("metrics") or {}).get("learners") or 500
        trend = []
        for i in range(12):
            month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i]
            trend.append({
                "m": month,
                "enrolments": int(base * (0.55 + 0.04 * i + random.uniform(-0.03, 0.03))),
                "completion": int(60 + 2 * i + random.uniform(-3, 3)),
                "ai_sessions": int((base / 5) * (0.4 + 0.07 * i + random.uniform(-0.05, 0.05))),
            })

        return {
            "institution": inst,
            "kpis": {
                "programmes": len(programmes),
                "courses": courses,
                "users": users_count,
                "ai_sessions": ai_sessions,
                "ai_outputs": ai_outputs,
                "avg_assessment_score": avg_score,
                "pass_rate": pass_rate,
                "pending_events": pending_events,
            },
            "trend": trend,
            "programmes": [
                {
                    "name": p["name"],
                    "code": p["code"],
                    "enrolled": p.get("enrolled", 0),
                    "completion_rate": p.get("completion_rate", 0),
                }
                for p in programmes
            ],
        }

    # ---------------------------------------------------------------- Workforce
    @router.get("/{institution_id}/workforce")
    async def workforce(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        fw = await db.skill_frameworks.find_one({"institution_id": institution_id}, {"_id": 0}) or {"target_roles": []}
        profiles = await db.learner_profiles.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)

        by_role = []
        for role in fw["target_roles"]:
            matching = [p for p in profiles if p.get("target_role") == role["key"]]
            heatmap = []
            for skill in role["skills"]:
                # average current level across matching learners (fall back to target-2 if no profiles)
                if matching:
                    levels = [
                        (next((x["level"] for x in p["skills"] if x["name"] == skill["name"]), 0))
                        for p in matching
                    ]
                    avg_cur = round(sum(levels) / len(levels), 2)
                else:
                    avg_cur = max(0, skill["level"] - 2)
                heatmap.append({
                    "skill": skill["name"],
                    "current": avg_cur,
                    "target": skill["level"],
                    "gap": max(0, round(skill["level"] - avg_cur, 2)),
                })
            total_target = sum(s["target"] for s in heatmap) or 1
            total_current = sum(s["current"] for s in heatmap)
            readiness_pct = round(100 * total_current / total_target, 1)
            by_role.append({
                "role": role["name"],
                "learners": len(matching) if matching else 0,
                "readiness_pct": readiness_pct,
                "heatmap": heatmap,
            })

        # institution-level metrics
        metrics = (await db.institutions.find_one({"id": institution_id}, {"_id": 0}) or {}).get("metrics", {})
        return {
            "by_role": by_role,
            "metrics": {
                "workforce_readiness": metrics.get("workforce_readiness", 0),
                "certification_compliance": metrics.get("certification_compliance", 0),
                "expiring_certs": metrics.get("expiring_certs", 0),
            },
        }

    # ---------------------------------------------------------------- Compliance
    @router.get("/{institution_id}/compliance")
    async def compliance(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        # Aggregate audit_logs
        cursor = db.audit_logs.find({"institution_id": institution_id}, {"_id": 0}).sort("ts", -1).limit(1000)
        by_action = Counter()
        by_actor = Counter()
        timeline = defaultdict(int)
        recent = []
        async for ev in cursor:
            by_action[ev.get("action", "?")] += 1
            by_actor[ev.get("actor", "?")] += 1
            ts = ev.get("ts", "")
            if ts:
                day = ts[:10]
                timeline[day] += 1
            if len(recent) < 30:
                recent.append(ev)

        timeline_items = sorted([{"day": k, "count": v} for k, v in timeline.items()], key=lambda x: x["day"])[-14:]

        # Approvals from psychometric_events as a separate stream
        psych_pending = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "pending_review"})
        psych_approved = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "approved"})
        psych_rejected = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "rejected"})

        inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0}) or {}
        return {
            "data_residency": inst.get("data_residency"),
            "compliance_framework": inst.get("compliance_framework"),
            "audit_total": sum(by_action.values()),
            "by_action": [{"action": k, "count": v} for k, v in by_action.most_common(12)],
            "by_actor": [{"actor": k, "count": v} for k, v in by_actor.most_common(10)],
            "timeline": timeline_items,
            "approvals": {"pending": psych_pending, "approved": psych_approved, "rejected": psych_rejected},
            "recent": recent,
        }

    # ---------------------------------------------------------------- AI usage
    @router.get("/{institution_id}/ai-usage")
    async def ai_usage(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        sessions = await db.ai_sessions.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        outputs = await db.ai_outputs.find({"institution_id": institution_id}, {"_id": 0, "model": 1, "kind": 1, "created_at": 1}).to_list(500)

        by_kind = Counter()
        by_model = Counter()
        for s in sessions:
            by_kind[s.get("kind", "?")] += 1
            for m in s.get("messages", []):
                if m.get("model"):
                    by_model[m["model"]] += 1
        for o in outputs:
            by_kind[o.get("kind", "content_" + (o.get("kind") or "?"))] += 1
            if o.get("model"):
                by_model[o["model"]] += 1

        use_cases = await db.ai_use_cases.find({"institution_id": institution_id}, {"_id": 0}).to_list(50)
        provider_mix = Counter()
        for uc in use_cases:
            provider_mix[uc.get("provider", "unknown")] += 1

        # Synthetic latency p50 / p95 per module
        random.seed(hash(institution_id + "lat") & 0xFFFFFFFF)
        latency = []
        for uc in use_cases:
            base_p50 = random.uniform(1800, 4200)
            latency.append({
                "module": uc["name_en"],
                "p50_ms": int(base_p50),
                "p95_ms": int(base_p50 * random.uniform(1.6, 2.2)),
                "calls": by_kind.get(uc["key"], 0) + random.randint(20, 240),
            })

        return {
            "sessions_total": len(sessions),
            "outputs_total": len(outputs),
            "by_kind": [{"kind": k, "count": v} for k, v in by_kind.most_common(10)],
            "by_model": [{"model": k, "count": v} for k, v in by_model.most_common(10)],
            "provider_mix": [{"provider": k, "count": v} for k, v in provider_mix.items()],
            "latency": sorted(latency, key=lambda x: -x["calls"])[:10],
        }

    # ---------------------------------------------------------------- Programmes drill-down
    @router.get("/{institution_id}/programmes")
    async def programmes(institution_id: str, user: dict = Depends(get_current_user)):
        await _scope(user, institution_id)
        db = get_db()
        progs = await db.programmes.find({"institution_id": institution_id}, {"_id": 0}).to_list(200)
        courses = await db.courses.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        out = []
        for p in progs:
            p_courses = [c for c in courses if c.get("programme_id") == p["id"]]
            out.append({
                **p,
                "course_count": len(p_courses),
                "module_count": sum(c.get("modules", 0) for c in p_courses),
            })
        return out

    # ---------------------------------------------------------------- NL Console
    INTENT_HINTS = "\n".join(f"- {k}: {v}" for k, v in INTENT_CATALOG.items())

    async def _execute_intent(db, institution_id: str, intent: str, narrative: str) -> dict:
        """Resolve intent against MongoDB and return {chart_type, data, narrative, x_label, y_label}."""

        async def _completion_by_programme():
            programmes = await db.programmes.find({"institution_id": institution_id}, {"_id": 0}).to_list(200)
            return {
                "chart_type": "bar",
                "data": [{"label": p["code"], "value": p.get("completion_rate", 0)} for p in programmes],
                "x_label": "Programme",
                "y_label": "Completion %",
            }

        async def _enrolment_by_programme():
            programmes = await db.programmes.find({"institution_id": institution_id}, {"_id": 0}).to_list(200)
            return {
                "chart_type": "bar",
                "data": [{"label": p["code"], "value": p.get("enrolled", 0)} for p in programmes],
                "x_label": "Programme",
                "y_label": "Enrolled",
            }

        async def _ai_sessions_by_module():
            sess = await db.ai_sessions.find({"institution_id": institution_id}, {"_id": 0, "kind": 1}).to_list(1000)
            cnt = Counter(s.get("kind", "?") for s in sess)
            return {
                "chart_type": "pie",
                "data": [{"label": k, "value": v} for k, v in cnt.items()],
                "x_label": "Module",
                "y_label": "Sessions",
            }

        async def _audit_volume_by_action():
            cur = db.audit_logs.find({"institution_id": institution_id}, {"_id": 0, "action": 1})
            cnt = Counter()
            async for e in cur:
                cnt[e.get("action", "?")] += 1
            top = cnt.most_common(8)
            return {
                "chart_type": "bar",
                "data": [{"label": k, "value": v} for k, v in top],
                "x_label": "Action",
                "y_label": "Events",
            }

        async def _intervention_pipeline():
            pending = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "pending_review"})
            approved = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "approved"})
            rejected = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "rejected"})
            return {
                "chart_type": "pie",
                "data": [
                    {"label": "Pending", "value": pending},
                    {"label": "Approved", "value": approved},
                    {"label": "Rejected", "value": rejected},
                ],
                "x_label": "Status",
                "y_label": "Events",
            }

        async def _fairness_status():
            audit = await db.fairness_audits.find_one(
                {"institution_id": institution_id}, {"_id": 0}, sort=[("created_at", -1)]
            )
            if not audit:
                return {"chart_type": "empty", "data": [], "x_label": "Dimension", "y_label": "Disparity",
                        "note": "No fairness audit has been run yet."}
            return {
                "chart_type": "bar",
                "data": [{"label": d["dimension"], "value": d["disparity"]} for d in audit["dimensions"]],
                "x_label": "Dimension",
                "y_label": "Disparity",
            }

        async def _assessment_scores_distribution():
            attempts = await db.assessment_attempts.find(
                {"institution_id": institution_id, "score": {"$ne": None}}, {"_id": 0, "score": 1}
            ).to_list(1000)
            buckets = ["0-20", "21-40", "41-60", "61-80", "81-100"]
            counts = [0, 0, 0, 0, 0]
            for a in attempts:
                s = a["score"]
                idx = min(4, int(s // 20))
                counts[idx] += 1
            return {
                "chart_type": "bar",
                "data": [{"label": b, "value": c} for b, c in zip(buckets, counts)],
                "x_label": "Score bucket",
                "y_label": "Attempts",
            }

        async def _workforce_readiness_by_role():
            fw = await db.skill_frameworks.find_one({"institution_id": institution_id}, {"_id": 0}) or {"target_roles": []}
            profiles = await db.learner_profiles.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
            data = []
            for role in fw["target_roles"]:
                matching = [p for p in profiles if p.get("target_role") == role["key"]]
                total_target = sum(s["level"] for s in role["skills"]) or 1
                if matching:
                    levels = []
                    for skill in role["skills"]:
                        per_learner = [
                            next((x["level"] for x in p["skills"] if x["name"] == skill["name"]), 0)
                            for p in matching
                        ]
                        levels.append(sum(per_learner) / len(per_learner))
                    total_current = sum(levels)
                else:
                    total_current = sum(max(0, s["level"] - 2) for s in role["skills"])
                data.append({"label": role["name"], "value": round(100 * total_current / total_target, 1)})
            return {
                "chart_type": "bar",
                "data": data,
                "x_label": "Target role",
                "y_label": "Readiness %",
            }

        async def _at_risk_learners():
            cnt = await db.psychometric_events.count_documents({"institution_id": institution_id, "status": "pending_review"})
            return {
                "chart_type": "metric",
                "data": [{"label": "At-risk learners", "value": cnt}],
                "x_label": "",
                "y_label": "",
            }

        async def _ai_provider_mix():
            use_cases = await db.ai_use_cases.find({"institution_id": institution_id}, {"_id": 0}).to_list(50)
            cnt = Counter(u.get("provider", "?") for u in use_cases)
            return {
                "chart_type": "pie",
                "data": [{"label": k, "value": v} for k, v in cnt.items()],
                "x_label": "Provider",
                "y_label": "Use cases",
            }

        registry = {
            "completion_by_programme": _completion_by_programme,
            "enrolment_by_programme": _enrolment_by_programme,
            "ai_sessions_by_module": _ai_sessions_by_module,
            "audit_volume_by_action": _audit_volume_by_action,
            "intervention_pipeline": _intervention_pipeline,
            "fairness_status": _fairness_status,
            "assessment_scores_distribution": _assessment_scores_distribution,
            "workforce_readiness_by_role": _workforce_readiness_by_role,
            "at_risk_learners": _at_risk_learners,
            "ai_provider_mix": _ai_provider_mix,
        }
        fn = registry.get(intent)
        if not fn:
            return {"chart_type": "empty", "data": [], "x_label": "", "y_label": "",
                    "note": f"Unsupported intent: {intent}"}
        result = await fn()
        result["narrative"] = narrative
        result["intent"] = intent
        return result

    @router.post("/ask")
    async def ask(payload: AskRequest = Body(...), user: dict = Depends(get_current_user)):
        await _scope(user, payload.institution_id)
        db = get_db()
        provider, model = await resolve_model(db, payload.institution_id, "analytics")
        lang = "Arabic (formal modern)" if payload.language == "ar" else "English"
        sys = (
            "You are AcademiaOS Natural Language Analytics Console. Translate the user's "
            f"academic-operations question into a controlled intent. Respond in {lang}. "
            "You MUST pick ONE intent from this catalog (use the key exactly):\n"
            f"{INTENT_HINTS}\n\n"
            "If no intent matches, respond with intent='unsupported' and a polite refusal."
        )
        user_text = (
            f"User question: {payload.question}\n\n"
            "Return JSON with schema: {intent:string, narrative:string, chart_title:string} "
            "where narrative is a one-sentence factual answer the user can read."
        )
        try:
            decision = await generate_json(
                system_message=sys, user_text=user_text, provider=provider, model=model, max_tokens=400
            )
        except Exception as e:
            raise HTTPException(502, f"AI provider error: {e}")
        intent = decision.get("intent", "unsupported")
        narrative = decision.get("narrative", "")
        chart_title = decision.get("chart_title") or intent.replace("_", " ").title()

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "institution_id": payload.institution_id,
            "action": "analytics.nl_query", "target": intent,
            "actor": user["email"], "question": payload.question[:500],
            "model": f"{provider}/{model}", "ts": now_iso(),
        })

        if intent == "unsupported":
            return {
                "intent": "unsupported",
                "narrative": narrative or "I couldn't translate that into a supported analytics query yet.",
                "chart_type": "empty", "data": [],
                "chart_title": chart_title,
                "model": f"{provider}/{model}",
                "available_intents": list(INTENT_CATALOG.keys()),
            }

        result = await _execute_intent(db, payload.institution_id, intent, narrative)
        result["chart_title"] = chart_title
        result["model"] = f"{provider}/{model}"
        result["question"] = payload.question
        return result

    return router
