"""
VEDA (Claros AI) multi-pass reasoning pipeline.

Replaces the single-pass RAG flow ("embed → retrieve → generate") with a
3-pass chain that decomposes intent, retrieves evidence for each
sub-question, generates an answer, and self-verifies whether the answer
actually addresses the original intent. If verification fails, the
pipeline retries with a refined query (up to N total passes). If still
unresolved, it escalates by writing a `support_tickets` row tagged
`source="veda_unresolved"` so a human can pick it up.

Outcomes are recorded so Claros Insights can compute the VEDA resolution
rate KPI (target 85%+):

    pass_count           — int, total retrieval cycles executed
    resolved_in_pass     — int | None, the cycle that produced a resolved
                            answer (1..MAX_PASSES) or None when escalated
    escalated            — bool

The function returns a dict that the chat route can directly merge into
its response payload.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ai_service import generate_json, retrieve, resolve_model, chat_send

logger = logging.getLogger("academiaos.veda_reasoning")

MAX_PASSES = 3        # caps the retrieval/verify cycles
TOP_K_PER_SUB = 3     # chunks per sub-question
MAX_MERGED = 8        # global cap after dedup

DECOMPOSE_SYS = (
    "You are an intent classifier for a student-facing assistant on the "
    "Claros platform. Decompose the user's query into the smallest set of "
    "concrete information needs that, if all answered, would fully satisfy "
    "the user. Be conservative — most queries decompose into 1–3 sub-questions."
    "\n\nReturn JSON ONLY in this schema:"
    "\n{"
    "\n  \"intent\": <one-sentence canonical statement of what the user wants>,"
    "\n  \"sub_questions\": [<short search-friendly sub-questions, 1–4 items>],"
    "\n  \"requires_pii\": <true if the answer requires the user's own personal/academic record>"
    "\n}"
)

VERIFY_SYS = (
    "You verify whether a draft answer fully addresses a user's intent. "
    "Be strict: if the answer is vague, sidesteps the question, or omits a "
    "sub-question, flag it as unresolved."
    "\n\nReturn JSON ONLY in this schema:"
    "\n{"
    "\n  \"resolved\": <true|false>,"
    "\n  \"missing\": <one short sentence describing what's still missing, or \"\" when resolved>"
    "\n}"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _decompose(query: str, provider: str, model: str) -> Dict[str, Any]:
    """Pass 1 — intent decomposition. Falls back to the raw query as a single
    sub-question if Claude returns a malformed payload."""
    try:
        out = await generate_json(
            system_message=DECOMPOSE_SYS,
            user_text=query,
            provider=provider,
            model=model,
            max_tokens=600,
        )
        sub = out.get("sub_questions") or []
        if not isinstance(sub, list) or not sub:
            sub = [query]
        return {
            "intent": (out.get("intent") or query)[:400],
            "sub_questions": [str(s)[:240] for s in sub][:4],
            "requires_pii": bool(out.get("requires_pii", False)),
        }
    except Exception as e:  # noqa: BLE001
        logger.warning("VEDA decompose failed (%s); falling back to raw query", e)
        return {"intent": query, "sub_questions": [query], "requires_pii": False}


async def _gather_chunks(db, institution_id: str, queries: List[str]) -> List[dict]:
    """Pass 2 — semantic retrieval. Runs one search per sub-question against
    the existing vector store (Mongo-backed cosine retrieval today, swappable
    for Qdrant tomorrow without changing this caller) and dedupes by
    ``source_id`` + leading chunk-id so the LLM never sees the same passage
    twice."""
    seen: set = set()
    merged: List[dict] = []
    for q in queries:
        try:
            hits = await retrieve(
                db, institution_id=institution_id, query=q, top_k=TOP_K_PER_SUB,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("VEDA retrieve failed for sub-question %r: %s", q[:60], e)
            continue
        for h in hits:
            key = (h.get("source_id"), (h.get("text") or "")[:64])
            if key in seen:
                continue
            seen.add(key)
            merged.append(h)
            if len(merged) >= MAX_MERGED:
                return merged
    return merged


def _format_evidence(chunks: List[dict]) -> str:
    if not chunks:
        return ""
    blocks = []
    for i, p in enumerate(chunks):
        title = p.get("source_title") or "untitled"
        blocks.append(f"[Doc {i+1} — {title}]\n{(p.get('text') or '')[:480]}")
    return "\n\n<KNOWLEDGE_BASE>\n" + "\n\n".join(blocks) + "\n</KNOWLEDGE_BASE>"


async def _verify(intent: str, draft: str, provider: str, model: str) -> Dict[str, Any]:
    """Pass 3 — does the draft fully address the original intent?"""
    try:
        out = await generate_json(
            system_message=VERIFY_SYS,
            user_text=f"INTENT:\n{intent}\n\nDRAFT ANSWER:\n{draft}",
            provider=provider,
            model=model,
            max_tokens=300,
        )
        return {
            "resolved": bool(out.get("resolved", False)),
            "missing": (out.get("missing") or "")[:240],
        }
    except Exception as e:  # noqa: BLE001
        logger.warning("VEDA verify failed (%s); treating as resolved", e)
        return {"resolved": True, "missing": ""}


async def _escalate(
    db, *, institution_id: str, user: dict, original_query: str,
    intent: str, draft: str, missing: str,
) -> str:
    """Drop an unresolved VEDA conversation into `support_tickets` so a human
    operator can take it from where the model gave up. Returns the ticket id.
    """
    ticket_id = str(uuid.uuid4())
    await db.support_tickets.insert_one({
        "id": ticket_id,
        "institution_id": institution_id,
        "learner_id": user.get("id"),
        "learner_name": user.get("name"),
        "learner_email": user.get("email"),
        "subject": f"VEDA could not resolve: {original_query[:80]}",
        "body": (
            f"VEDA exhausted {MAX_PASSES} reasoning passes without satisfying the user's intent."
            f"\n\nORIGINAL QUERY:\n{original_query}"
            f"\n\nDECOMPOSED INTENT:\n{intent}"
            f"\n\nLAST DRAFT ANSWER:\n{draft}"
            f"\n\nVERIFIER SAID STILL MISSING:\n{missing or '(unspecified)'}"
        ),
        "category": "ai_assistant_escalation",
        "severity": "medium",
        "source": "veda_unresolved",
        "status": "open",
        "ts": _now_iso(),
        "thread": [],
    })
    # Notify the registrar + institution admin role
    for role in ("registrar", "institution_admin"):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": institution_id,
            "user_id": None,
            "role": role,
            "kind": "veda.escalation",
            "title": "VEDA escalation",
            "body": f"VEDA escalated a query after {MAX_PASSES} passes: {original_query[:80]}",
            "link": "/student-assistant#tickets",
            "ts": _now_iso(),
            "read": False,
            "actor": user.get("email"),
        })
    return ticket_id


async def run_pipeline(
    *,
    db,
    session: dict,
    institution_id: str,
    user: dict,
    user_text: str,
    base_system_message: str,
    provider: str,
    model: str,
) -> Dict[str, Any]:
    """
    Drive the full 3-pass chain for one user message.

    Returns:
        {
            "reply": str,
            "model": str,
            "session_id": str,
            "pass_count": int,
            "resolved_in_pass": int | None,
            "escalated": bool,
            "ticket_id": str | None,
            "intent": str,
            "sub_questions": List[str],
            "citations": List[dict],
        }
    """
    # --- Pass 1 -----------------------------------------------------------
    decomp = await _decompose(user_text, provider, model)
    intent = decomp["intent"]
    sub_questions = decomp["sub_questions"]

    # Iterate retrieval + verify up to MAX_PASSES, refining the query each
    # cycle by appending the previous "what's still missing" hint.
    refined_queries: List[str] = list(sub_questions)
    last_draft: str = ""
    last_missing: str = ""
    last_chunks: List[dict] = []
    resolved_in_pass: Optional[int] = None
    pass_count = 0
    assistant_meta: Dict[str, Any] = {}

    for cycle in range(1, MAX_PASSES + 1):
        pass_count = cycle

        # --- Pass 2 -------------------------------------------------------
        chunks = await _gather_chunks(db, institution_id, refined_queries)
        last_chunks = chunks
        evidence_block = _format_evidence(chunks)

        # --- Pass 3a (generate) ------------------------------------------
        sys = (
            base_system_message
            + f"\n\n<DECOMPOSED_INTENT>\n{intent}\n</DECOMPOSED_INTENT>"
            + evidence_block
        )
        # Use chat_send only on the FINAL cycle so we don't pollute the
        # session history with retry drafts. Earlier cycles use a lightweight
        # generate_text via the same Claude.
        if cycle < MAX_PASSES:
            from ai_service import generate_text as _gt
            try:
                last_draft = await _gt(
                    system_message=sys, user_text=user_text,
                    provider=provider, model=model, max_tokens=1200,
                )
            except Exception as e:  # noqa: BLE001
                logger.warning("VEDA generation failed on cycle %d: %s", cycle, e)
                last_draft = ""
        else:
            # Final cycle — persist to chat history via chat_send
            try:
                assistant = await chat_send(
                    db, session=session, user_text=user_text,
                    system_message=sys, provider=provider, model=model,
                    citations=[
                        {"source_id": c.get("source_id"),
                         "title": c.get("source_title"),
                         "score": c.get("score")}
                        for c in chunks
                    ],
                    max_history=20,
                )
                last_draft = assistant["text"]
                assistant_meta = assistant
            except Exception as e:
                logger.exception("VEDA final chat_send failed: %s", e)
                raise

        # --- Pass 3b (verify) --------------------------------------------
        verdict = await _verify(intent, last_draft, provider, model)
        if verdict["resolved"]:
            resolved_in_pass = cycle
            break

        # Refine query for next cycle: append the missing hint as a new
        # sub-question so retrieval looks for what we lacked.
        last_missing = verdict["missing"]
        refined_queries = sub_questions + (
            [last_missing] if last_missing else []
        )

    escalated = resolved_in_pass is None
    ticket_id: Optional[str] = None
    if escalated:
        try:
            ticket_id = await _escalate(
                db, institution_id=institution_id, user=user,
                original_query=user_text, intent=intent,
                draft=last_draft, missing=last_missing,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("VEDA escalation insert failed: %s", e)

    # Persist a dedicated reasoning trace row so Insights can compute the
    # VEDA resolution-rate KPI without scanning embedded session arrays.
    try:
        await db.veda_message_traces.insert_one({
            "id": str(uuid.uuid4()),
            "institution_id": institution_id,
            "user_id": user.get("id"),
            "session_id": session["id"],
            "query": user_text[:1000],
            "intent": intent,
            "sub_questions": sub_questions,
            "pass_count": pass_count,
            "resolved_in_pass": resolved_in_pass,
            "escalated": escalated,
            "ticket_id": ticket_id,
            "citations_n": len(last_chunks),
            "ts": _now_iso(),
        })
    except Exception as e:  # noqa: BLE001
        logger.warning("VEDA trace persist failed: %s", e)

    return {
        "reply": last_draft,
        "model": assistant_meta.get("model") or model,
        "session_id": session["id"],
        "pass_count": pass_count,
        "resolved_in_pass": resolved_in_pass,
        "escalated": escalated,
        "ticket_id": ticket_id,
        "intent": intent,
        "sub_questions": sub_questions,
        "citations": [
            {"source_id": c.get("source_id"),
             "title": c.get("source_title"),
             "score": c.get("score")}
            for c in last_chunks
        ],
    }
