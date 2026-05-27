import React, { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  BarChart3,
  Sparkles,
  Send,
  Loader2,
  ShieldCheck,
  Users2,
  Briefcase,
  Activity,
  Gauge,
} from "lucide-react";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(340, 60%, 55%)",
  "hsl(180, 50%, 40%)",
];

const SUGGESTED = {
  en: [
    "Which programme has the highest completion rate?",
    "How many AI sessions per module last month?",
    "What is the workforce readiness for Product Manager?",
    "Show me the assessment scores distribution.",
    "What's the audit volume by action?",
    "Show fairness audit status by dimension.",
  ],
  ar: [
    "ما البرنامج الأعلى في معدل الإتمام؟",
    "ما توزيع نتائج التقييم؟",
    "ما حجم سجلات التدقيق حسب الإجراء؟",
    "أظهر مزيج موفّري الذكاء الاصطناعي.",
  ],
};

export default function Analytics() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [exec, setExec] = useState(null);
  const [wf, setWf] = useState(null);
  const [comp, setComp] = useState(null);
  const [ai, setAi] = useState(null);

  const load = async () => {
    if (!current) return;
    const [a, b, c, d] = await Promise.all([
      api.get(`/analytics/${current.id}/executive`),
      api.get(`/analytics/${current.id}/workforce`),
      api.get(`/analytics/${current.id}/compliance`),
      api.get(`/analytics/${current.id}/ai-usage`),
    ]);
    setExec(a.data);
    setWf(b.data);
    setComp(c.data);
    setAi(d.data);
  };

  useEffect(() => {
    load();
  }, [current?.id]);

  if (!current || !exec) return null;

  return (
    <div data-testid="analytics-page">
      <PageHeader
        eyebrow="Module 4.6 · Executive Analytics & NL Console"
        title="Institutional Intelligence"
        description="Role-aware dashboards + Natural Language Analytics Console — ask in English or Arabic, get a chart back."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {current.compliance_framework || "Compliance · Active"}
          </Badge>
        }
      />

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="exec">
          <TabsList>
            <TabsTrigger value="exec" data-testid="tab-exec"><BarChart3 className="h-3.5 w-3.5 me-1.5" /> Executive</TabsTrigger>
            <TabsTrigger value="workforce" data-testid="tab-workforce"><Users2 className="h-3.5 w-3.5 me-1.5" /> Workforce</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance"><ShieldCheck className="h-3.5 w-3.5 me-1.5" /> Compliance</TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai-usage"><Activity className="h-3.5 w-3.5 me-1.5" /> AI Usage</TabsTrigger>
            <TabsTrigger value="ask" data-testid="tab-nl"><Sparkles className="h-3.5 w-3.5 me-1.5" /> NL Console</TabsTrigger>
          </TabsList>

          <TabsContent value="exec" className="mt-6">
            <ExecutiveTab data={exec} />
          </TabsContent>
          <TabsContent value="workforce" className="mt-6">
            <WorkforceTab data={wf} />
          </TabsContent>
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTab data={comp} institution={current} />
          </TabsContent>
          <TabsContent value="ai" className="mt-6">
            <AiUsageTab data={ai} />
          </TabsContent>
          <TabsContent value="ask" className="mt-6">
            <NLConsole institutionId={current.id} lang={lang} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi-card">
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ---------------- Executive ----------------
function ExecutiveTab({ data }) {
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Programmes" value={k.programmes} />
        <Kpi label="Courses" value={k.courses} />
        <Kpi label="Learners" value={k.users} />
        <Kpi label="AI sessions" value={k.ai_sessions} />
      </section>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Avg. assessment score" value={`${k.avg_assessment_score}%`} hint={`Pass rate ${k.pass_rate}%`} />
        <Kpi label="AI outputs published" value={k.ai_outputs} />
        <Kpi label="Pending interventions" value={k.pending_events} hint="Awaiting human review" />
        <Kpi label="Workforce readiness" value={`${data.institution.metrics?.workforce_readiness || 0}%`} />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow">12-month momentum</div>
        <div className="mt-3 h-72 min-h-[18rem]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="ex-en" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ex-ai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="enrolments" stroke="hsl(var(--chart-1))" fill="url(#ex-en)" strokeWidth={2} />
              <Area type="monotone" dataKey="ai_sessions" stroke="hsl(var(--chart-3))" fill="url(#ex-ai)" strokeWidth={2} />
              <Line type="monotone" dataKey="completion" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow mb-3">Programme momentum</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-start pb-2 font-medium">Programme</th><th className="text-start pb-2 font-medium">Code</th><th className="text-end pb-2 font-medium">Enrolled</th><th className="text-end pb-2 font-medium">Completion</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.programmes.map((p, i) => (
              <tr key={i}>
                <td className="py-2 font-medium">{p.name}</td>
                <td className="py-2 font-mono text-xs">{p.code}</td>
                <td className="py-2 text-end tabular-nums">{p.enrolled}</td>
                <td className="py-2 text-end tabular-nums">{p.completion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------- Workforce ----------------
function WorkforceTab({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Workforce readiness" value={`${data.metrics?.workforce_readiness || 0}%`} />
        <Kpi label="Certification compliance" value={`${data.metrics?.certification_compliance || 0}%`} />
        <Kpi label="Expiring certs (90d)" value={data.metrics?.expiring_certs || 0} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.by_role.map((r) => (
          <div key={r.role} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-eyebrow">Target role</div>
                <div className="text-sm font-semibold mt-0.5">{r.role}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{r.learners} learners</Badge>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-3xl font-semibold tabular-nums">{r.readiness_pct}%</div>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <Progress value={r.readiness_pct} className="mt-2 h-1.5" />
            <ul className="mt-4 space-y-2">
              {r.heatmap.map((s) => (
                <li key={s.skill} className="text-xs">
                  <div className="flex justify-between">
                    <span>{s.skill}</span>
                    <span className="font-mono tabular-nums">
                      {s.current.toFixed(1)} / {s.target}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.current / s.target) * 100}%`,
                        background: s.gap > 1.5 ? "hsl(0 70% 55%)" : s.gap > 0.5 ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------- Compliance ----------------
function ComplianceTab({ data, institution }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Audit events" value={data.audit_total} />
        <Kpi label="Pending approvals" value={data.approvals.pending} />
        <Kpi label="Data residency" value={data.data_residency || "—"} />
        <Kpi label="Framework" value={data.compliance_framework || institution?.compliance_framework || "—"} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3">Audit volume by action</div>
          <div className="h-64 min-h-[16rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_action} layout="vertical">
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="action" tick={{ fontSize: 10 }} width={150} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3">Top actors</div>
          <ul className="space-y-2">
            {data.by_actor.map((a) => (
              <li key={a.actor} className="flex justify-between text-sm border-b border-border last:border-0 pb-1.5">
                <span className="truncate me-2">{a.actor}</span>
                <span className="font-mono tabular-nums">{a.count}</span>
              </li>
            ))}
            {data.by_actor.length === 0 && <li className="text-xs text-muted-foreground">No audit activity yet.</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow mb-3">Recent audit events</div>
        <ul className="divide-y divide-border max-h-80 overflow-y-auto">
          {data.recent.slice(0, 20).map((e, i) => (
            <li key={i} className="py-2 flex items-start gap-3 text-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-muted shrink-0">
                <Activity className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.action}</div>
                <div className="text-muted-foreground truncate">{e.actor} {e.target ? `→ ${e.target.slice(0, 40)}` : ""}</div>
              </div>
              <span className="font-mono text-muted-foreground whitespace-nowrap">{new Date(e.ts).toLocaleString()}</span>
            </li>
          ))}
          {data.recent.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">No events.</li>}
        </ul>
      </section>
    </div>
  );
}

// ---------------- AI Usage ----------------
function AiUsageTab({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="AI sessions" value={data.sessions_total} />
        <Kpi label="AI outputs" value={data.outputs_total} />
        <Kpi label="Models in use" value={data.by_model.length} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3">Provider mix</div>
          <div className="h-56 min-h-[14rem]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.provider_mix} dataKey="count" nameKey="provider" innerRadius={48} outerRadius={88} paddingAngle={3}>
                  {data.provider_mix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3">Activity by module</div>
          <div className="h-56 min-h-[14rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_kind}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="kind" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} width={28} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow mb-3 flex items-center gap-2"><Gauge className="h-3.5 w-3.5" /> Latency by module · p50 / p95</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-start pb-2 font-medium">Module</th><th className="text-end pb-2 font-medium">Calls</th><th className="text-end pb-2 font-medium">p50</th><th className="text-end pb-2 font-medium">p95</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.latency.map((row, i) => (
              <tr key={i}>
                <td className="py-2 font-medium">{row.module}</td>
                <td className="py-2 text-end tabular-nums">{row.calls.toLocaleString()}</td>
                <td className="py-2 text-end tabular-nums">{row.p50_ms} ms</td>
                <td className="py-2 text-end tabular-nums">{row.p95_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------- NL Console ----------------
function NLConsole({ institutionId, lang }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { setMessages([]); }, [institutionId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = async (text) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setBusy(true);
    try {
      const { data } = await api.post(`/analytics/ask`, {
        institution_id: institutionId,
        question: value,
        language: lang,
      });
      setMessages((m) => [...m, { role: "assistant", ...data }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", chart_type: "empty", narrative: "I couldn't reach the analytics service.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col min-h-[60vh]">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Natural Language Analytics</div>
          <div className="text-[11px] text-muted-foreground">Bilingual EN / AR · controlled intents · audit logged</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <BarChart3 className="h-6 w-6 mx-auto text-primary" />
            <div className="mt-3 text-sm font-medium">Ask anything about your tenant.</div>
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {(SUGGESTED[lang] || SUGGESTED.en).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  data-testid="nl-suggested"
                  className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted/60 transition text-start"
                >{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm">{m.text}</div>
            </div>
          ) : (
            <NLAnswer key={i} answer={m} />
          )
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the data…
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === "ar" ? "اسأل عن أداء البرامج أو الامتثال…" : "Ask in plain English or Arabic…"}
          data-testid="nl-input"
          disabled={busy}
          className="flex-1"
        />
        <Button type="submit" disabled={busy || !input.trim()} data-testid="nl-send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function NLAnswer({ answer }) {
  return (
    <div className="flex gap-3" data-testid="nl-answer">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border bg-background p-4">
          {answer.chart_title && (
            <div className="label-eyebrow mb-2">{answer.chart_title}</div>
          )}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{answer.narrative || answer.note}</div>
          {answer.chart_type !== "empty" && answer.data?.length > 0 && (
            <div className="mt-4">
              <NLChart spec={answer} />
            </div>
          )}
          {answer.intent === "unsupported" && answer.available_intents && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Try one of: {answer.available_intents.slice(0, 6).join(" · ")}
            </div>
          )}
        </div>
        {answer.model && <div className="mt-1 text-[10px] text-muted-foreground font-mono">{answer.model} · intent={answer.intent}</div>}
      </div>
    </div>
  );
}

function NLChart({ spec }) {
  const data = spec.data || [];
  if (spec.chart_type === "metric") {
    return (
      <div className="text-center">
        <div className="text-5xl font-semibold tabular-nums">{data[0]?.value ?? 0}</div>
        <div className="text-xs text-muted-foreground mt-1">{data[0]?.label}</div>
      </div>
    );
  }
  if (spec.chart_type === "pie") {
    return (
      <div className="h-56 min-h-[14rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={88} paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="h-60 min-h-[15rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
