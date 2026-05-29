import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Users2,
  GraduationCap,
  BookOpen,
  Activity,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  ProgrammeManagerDashboard,
  RegistrarDashboard,
  CareerServicesDashboard,
} from "../components/dashboards/variants-ops";
import {
  ComplianceOfficerDashboard,
  AIGovernanceDashboard,
  TrainingManagerDashboard,
  HRWorkforceDashboard,
  LineManagerDashboard,
  ExecutiveDashboard,
  FacultyDashboard,
  StudentDashboard,
} from "../components/dashboards/variants-strategic";

function Kpi({ label, value, hint, icon: Icon, trend, testid }) {
  return (
    <div className="kpi-card" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function trendSeries(seed) {
  // deterministic-ish series
  return Array.from({ length: 12 }).map((_, i) => ({
    m: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    enrol: Math.round(seed * (0.6 + 0.05 * i + Math.sin(i + seed) * 0.04)),
    completion: Math.round(60 + Math.sin(i / 2 + seed) * 8 + i),
    ai_sessions: Math.round((seed / 6) * (0.3 + 0.08 * i + Math.cos(i + seed) * 0.05)),
  }));
}

export default function Dashboard() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!current) return;
    api
      .get(`/dashboard/${current.id}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null));
  }, [current?.id]);

  if (!current) return null;
  const m = data?.metrics || current.metrics || {};

  // Role-specific landing screens
  const role = user?.role;
  if (role === "programme_manager")
    return <ProgrammeManagerDashboard inst={current} m={m} />;
  if (role === "registrar")
    return <RegistrarDashboard inst={current} m={m} />;
  if (role === "career_services")
    return <CareerServicesDashboard inst={current} m={m} />;
  if (role === "compliance_officer")
    return <ComplianceOfficerDashboard inst={current} m={m} />;
  if (role === "ai_governance_admin")
    return <AIGovernanceDashboard inst={current} m={m} />;
  if (role === "training_manager")
    return <TrainingManagerDashboard inst={current} m={m} />;
  if (role === "hr_workforce_planner")
    return <HRWorkforceDashboard inst={current} m={m} />;
  if (role === "line_manager")
    return <LineManagerDashboard inst={current} m={m} />;
  if (role === "executive_leadership")
    return <ExecutiveDashboard inst={current} m={m} />;
  if (role === "faculty" || role === "instructor")
    return <FacultyDashboard inst={current} m={m} />;
  if (role === "student")
    return <StudentDashboard inst={current} user={user} />;

  // Default admin/dean/super_admin view (existing canonical layout)
  const isGov = current.type === "Government Academy";
  const series = trendSeries(m.students || m.learners || 800);

  const kpis = isGov
    ? [
        { label: "Active learners", value: m.learners || 0, icon: Users2, trend: "+4.2%", testid: "kpi-learners" },
        { label: "Programmes", value: m.programmes || data?.counts?.programmes || 0, icon: GraduationCap, testid: "kpi-programmes" },
        { label: "Cert. compliance", value: `${m.certification_compliance || 0}%`, icon: ShieldCheck, trend: "+1.1%", testid: "kpi-compliance" },
        { label: "Workforce readiness", value: `${m.workforce_readiness || 0}%`, icon: TrendingUp, testid: "kpi-readiness" },
      ]
    : [
        { label: "Students", value: m.students || 0, icon: Users2, trend: "+3.8%", testid: "kpi-students" },
        { label: "Programmes", value: m.programmes || data?.counts?.programmes || 0, icon: GraduationCap, testid: "kpi-programmes" },
        { label: "Completion", value: `${m.completion_rate || 0}%`, icon: TrendingUp, trend: "+2.1%", testid: "kpi-completion" },
        { label: "At-risk", value: m.at_risk ?? "—", icon: AlertTriangle, testid: "kpi-atrisk" },
      ];

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        eyebrow="Control Room"
        title={`${current.short_name} · Institutional Dashboard`}
        description={current.description}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <span className="dot-pulse" />
              {m.ai_sessions?.toLocaleString() || 0} AI sessions
            </Badge>
            <Badge className="bg-primary text-primary-foreground">{current.type}</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </section>

        {/* Charts grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-eyebrow">Enrolment & completion · 12 mo</div>
                <h3 className="text-base font-semibold mt-1">Cohort momentum</h3>
              </div>
              <Badge variant="secondary" className="text-[10px]">YoY +12%</Badge>
            </div>
            <div className="mt-4 h-64 min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="enrol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="comp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={28} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="enrol" name="Enrolments" stroke="hsl(var(--chart-1))" fill="url(#enrol)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completion" name="Completion %" stroke="hsl(var(--chart-2))" fill="url(#comp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow">AI sessions · last 12 mo</div>
            <h3 className="text-base font-semibold mt-1">AI module activity</h3>
            <div className="mt-4 h-64 min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={28} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="ai_sessions" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Bottom strip */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label-eyebrow">AI Governance</div>
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <ul className="space-y-3 text-sm">
              {[
                ["Prompt policy", "v3 · ratified"],
                ["Bias audit", "passed · 14d ago"],
                ["Human-in-the-loop", "enforced on 8 actions"],
                ["Data residency", current.data_residency || "—"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-end">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label-eyebrow">Recent audit events</div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <ul className="space-y-3 text-xs">
              {[
                ["Lesson plan published", "Faculty · approved", "12m ago"],
                ["Adaptive test config updated", "Programme Manager", "1h ago"],
                ["Certificate batch generated", "Registrar · 184 units", "3h ago"],
                ["AI prompt template v3 ratified", "AI Governance Admin", "1d ago"],
              ].map(([title, meta, time]) => (
                <li key={title} className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                  <div>
                    <div className="font-medium text-foreground">{title}</div>
                    <div className="text-muted-foreground">{meta}</div>
                  </div>
                  <span className="font-mono text-muted-foreground whitespace-nowrap">{time}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label-eyebrow">Tenant snapshot</div>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{current.type}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Country</dt><dd className="font-medium">{current.country}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Languages</dt><dd className="font-medium uppercase">{[current.primary_language, current.secondary_language].filter(Boolean).join(" / ")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Compliance</dt><dd className="font-medium text-end">{current.compliance_framework || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Timezone</dt><dd className="font-medium font-mono text-xs">{current.timezone}</dd></div>
            </dl>
            <a
              href="/institution-setup"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open setup console <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
