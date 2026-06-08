import React from "react";
import {
  Building2,
  Network,
  Users as UsersIcon,
  Sparkles,
  FileStack,
  GraduationCap,
  ClipboardCheck,
  ShieldCheck,
  Workflow as WorkflowIcon,
  Scale,
  Mail,
  KeyRound,
  Rocket,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";

/**
 * Admin Guide — Standard Operating Procedure (SOP) for new Institution Admins.
 *
 * Audience: a freshly-onboarded Institution Admin who has just received their
 * approved credentials from Claros and needs to set up their tenant
 * end-to-end without help.
 */

const STEPS = [
  {
    n: 1,
    key: "step-account",
    title: "Sign in & validate your admin account",
    icon: KeyRound,
    eta: "3 min",
    bullets: [
      "Use the credentials emailed to you by Claros onboarding.",
      "On first sign-in you'll land on the role-tailored Institution Admin dashboard.",
      "Confirm your name & avatar in the top-right user menu. If anything is off, raise a support ticket via Student Assistant (yes, admins use it too).",
    ],
    cta: { to: "/", label: "Open Dashboard" },
  },
  {
    n: 2,
    key: "step-institution",
    title: "Configure your institution profile",
    icon: Building2,
    eta: "5 min",
    bullets: [
      "Go to Institution Setup. Fill name, short name, type (University / Business School / Government Academy / Corporate).",
      "Set country, timezone, primary language and data-residency policy. Choose your compliance framework (AACSB, EQUIS, GDPR, UAE Federal etc.).",
      "Step 1 → enable the Arabic UI only if Arabic is an operating language for your institution.",
      "Step 4 → upload your theme colors and logo so every learner-facing page is branded.",
      "Hit Save. An institution.update event is automatically written to the audit log.",
    ],
    cta: { to: "/institution-setup", label: "Open Institution Setup" },
  },
  {
    n: 3,
    key: "step-academic",
    title: "Build your academic structure",
    icon: Network,
    eta: "15 min",
    bullets: [
      "In Academic Structure add Campuses → Departments → Programmes → Courses → Cohorts in that order.",
      "Each level supports inline create / edit / delete with audit-logged changes.",
      "Programmes and Courses become the knowledge-scope filters that the AI Instructor and AI Advisor read from.",
      "Tip: seed at least one Cohort per Programme before inviting students — it unblocks the assessments + analytics flows.",
    ],
    cta: { to: "/academic-structure", label: "Open Academic Structure" },
  },
  {
    n: 4,
    key: "step-users",
    title: "Invite users and assign roles",
    icon: UsersIcon,
    eta: "10 min",
    bullets: [
      "Open Users & Roles. Invite users by email — they receive a magic-link / SSO sign-in invite.",
      "Assign one of the 15 platform roles (Faculty, Programme Manager, Registrar, Compliance Officer, AI Governance Admin, etc.). Each role unlocks a tailored landing dashboard.",
      "Bulk-invite is supported: paste a CSV of email,role,name. Validation runs before any record is committed.",
      "All invites and role changes are audit-logged; rollback is one click.",
    ],
    cta: { to: "/users-roles", label: "Open Users & Roles" },
  },
  {
    n: 5,
    key: "step-ai-modules",
    title: "Activate Claros modules via the Onboarding Wizard",
    icon: Sparkles,
    eta: "5 min",
    bullets: [
      "Open the Onboarding Wizard. Step 1 reviews your tenant profile; Step 2 lets you pick which of the 12 canonical Claros modules to enable on day 1 (Insights · AI · Enroll · Core · Learn · Launch · Research · People · Alumni · Safe · Green · Comply); Step 3 lists every activated module with a one-click jump-in link.",
      "Toggles persist immediately to the database — the sidebar and module gates live-update across every open tab the moment you hit Launch.",
      "You can change activations anytime: re-run the wizard, or for fine-grained control use Branding & Module Names (per-module display name, short name, enable/disable, and tenant branding all in one place).",
      "For each AI use case (under AI Use Cases) decide if Human-in-the-Loop is required and whether responses must carry citations. Defaults are sensible for your compliance framework.",
    ],
    cta: { to: "/onboarding", label: "Open Onboarding Wizard" },
  },
  {
    n: 6,
    key: "step-content",
    title: "Load your first knowledge sources",
    icon: FileStack,
    eta: "10 min",
    bullets: [
      "Open Content Studio. Upload your lecture notes, handbooks, case studies (PDF / DOCX / PPTX / TXT supported up to 25 MB each).",
      "Map each source to a Programme or Course so it becomes available to the AI Instructor's knowledge scope.",
      "Generate auto-summaries, MCQ banks, flashcards or case guides from any uploaded source. Faculty approval is HITL by default.",
      "Approved content is published instantly. Unapproved content is private to your draft library.",
    ],
    cta: { to: "/content-studio", label: "Open Content Studio" },
  },
  {
    n: 7,
    key: "step-governance",
    title: "Ratify the prompt policy & enable audits",
    icon: Scale,
    eta: "5 min",
    bullets: [
      "Open AI Governance. Review the prompt policy for each AI module: risk score, HITL gates, citation requirement, status.",
      "Approve coming-soon modules into Active once you're satisfied with the policy.",
      "Pin a bias-audit cadence on the modules you care about (Virtual Instructor and Predictive Workforce are recommended).",
      "Open Compliance & Audit to confirm your framework controls (data residency, consent capture, HITL enforcement) all show 100%.",
    ],
    cta: { to: "/governance", label: "Open AI Governance" },
  },
  {
    n: 8,
    key: "step-workflows",
    title: "Wire approval workflows",
    icon: WorkflowIcon,
    eta: "10 min",
    bullets: [
      "Open Agentic Workflows. Three production templates ship with your tenant: Certificate Issuance, At-Risk Escalation, Compliance Report.",
      "Drag-and-drop the Template Editor to add or remove HITL gates that match your delegation chart (e.g., add Dean approval before certificate issuance).",
      "Run a dry-run with a synthetic learner before going live.",
      "Every workflow run is fully auditable in Compliance & Audit, and any pause/HITL step automatically notifies the right role via the bell.",
    ],
    cta: { to: "/workflows", label: "Open Workflows" },
  },
  {
    n: 9,
    key: "step-validation",
    title: "Validate end-to-end with a pilot cohort",
    icon: ClipboardCheck,
    eta: "1 week",
    bullets: [
      "Invite a small pilot cohort (10–20 learners). Have them register, take an AI Instructor session, generate an AI Advisor career plan, submit a support ticket and complete one assessment.",
      "As Institution Admin, watch the bell + Analytics dashboard fill up with real data: AI sessions, cited answers, learner sentiment, ticket SLAs.",
      "Pull a Compliance & Audit report at week-end and confirm every learner-impacting event was captured.",
    ],
    cta: { to: "/analytics", label: "Open Analytics" },
  },
  {
    n: 10,
    key: "step-launch",
    title: "Go live & start your operating cadence",
    icon: Rocket,
    eta: "ongoing",
    bullets: [
      "Roll out to your full student population. Communicate the launch and link learners to the Student Assistant for support.",
      "Operating cadence: review notifications daily, the audit log weekly, the bias-audit + workforce-readiness reports monthly.",
      "Need help? Open a ticket from Student Assistant or escalate to Claros support via your dedicated Slack channel.",
    ],
    cta: { to: "/dashboard", label: "Back to dashboard" },
  },
];

export default function AdminGuide() {
  return (
    <div data-testid="admin-guide-page">
      <PageHeader
        eyebrow="Admin · Standard Operating Procedure"
        title="Institution Admin · Setup Guide"
        description="A self-serve, ten-step playbook to take your tenant from approved credentials to production. Total hands-on time: ~ 60 minutes."
        actions={<Badge className="bg-primary text-primary-foreground">Admin Manual</Badge>}
      />

      <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
        {/* Hero summary card */}
        <section className="rounded-lg border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <div className="label-eyebrow">Why this guide exists</div>
            <h2 className="mt-2 text-xl font-semibold">Spin up a fully-audited, compliance-grade academic AI tenant in one focused afternoon.</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              You've just received your Institution Admin credentials from Claros onboarding.
              Follow these ten steps in order — each one is a small, audit-logged change to your
              tenant. By the end you'll have your academic structure, users, AI module policy,
              workflows and compliance posture all configured and verified with a pilot cohort.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5"><CheckCircle2 className="h-3 w-3" /> Audit-logged</Badge>
              <Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3 w-3" /> Tenant-isolated</Badge>
              <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> AI policy on day one</Badge>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-4 self-start">
            <div className="label-eyebrow">Estimated effort</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">~60 min</div>
            <div className="text-xs text-muted-foreground">+ 1 pilot week before full roll-out</div>
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Stuck? Email <span className="font-medium text-foreground">support@academiaos.ai</span>
            </div>
          </div>
        </section>

        {/* Step accordion */}
        <section className="rounded-lg border border-border bg-card" data-testid="admin-guide-steps">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="label-eyebrow">Ten steps</div>
              <h3 className="text-base font-semibold mt-1">Tap any step to expand the SOP</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">10 / 10</Badge>
          </div>

          <Accordion type="multiple" className="px-5" defaultValue={["step-account"]}>
            {STEPS.map((s) => (
              <AccordionItem key={s.key} value={s.key} className="border-b border-border last:border-0" data-testid={`admin-guide-${s.key}`}>
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-4 text-start">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-sm tabular-nums">
                      {String(s.n).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{s.title}</div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><s.icon className="h-3 w-3" /> {s.eta}</span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-[3.25rem] pb-5">
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {s.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2.5 leading-relaxed">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {s.cta && (
                    <Link
                      to={s.cta.to}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                      data-testid={`admin-guide-${s.key}-cta`}
                    >
                      {s.cta.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Onboarding-to-Live end-to-end flow */}
        <section className="rounded-lg border border-primary/40 bg-primary/5 p-6"
                 data-testid="admin-guide-onboarding-flow">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">End-to-end Onboarding to Live</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            The fastest path from a fresh tenant to a live, learner-ready Claros environment.
            Every step is reversible and audit-logged.
          </p>
          <ol className="mt-4 space-y-2.5 text-xs text-foreground/90 list-decimal list-inside">
            <li><strong>Sign in</strong> as Institution Admin with the credentials Claros emailed you. (Step 1 above.)</li>
            <li><strong>Configure institution profile</strong> at <code className="font-mono bg-muted px-1 rounded">/institution-setup</code> — name, type, country, languages, compliance framework, theme colors, logo. (Step 2.)</li>
            <li><strong>Build academic structure</strong> at <code className="font-mono bg-muted px-1 rounded">/academic-structure</code>: Campuses → Departments → Programmes → Courses → Cohorts (in that order). (Step 3.)</li>
            <li><strong>Invite users &amp; assign roles</strong> at <code className="font-mono bg-muted px-1 rounded">/users-roles</code> — bulk-paste CSV supported. (Step 4.)</li>
            <li>
              <strong>Run the Onboarding Wizard</strong> at <code className="font-mono bg-muted px-1 rounded">/onboarding</code>:
              <ul className="mt-1 ml-4 space-y-1 list-disc list-inside text-muted-foreground">
                <li><em>Step 1</em> reviews your 12-module catalog (Phase 1 / 2 / 3 grouping).</li>
                <li><em>Step 2</em> — toggle each module ON / OFF. Dependencies are auto-checked; use the per-phase <em>All / None</em> shortcuts for speed.</li>
                <li><em>Step 3</em> — Launch. The sidebar &amp; module gates update live in every open tab the moment you save.</li>
              </ul>
            </li>
            <li><strong>Rebrand each module</strong> (optional) at <code className="font-mono bg-muted px-1 rounded">/admin/tenant-config</code> — give every Claros module a tenant-specific display name (e.g. VCE renames Claros AI → VEDA). Platform name, primary colour, footer tagline configurable too.</li>
            <li><strong>Configure AI governance</strong> at <code className="font-mono bg-muted px-1 rounded">/ai-use-cases</code> — per use case set provider, model, HITL, citations. (Step 5.)</li>
            <li><strong>Load knowledge sources</strong> at <code className="font-mono bg-muted px-1 rounded">/content-studio</code> (PDF / DOCX / PPTX up to 25 MB; map each to a Programme). (Step 6.)</li>
            <li><strong>Ratify prompt policy &amp; audit</strong> at <code className="font-mono bg-muted px-1 rounded">/governance</code>. (Step 7.)</li>
            <li><strong>Wire approval workflows</strong> at <code className="font-mono bg-muted px-1 rounded">/workflows</code>. (Step 8.)</li>
            <li><strong>Pilot &amp; validate</strong> with 10–20 learners and watch <code className="font-mono bg-muted px-1 rounded">/analytics</code> + the bell fill with real data. (Step 9.)</li>
            <li><strong>Go live</strong> — roll out to your full population. Daily / weekly / monthly cadence documented in Step 10.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <Link to="/onboarding" className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted">
              <Rocket className="h-3 w-3" /> Open Onboarding Wizard
            </Link>
            <Link to="/admin/tenant-config" className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted">
              Branding &amp; Module Names
            </Link>
            <Link to="/ai-use-cases" className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted">
              AI Use Cases
            </Link>
          </div>
        </section>

        {/* Quick reference */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="admin-guide-quickref">
          <div className="rounded-lg border border-border bg-card p-5">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div className="mt-3 font-semibold text-sm">15 platform roles</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Each lands on its own tailored dashboard with the right widgets and permissions.
              See Users & Roles → role reference.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="mt-3 font-semibold text-sm">12 Claros modules</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Insights · AI · Enroll · Core · Learn · Launch · Research · People · Alumni · Safe · Green · Comply.
              Toggle per tenant, rename to your house brand, all changes live-propagate.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div className="mt-3 font-semibold text-sm">Audit-first</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Every change made by every role is appended to audit_logs and surfaced in
              Compliance & Audit. Rollback is one click for reversible workflows.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
