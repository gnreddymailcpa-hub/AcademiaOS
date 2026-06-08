# Claros Onboarding Playbook — Tenant to Live

> Companion to the in-app **Admin Guide** (`/admin-guide`) and **Product Brief**
> (`/product-brief`). This playbook is the canonical end-to-end procedure for
> bringing a new Institution onto the Claros platform.

**Audience**: Institution Admin (typically the Registrar or Provost designate)
who has just received Claros-issued credentials.

**Time to live**: ≈ 4 hours of admin work + 1 pilot week for a tenant of
≤ 5 000 learners. Faster for smaller tenants.

**Reversibility**: Every step below is reversible and audit-logged. Worst-case
rollback is one click in `/governance` or `/admin/tenant-config`.

---

## 0 · Pre-flight (Claros-side, before you arrive)

Claros operations team has already:

- ✅ Provisioned your tenant in the multi-tenant database (`institutions` row)
- ✅ Seeded the 12 canonical Claros module catalog (Insights · AI · Enroll ·
  Core · Learn · Launch · Research · People · Alumni · Safe · Green · Comply)
- ✅ Generated your Institution Admin account and a one-time magic-link
  invite (emailed to the operations contact you nominated in the contract)
- ✅ Configured your data-residency policy per the contract

If any of the above is missing, raise a ticket via your dedicated Slack channel
**before** starting Step 1.

---

## 1 · Sign in & validate

| | |
|--|--|
| **Route** | `/login` |
| **ETA** | 3 min |
| **Role required** | Institution Admin |

1. Open the magic-link from your inbox. You'll land on the role-tailored
   Institution Admin dashboard.
2. Confirm your name + avatar in the top-right user menu. If anything is
   wrong, raise a support ticket from `/ai` (Claros AI > Chat) — admins use
   the same Student Assistant chat as learners.

---

## 2 · Institution profile

| | |
|--|--|
| **Route** | `/institution-setup` |
| **ETA** | 5 min |

| Field | Notes |
|---|---|
| Name, short name | Public-facing on every learner screen. |
| Type | University / Business School / Government Academy / Corporate. |
| Country, timezone | Drives all date / time displays. |
| Primary language | Enable Arabic only if it's an operating language. |
| Data residency | Must match the contract. Cannot be changed post-launch without re-onboarding. |
| Theme colors | Hex codes for primary + accent. Applied globally. |
| Logo URL | Recommend SVG ≤ 50 kB. Shows in the sidebar and every printable export. |
| Compliance framework | AACSB · EQUIS · GDPR · UAE Federal · NAAC · NBA — pick one or more. |

Hit **Save**. An `institution.update` event is automatically appended to
`audit_logs`.

---

## 3 · Academic structure

| | |
|--|--|
| **Route** | `/academic-structure` |
| **ETA** | 15 min |

Add hierarchically: **Campuses → Departments → Programmes → Courses → Cohorts**.

- Each level supports inline create / edit / delete with audit-logged
  changes.
- Programmes + Courses become the knowledge-scope filters that the AI
  Instructor and AI Advisor read from.
- **Tip**: seed at least one Cohort per Programme before inviting learners
  — it unblocks assessment + analytics flows.

---

## 4 · Invite users & assign roles

| | |
|--|--|
| **Route** | `/users-roles` |
| **ETA** | 10 min |

- Invite by email — recipients get a magic-link / SSO sign-in.
- 15 platform roles available: Faculty, Programme Manager, Registrar,
  Dean, HoD, Compliance Officer, AI Governance Admin, Career Services,
  Hostel Warden, Training Manager, Student, etc. Each unlocks a tailored
  landing dashboard.
- **Bulk-invite**: paste a CSV of `email,role,name`. Validation runs
  before any record is committed.
- All invites + role changes are audit-logged. Rollback is one click.

---

## 5 · ⭐ Onboarding Wizard — activate Claros modules

| | |
|--|--|
| **Route** | `/onboarding` |
| **ETA** | 5 min |

This is the **module activation entry point**. Three-step UI:

### Step 1 — Catalog review
Reviews your 12-module catalog grouped by phase:
- **Phase 1 (Foundational, Day-1)**: Claros AI · Claros Enroll · Claros
  Core · Claros Comply · Claros Launch · Claros Insights
