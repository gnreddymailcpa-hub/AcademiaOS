# AcademiaOS.ai — PRD

## Vision
Gartner-grade enterprise Academic AI Operating System. Multi-tenant SaaS where an
Institution Admin can configure a university, business school, government academy,
corporate academy, or online education platform end-to-end — without code.

## Tech (adapted to Emergent platform)
- Frontend: React 19 (CRA) + Tailwind + shadcn/ui + lucide-react + Recharts
- Backend: FastAPI (Python 3.11)
- DB: MongoDB (via Motor) — `users`, `institutions`, `campuses`, `departments`,
  `programmes`, `courses`, `cohorts`, `roles`
- Auth: JWT (PyJWT + bcrypt), token stored in `localStorage` key
  `academiaos_token`, sent as `Authorization: Bearer` header
- Theming: per-institution CSS-variable themes (`isb-theme`, `eaic-theme`,
  `bradford-theme`) swapped on `<html>` className
- i18n: EN / AR dictionary with `<html dir>` flipping

## Core requirements (static)
1. Configurable tenants (no hardcoded institution logic outside seed)
2. Institution switcher swaps ALL context simultaneously (theme + data)
3. 15 distinct user roles with scope-based RBAC
4. 15 sidebar navigation sections (5 functional in P1+2, 10 ComingSoon)
5. AI governance, audit trail and human-in-the-loop on irreversible actions
6. Bilingual EN/AR with full RTL
7. Demo-ready ISB India, EAIC UAE, University of Bradford UK

## Personas (P1+2)
- Super Admin — sees all tenants, default landing
- Institution Admin — scoped to one tenant, runs setup wizard + academic builder
- Dean / Executive Leadership — read-only dashboards
- Faculty / Instructor — content + course visibility (in P3)
- Student / Cadet — learner-side modules (in P3)

## Build phases
| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation: shell, RBAC, i18n/RTL, design system, multi-tenant model | ✅ |
| 2 | Institution config console, academic structure, 3 seed institutions | ✅ |
| 3 | AI modules M1–M4 (Content Generator, Instructor, Advisor, Student Assistant) | ✅ |
| 4 | AI modules M5–M6 (Assessments, Psychometrics) | ✅ |
| 5 | M7 Executive Analytics + NL console + AI Examiner co-pilot | ✅ |
| 6 | M8 Agentic Workflows + Compliance & Audit explorer | ✅ |
| 7 | Demo polish, security hardening, deploy | ⏳ |

## Implemented (May 2026)
- JWT auth (`/api/auth/login`, `/me`, `/logout`) with bcrypt hashing
- 3 seed institutions (ISB / EAIC / UoB) with full academic tree
- 15 seed roles, 11 demo users + 1 super admin
- Institution CRUD + tenant-scoped RLS at API layer
- Academic CRUD: campuses, departments, programmes, courses, cohorts
- Dashboard summary endpoint
- React shell: sidebar (15 routes), top bar, institution switcher, EN/AR
  language switcher with RTL, user menu
- Pages: Dashboard, Institution Setup (4-step wizard), Academic Structure
  (tree builder + add programme dialog), Users & Roles (roles + users tabs),
  Settings, ComingSoon placeholders for the remaining future modules
- Theming: per-tenant CSS variables applied on `<html>` class

### Phase 3 — May 2026
- AI provider abstraction via `emergentintegrations.llm.chat.LlmChat` with
  Emergent Universal Key. Per-institution provider/model override resolved
  from `ai_use_cases` collection.
- Seeded **8 AI use cases per tenant** (4.1–4.8) with bilingual EN/AR names,
  status flags (active / coming_soon), risk score, HITL + citations toggles.
- **Module 4.4 Content Studio**: text/file upload → SME approval → chunk + index
  for RAG → AI-generated `lesson_plan | flashcards | mcqs | case_guide` with
  structured JSON output and approval queue.
- **Module 4.1 AI Instructor**: course-grounded chat with term-frequency
  retrieval over `content_chunks`, citation cards with relevance scores,
  bilingual EN/AR, multi-turn session persistence in `ai_sessions`.
