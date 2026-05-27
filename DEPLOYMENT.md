# AcademiaOS — Deployment Readiness

This document covers everything needed to take AcademiaOS from the preview environment to a customer-facing deployment.

> Stack: **FastAPI · MongoDB · React (CRA) · supervisor**.
> No Docker compose required on the platform — supervisor manages both
> services. For self-hosted deployments use the Containerfile in `infra/`
> (when added) or replicate the supervisor model with systemd.

---

## 1. Environment variables

### `backend/.env` (production)
| Key | Purpose | Notes |
|-----|---------|-------|
| `MONGO_URL` | Mongo connection string | mongodb+srv://… for Atlas |
| `DB_NAME` | Mongo database name | keep stable per environment |
| `JWT_SECRET` | App JWT signing secret | rotate quarterly |
| `EMERGENT_LLM_KEY` | Universal LLM key | obtained via Profile → Universal Key |
| `UPLOAD_DIR` | Path for Content Studio object storage | default `/app/uploads`, mount a persistent volume |

### `frontend/.env` (production)
| Key | Purpose |
|-----|---------|
| `REACT_APP_BACKEND_URL` | Public origin of the backend (ingress URL) |

Both `.env` files are loaded at process start. **Never** commit them.

---

## 2. External integrations

Per-tenant integrations are configured by Institution Admins under
**Settings → Integrations**. Required keys:

| Integration | Where the key comes from |
|-------------|--------------------------|
| Resend (email) | https://resend.com/api-keys (admin self-serve) |
| Emergent Google Auth | zero-config; ensure the FE origin matches the OAuth allowlist |
| LLM provider | inherited from `EMERGENT_LLM_KEY`; no per-tenant key required |

---

## 3. Pre-launch checklist

### Backend
- [ ] `JWT_SECRET` is set to a high-entropy random string (not the dev default).
- [ ] `MONGO_URL` points to a managed cluster (Atlas / DocumentDB) with auth + TLS.
- [ ] `UPLOAD_DIR` is mapped to a persistent volume (≥ 50 GB recommended).
- [ ] CORS allow-list trimmed to the production frontend origin (currently `["*"]`).
- [ ] `audit_logs` retention policy configured (≥ 13 months for compliance frameworks).
- [ ] Health endpoint exposed (`GET /api/health` returns `{ok: true}`).
- [ ] Rate limiting in front of `/api/auth/*` (login + Google session).

### Frontend
- [ ] `REACT_APP_BACKEND_URL` points to the ingress URL of the prod backend.
- [ ] `yarn build` succeeds with zero ESLint errors.
- [ ] CDN serves built static assets with long cache (≥ 30 days, content-hashed filenames).
- [ ] Tenant theme & language detect correctly on a cold browser.
- [ ] Google login button visible on /login.

### Multi-tenant data
- [ ] At least one institution admin per tenant has an email matching their Google account (otherwise SSO is blocked).
- [ ] Seed data scripts (`seed_data.py`, `seed_ai.py`, `seed_phase4.py`, `seed_phase6.py`) are **idempotent** — running them twice does not duplicate rows.
- [ ] Workflow templates per tenant reviewed by the Compliance Officer.
- [ ] At least one HITL approver provisioned for every workflow that contains an `hitl` step.

### Mobile QA (smoke list)
- [ ] Sidebar drawer opens / closes on ≤ 900px.
- [ ] PageHeader actions wrap on small screens (no horizontal scroll).
- [ ] Workflows tabs scroll horizontally without breaking layout.
- [ ] Recharts containers resize correctly on orientation change.
- [ ] All approve/reject buttons in the Approval Queue remain reachable on 375px.

### Observability
- [ ] `tail -f /var/log/supervisor/backend.*.log` shows clean startup + seed counts.
- [ ] Audit log volume monitored — sudden drops indicate a regression.
- [ ] Workflow failure rate alarmed (alert if > 5% / hour).

### Security
- [ ] No demo passwords (`Demo@2026`, `Admin@2026`) remain in production user rows.
- [ ] `test_credentials.md` removed from the production image.
- [ ] Bcrypt rounds ≥ 12.
- [ ] HTTPS termination at the ingress; HSTS enabled.
- [ ] Backup strategy for Mongo (daily snapshot + 30 days retention).

---

## 4. Smoke commands

```bash
# Backend health
curl -fsS "$REACT_APP_BACKEND_URL/api/auth/login" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@academiaos.ai","password":"<rotated>"}'

# Seed verification
mongosh "$MONGO_URL" --eval "
  use('$DB_NAME');
  print('institutions:', db.institutions.countDocuments());
  print('users:', db.users.countDocuments());
  print('workflow_templates:', db.workflow_templates.countDocuments());
"

# Frontend
yarn --cwd /app/frontend build && ls -lh /app/frontend/build/static/js
```

---

## 5. Roll-back plan

- Mongo: restore from latest snapshot (Atlas point-in-time).
- Backend: redeploy previous tagged build; rolling restart via supervisor.
- Frontend: previous CDN bundle is preserved for 30 days — flip alias.
- For data corruption in workflow runs: use the per-run **Rollback Console** (UI button) — it flips undoable steps to `rolled_back` and writes a `workflow.rollback` audit row.

---

_Last updated: Phase 8 (May 2026)._
