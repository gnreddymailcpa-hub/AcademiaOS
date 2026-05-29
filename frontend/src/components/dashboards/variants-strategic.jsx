import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  Sparkles,
  ScrollText,
  ClipboardCheck,
  Workflow as WorkflowIcon,
  TrendingUp,
  Users2,
  GraduationCap,
  Award,
  Target,
  Briefcase,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "../layout/Shell";
import { Badge } from "../ui/badge";
import { Kpi, Panel, ItemList, MiniBar, PageLink } from "./widgets";
import { api } from "../../lib/api";

// ---------------------------------------------------------------------------
// Compliance Officer — owns audit trails + framework compliance
// ---------------------------------------------------------------------------
export function ComplianceOfficerDashboard({ inst }) {
  const [audit, setAudit] = useState([]);
  useEffect(() => {
    if (!inst) return;
    api.get(`/audit/${inst.id}`, { params: { limit: 8 } })
      .then((r) => setAudit(r.data?.items || r.data || []))
      .catch(() => setAudit([]));
  }, [inst?.id]);

  return (
    <div data-testid="dashboard-compliance">
      <PageHeader
        eyebrow="Audit & Governance"
        title={`${inst.short_name} · Compliance Officer`}
        description={`Framework: ${inst.compliance_framework || "—"} · Residency: ${inst.data_residency || "—"}`}
        actions={<Badge className="bg-primary text-primary-foreground">Compliance Officer</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Audit events · 7d" value={audit.length * 17 || 248} icon={Activity} trend="+12" testid="comp-kpi-events" />
          <Kpi label="Open alerts" value={3} icon={AlertTriangle} trendDir="down" trend="-2" testid="comp-kpi-alerts" />
          <Kpi label="Framework score" value="94%" icon={ShieldCheck} trend="+1.1%" testid="comp-kpi-framework" />
          <Kpi label="HITL gates" value={8} icon={ClipboardCheck} testid="comp-kpi-hitl" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="Inbox" title="Recent audit events" testid="comp-events" className="lg:col-span-2"
                 action={<PageLink to="/compliance" label="Open explorer" />}>
            <ItemList
              testid="comp-events-list"
              empty="No audit events recorded yet."
              items={audit.slice(0, 6).map((e) => ({
                id: e.id,
                title: e.action,
                meta: `${e.actor} · ${e.target || "—"}`,
                right: new Date(e.ts).toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
              }))}
            />
          </Panel>
          <Panel eyebrow="Alerts" title="Open investigations" testid="comp-investigations">
            <ItemList
              items={[
                { title: "Unusual content-approval velocity", meta: "AI Use-case 4.4 · 5x baseline", right: "P1" },
                { title: "Cross-tenant access attempt", meta: "blocked · 14 attempts", right: "P2" },
                { title: "Prompt-policy drift", meta: "Module 4.1 · 3 deviations", right: "P3" },
              ]}
            />
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Compliance posture" title={`${inst.compliance_framework || "Framework"} controls`} testid="comp-controls">
            {[
              ["Data residency", 100],
              ["AI consent capture", 96],
              ["Audit log integrity", 100],
              ["Bias audit cadence", 88],
              ["HITL enforcement", 100],
            ].map(([k, v]) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} color={v < 95 ? "hsl(35, 92%, 55%)" : "hsl(142, 71%, 45%)"} />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Workflows" title="Compliance-relevant" testid="comp-workflows" action={<PageLink to="/workflows" label="Open workflows" />}>
            <ItemList
              items={[
                { title: "Certificate issuance", meta: "HITL · Dean approval", right: "active" },
                { title: "Compliance report Q1", meta: "auto · 4 steps", right: "1d" },
                { title: "At-risk escalation", meta: "HITL · 2 gates", right: "active" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Governance Admin — owns prompt-policy + bias audits
// ---------------------------------------------------------------------------
export function AIGovernanceDashboard({ inst }) {
  const [cases, setCases] = useState([]);
  useEffect(() => {
    if (!inst) return;
    api.get(`/ai/use-cases/${inst.id}`).then((r) => setCases(r.data || [])).catch(() => setCases([]));
  }, [inst?.id]);

  const active = cases.filter((c) => c.status === "active").length;
  const pending = cases.filter((c) => c.status === "coming_soon").length;

  return (
    <div data-testid="dashboard-ai-governance">
      <PageHeader
        eyebrow="AI TRiSM"
        title={`${inst.short_name} · AI Governance`}
        description="Prompt-policy approvals, bias audits and human-in-the-loop coverage."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Universal Key</Badge>
            <Badge className="bg-primary text-primary-foreground">AI Governance Admin</Badge>
          </>
        }
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active use-cases" value={active} icon={Sparkles} testid="aig-kpi-active" />
          <Kpi label="Pending approval" value={pending} icon={ClipboardCheck} testid="aig-kpi-pending" />
          <Kpi label="Prompt policy" value="v3" hint="ratified · 14d ago" icon={ScrollText} testid="aig-kpi-policy" />
          <Kpi label="Bias audit score" value="92%" icon={ShieldCheck} trend="+1.4%" testid="aig-kpi-bias" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="Queue" title="Prompt-policy approvals" testid="aig-queue" className="lg:col-span-2"
                 action={<PageLink to="/governance" label="Open governance" />}>
            <ItemList
              testid="aig-queue-list"
              items={cases.slice(0, 6).map((c) => ({
                id: c.id,
                title: `${c.code} · ${c.name_en}`,
                meta: `Risk score ${c.risk_score ?? "—"} · HITL ${c.hitl_required ? "ON" : "OFF"} · Citations ${c.citations_required ? "ON" : "OFF"}`,
                right: c.status,
              }))}
              empty="No pending policy approvals."
            />
          </Panel>
          <Panel eyebrow="HITL coverage" title="Gates enforced" testid="aig-hitl">
            {[
              ["Content publish", 100],
              ["Certificate issuance", 100],
              ["At-risk escalation", 88],
              ["Workflow rollback", 100],
              ["Prompt policy change", 100],
            ].map(([k, v]) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} color="hsl(258, 90%, 66%)" />
              </div>
            ))}
          </Panel>
        </section>

        <Panel eyebrow="Recent" title="Governance signal" testid="aig-signal">
          <ItemList
            items={[
              { title: "Prompt policy v3 ratified", meta: "AI Governance Admin", right: "1d" },
              { title: "Bias audit passed", meta: "Module 4.1 · 0 deviations", right: "14d" },
              { title: "TRiSM review", meta: "Module 4.4 · scheduled", right: "in 3d" },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Training Manager — owns delivery cadence & instructor allocation
// ---------------------------------------------------------------------------
export function TrainingManagerDashboard({ inst, m }) {
  return (
    <div data-testid="dashboard-training-manager">
      <PageHeader
        eyebrow="Training Operations"
        title={`${inst.short_name} · Training Manager`}
        description="Delivery cadence, instructor allocation and certification flow."
        actions={<Badge className="bg-primary text-primary-foreground">Training Manager</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active programmes" value={m.programmes || 0} icon={GraduationCap} testid="tm-kpi-programmes" />
          <Kpi label="Active learners" value={(m.learners || m.students || 0).toLocaleString()} icon={Users2} testid="tm-kpi-learners" />
          <Kpi label="Instructors deployed" value={m.instructors || m.faculty || 0} icon={ClipboardCheck} testid="tm-kpi-instructors" />
          <Kpi label="Cert compliance" value={`${m.certification_compliance || m.completion_rate || 0}%`} icon={Award} trend="+1.4%" testid="tm-kpi-cert" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="This week" title="Sessions delivered" testid="tm-sessions" className="lg:col-span-2">
            <ItemList
              items={[
                { title: "Identity verification module · 8 sessions", meta: "Mon–Fri · classroom + LMS", right: "324 learners" },
                { title: "Border security simulation · 5 sessions", meta: "Tue + Thu · classroom", right: "180 learners" },
                { title: "AI-assisted profiling · 12 sessions", meta: "Daily · LMS only", right: "612 learners" },
              ]}
            />
          </Panel>
          <Panel eyebrow="Allocation" title="Instructor load" testid="tm-load">
            {[
              ["Capt. Noura Al Suwaidi", 92],
              ["Off. Saeed Al Nuaimi", 78],
              ["Maj. Khalid (visiting)", 64],
              ["Cohort coaches (×6)", 88],
            ].map(([k, v]) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium truncate pe-2">{k}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} color={v > 90 ? "hsl(35, 92%, 55%)" : "hsl(var(--primary))"} />
              </div>
            ))}
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HR / Workforce Planner — owns workforce readiness & skill gaps
// ---------------------------------------------------------------------------
export function HRWorkforceDashboard({ inst, m }) {
  return (
    <div data-testid="dashboard-hr-workforce">
      <PageHeader
        eyebrow="Workforce Planning"
        title={`${inst.short_name} · HR · Workforce Planner`}
        description="Skill gaps, certification expiries and workforce readiness."
        actions={<Badge className="bg-primary text-primary-foreground">HR Workforce Planner</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Workforce readiness" value={`${m.workforce_readiness || 0}%`} icon={Target} trend="+2.6%" testid="hr-kpi-readiness" />
          <Kpi label="Active learners" value={(m.learners || m.students || 0).toLocaleString()} icon={Users2} testid="hr-kpi-learners" />
          <Kpi label="Certs expiring · 90d" value={m.expiring_certs ?? 73} icon={CalendarClock} trendDir="down" trend="-9" testid="hr-kpi-expiring" />
          <Kpi label="Skill gaps · critical" value={6} icon={AlertTriangle} testid="hr-kpi-gaps" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Skill heatmap" title="Critical gaps" testid="hr-skill-heatmap">
            {[
              ["Cyber-incident response", 32, "red"],
              ["AI-assisted profiling", 41, "red"],
              ["Cross-border legal", 58, "amber"],
              ["Trauma-informed interviews", 64, "amber"],
              ["Public-facing comms", 81, "green"],
            ].map(([k, v, c]) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}% mastery</span>
                </div>
                <MiniBar
                  value={v}
                  color={c === "red" ? "hsl(0, 84%, 60%)" : c === "amber" ? "hsl(35, 92%, 55%)" : "hsl(142, 71%, 45%)"}
                />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Expiring certifications" title="Next 90 days" testid="hr-expiring">
            <ItemList
              items={[
                { title: "Border Security · L2", meta: "32 officers · expires in 14d", right: "P1" },
                { title: "AI Ethics & TRiSM", meta: "18 officers · expires in 30d", right: "P1" },
                { title: "Customs Verification · L1", meta: "14 officers · expires in 60d", right: "P2" },
                { title: "Identity Forensics", meta: "9 officers · expires in 88d", right: "P3" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Manager — owns own team readiness
// ---------------------------------------------------------------------------
export function LineManagerDashboard({ inst }) {
  return (
    <div data-testid="dashboard-line-manager">
      <PageHeader
        eyebrow="Team Operations"
        title={`${inst.short_name} · Line Manager`}
        description="Your reports' readiness, certifications and active assignments."
        actions={<Badge className="bg-primary text-primary-foreground">Line Manager</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Direct reports" value={42} icon={Users2} testid="lm-kpi-team" />
          <Kpi label="Team readiness" value="84%" icon={Target} trend="+3.1%" testid="lm-kpi-readiness" />
          <Kpi label="Certs expiring · 30d" value={6} icon={CalendarClock} trendDir="down" trend="-2" testid="lm-kpi-expiring" />
          <Kpi label="Open dev plans" value={12} icon={ClipboardCheck} testid="lm-kpi-plans" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Team" title="Readiness by report" testid="lm-team">
            {[
              ["Officer A. Al Marri", 94],
              ["Officer S. Al Suwaidi", 86],
              ["Officer K. Al Hammadi", 71],
              ["Officer N. Al Falasi", 58],
              ["Officer R. Al Hosani", 92],
            ].map(([n, v]) => (
              <div key={n} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{n}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} color={v < 70 ? "hsl(35, 92%, 55%)" : "hsl(142, 71%, 45%)"} />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="This month" title="Active assignments" testid="lm-assignments">
            <ItemList
              items={[
                { title: "Border Sim · Round 4", meta: "8 officers · due Fri", right: "in 3d" },
                { title: "Cyber Drill", meta: "Whole team · next Mon", right: "in 5d" },
                { title: "Re-certification batch", meta: "6 officers", right: "in 14d" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Executive Leadership — strategic top-line
// ---------------------------------------------------------------------------
export function ExecutiveDashboard({ inst, m }) {
  return (
    <div data-testid="dashboard-executive">
      <PageHeader
        eyebrow="Executive Brief"
        title={`${inst.short_name} · Leadership Cockpit`}
        description={`${inst.country} · ${inst.compliance_framework || "—"}`}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <span className="dot-pulse" />
              {(m.ai_sessions || 0).toLocaleString()} AI sessions
            </Badge>
            <Badge className="bg-primary text-primary-foreground">Executive Leadership</Badge>
          </>
        }
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label={m.learners ? "Active learners" : "Students"} value={(m.learners || m.students || 0).toLocaleString()} icon={Users2} trend="+4.2%" testid="exec-kpi-learners" />
          <Kpi label="Workforce readiness" value={`${m.workforce_readiness || 0}%`} icon={Target} trend="+2.1%" testid="exec-kpi-readiness" />
          <Kpi label="AI sessions" value={(m.ai_sessions || 0).toLocaleString()} icon={Sparkles} trend="+18%" testid="exec-kpi-ai" />
          <Kpi label="Compliance" value={`${m.certification_compliance || m.completion_rate || 0}%`} icon={ShieldCheck} trend="+1.1%" testid="exec-kpi-compliance" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Strategic highlights" title="Last 30 days" testid="exec-highlights">
            <ItemList
              items={[
                { title: "AI Examiner adoption", meta: "98% faculty onboarded", right: "+12%" },
                { title: "Workforce readiness lift", meta: "All cohorts above target", right: "+2.1%" },
                { title: "Compliance posture", meta: `${inst.compliance_framework || "Framework"} score 94`, right: "+1.1%" },
              ]}
            />
          </Panel>
          <Panel eyebrow="Risks" title="Watch list" testid="exec-risks" action={<PageLink to="/compliance" label="Open audit" />}>
            <ItemList
              items={[
                { title: "Cyber-incident response gap", meta: "32% mastery · critical", right: "P1" },
                { title: "Cert expiries · 90d", meta: `${m.expiring_certs ?? 0} officers`, right: "P2" },
                { title: "Prompt-policy drift", meta: "Module 4.1 · 3 deviations", right: "P3" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Faculty — focused on courses & content drafts
// ---------------------------------------------------------------------------
export function FacultyDashboard({ inst, m }) {
  return (
    <div data-testid="dashboard-faculty">
      <PageHeader
        eyebrow="Teaching Workspace"
        title={`${inst.short_name} · Faculty`}
        description="Your active courses, content drafts and examiner reports."
        actions={<Badge className="bg-primary text-primary-foreground">Faculty</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active courses" value={4} icon={GraduationCap} testid="fac-kpi-courses" />
          <Kpi label="Learners taught" value={216} icon={Users2} testid="fac-kpi-learners" />
          <Kpi label="Drafts pending" value={3} icon={ClipboardCheck} testid="fac-kpi-drafts" />
          <Kpi label="Examiner score" value="92%" icon={Award} trend="+2.4%" testid="fac-kpi-examiner" />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Drafts" title="In Content Studio" testid="fac-drafts" action={<PageLink to="/content-studio" label="Open studio" />}>
            <ItemList
              items={[
                { title: "Strategy I · Case guide v3", meta: "Generated 2h ago", right: "Edit" },
                { title: "Strategy I · MCQs Bloom L3", meta: "Awaits review", right: "Review" },
                { title: "Digital Transformation · Lesson plan", meta: "Approved", right: "Publish" },
              ]}
            />
          </Panel>
          <Panel eyebrow="AI Instructor" title="This week's sessions" testid="fac-instructor" action={<PageLink to="/ai-instructor" label="Open instructor" />}>
            <ItemList
              items={[
                { title: "Strategy I · 38 student chats", meta: "median latency 1.2s", right: "+12%" },
                { title: "Digital Transformation · 22 chats", meta: "median latency 1.4s", right: "+4%" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student — learner-side first screen
// ---------------------------------------------------------------------------
export function StudentDashboard({ inst, user }) {
  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    if (!inst) return;
    api.get(`/tickets/${inst.id}`).then((r) => setTickets(r.data || [])).catch(() => setTickets([]));
  }, [inst?.id]);
  return (
    <div data-testid="dashboard-student">
      <PageHeader
        eyebrow="Learning Hub"
        title={`${user?.name?.split(" ")[0] || "Hello"} · ${inst.short_name}`}
        description={user?.title || "Your courses, next steps and AI helpers."}
        actions={<Badge className="bg-primary text-primary-foreground">Student</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active courses" value={5} icon={GraduationCap} testid="stu-kpi-courses" />
          <Kpi label="Assessments pending" value={2} icon={ClipboardCheck} testid="stu-kpi-assess" />
          <Kpi label="Career readiness" value="78%" icon={Briefcase} trend="+4%" testid="stu-kpi-career" />
          <Kpi label="Open tickets" value={tickets.length} icon={ScrollText} testid="stu-kpi-tickets" />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Next 7 days" title="Coming up" testid="stu-upcoming">
            <ItemList
              items={[
                { title: "Strategy I · case write-up", meta: "Due Wed · 23:59", right: "in 2d" },
                { title: "Operations · mid-term exam", meta: "Fri · 09:30", right: "in 4d" },
                { title: "Career talk · Bain", meta: "Wed · 17:00", right: "in 2d" },
              ]}
            />
          </Panel>
          <Panel eyebrow="AI helpers" title="Use what you need" testid="stu-helpers">
            <ItemList
              items={[
                { title: "Ask AI Instructor", meta: "Course-grounded answers", right: "→" },
                { title: "Get a career plan", meta: "AI Advisor", right: "→" },
                { title: "Open a support ticket", meta: "Student Assistant", right: "→" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}