- **Module 4.2 AI Advisor**: deterministic skill-gap computation against
  institution skill framework + LLM-generated learning path, career pathway
  and proactive alerts (structured JSON).
- **Module 4.3 Student Assistant**: FAQ-grounded Claude chat with service
  category sidebar and ticket escalation.
- Full audit trail in `audit_logs` collection: every AI generation, approval,
  use-case mutation captured with actor + model + target.

### Phase 4 — May 2026
- **Module 4.7 Advanced Assessment Engine**: assessment CRUD, item bank,
  AI item generation from approved sources, adaptive sequencing (easy →
  intermediate → hard based on correctness), auto-scoring for MCQ, signal
  capture during attempts (response_time, hint_count, wrong_streak,
  inactivity), competency report by Bloom's level + difficulty.
- **Module 4.5 Psychometric & Behaviour Intelligence**: signal-rule engine
  evaluated on every answer submission; triggered events queued for human
  review (HITL); approve/reject with audit log; per-institution thresholds.
- **Fairness audit**: runs disparity computation across 3 dimensions
  (Cohort / Gender / Region) with OK / Watch / Review status; overall
  disparity = max(dimension disparities); thresholds 0.08 (warn) / 0.14 (fail).
- **Model drift dashboard**: 14-week accuracy + calibration_error line chart
  with reference threshold and alert flags.
- 3 seeded assessments (20 total items), 12 psychometric rules (4/institution)
  and 7 sample events so demo loads non-empty.
- Test coverage: 18/18 new Phase 4 backend tests pass; 18/18 Phase 1+2
  regression remain green.

### Phase 5 — May 2026
- **Module 4.6 Executive Analytics**: 5-tab role-aware console wired to
  live tenant data:
  - Executive — 8 KPI cards (programmes, courses, learners, AI sessions,
    avg assessment, pass rate, pending interventions, workforce readiness),
    12-month enrolment / completion / AI-sessions area chart and programme
    momentum table.
  - Workforce — readiness % per target role with per-skill heatmap bars
    colored by gap (red / amber / green) and certification compliance KPIs.
  - Compliance — audit volume by action (horizontal bars), top actors,
    recent audit events feed sourced from the same `audit_logs` collection
    we've been writing to since Phase 1.
  - AI Usage — provider mix pie, activity by module, per-module p50/p95
    latency.
- **Natural Language Analytics Console**: chat UI where the user asks in
  English or Arabic; Claude/GPT-4o resolves the question into a controlled
  intent from a 10-intent catalog; backend dispatches to a deterministic
  MongoDB aggregation; UI renders bar / pie / metric chart with narrative
  + model trace footer. Unsupported queries return a polite refusal with
  a list of available intents.
- Every NL query writes an `analytics.nl_query` entry to `audit_logs`.

### AI Examiner co-pilot — May 2026
- New endpoint `POST /api/assessments/items/{item_id}/examine` runs a
  fairness / distractor-quality / Bloom-alignment / source-grounding
  calibration via Claude or GPT-4o (tenant default) and stores the
  structured report in `examiner_reports`.
- Faculty trigger it from the item bank via an "Examine" button; dialog
  renders the verdict pill (pass / revise / reject), 4 score cards,
  suggestions list and a one-click suggested revised stem.
- 14/14 new Phase 5 backend tests pass; full regression on Phases 1–4
  remains green.

### Phase 6 — May 2026
- **Module 4.8 Agentic Workflows**: backend `routes_workflows.py` exposes
  `/api/workflows/{tenant}/templates|runs|approvals|summary` plus per-run
  `approve|reject|rollback` endpoints. Step kinds: `auto` (deterministic
  tool), `llm` (tenant-resolved Claude/GPT) and `hitl` (pauses for human
  approval). Runs auto-advance through auto/llm steps and pause on HITL
  gates. Every transition writes to `audit_logs`.
- **Workflow templates** seeded per tenant (4 each = 12 total): learner
  enrolment, certificate issuance, compliance report, at-risk escalation.
  15 sample runs seeded across completed / awaiting_approval / rejected /
  rolled_back so dashboards load non-empty.
