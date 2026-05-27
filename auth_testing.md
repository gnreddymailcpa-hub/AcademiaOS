# Auth Testing Playbook (Emergent Google Auth)

This file is consumed by the testing agent when validating Google Auth flows.

## Goal
AcademiaOS supports **two parallel auth modes**:

1. **Email/Password (legacy)** — JWT issued at `POST /api/auth/login`, bearer auth on every API call. Demo users live in `/app/memory/test_credentials.md`.
2. **Google SSO (Emergent-managed)** — initiated via `https://auth.emergentagent.com/?redirect=<origin>/dashboard`, returns to `/dashboard#session_id=<id>`. The frontend's AuthCallback page exchanges the session_id at `POST /api/auth/session` which sets an HTTP-only `session_token` cookie (7 days) **and** returns the same `{user, token}` payload as `/api/auth/login` so the existing app continues to work unchanged.

## Reminder block
Inside any code path that builds the Google login URL:

```
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const redirectUrl = window.location.origin + "/dashboard";
window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
```

## Backend mapping
- `POST /api/auth/session` accepts `{session_id}` in body **or** the `X-Session-ID` header.
- It calls `GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with header `X-Session-ID: <id>`.
- Response `{id, email, name, picture, session_token}` is upserted into `db.users` keyed by `email`. If an existing demo user exists with the same email, we **reuse** the row so RBAC stays consistent.
- A row in `db.user_sessions` is created with `expires_at = now() + 7d` (timezone-aware).
- The endpoint:
  - Sets an HTTP-only `session_token` cookie (`Secure`, `SameSite=None`, `path=/`).
  - Returns `{access_token: session_token, user}` so the existing JWT bearer flow keeps working.
- `GET /api/auth/me` accepts **either** the `session_token` cookie **or** an `Authorization: Bearer …` header.

## Test identities
- Demo Google account: provisioned by Emergent OAuth at runtime.
- Demo email/password identities: see `/app/memory/test_credentials.md`.

## Smoke checks
```bash
# Mint a fake session as a smoke test of /api/auth/me (cookie path)
curl -i -X POST $API/api/auth/session -H "X-Session-ID: <real-session-id-from-redirect>"
curl -i $API/api/auth/me --cookie "session_token=<the-token-just-set>"
```