- **Phase 2 (Engagement)**: Claros Learn · Claros Research · Claros People ·
  Claros Alumni · Claros Safe
- **Phase 3 (Strategic)**: Claros Green

> Module names rebrand automatically per tenant. VCE sees VEDA / ARISE /
> NEXUS / ILLUMINATE / etc. instead of the canonical Claros names. ISB and
> all default tenants see the canonical names.

### Step 2 — Pick what goes live on day 1
- Toggle each module ON / OFF.
- Use per-phase **All / None** shortcuts for speed.
- Dependencies (e.g. Claros Green depends on Claros Safe) are auto-validated
  by the backend — the API rejects activations that would violate a
  dependency.

### Step 3 — Launch
- Sidebar + every module gate live-update **across all open tabs** the moment
  you hit Launch.
- A summary panel lists every activated module with a one-click jump-in
  link.
- Re-run the wizard anytime to add or remove modules — toggles persist
  immediately to `platform_modules` and broadcast to every other consumer.

---

## 6 · Branding & module names (optional)

| | |
|--|--|
| **Route** | `/admin/tenant-config` |
| **ETA** | 5 min |

For each canonical Claros module:
- **Display name** (e.g. `Claros AI` → `VEDA`)
- **Short name** (e.g. `AI` → `VEDA`) — used in dense UI
- **Enable / disable** toggle
- **Icon override** (optional)

Plus platform-wide:
- **Platform display name** (e.g. `Claros Platform` → `VCE Intelligent Campus`)
- **Primary colour** + accent
- **Logo URL**
- **Footer tagline** (`Powered by Claros` — leave blank to hide)

All overrides cascade automatically through the sidebar, topbar, breadcrumbs,
the Onboarding Wizard's catalog labels, and every Insights / AI Use Cases page
header.

---

## 7 · AI use cases — provider, model, governance

| | |
|--|--|
| **Route** | `/ai-use-cases` |
| **ETA** | 5 min |

Cards are grouped by the canonical Claros module their use case belongs to:

| Claros module | Bundled AI use cases |
|---|---|
| Claros AI (VEDA) | Student Assistant — 3-pass multi-pass reasoning chain (auto-escalates to support ticket if unresolved in 3 passes) |
| Claros Learn (ILLUMINATE) | AI Instructor · Content Studio · Assessments Engine · Psychometric & Behaviour Intelligence |
| Claros Launch (PATHFINDER) | AI Educational Advisor (career + skill-gap) |
| Claros People (FACULTY) | Predictive Workforce Planning |
| Claros Comply (COMPASS) | AI Automation Agents (workflow orchestration) |

For each use case, **Configure**:
- Provider — Anthropic / OpenAI / Google
- Model — current short list:
  - Anthropic: `claude-sonnet-4.5` · `claude-haiku-4.5` · `claude-opus-4.5`
  - OpenAI: `gpt-5.2` · `gpt-5-mini` · `gpt-4o` · `gpt-4o-mini`
  - Google: `gemini-3-pro` · `gemini-3-flash` · `gemini-2.5-pro` · `gemini-nano-banana`
- Status — active / coming_soon / disabled
- Human-in-the-loop — approval required on irreversible actions
- Citations required — force RAG grounding on every response

Every save writes an `ai.use_case.update` event to the audit log and
refreshes the prompt policy on the **next** AI call (no restart needed).

---

## 8 · Load knowledge sources

| | |
|--|--|
| **Route** | `/content-studio` |
| **ETA** | 10 min |

- Upload PDF · DOCX · PPTX · TXT up to 25 MB each.
- Map each source to a Programme or Course — that becomes the knowledge
  scope visible to AI Instructor + Student Assistant via Qdrant-backed
  vector retrieval.
- Generate auto-summaries, MCQ banks, flashcards or case guides from any
  uploaded source. Faculty approval is HITL by default.
- Approved content publishes instantly. Unapproved stays in your draft
  library.

---

## 9 · Ratify governance & enable audits

| | |
|--|--|
| **Route** | `/governance` and `/comply` |
| **ETA** | 5 min |

- Review prompt policy per AI module: risk score, HITL gates, citation
  requirement, status.
- Approve `coming_soon` modules → `active` once you're satisfied with the
  policy.