- **Frontend `/workflows`** — 4-tab console: Workflow Builder (template
  cards with step previews + Start dialog), Run Monitor (run list +
  step-by-step trace with reasoning timeline), Approval Queue (badge
  count, inline Approve/Reject), Audit Trail (consolidated reasoning
  trail across all runs). Summary strip shows 6 KPI counters.
- **Rollback Console**: finished runs expose a Rollback button that flips
  undoable steps to `rolled_back` and irreversible steps to
  `completed_irreversible`, writing `workflow.rollback` to audit.
- **Compliance & Audit explorer** at `/compliance`: filterable audit log
  table with action / actor / free-text filters, audit-volume bar chart,
  top-actor list, CSV export, full-event JSON inspector.
- 20/20 Phase 6 backend tests pass; all 17 requested e2e flows green;
  full regression on Phases 1–5 remains green.

### Phase 7 (P1 follow-ups) — May 2026
- **Academic Structure full CRUD**: backend now exposes POST / GET /
  PATCH / DELETE on every entity (`campuses`, `departments`, `programmes`,
  `courses`, `cohorts`) at `/api/academic/{institution_id}/...`. Each
  mutation writes `audit_logs` (`academic.<entity>.<verb>`). Tenant
  isolation enforced — cross-tenant returns 403.
- **Institution Setup persistence**: `PATCH /api/institutions/{id}` now
  audit-logs every field change, and the Institution Setup Wizard
  persists the AI sub-document (`ai_config.provider / tone / embedding_model /
  max_tokens / citations_required / hitl_irreversible`) and Governance
  sub-document (`governance.audit_level / bias_audit / consent_required`).
  Values are re-hydrated from the institution on reload.
- **Academic Structure Builder UI**: hierarchy tree (Campus → Department
  → Programme → Course → Cohort) with hover-revealed Row Actions menu
  (Edit / Delete) on every node and a `+ New` dropdown to add any of the
  five entity types via a single `EntityDialog`. Stats sidebar live-updates.
- **Content Studio object storage**: PDF / DOCX / PPTX / TXT / MD uploads
  with MIME validation, 25 MB size cap, streamed disk persistence under
  `/app/uploads`, and type-aware text extraction (`pypdf`, `python-docx`,
  `python-pptx`). Unsupported types return 415. New `GET
  /api/ai/content/sources/{source_id}/download` streams the original
  binary with `Content-Type` set. Source cards now show a Download
  button and the original file size.
- 15/15 Phase 7 backend tests pass (`/app/backend/tests/test_phase7.py`);
  100% on frontend flows tested.

### Phase 8 — May 2026 (Workflow Template Editor + Production Hardening)
- **Workflow Template Editor (P2)**: Institution Admins can now author,
  edit and delete workflow templates directly inside the `/workflows`
  Workflow Builder tab. Drag-and-drop step reordering using
  `@dnd-kit/sortable` (mouse + accessible keyboard via Space + ArrowDown).
  Per-step controls for kind (auto / llm / hitl), tool, HITL role and
  undoable flag. Backend `POST/PATCH/DELETE /api/workflows/...templates`
  with audit logging, version-bump on every edit, RBAC (admin-only),
  cross-tenant 403.
- **Emergent Google SSO**: existing email/password login remains the
  primary; added “Continue with Google” on `/login` and a top-level
  `AuthCallback` that consumes the `#session_id=` fragment, exchanges it
  via `POST /api/auth/session`, mints our existing JWT and sets the
  session cookie. New emails not yet provisioned for any tenant are
  rejected (multi-tenant safety).
- **Per-tenant email integration (Resend)**: new Settings →
  Integrations tab where Institution Admins paste their own Resend API
  key + From address. `GET /api/integrations/{id}` masks stored keys,
  `PATCH` preserves the stored key if the input is left blank, `POST
  /email/test` sends a smoke email. Workflow runs that pause for HITL
  approval now email the tenant’s admins via the configured provider
  (graceful no-op when not enabled).
- **Mobile responsiveness**: shell now collapses to a single column at
  ≤900px with a slide-in sidebar drawer + dimming overlay. Topbar
  trims to fit on 414px viewports (notifications bell hidden below sm,
  AI compliance badge hidden below lg, tenant selector capped at
  200px, user pill remains tappable). Verified by automated viewport
  tests: `scrollWidth === clientWidth` at 414×800.
