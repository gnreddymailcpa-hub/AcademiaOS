"""
AcademiaOS AI Service
- Pluggable LLM provider abstraction via emergentintegrations
- Per-institution model overrides resolved from MongoDB
- Lightweight RAG via term-frequency retrieval over document chunks
- Multi-turn chat sessions persisted in MongoDB
"""
from __future__ import annotations

import os
import re
import json
import uuid
import math
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("academiaos.ai")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Platform default. Each institution can override via ai_config.
DEFAULT_PROVIDER = "anthropic"
DEFAULT_MODEL = "claude-sonnet-4-6"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Per-institution model resolution
# ---------------------------------------------------------------------------
INSTITUTION_DEFAULTS = {
    # ISB → OpenAI English (business school)
    "11111111-1111-1111-1111-111111111111": ("openai", "gpt-4o"),
    # EAIC → Claude (best Arabic / RAG)
    "22222222-2222-2222-2222-222222222222": ("anthropic", "claude-sonnet-4-6"),
    # UoB → Claude
    "33333333-3333-3333-3333-333333333333": ("anthropic", "claude-sonnet-4-6"),
}


async def resolve_model(db, institution_id: str, use_case_key: Optional[str] = None) -> tuple[str, str]:
    """Return (provider, model) for a given institution + optional use case override."""
    if use_case_key:
        cfg = await db.ai_use_cases.find_one(
            {"institution_id": institution_id, "key": use_case_key}, {"_id": 0}
        )
        if cfg and cfg.get("provider") and cfg.get("model"):
            return cfg["provider"], cfg["model"]
    return INSTITUTION_DEFAULTS.get(institution_id, (DEFAULT_PROVIDER, DEFAULT_MODEL))


# ---------------------------------------------------------------------------
# Single-shot generation (no history)
# ---------------------------------------------------------------------------
async def generate_text(
    *,
    system_message: str,
    user_text: str,
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    session_id: Optional[str] = None,
    max_tokens: int = 2000,
) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id or str(uuid.uuid4()),
        system_message=system_message,
    ).with_model(provider, model).with_params(max_tokens=max_tokens)
    response = await chat.send_message(UserMessage(text=user_text))
    return response


async def generate_json(
    *,
    system_message: str,
    user_text: str,
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 3000,
) -> dict:
    """Force JSON output by appending strict instructions; parse defensively."""
    sys = (
        system_message
        + "\n\nYou MUST respond with VALID JSON only. No prose, no markdown fences, no explanations."
        + " Start with '{' and end with '}'. Do not wrap output in code blocks."
    )
    raw = await generate_text(
        system_message=sys, user_text=user_text, provider=provider, model=model,
        max_tokens=max_tokens,
    )
    # Strip code fences if any
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # Take first { ... } substring
    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        text = text[first : last + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("JSON parse failed; returning raw text payload")
        return {"raw": raw}


# ---------------------------------------------------------------------------
# Multi-turn chat with DB-backed persistence
# ---------------------------------------------------------------------------
async def get_or_create_session(db, *, institution_id: str, user_id: str, kind: str, course_id: Optional[str] = None) -> dict:
    """kind: 'instructor' | 'advisor' | 'assistant'."""
    sess = await db.ai_sessions.find_one(
        {"institution_id": institution_id, "user_id": user_id, "kind": kind, "course_id": course_id, "open": True},
        {"_id": 0},
    )
    if sess:
        return sess
    sess = {
        "id": str(uuid.uuid4()),
        "institution_id": institution_id,
        "user_id": user_id,
        "kind": kind,
        "course_id": course_id,
        "open": True,
        "created_at": now_iso(),
        "messages": [],
    }
    await db.ai_sessions.insert_one(dict(sess))
    return sess


async def chat_send(
    db,
    *,
    session: dict,
    user_text: str,
    system_message: str,
    provider: str,
    model: str,
    citations: Optional[List[dict]] = None,
    max_history: int = 20,
) -> dict:
    """Send a message in a session; history is replayed from DB.

    `max_history` caps the rolling window — only the last N user-turns are
    replayed to keep context lean and prevent quadratic token growth.
    """
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session["id"],
        system_message=system_message,
    ).with_model(provider, model).with_params(max_tokens=1200)

    # Replay only the rolling window of prior USER turns into the chat object.
    prior_user_msgs = [m for m in session.get("messages", []) if m.get("role") == "user"]
    for m in prior_user_msgs[-max_history:]:
        try:
            await chat.send_message(UserMessage(text=m["text"]))
        except Exception:
            pass  # best-effort replay; lib stores history internally too

    response = await chat.send_message(UserMessage(text=user_text))

    new_user = {"role": "user", "text": user_text, "ts": now_iso()}
    new_assistant = {
        "role": "assistant",
        "text": response,
        "ts": now_iso(),
        "citations": citations or [],
        "model": f"{provider}/{model}",
    }
    await db.ai_sessions.update_one(
        {"id": session["id"]},
        {"$push": {"messages": {"$each": [new_user, new_assistant]}}},
    )
    return new_assistant


# ---------------------------------------------------------------------------
# Lightweight RAG retrieval (term-frequency cosine)
# ---------------------------------------------------------------------------
_WORD_RE = re.compile(r"[A-Za-z\u0600-\u06FF]{2,}")


def _tokens(text: str) -> List[str]:
    return [w.lower() for w in _WORD_RE.findall(text or "")]


def _vec(text: str) -> Counter:
    return Counter(_tokens(text))


def _cos(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    num = sum(a[t] * b[t] for t in common)
    da = math.sqrt(sum(v * v for v in a.values()))
    db = math.sqrt(sum(v * v for v in b.values()))
    if da == 0 or db == 0:
        return 0.0
    return num / (da * db)


def chunk_text(text: str, *, size: int = 600, overlap: int = 80) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += size - overlap
    return chunks


async def retrieve(db, *, institution_id: str, query: str, top_k: int = 4, course_id: Optional[str] = None) -> List[dict]:
    q = _vec(query)
    filt = {"institution_id": institution_id, "approved": True}
    if course_id:
        filt["course_id"] = course_id
    cursor = db.content_chunks.find(filt, {"_id": 0}).limit(2000)
    scored: List[tuple[float, dict]] = []
    async for c in cursor:
        score = _cos(q, Counter(c.get("tokens", {})))
        if score > 0:
            scored.append((score, c))
    scored.sort(key=lambda x: -x[0])
    return [{**c, "score": round(s, 4)} for s, c in scored[:top_k]]
