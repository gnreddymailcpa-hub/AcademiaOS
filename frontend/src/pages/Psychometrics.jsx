import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Brain,
  ShieldCheck,
  Plus,
  Check,
  X as XIcon,
  AlertTriangle,
  ScanLine,
  Activity,
  Loader2,
  Scale,
} from "lucide-react";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const SIGNAL_LABELS = {
  response_time_ms_avg: "Average response time (ms)",
  wrong_streak: "Consecutive wrong answers",
  hint_usage: "Hint usage count",
  inactivity: "Inactivity events",
};

const INTERVENTION_LABELS = {
  microlearning_suggested: "Microlearning suggested",
  faculty_alert: "Faculty alert",
  break_recommended: "Break recommended",
  easier_explanation: "Easier explanation",
  mentor_intervention: "Mentor intervention",
};

const STATUS_STYLE = {
  pending_review: "border-amber-300 bg-amber-50 text-amber-700",
  approved: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected: "border-slate-300 bg-slate-50 text-slate-600",
};

export default function Psychometrics() {
  const { current } = useInstitution();
  const [summary, setSummary] = useState(null);
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [fairness, setFairness] = useState(null);
  const [drift, setDrift] = useState(null);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);

  const load = async () => {
    if (!current) return;
    const [s, r, e, f, d] = await Promise.all([
      api.get(`/psychometrics/summary/${current.id}`),
      api.get(`/psychometrics/rules/${current.id}`),
      api.get(`/psychometrics/events/${current.id}?limit=50`),
      api.get(`/psychometrics/fairness/${current.id}`),
      api.get(`/psychometrics/drift/${current.id}`),
    ]);
    setSummary(s.data);
    setRules(r.data);
    setEvents(e.data);
    setFairness(f.data);
    setDrift(d.data);
  };

  useEffect(() => { load(); }, [current?.id]);

  const runFairness = async () => {
    try {
      const { data } = await api.post(`/psychometrics/fairness/${current.id}/run`);
      setFairness(data);
      toast.success("Fairness audit complete");
    } catch {
      toast.error("Could not run audit");
    }
  };

  const decide = async (id, action) => {
    try {
      await api.post(`/psychometrics/events/${id}/${action}`);
      toast.success(`Intervention ${action}d`);
      load();
    } catch {
      toast.error("Could not update");
    }
  };

  const toggleRule = async (rule, enabled) => {
    await api.patch(`/psychometrics/rules/${rule.id}`, { enabled });
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
  };

  if (!current) return null;
  const pending = events.filter((e) => e.status === "pending_review");

  return (
    <div data-testid="psychometrics-page">
      <PageHeader
        eyebrow="Module 4.5 · Highest-risk · TRiSM required"
        title="Psychometric & Behaviour Intelligence"
        description="Behavioural signal capture, intervention rules with human-in-the-loop, fairness audit and model drift monitoring."
        actions={
          <Badge variant="outline" className="gap-1.5 border-rose-300 bg-rose-50 text-rose-700">
            <ShieldCheck className="h-3 w-3" /> Bias audit · enforced
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Top KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Kpi label="Active rules" value={`${summary?.rules_active || 0} / ${summary?.rules_total || 0}`} icon={Activity} />
          <Kpi label="Pending review" value={summary?.events?.pending || 0} icon={AlertTriangle} accent="amber" />
          <Kpi label="Approved interventions" value={summary?.events?.approved || 0} icon={Check} accent="emerald" />
          <Kpi label="Rejected" value={summary?.events?.rejected || 0} icon={XIcon} />
        </section>

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue" data-testid="tab-queue">
              Intervention queue ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">Signal rules ({rules.length})</TabsTrigger>
            <TabsTrigger value="fairness" data-testid="tab-fairness">Fairness audit</TabsTrigger>
            <TabsTrigger value="drift" data-testid="tab-drift">Model drift</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
                <ul className="divide-y divide-border">
                  {events.length === 0 && (
                    <li className="p-10 text-center text-sm text-muted-foreground">No events captured yet.</li>
                  )}
                  {events.map((e) => (
                    <li key={e.id} className="p-4 flex items-start gap-3" data-testid={`event-${e.id}`}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{e.user_name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {SIGNAL_LABELS[e.signal_class] || e.signal_class}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[e.status] || ""}`}>
                            {e.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Recommended: <span className="font-medium text-foreground">{INTERVENTION_LABELS[e.intervention] || e.intervention}</span>
                          {" · "}
                          value <span className="font-mono text-foreground">{e.value}</span> exceeded threshold{" "}
                          <span className="font-mono text-foreground">{e.threshold}</span>
                          {" · "}
                          {new Date(e.created_at).toLocaleString()}
                        </div>
                      </div>
                      {e.status === "pending_review" && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => decide(e.id, "approve")} data-testid={`approve-event-${e.id}`}>
                            <Check className="h-3.5 w-3.5 me-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => decide(e.id, "reject")}>
                            <XIcon className="h-3.5 w-3.5 me-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="space-y-4">
                {summary && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-5">
                      <div className="label-eyebrow mb-3">By signal class</div>
                      <BySignalChart data={summary.by_signal} />
                    </div>
                    <div className="rounded-lg border border-border bg-card p-5">
                      <div className="label-eyebrow mb-3">By intervention</div>
                      <ul className="space-y-2">
                        {summary.by_intervention.map((s) => (
                          <li key={s.intervention} className="flex justify-between text-sm">
                            <span>{INTERVENTION_LABELS[s.intervention] || s.intervention}</span>
                            <span className="font-mono tabular-nums">{s.count}</span>
                          </li>
                        ))}
                        {summary.by_intervention.length === 0 && (
                          <li className="text-xs text-muted-foreground">No interventions captured yet.</li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <div className="mb-4 flex justify-end">
              <CreateRuleDialog
                open={createRuleOpen}
                setOpen={setCreateRuleOpen}
                institutionId={current.id}
                onCreated={load}
              />
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-3 text-start font-medium">Rule</th>
                    <th className="p-3 text-start font-medium">Signal class</th>
                    <th className="p-3 text-end font-medium">Threshold</th>
                    <th className="p-3 text-start font-medium">Intervention</th>
                    <th className="p-3 text-end font-medium">Enabled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((r) => (
                    <tr key={r.id} data-testid={`rule-${r.id}`}>
                      <td className="p-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                      </td>
                      <td className="p-3 text-xs font-mono">{SIGNAL_LABELS[r.signal_class] || r.signal_class}</td>
                      <td className="p-3 text-end tabular-nums font-mono">{r.threshold}</td>
                      <td className="p-3 text-xs">{INTERVENTION_LABELS[r.intervention] || r.intervention}</td>
                      <td className="p-3 text-end">
                        <Switch checked={!!r.enabled} onCheckedChange={(v) => toggleRule(r, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="fairness" className="mt-6">
            <FairnessView data={fairness} onRun={runFairness} />
          </TabsContent>

          <TabsContent value="drift" className="mt-6">
            <DriftView data={drift} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }) {
  const accentClass = {
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
  }[accent] || "text-muted-foreground";
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${accentClass}`} />}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BySignalChart({ data }) {
  if (!data?.length) return <div className="text-xs text-muted-foreground">No signals captured yet.</div>;
  return (
    <div className="h-40 min-h-[10rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: SIGNAL_LABELS[d.signal] || d.signal }))} layout="vertical">
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------- Rule create dialog ----------------
function CreateRuleDialog({ open, setOpen, institutionId, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    signal_class: "response_time_ms_avg",
    threshold: 45000,
    intervention: "easier_explanation",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.name) return toast.error("Name required");
    setBusy(true);
    try {
      await api.post(`/psychometrics/rules`, { institution_id: institutionId, ...form });
      toast.success("Rule created");
      setOpen(false);
      setForm({ ...form, name: "", description: "" });
      onCreated();
    } catch {
      toast.error("Could not create");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-rule-trigger">
          <Plus className="h-4 w-4 me-1.5" /> New rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New signal rule</DialogTitle>
          <DialogDescription className="text-xs">
            Every triggered rule queues an intervention awaiting human review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="new-rule-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Signal class</Label>
              <Select value={form.signal_class} onValueChange={(v) => setForm({ ...form, signal_class: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SIGNAL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Threshold</Label>
              <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Intervention</Label>
            <Select value={form.intervention} onValueChange={(v) => setForm({ ...form, intervention: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INTERVENTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} data-testid="new-rule-save">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Fairness ----------------
function FairnessView({ data, onRun }) {
  const STATUS_FACE = {
    ok: { color: "text-emerald-700 border-emerald-300 bg-emerald-50", label: "OK" },
    watch: { color: "text-amber-700 border-amber-300 bg-amber-50", label: "Watch" },
    review: { color: "text-rose-700 border-rose-300 bg-rose-50", label: "Review" },
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-eyebrow">Fairness audit</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {data?.last_audit_at || data?.created_at
              ? `Last run · ${new Date(data.created_at || data.last_audit_at).toLocaleString()}`
              : "No audit run yet."}
          </div>
        </div>
        <Button onClick={onRun} data-testid="run-fairness">
          <Scale className="h-4 w-4 me-1.5" /> Run audit
        </Button>
      </div>

      {data?.dimensions?.length > 0 ? (
        <>
          <div className="rounded-lg border border-border bg-card p-5 flex items-center justify-between">
            <div>
              <div className="label-eyebrow">Overall disparity</div>
              <div className="text-3xl font-semibold tabular-nums mt-1">{data.overall_disparity}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Warn ≥ {data.threshold_warn} · Fail ≥ {data.threshold_fail}
              </div>
            </div>
            <Badge variant="outline" className={STATUS_FACE[
              data.overall_disparity >= data.threshold_fail ? "review"
              : data.overall_disparity >= data.threshold_warn ? "watch" : "ok"
            ].color}>
              {STATUS_FACE[
                data.overall_disparity >= data.threshold_fail ? "review"
                : data.overall_disparity >= data.threshold_warn ? "watch" : "ok"
              ].label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.dimensions.map((d) => (
              <div key={d.dimension} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="label-eyebrow">{d.dimension}</div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_FACE[d.status].color}`}>{STATUS_FACE[d.status].label}</Badge>
                </div>
                <ul className="space-y-3">
                  {d.groups.map((g, i) => (
                    <li key={g} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{g}</span>
                        <span className="font-mono tabular-nums">{(d.rates[i] * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={d.rates[i] * 100} className="h-1.5" />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-2">
                  Disparity · <span className="font-mono">{d.disparity}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Run the audit to compute intervention-rate disparities across cohort, gender, and region dimensions.
        </div>
      )}
    </div>
  );
}

// ---------------- Drift ----------------
function DriftView({ data }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No drift snapshots yet.
      </div>
    );
  }
  const alerted = data.series.filter((p) => p.alert).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Model" value={data.model} icon={ScanLine} />
        <Kpi label="Threshold" value={`${(data.threshold_accuracy * 100).toFixed(0)}%`} />
        <Kpi label="Weeks below threshold" value={alerted} icon={AlertTriangle} accent={alerted > 0 ? "amber" : "emerald"} />
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow mb-3">Accuracy · last 14 weeks</div>
        <div className="h-72 min-h-[18rem]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis domain={[0.7, 0.95]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={42} />
              <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <ReferenceLine y={data.threshold_accuracy} stroke="hsl(0 84% 60%)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="calibration_error" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
