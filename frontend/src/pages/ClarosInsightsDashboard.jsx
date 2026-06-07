import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Users2,
  GraduationCap,
  Building2,
  Activity,
  Wallet,
  Sparkles,
  Briefcase,
  IndianRupee,
  TrendingUp,
  ShieldCheck,
  UserPlus,
  CalendarPlus,
  AlertTriangle,
  Loader2,
  Copy,
  Download,
  RefreshCcw,
  Brain,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../context/AuthContext";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";

const SEV_TONE = {
  CRITICAL: "bg-red-500/10 border-red-500/40 text-red-700",
  WARNING: "bg-amber-500/10 border-amber-500/40 text-amber-700",
  INFO: "bg-blue-500/10 border-blue-500/40 text-blue-700",
};

function pctTone(pct) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function fmtNum(n, opts = {}) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", opts);
}

function KpiCard({ icon: Icon, label, value, suffix, sub, testid }) {
  return (
    <div
      className="card p-5 flex flex-col gap-1.5 border border-border bg-card hover:border-primary/40 transition-colors"
      data-testid={testid}
    >
      <div className="flex items-center justify-between">
        <div className="label-eyebrow">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums leading-tight">
        {value}
        {suffix && <span className="text-base font-normal text-muted-foreground ml-1.5">{suffix}</span>}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({ title, children, actions, testid }) {
  return (
    <section className="space-y-3" data-testid={testid}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * VEDA agentic reasoning telemetry. Renders nothing when the endpoint
 * returned no data (e.g. permission denied or zero traffic ever).
 * Lays out a hero KPI + status pill + per-pass breakdown + escalations.
 */
function VedaResolutionRateSection({ data }) {
  if (!data) return null;
  const pct = data.resolution_rate_pct || 0;
  const target = data.target_pct || 85;
  const meeting = pct >= target;
  const total = data.total || 0;

  // Color the hero number relative to the 85% target.
  const heroTone =
    pct >= target ? "text-emerald-600 dark:text-emerald-400" :
    pct >= target - 15 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  const byPass = data.resolved_by_pass || { 1: 0, 2: 0, 3: 0 };
  const totalResolved = (byPass["1"] || 0) + (byPass["2"] || 0) + (byPass["3"] || 0);
  // Percentage share of resolved messages handled by each pass count
  const passPct = (n) => totalResolved > 0
    ? Math.round((byPass[String(n)] || 0) * 100 / totalResolved)
    : 0;

  return (
    <Section
      title="VEDA Agentic Reasoning"
      testid="insights-veda-section"
      actions={
        <Badge
          variant="outline"
          className={
            "gap-1.5 " +
            (meeting
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300")
          }
          data-testid="veda-target-badge"
        >
          {meeting ? "On target" : `Below ${target}% target`}
        </Badge>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="veda-resolution-section">
        {/* HERO — Resolution rate */}
        <div
          className="card p-6 border border-border bg-card flex flex-col gap-2 lg:col-span-1"
          data-testid="veda-kpi-card"
        >
          <div className="flex items-center justify-between">
            <div className="label-eyebrow inline-flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Resolution rate (30d)
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">target {target}%</span>
          </div>
          <div className={`text-4xl font-semibold tracking-tight tabular-nums ${heroTone}`}
               data-testid="veda-resolution-rate">
            {total > 0 ? `${pct}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {total > 0
              ? `${data.resolved}/${total} conversations resolved · avg ${data.avg_pass_count} pass(es)`
              : "Awaiting first VEDA traffic"}
          </div>
          {/* Progress relative to target */}
          {total > 0 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={pctTone(pct)}
                  style={{ width: `${Math.min(100, pct)}%`, height: "100%" }}
                  data-testid="veda-resolution-bar"
                />
              </div>
            </div>
          )}
        </div>

        {/* PASS BREAKDOWN — what cycle resolved each conversation */}
        <div
          className="card p-6 border border-border bg-card lg:col-span-1"
          data-testid="veda-pass-breakdown"
        >
          <div className="label-eyebrow mb-3">Resolved in pass…</div>
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => {
              const count = byPass[String(n)] || 0;
              const share = passPct(n);
              return (
                <div key={n} className="flex items-center gap-3" data-testid={`veda-pass-${n}-row`}>
                  <span className="text-xs font-mono w-12 text-muted-foreground">Pass {n}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-10 text-right">{count}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{share}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">
            More queries resolving in pass 1 means cleaner retrieval; more in pass 3 means the verifier is doing heavy lifting.
          </div>
        </div>

        {/* ESCALATIONS — when the 3-pass chain gave up */}
        <div
          className="card p-6 border border-border bg-card lg:col-span-1"
          data-testid="veda-escalations-card"
        >
          <div className="flex items-center justify-between">
            <div className="label-eyebrow inline-flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Escalations (30d)
            </div>
          </div>
          <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums"
               data-testid="veda-escalations-count">
            {data.escalated || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Conversations VEDA couldn&apos;t resolve in 3 passes — each filed as a support ticket.
          </div>
          <div className="text-xs text-muted-foreground mt-2 tabular-nums">
            Escalation rate: <span className="font-semibold text-foreground">{total > 0 ? Math.round((data.escalated || 0) * 100 / total) : 0}%</span>
          </div>
        </div>
      </div>
    </Section>
  );
}



export default function ClarosInsightsDashboard() {
  const { user } = useAuth();
  const { current } = useInstitution();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [placementTrend, setPlacementTrend] = useState([]);
  const [enrollTrend, setEnrollTrend] = useState([]);
  const [naac, setNaac] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [veda, setVeda] = useState(null);

  // Report generator state
  const now = new Date();
  const [reportType, setReportType] = useState("MONTHLY");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);

  const isAdmin = user && ["super_admin", "institution_admin"].includes(user.role);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const iidParam = current?.id ? { iid: current.id } : {};
    try {
      const [ov, att, plc, enr, nc, al, vd] = await Promise.all([
        api.get("/v1/insights/overview", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/trends/attendance", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/trends/placements", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/trends/enrollment", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/naac/summary", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/alerts", { params: iidParam }).then(r => r.data),
        api.get("/v1/insights/veda/resolution-rate", { params: { ...iidParam, days: 30 } })
          .then(r => r.data)
          .catch(() => null),  // KPI is optional — don't fail the whole page if it errors
      ]);
      setOverview(ov);
      setAttendanceTrend(att || []);
      setPlacementTrend(plc || []);
      setEnrollTrend(enr || []);
      setNaac(nc || []);
      setAlerts((al && al.items) || []);
      setVeda(vd);
    } catch (e) {
      console.error("Insights load failed", e);
      toast.error("Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, current?.id]);

  useEffect(() => { load(); }, [load]);

  const reevaluate = async () => {
    try {
      const iidParam = current?.id ? { iid: current.id } : {};
      const r = await api.post("/v1/insights/alerts/evaluate", null, { params: iidParam }).then(r => r.data);
      toast.success(`Evaluated ${r.rule_count} rules · ${r.triggered.length} new alert(s)`);
      load();
    } catch {
      toast.error("Alert evaluation failed");
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setGenerated(null);
    try {
      const iidParam = current?.id ? { iid: current.id } : {};
      const r = await api.post("/v1/insights/reports/generate", {
        report_type: reportType,
        month: Number(month),
        year: Number(year),
      }, { params: iidParam }).then(r => r.data);
      setGenerated(r);
      toast.success("Report generated");
    } catch (e) {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = async () => {
    if (!generated?.content) return;
    await navigator.clipboard.writeText(generated.content);
    toast.success("Copied to clipboard");
  };

  const downloadReport = () => {
    if (!generated?.content) return;
    const blob = new Blob([generated.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claros-insights-${(generated.period_label || "").replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const kpis = useMemo(() => {
    const o = overview || {};
    return [
      { label: "Total Students", value: fmtNum(o.total_students), icon: Users2,
        sub: "active enrollment", testid: "kpi-total-students" },
      { label: "Total Faculty", value: fmtNum(o.total_faculty), icon: GraduationCap,
        sub: "teaching staff", testid: "kpi-total-faculty" },
      { label: "Departments", value: fmtNum(o.departments), icon: Building2,
        sub: "academic units", testid: "kpi-departments" },
      { label: "Avg Attendance", value: fmtNum(o.avg_attendance_pct), suffix: "%",
        icon: Activity, sub: "YTD across all cohorts", testid: "kpi-avg-attendance" },
      { label: "Fee Collection", value: fmtNum(o.fee_collection_pct), suffix: "%",
        icon: Wallet, sub: "of total due", testid: "kpi-fee-collection" },
      { label: "AI Queries Today", value: fmtNum(o.ai_sessions_today), icon: Sparkles,
        sub: "Claros AI sessions", testid: "kpi-ai-today" },
      { label: "Placed Count", value: fmtNum(o.placed_count), icon: Briefcase,
        sub: "this cycle", testid: "kpi-placed-count" },
      { label: "Avg Package", value: fmtNum(o.avg_package), suffix: "LPA",
        icon: IndianRupee, sub: "across offers", testid: "kpi-avg-package" },
      { label: "Placement Rate", value: fmtNum(o.placement_rate), suffix: "%",
        icon: TrendingUp, sub: "of active students", testid: "kpi-placement-rate" },
      { label: "NAAC Readiness", value: fmtNum(o.naac_readiness_pct), suffix: "%",
        icon: ShieldCheck, sub: "evidence-weighted", testid: "kpi-naac-readiness" },
      { label: "Active Leads", value: fmtNum(o.active_leads), icon: UserPlus,
        sub: "in admissions pipeline", testid: "kpi-active-leads" },
      { label: "Enrolled This Month", value: fmtNum(o.enrolled_this_month),
        icon: CalendarPlus, sub: "new conversions", testid: "kpi-enrolled-month" },
    ];
  }, [overview]);

  if (!isAdmin) {
    return (
      <div className="space-y-6" data-testid="insights-forbidden">
        <PageHeader
          eyebrow="Claros Insights"
          title="Executive Command Center"
          description="This module is visible only to Admin and Principal."
        />
        <div className="card p-6 flex items-center gap-3 border border-amber-300 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-900">
            Your current role does not have access to executive analytics. Switch to a
            super_admin or institution_admin (Principal) account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="insights-dashboard">
      <PageHeader
        eyebrow="Claros Insights"
        moduleId="claros-insights"
        title="Executive Command Center"
        description={`Live KPIs, trends, alerts and AI-generated board reports · ${current?.short_name || ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={load} data-testid="insights-refresh">
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="insights-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading institutional KPIs…
        </div>
      )}

      {/* SECTION 1 — KPI Cards 3×4 grid */}
      <Section title="Headline KPIs" testid="insights-kpi-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpis.map(k => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
      </Section>

      {/* SECTION 1b — VEDA reasoning telemetry */}
      <VedaResolutionRateSection data={veda} />

      {/* SECTION 2 — Charts row */}
      <Section title="Trends" testid="insights-trends-section">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 border border-border" data-testid="chart-attendance">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="label-eyebrow">Attendance</div>
                <div className="text-sm font-medium">Last 12 months</div>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_pct" stroke="hsl(var(--primary))"
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
                    name="Avg %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5 border border-border" data-testid="chart-placements">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="label-eyebrow">Placements</div>
                <div className="text-sm font-medium">Last 4 academic years</div>
              </div>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={placementTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="placed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Placed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card p-5 border border-border" data-testid="chart-enrollment">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="label-eyebrow">Admissions funnel</div>
              <div className="text-sm font-medium">Leads created vs converted · last 12 months</div>
            </div>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={enrollTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads_created" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="converted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Converted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* SECTION 3 — NAAC Health */}
      <Section title="NAAC Health · 7 Criteria" testid="insights-naac-section">
        <div className="card p-5 border border-border space-y-3">
          {naac.length === 0 && (
            <div className="text-sm text-muted-foreground">No NAAC criteria data available.</div>
          )}
          {naac.map((c) => (
            <div key={c.criterion_code} data-testid={`naac-row-${c.criterion_code}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono text-[10px]">{c.criterion_code}</Badge>
                  <span className="font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-muted-foreground">{c.evidence_count} evidence</span>
                  <span className="font-semibold">{(c.pct || 0).toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${pctTone(c.pct || 0)} transition-all`}
                  style={{ width: `${Math.min(100, Math.max(0, c.pct || 0))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SECTION 4 — Alert Center */}
      <Section
        title="Alert Center"
        testid="insights-alerts-section"
        actions={
          <Button variant="outline" size="sm" onClick={reevaluate} data-testid="alerts-evaluate-btn">
            <AlertTriangle className="h-4 w-4 mr-2" /> Re-evaluate rules
          </Button>
        }
      >
        <div className="card p-5 border border-border">
          {alerts.length === 0 ? (
            <div className="text-sm text-muted-foreground" data-testid="alerts-empty">
              No active alerts. All rules tracking within thresholds.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md p-3 ${SEV_TONE[a.severity] || SEV_TONE.WARNING}`}
                  data-testid={`alert-${a.id}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{a.rule_name || "Alert"}</div>
                      <div className="text-xs opacity-80">{a.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <Badge variant="outline" className="bg-white/40 text-[10px]">{a.severity}</Badge>
                    <span>{new Date(a.triggered_at).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* SECTION 5 — Report Generator */}
      <Section title="AI Board Report" testid="insights-report-section">
        <div className="card p-5 border border-border space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="label-eyebrow">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="report-type-select"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label-eyebrow">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="report-month-select"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label-eyebrow">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="report-year-select"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = now.getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <Button
              onClick={generateReport}
              disabled={generating}
              data-testid="report-generate-btn"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Report
            </Button>
          </div>
          {generated && (
            <div className="space-y-3" data-testid="report-output">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Period: <span className="font-medium text-foreground">{generated.period_label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={copyReport} data-testid="report-copy-btn">
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadReport} data-testid="report-download-btn">
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Save
                  </Button>
                </div>
              </div>
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/40 border rounded-md p-4 font-sans"
                data-testid="report-content"
              >
                {generated.content}
              </pre>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
