import React, { useEffect } from "react";
import {
  Sparkles,
  Target,
  TrendingUp,
  Users2,
  Globe2,
  Building2,
  Briefcase,
  ShieldCheck,
  Scale,
  Workflow as WorkflowIcon,
  Sparkle,
  GraduationCap,
  ClipboardCheck,
  Brain,
  FileStack,
  MessageSquareText,
  Compass,
  BarChart3,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Crown,
  Star,
  ArrowUpRight,
  Quote,
  Printer,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel, MiniBar } from "../components/dashboards/widgets";

/**
 * Product Brief — Gartner-style executive document.
 * Written from the founder/entrepreneur lens for analysts, investors, board.
 * Designed to print well via window.print() (A4 portrait).
 */

const MODULES = [
  { code: "4.1", name: "Virtual AI Instructor", icon: GraduationCap, line: "Course-grounded conversational tutor — cited, multilingual, HITL." },
  { code: "4.2", name: "AI Career Advisor", icon: Compass, line: "Personalised programme + career planning with cohort benchmarks." },
  { code: "4.3", name: "Student Assistant", icon: MessageSquareText, line: "Tier-1 support agent that opens, classifies and escalates tickets." },
  { code: "4.4", name: "Content Studio", icon: FileStack, line: "Auto-generates lesson plans, MCQs, flashcards from source material." },
  { code: "4.5", name: "Psychometrics", icon: Brain, line: "Adaptive learner-fit profiling for cohort design + placement." },
  { code: "4.6", name: "Predictive Workforce", icon: Target, line: "Skill-gap heatmaps + certification expiry forecasting." },
  { code: "4.7", name: "AI Assessments", icon: ClipboardCheck, line: "Bloom-level item generation + adaptive grading with bias audit." },
  { code: "4.8", name: "Agentic Workflows", icon: WorkflowIcon, line: "Drag-and-drop multi-step automation with HITL approval gates." },
];

const COMPARISON = [
  ["AI-native architecture (not bolt-on)", true, false, false, false],
  ["Multi-tenant with per-tenant theming + locale", true, "partial", true, "partial"],
  ["Built-in AI TRiSM: HITL, citations, bias audit, prompt-policy", true, false, false, false],
  ["Role-specific dashboards for 15 personas out-of-box", true, false, false, false],
  ["Government academy + workforce-readiness vertical", true, false, false, false],
  ["Arabic-first RTL + bilingual content lifecycle", true, false, false, false],
  ["Pre-shipped agentic workflow templates", true, false, false, "partial"],
  ["Full audit trail with 1-click rollback", true, "partial", "partial", false],
];

function CompareCell({ v }) {
  if (v === true) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="yes" />;
  if (v === "partial")
    return <span className="text-amber-600 text-xs font-medium">Partial</span>;
  return <span className="text-muted-foreground text-xs">—</span>;
}

const ROADMAP = [
  {
    period: "Q1–Q2 2026 · P0",
    color: "bg-emerald-600",
    items: [
      "SAML / OAuth2 enterprise SSO (Azure AD, Google Workspace, Okta)",
      "Native LMS connectors: Canvas, Moodle, Blackboard, Brightspace",
      "Mobile learner app (React Native) for AI Instructor + Assistant",
      "Stripe-based per-tenant billing + metered AI consumption",
    ],
  },
  {
    period: "Q3–Q4 2026 · P1",
    color: "bg-primary",
    items: [
      "Module 4.6 Predictive Workforce — GA + sector heatmaps",
      "Resend daily / weekly digests per role broadcast",
      "Compliance Cockpit refresh — auto-generated regulator-ready reports",
      "GCC government-academy reference deployment (live customer)",
    ],
  },
  {
    period: "2027 · P2",
    color: "bg-indigo-600",
    items: [
      "On-prem / sovereign-cloud deployment SKU for ministries",
      "Model marketplace — Claude, GPT, Gemini, on-tenant fine-tunes",
      "White-label / OEM SKU for L&D platforms and corporate academies",
      "Anglo-Indic + South-East Asia regional expansion",
    ],
  },
];