- Pin a bias-audit cadence on the modules you care about (Virtual Instructor
  and Predictive Workforce are recommended).
- Open `/comply` to confirm your framework controls (data residency, consent
  capture, HITL enforcement) all show 100%.

---

## 10 · Wire approval workflows

| | |
|--|--|
| **Route** | `/workflows` |
| **ETA** | 10 min |

Three production templates ship with your tenant:
- Certificate Issuance
- At-Risk Escalation
- Compliance Report

Drag-and-drop the Template Editor to add or remove HITL gates that match
your delegation chart (e.g. add Dean approval before certificate issuance).
Run a dry-run with a synthetic learner before going live.

---

## 11 · Validate end-to-end with a pilot cohort

| | |
|--|--|
| **Route** | `/insights` and `/analytics` |
| **ETA** | 1 week |

Invite a small pilot cohort (10–20 learners). Have them:
- Register and complete onboarding.
- Take an AI Instructor session.
- Generate an AI Advisor career plan.
- Submit a support ticket (will exercise the VEDA 3-pass chain — watch the
  Resolution Rate KPI tile populate in real time).
- Complete one assessment.

As Institution Admin, watch the bell + `/insights` + `/analytics` fill with
real data: AI sessions, cited answers, learner sentiment, ticket SLAs, VEDA
resolution rate by pass.

Pull a Compliance & Audit report at week-end and confirm every
learner-impacting event was captured.

---

## 12 · Go live

| | |
|--|--|
| **ETA** | ongoing |

Roll out to your full student population. Communicate the launch and link
learners to `/ai` for support.

**Operating cadence:**
- Daily — review the bell + open tickets.
- Weekly — audit log review + VEDA resolution rate KPI.
- Monthly — bias-audit, workforce-readiness, sustainability composite.

**Escalation path**: open a ticket from `/ai` (Claros AI > Chat) or escalate
to Claros support via your dedicated Slack channel.

---

## Troubleshooting

| Symptom | Probable cause | Fix |
|---|---|---|
| Modules I activated in Onboarding don't show in sidebar | Stale tab cache (shouldn't happen post-Phase 42.3) | Reload the tab. If it persists, file a ticket. |
| Onboarding reopens with old toggle state | Same as above | Reload; if persistent it means the PATCH /api/modules/{iid}/{code} call returned non-200 — check Network tab. |
| VEDA returns no citations | Knowledge sources not yet ingested OR scope mapping wrong | Confirm `/content-studio` shows ingested sources mapped to the relevant Programme. |
| Tenant rebrand (Branding & Module Names) doesn't appear | Browser tab opened before save | Hit Refresh on the section header — the BroadcastChannel fix should auto-sync. |
| Super admin "Preview as Tenant" not updating sidebar | Pre-Phase 42.4 bug | Confirmed fixed — if it recurs, file a ticket. |

---

## Reference — canonical Claros module IDs ↔ legacy registry codes

| Canonical ID | Legacy code | Default display name | VCE rebrand |
|---|---|---|---|
| `claros-ai` | VEDA | Claros AI | VEDA |
| `claros-insights` | COMMAND | Claros Insights | COMMAND |
| `claros-enroll` | ARISE | Claros Enroll | ARISE |
| `claros-core` | NEXUS | Claros Core | NEXUS |
| `claros-learn` | ILLUMINATE | Claros Learn | ILLUMINATE |
| `claros-launch` | PATHFINDER | Claros Launch | PATHFINDER |
| `claros-research` | PRISM | Claros Research | PRISM |
| `claros-people` | FACULTY | Claros People | FACULTY+ |
| `claros-alumni` | ALUMNI360 | Claros Alumni | ALUMNI360 |
| `claros-safe` | GUARDIAN | Claros Safe | GUARDIAN |
| `claros-green` | GREENIQ | Claros Green | GREENIQ |
| `claros-comply` | COMPASS | Claros Comply | COMPASS |

The legacy codes drive the `module_status` collection that the Onboarding
Wizard reads. The canonical IDs drive `tenant_module_configs` (rebrand
labels). The two are joined by `LEGACY_TO_CLAROS` in `Onboarding.jsx`.

---

_Last updated: Feb 2026 · Phase 42.3 (Onboarding live-sync + canonical taxonomy)_
