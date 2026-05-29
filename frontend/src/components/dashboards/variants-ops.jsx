import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  Users2,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  TrendingUp,
  Briefcase,
  CalendarCheck,
  Award,
} from "lucide-react";
import { PageHeader } from "../layout/Shell";
import { Badge } from "../ui/badge";
import { Kpi, Panel, ItemList, MiniBar, PageLink } from "./widgets";
import { api } from "../../lib/api";

// ---------------------------------------------------------------------------
// Programme Manager — owns programmes & cohorts
// ---------------------------------------------------------------------------
export function ProgrammeManagerDashboard({ inst, m }) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!inst) return;
    api.get(`/dashboard/${inst.id}`).then((r) => setCounts(r.data?.counts || {})).catch(() => {});
  }, [inst?.id]);

  return (
    <div data-testid="dashboard-programme-manager">
      <PageHeader
        eyebrow="Programme Operations"
        title={`${inst.short_name} · Programme Manager`}
        description="Cohorts, milestones and faculty allocation at a glance."
        actions={<Badge className="bg-primary text-primary-foreground">Programme Manager</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Programmes owned" value={m.programmes || counts.programmes || 0} icon={GraduationCap} testid="pm-kpi-programmes" />
          <Kpi label="Active courses" value={counts.courses || m.courses || 0} icon={ClipboardList} testid="pm-kpi-courses" />
          <Kpi label="Cohort completion" value={`${m.completion_rate || 0}%`} icon={CheckCircle2} trend="+2.1%" testid="pm-kpi-completion" />
          <Kpi label="At-risk learners" value={m.at_risk ?? "—"} icon={AlertTriangle} trendDir="down" trend="-3" testid="pm-kpi-atrisk" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="Today" title="Pending content approvals" testid="pm-content-approvals" className="lg:col-span-2"
                 action={<PageLink to="/content-studio" label="Open studio" />}>
            <ItemList
              testid="pm-content-list"
              items={[
                { title: "Strategy I · Case-guide v3", meta: "Faculty · Prof. Ananya Rao", right: "Awaits SME" },
                { title: "Digital Transformation · MCQs", meta: "Generated 12m ago", right: "Awaits SME" },
                { title: "Operations Lab · Flashcards", meta: "Faculty · Rao", right: "Approved" },
              ]}
            />
          </Panel>
          <Panel eyebrow="This week" title="Cohort milestones" testid="pm-milestones">
            <ItemList
              items={[
                { title: "PGP-101 capstone briefing", meta: "Wed · 14:00 IST", right: "120" },
                { title: "PGP-103 mid-term", meta: "Fri · 09:30 IST", right: "118" },
                { title: "Exec-Edu retreat", meta: "Next Mon", right: "42" },
              ]}
            />
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Faculty allocation" title="Coverage by course" testid="pm-faculty-coverage">
            {[
              ["Strategy I", 95],
              ["Operations", 88],
              ["Marketing Analytics", 72],
              ["Digital Transformation", 64],
            ].map(([c, v]) => (
              <div key={c} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{c}</span>
                  <span className="text-muted-foreground">{v}% staffed</span>
                </div>
                <MiniBar value={v} />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Workflows" title="Awaiting your approval" testid="pm-workflows" action={<PageLink to="/workflows" label="Open queue" />}>
            <ItemList
              items={[
                { title: "Cohort PGP-2026 enrolment", meta: "Step 3 of 5 · HITL", right: "12m" },
                { title: "Capstone topic allocation", meta: "Step 2 of 4 · HITL", right: "1h" },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registrar — owns enrolments, certificates, tickets
// ---------------------------------------------------------------------------
export function RegistrarDashboard({ inst, m }) {
  const [tickets, setTickets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    if (!inst) return;
    api.get(`/tickets/${inst.id}`, { params: { status: "open" } }).then((r) => setTickets(r.data || [])).catch(() => setTickets([]));
    api.get(`/notifications`, { params: { limit: 6 } }).then((r) => setNotifs(r.data?.items || [])).catch(() => setNotifs([]));
  }, [inst?.id]);

  return (
    <div data-testid="dashboard-registrar">
      <PageHeader
        eyebrow="Records & Enrolment"
        title={`${inst.short_name} · Registrar`}
        description="Open tickets, certificate batches and enrolment requests."
        actions={<Badge className="bg-primary text-primary-foreground">Registrar</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Open tickets" value={tickets.length} icon={FileSignature} trend={tickets.length > 5 ? "+3 today" : "—"} trendDir={tickets.length > 5 ? "up" : "up"} testid="reg-kpi-tickets" />
          <Kpi label="Enrolled learners" value={(m.students || m.learners || 0).toLocaleString()} icon={Users2} testid="reg-kpi-enrolled" />
          <Kpi label="Certificates · 30d" value={m.completion_rate ? Math.round((m.students || m.learners || 0) * (m.completion_rate / 100) / 6) : 184} icon={Award} testid="reg-kpi-certs" />
          <Kpi label="Cohorts in flight" value={m.programmes || 0} icon={CalendarCheck} testid="reg-kpi-cohorts" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="Inbox" title="Open support tickets" testid="reg-tickets" className="lg:col-span-2"
                 action={<PageLink to="/student-assistant#tickets" label="Open queue" />}>
            <ItemList
              testid="reg-tickets-list"
              empty="No open tickets — you're clear."
              items={tickets.slice(0, 6).map((t) => ({
                id: t.id,
                title: t.subject,
                meta: `${t.learner_name || "Learner"} · ${t.category} · ${t.severity}`,
                right: new Date(t.ts).toLocaleDateString(),
              }))}
            />
          </Panel>
          <Panel eyebrow="Live" title="Notifications" testid="reg-notifs">
            <ItemList
              items={notifs.slice(0, 5).map((n) => ({
                id: n.id,
                title: n.title,
                meta: n.kind?.replace(".", " · "),
                right: new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              }))}
            />
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Certificate batches" title="Pending issuance" testid="reg-cert-batches">
            <ItemList
              items={[
                { title: "PGP 2025 · Final certificates", meta: "Awaiting Dean sign-off", right: "284 units" },
                { title: "Exec-Edu Q1 2026 · Completion", meta: "Ready for issuance", right: "96 units" },
                { title: "AMP · Module-3 certificates", meta: "Scheduled · Mon", right: "42 units" },
              ]}
            />
          </Panel>
          <Panel eyebrow="Enrolment flow" title="Requests this week" testid="reg-enrolment">
            {[
              ["Transfer", 18, 25],
              ["Drop", 4, 25],
              ["Add course", 12, 25],
              ["Defer", 2, 25],
            ].map(([label, v, max]) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
                <MiniBar value={v} max={max} />
              </div>
            ))}
          </Panel>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Career Services — placement & employer engagement
// ---------------------------------------------------------------------------
export function CareerServicesDashboard({ inst, m }) {
  return (
    <div data-testid="dashboard-career-services">
      <PageHeader
        eyebrow="Placement & Outcomes"
        title={`${inst.short_name} · Career Services`}
        description="Employer pipeline, placement progress and learner readiness."
        actions={<Badge className="bg-primary text-primary-foreground">Career Services</Badge>}
      />
      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Placement rate" value="91%" icon={Briefcase} trend="+4.6%" testid="cs-kpi-placement" />
          <Kpi label="Active employers" value="138" icon={Users2} trend="+12" testid="cs-kpi-employers" />
          <Kpi label="Median offer (LPA)" value="₹28.4" icon={TrendingUp} trend="+8.2%" testid="cs-kpi-offer" />
          <Kpi label="Open roles" value="412" icon={ClipboardList} trend="+34" testid="cs-kpi-roles" />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel eyebrow="Pipeline" title="Active placement funnel" testid="cs-funnel" className="lg:col-span-2">
            {[
              ["Profile shortlisted", 78],
              ["Case round complete", 64],
              ["Final interview", 41],
              ["Offer extended", 28],
              ["Accepted", 22],
            ].map(([s, v]) => (
              <div key={s} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{s}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="This week" title="Employer events" testid="cs-events">
            <ItemList
              items={[
                { title: "Bain pre-placement talk", meta: "Wed · 17:00", right: "Confirmed" },
                { title: "McKinsey case workshop", meta: "Thu · 10:00", right: "Confirmed" },
                { title: "Flipkart hiring drive", meta: "Fri · all day", right: "12 reqs" },
              ]}
            />
          </Panel>
        </section>
        <Panel eyebrow="Learner readiness" title="Career-ready cohort" testid="cs-readiness">
          <ItemList
            items={[
              { title: "PGP Batch 2026", meta: `${m.students || 900} learners · 84% career-ready`, right: "Track" },
              { title: "AMP Cohort 14", meta: "120 learners · 76% career-ready", right: "Track" },
              { title: "Exec-Edu Q1", meta: "96 learners · 91% career-ready", right: "Track" },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