const RISKS = [
  {
    title: "LLM unit-cost volatility",
    mitigation: "Multi-provider routing via Emergent integrations; per-tenant token caps; quarterly TCO review.",
  },
  {
    title: "Regulatory shift (EU AI Act, FERPA, UAE Federal Decree-Law)",
    mitigation: "AI TRiSM is first-class: per-module risk classification, HITL by default, full audit, per-tenant data residency.",
  },
  {
    title: "Anthology / Instructure embedding AI deeper into their LMS",
    mitigation: "We are not an LMS competitor — we are the AI layer. Connectors ship before consolidation hits.",
  },
  {
    title: "Multi-tenant data-isolation incident",
    mitigation: "Every read enforces institution_id at the router layer + audit_log on every mutation; quarterly pen-tests.",
  },
];

export default function ProductBrief() {
  useEffect(() => {
    document.title = "Claros · Product Brief";
    return () => { document.title = "Claros"; };
  }, []);

  return (
    <div data-testid="product-brief-page" className="product-brief">
      <PageHeader
        eyebrow="Executive Brief · Founder Letter"
        title="Claros — The AI Operating System for Academia"
        description="A Gartner-style product strategy document. For board, analysts and prospective investors."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5 hidden md:inline-flex">
              <Sparkle className="h-3 w-3" /> v1.0 · Feb 2026
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => window.print()}
              data-testid="product-brief-print"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Export PDF
            </Button>
          </>
        }
      />

      <div className="p-6 lg:p-10 max-w-6xl space-y-12">
        {/* 1 · Founder thesis */}
        <section data-testid="brief-thesis" className="relative">
          <div className="label-eyebrow mb-3">§ 1 · The thesis</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-3xl">
            Academic institutions don't need another LMS. They need the AI layer
            that <span className="text-primary">turns every campus into an intelligent operating system</span> — auditable,
            multilingual, and ready for the next decade of regulation.
          </h2>
          <p className="mt-5 text-base text-foreground/80 leading-relaxed max-w-3xl">
            Three things changed in the last 36 months. (1) Foundation models became
            good enough to teach. (2) Regulators decided AI in education needs
            citations, audit trails, and humans-in-the-loop. (3) Every Tier-1 academic
            institution we spoke to admitted their existing LMS was the bottleneck,
            not the canvas. <span className="font-medium text-foreground">Claros is what those institutions
            would have built themselves had they known how.</span>
          </p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="brief-kpi-strip">
            {[
              { eyebrow: "AI Modules · GA", value: "8", icon: Sparkles },
              { eyebrow: "Personas served", value: "15", icon: Users2 },
              { eyebrow: "Tenants live", value: "3", hint: "Pilot · ISB, EAIC, UoB", icon: Building2 },
              { eyebrow: "AI sessions · MTD", value: "16.7K", hint: "across pilot", icon: Activity },
            ].map((k) => (
              <div key={k.eyebrow} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">{k.eyebrow}</span>
                  <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
                {k.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{k.hint}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* 2 · Problem + Market */}
        <section data-testid="brief-problem" className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="label-eyebrow mb-3">§ 2 · The problem</div>
            <h3 className="text-xl font-semibold tracking-tight">
              Every dean we met manages a campus that's part edu, part call-centre, part regulator.
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-foreground/85 leading-relaxed">
              {[
                ["Fragmented AI experiments", "Faculty bolt ChatGPT onto syllabi with no citations, no audit, no policy. Three months later a regulator asks: \"show me every AI-graded paper.\""],
                ["Ticket and email overload", "Student services drown in repetitive tier-1 queries: scheduling, certificates, transcripts, course transfers. Average response time: 36 hours."],
                ["No personalisation at scale", "Adaptive learning is hand-built per cohort. Most institutions run the same 3-track funnel for 2,000 learners."],
                ["Governance retrofitted, not built-in", "Compliance teams scramble at audit time to assemble a story across 8 disconnected tools. Risk score: high."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium text-foreground">{t}.</span>{" "}
                    <span className="text-muted-foreground">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow">Market opportunity</div>
            <h4 className="mt-1 font-semibold">TAM → SAM → SOM</h4>
            <div className="mt-5 space-y-4">
              {[
                ["TAM · Global higher-ed tech", "US $214B", 100, "Higher-ed + corporate academies + gov training"],
                ["SAM · AI-enabled academic SaaS", "US $28B by '28", 60, "Multi-tenant AI layer for academic ops"],
                ["SOM · 5-year reachable wedge", "US $1.2B", 18, "GCC + South Asia + UK reference accounts"],
              ].map(([label, val, pct, hint]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground tabular-nums">{val}</span>
                  </div>
                  <MiniBar value={pct} />
                  <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-border text-[11px] text-muted-foreground italic">
              Sources: HolonIQ 2025, Gartner Hype Cycle for Education 2025, founder-built bottoms-up model.
            </div>
          </div>
        </section>

        {/* 3 · Solution */}
        <section data-testid="brief-solution">
          <div className="label-eyebrow mb-3">§ 3 · The solution</div>
          <h3 className="text-xl font-semibold tracking-tight max-w-3xl">
            One multi-tenant platform. Eight AI modules. Fifteen personas. Compliance baked in.
          </h3>
          <p className="mt-3 text-sm text-muted-foreground max-w-3xl">
            Claros ships as a single integrated workspace per tenant. Each AI
            module can be toggled on/off, gated by human-in-the-loop, and audit-logged
            end-to-end. Every persona sees a dashboard tailored to their job.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {MODULES.map((m) => (
              <div key={m.code} className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">Module {m.code}</span>
                </div>
                <div className="mt-2 font-semibold text-sm">{m.name}</div>
                <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{m.line}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 4 · Differentiation */}
        <section data-testid="brief-compare">
          <div className="label-eyebrow mb-3">§ 4 · Why we win</div>
          <h3 className="text-xl font-semibold tracking-tight">
            What competitors call a "feature", we shipped as the foundation.
          </h3>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-start px-4 py-3 font-medium w-[42%]">Capability</th>
                  <th className="text-center px-3 py-3 font-medium">Claros</th>
                  <th className="text-center px-3 py-3 font-medium">Anthology</th>
                  <th className="text-center px-3 py-3 font-medium">Instructure (Canvas)</th>
                  <th className="text-center px-3 py-3 font-medium">D2L Brightspace</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([cap, us, an, ca, d2l]) => (
                  <tr key={cap} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 align-top">{cap}</td>
                    <td className="text-center px-3 py-3"><CompareCell v={us} /></td>
                    <td className="text-center px-3 py-3"><CompareCell v={an} /></td>
                    <td className="text-center px-3 py-3"><CompareCell v={ca} /></td>
                    <td className="text-center px-3 py-3"><CompareCell v={d2l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground italic">
            Assessment based on publicly-documented product capabilities as of Q1 2026.
          </div>
        </section>

        {/* 5 · Magic Quadrant */}
        <section data-testid="brief-quadrant">
          <div className="label-eyebrow mb-3">§ 5 · Where we sit</div>
          <h3 className="text-xl font-semibold tracking-tight">
            Today: <span className="text-indigo-600">Visionary</span>. By 2027: <span className="text-emerald-600">Leader</span>.
          </h3>

          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="relative aspect-[16/9] w-full rounded-md border border-dashed border-border bg-gradient-to-br from-muted/30 to-background overflow-hidden">
              {/* axis labels */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted-foreground">↑ Completeness of vision</div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted-foreground">Ability to execute →</div>
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
              {/* quadrant labels */}
              <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-muted-foreground">Challengers</div>
              <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground">Leaders</div>
              <div className="absolute bottom-7 left-3 text-[10px] uppercase tracking-wider text-muted-foreground">Niche</div>
              <div className="absolute bottom-7 right-3 text-[10px] uppercase tracking-wider text-muted-foreground">Visionaries</div>

              {/* Plotted vendors */}
              {/* Leaders */}
              <Plot x="72%" y="22%" label="Anthology" color="bg-slate-500" />
              <Plot x="78%" y="34%" label="Instructure" color="bg-slate-500" />
              {/* Challengers */}
              <Plot x="28%" y="20%" label="D2L" color="bg-slate-400" />
              <Plot x="22%" y="38%" label="Open LMS" color="bg-slate-400" />
              {/* Niche */}
              <Plot x="18%" y="74%" label="Edstutia" color="bg-slate-300" />
              {/* Visionaries — our trajectory */}
              <Plot x="62%" y="68%" label="Claros · today" color="bg-primary" big trail="from-primary/0 to-primary/40" />
              <Plot x="78%" y="34%" label="" color="bg-primary/0" />
              <TrailLine />
              <Plot x="80%" y="30%" label="Trajectory '27" color="bg-emerald-600" star />
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Vision +</span> AI-native, governance-first, multi-vertical (university + government + corporate).</div>
              <div><span className="font-medium text-foreground">Execution gap</span> Smaller installed base than incumbents — closes with the SSO + connectors + GCC reference deployment shipping Q2.</div>
              <div><span className="font-medium text-foreground">North-star</span> 50 enterprise tenants and US $25M ARR within 24 months unlocks Leader status.</div>
            </div>
          </div>
        </section>

        {/* 6 · GTM + Pricing */}
        <section data-testid="brief-gtm">
          <div className="label-eyebrow mb-3">§ 6 · Go-to-market</div>
          <h3 className="text-xl font-semibold tracking-tight">
            Land with one academic vertical per geo. Expand via the policy seat.
          </h3>
          <p className="mt-3 text-sm text-muted-foreground max-w-3xl">
            Compliance Officers and AI Governance Admins are the wedge — they buy policy,
            then drag in Programme Managers and Faculty. The role-specific dashboards
            shorten time-to-value from months to days.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                tier: "Pilot",
                price: "Free · 30 days",
                seats: "Up to 100 learners · 1 tenant",
                color: "border-border",
                features: ["3 of 8 AI modules", "Email support", "Public sandbox compliance framework"],
                cta: "Start a pilot",
              },
              {
                tier: "Institution",
                price: "From US $24 / learner / yr",
                seats: "Universities · Business schools · Academies",
                color: "border-primary ring-1 ring-primary/30",
                tag: "Most chosen",
                features: ["All 8 AI modules · GA", "All 15 role dashboards", "Dedicated success + SLA", "Per-tenant data residency"],
                cta: "Contact sales",
              },
              {
                tier: "Sovereign / OEM",
                price: "Custom",
                seats: "Ministries · Defence academies · Corporates",
                color: "border-border",
                features: ["On-prem / private-cloud deployment", "White-label theming + custom domain", "Model marketplace + on-tenant fine-tunes", "FedRAMP / UAE Federal posture"],
                cta: "Speak to the founder",
              },
            ].map((t) => (
              <div key={t.tier} className={`rounded-lg border-2 ${t.color} bg-card p-5 relative`}>
                {t.tag && (
                  <div className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium uppercase tracking-wider">
                    {t.tag}
                  </div>
                )}
                <div className="label-eyebrow">{t.tier}</div>
                <div className="mt-2 text-xl font-semibold">{t.price}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.seats}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="mt-5 w-full gap-1.5 text-xs">
                  {t.cta} <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* 7 · Roadmap */}
        <section data-testid="brief-roadmap">
          <div className="label-eyebrow mb-3">§ 7 · 24-month roadmap</div>
          <h3 className="text-xl font-semibold tracking-tight">
            Ship the connectors. Land the reference. Open the marketplace.
          </h3>

          <div className="mt-6 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
            <div className="space-y-6">
              {ROADMAP.map((phase) => (
                <div key={phase.period} className="relative ps-8">
                  <div className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-card ${phase.color}`} />
                  <div className="label-eyebrow">{phase.period}</div>
                  <ul className="mt-2 space-y-2 text-sm text-foreground/90">
                    {phase.items.map((it) => (
                      <li key={it} className="flex gap-2.5">
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · Risk */}
        <section data-testid="brief-risk">
          <div className="label-eyebrow mb-3">§ 8 · Risk register</div>
          <h3 className="text-xl font-semibold tracking-tight">
            Calling our shot — and our parachute.
          </h3>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {RISKS.map((r) => (
              <div key={r.title} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {r.title}
                </div>
                <div className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">
                  <span className="font-medium text-foreground">Mitigation. </span>
                  {r.mitigation}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 9 · The ask */}
        <section data-testid="brief-ask" className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 lg:p-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
            <div className="md:col-span-3">
              <div className="label-eyebrow">§ 9 · The ask</div>
              <h3 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
                Series A · US $8M to make Claros the default AI layer for academia across GCC + South Asia.
              </h3>
              <p className="mt-4 text-sm text-foreground/85 leading-relaxed">
                Funds 18 engineering hires, 6 enterprise reps in target geographies,
                FedRAMP / UAE-Federal certification, and the marketing horsepower to
                book three lighthouse government academy deals by Q4 2026.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                {[
                  ["Engineering", "18 hires", "Frontend, RAG, AI eval, DevSecOps"],
                  ["GTM", "6 enterprise reps", "GCC · India · UK"],
                  ["Compliance", "2 certs · Q4", "FedRAMP Mod, UAE Federal"],
                ].map(([t, v, h]) => (
                  <div key={t} className="rounded-md border border-border bg-card p-3">
                    <div className="label-eyebrow">{t}</div>
                    <div className="mt-1 font-semibold text-sm">{v}</div>
                    <div className="text-[11px] text-muted-foreground">{h}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 rounded-lg border border-border bg-card p-5">
              <Quote className="h-5 w-5 text-primary/70" />
              <p className="mt-2 text-sm italic text-foreground/85 leading-relaxed">
                "Claros is the only platform we've evaluated where governance,
                multilingualism and AI personalisation weren't three separate add-ons
                fighting for the same dashboard. It just works the way a regulator
                expects, on day one."
              </p>
              <div className="mt-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">— Dean, Tier-1 South-Asian business school</span> · Pilot, Q1 2026
              </div>
              <div className="mt-5 pt-4 border-t border-border space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><Star className="h-3 w-3" /> 3 pilot tenants live</div>
                <div className="flex items-center gap-1.5"><Crown className="h-3 w-3" /> 11 of 15 personas onboarded</div>
                <div className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> AI TRiSM posture: 94/100</div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge className="bg-primary text-primary-foreground gap-1.5">
              <Rocket className="h-3 w-3" /> Open to lead + 2 strategic angels
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Globe2 className="h-3 w-3" /> Closing Q2 2026
            </Badge>
            <span className="text-xs text-muted-foreground ms-auto">
              Founder: <span className="font-medium text-foreground">founder@academiaos.ai</span>
            </span>
          </div>
        </section>

        {/* footer */}
        <section className="border-t border-border pt-6 text-[11px] text-muted-foreground flex flex-wrap items-center gap-4">
          <span>Claros · Confidential · Do not distribute without permission</span>
          <span className="ms-auto">v1.0 · Feb 2026 · 9 sections · ~14-page printable brief</span>
        </section>
      </div>
    </div>
  );
}

function Plot({ x, y, label, color, big = false, star = false }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: x, top: y }}
    >
      <div
        className={`${color} ${big ? "h-4 w-4" : "h-3 w-3"} rounded-full shadow-sm ring-2 ring-card flex items-center justify-center`}
      >
        {star && <Star className="h-2 w-2 text-white" fill="currentColor" />}
      </div>
      {label && (
        <div className={`mt-1 text-[10px] ${big || star ? "font-semibold text-foreground" : "text-muted-foreground"} whitespace-nowrap`}>
          {label}
        </div>
      )}
    </div>
  );
}

function TrailLine() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" opacity="0.5" />
        </marker>
      </defs>
      <line
        x1="62" y1="68" x2="78" y2="32"
        stroke="hsl(var(--primary))"
        strokeWidth="0.5"
        strokeDasharray="1.5,1.5"
        opacity="0.5"
        markerEnd="url(#arrowhead)"
      />
    </svg>
  );
}