- **Deployment readiness**: `/app/DEPLOYMENT.md` checklist covering
  env vars, integrations, multi-tenant data, mobile QA, observability,
  security and roll-back plan.
- 19/19 Phase 8 backend tests pass (`/app/backend/tests/test_phase8.py`);
  frontend re-test 100% (2/2 regression checks green in
  `/app/test_reports/iteration_8.json`).

### Phase 9 — May 2026 (AI Instructor editorial redesign)
- **AI Virtual Instructor (Module 4.1) — AI-authentic-first**: rebuilt as
  an editorial dark surface with dual-language hero (المعلم الذكي · *Virtual
  AI Instructor*), gold geometric eyebrow (◈ Module 4.1), 4-stat live metric
  strip (median latency / cited answers / bilingual / approved sources),
  trust pill row (Tenant-isolated · Source-grounded · Audit-logged · HITL).
- **AI Core canvas** as protagonist: live status dot + model badge, gold
  user bubbles, AI bubbles with model/latency/persona footer + collapsible
  citations grid, sticky right rail with “Live citations” (score-bar per
  source) + “Reasoning trail” + “Knowledge base” panels.
- **Authentic AI controls**: Persona picker (Lecturer / Tutor / Coach /
  Examiner) maps to a system-prompt directive; Depth segmented toggle
  (Concise / Standard / Deep dive) caps response length; Show reasoning
  toggle injects a `<reasoning>` block that surfaces in the side rail.
- **Backend additions**: `POST /api/ai/instructor/message` now accepts
  `persona`, `depth`, `show_reasoning` and returns `latency_ms`, `reasoning`;
  retrieval has a tenant-wide fallback when a course-scoped lookup returns
  no hits. New `GET /api/ai/instructor/suggestions/{tenant}` returns 4
  starter prompts anchored to the top approved source title (better
  RAG-hit-rate) with EN + AR variants.
- **a11y / testability**: LanguageSwitcher exposes data-testids
  `language-switcher` / `lang-en` / `lang-ar` for deterministic RTL flow
  tests.
- 6/6 + 3/3 Phase 9 backend tests pass; frontend e2e 100% in
  `/app/test_reports/iteration_10.json`.
  Emergent Universal Key. Per-institution provider/model override resolved
  from `ai_use_cases` collection.
- Seeded **8 AI use cases per tenant** (4.1–4.8) with bilingual EN/AR names,
  status flags (active / coming_soon), risk score, HITL + citations toggles.
- **Module 4.4 Content Studio**: text/file upload → SME approval → chunk + index
  for RAG → AI-generated `lesson_plan | flashcards | mcqs | case_guide` with
  structured JSON output and approval queue.
- **Module 4.1 AI Instructor**: course-grounded chat with term-frequency
  retrieval over `content_chunks`, citation cards with relevance scores,
  bilingual EN/AR, multi-turn session persistence in `ai_sessions`.
- **Module 4.2 AI Advisor**: deterministic skill-gap computation against
  institution skill framework + LLM-generated learning path, career pathway
  and proactive alerts (structured JSON).
- **Module 4.3 Student Assistant**: FAQ-grounded Claude chat with service
  category sidebar and ticket escalation.
- Full audit trail in `audit_logs` collection: every AI generation, approval,
  use-case mutation captured with actor + model + target.

## Backlog
**P0 — Phase 3 (AI modules core)**
- Pluggable AI provider abstraction (OpenAI / Claude / Jais / on-prem)
- Object storage integration for content uploads
- Content Studio: upload → Bloom's mapping → SME approval queue
- AI Instructor chat (RAG, citations, EN/AR, escalation)
- AI Advisor: skill gap + learning path
- Student Assistant

**P1 — Phase 4–6**
- Assessment engine (item bank, adaptive testing)
- Psychometric signal capture + fairness audit
- Role-based executive analytics + NL console
- Agentic workflows + HITL approval queue
- Compliance & Audit log explorer

**P2 — Phase 7**
- Email + SSO integration
- Onboarding tour
- Mobile responsiveness QA
- Production deploy pipeline

## Test credentials
See `/app/memory/test_credentials.md`.
