"""
Per-tenant email service. The tenant's admin configures their Resend
(or compatible) API key under Settings → Integrations. We never use a
platform-wide key — each institution owns its sending domain.

Falls back to a structured log line when no provider is configured so
the rest of the workflow stack continues to function for demos.
"""
import logging
from typing import Tuple, Optional

import httpx

logger = logging.getLogger("academiaos.email")


async def _load_email_config(db, institution_id: str) -> Optional[dict]:
    doc = await db.tenant_integrations.find_one({"institution_id": institution_id})
    if not doc:
        return None
    return doc.get("email") or None


async def send_email(
    db,
    institution_id: str,
    to: str,
    *,
    subject: str,
    text: str,
    html: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """Send an email via the tenant's configured provider.

    Returns (success, error_message). When no provider is configured the
    call is logged and returns (False, "not_configured") so the caller
    can decide to surface or silently degrade.
    """
    cfg = await _load_email_config(db, institution_id)
    if not cfg or not cfg.get("enabled") or not cfg.get("api_key"):
        logger.info("Email skipped (not configured) tenant=%s to=%s subj=%s",
                    institution_id, to, subject)
        return False, "not_configured"

    provider = (cfg.get("provider") or "resend").lower()
    from_email = cfg.get("from_email") or "noreply@academiaos.ai"
    from_name = cfg.get("from_name") or "AcademiaOS"
    from_header = f"{from_name} <{from_email}>"

    try:
        if provider == "resend":
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {cfg['api_key']}"},
                    json={
                        "from": from_header,
                        "to": [to],
                        "subject": subject,
                        "text": text,
                        **({"html": html} if html else {}),
                    },
                )
                if r.status_code >= 300:
                    return False, f"resend_{r.status_code}: {r.text[:160]}"
                return True, None
        return False, f"unsupported_provider:{provider}"
    except Exception as e:
        logger.exception("Email send failed: %s", e)
        return False, str(e)[:200]
