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
| 3 | AI modules M1–M4 (Content Generator, Instructor, Advisor, Student Assistant) | ⏳ |
| 4 | AI modules M5–M6 (Assessments, Psychometrics) | ⏳ |
| 5 | M7 Executive Analytics + NL console | ⏳ |
| 6 | M8 Agentic Workflows + AI Governance & Compliance | ⏳ |
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
  Settings, ComingSoon placeholders for the 10 future modules
- Theming: per-tenant CSS variables applied on `<html>` class

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
