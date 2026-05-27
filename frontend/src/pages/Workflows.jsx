import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
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
  Workflow,
  Play,
  Check,
  X as XIcon,
  Undo2,
  Loader2,
  ClipboardList,
  CheckCircle2,
  PauseCircle,
  ShieldAlert,
  History,
  ChevronRight,
  Sparkles,
  Bot,
  Hand,
  Cog,
} from "lucide-react";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const STATUS_STYLE = {
  running: "border-sky-300 bg-sky-50 text-sky-700",
  awaiting_approval: "border-amber-300 bg-amber-50 text-amber-700",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-300 bg-rose-50 text-rose-700",
  failed: "border-rose-300 bg-rose-50 text-rose-700",
  rolled_back: "border-slate-300 bg-slate-50 text-slate-600",
};

const STEP_STATUS_STYLE = {
  pending: "border-slate-200 bg-slate-50 text-slate-500",
  running: "border-sky-300 bg-sky-50 text-sky-700",
  awaiting_approval: "border-amber-300 bg-amber-50 text-amber-700",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-700",
  completed_irreversible: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-300 bg-rose-50 text-rose-700",
  failed: "border-rose-300 bg-rose-50 text-rose-700",
  rolled_back: "border-slate-300 bg-slate-50 text-slate-600",
};

const KIND_ICON = {
  auto: Cog,
  llm: Bot,
  hitl: Hand,
};

const CATEGORY_LABEL = {
  operations: "Operations",
  governance: "Governance",
  learner_success: "Learner Success",
};

function StatusPill({ status }) {
  return (
    <Badge
      variant="outline"
      className={`capitalize ${STATUS_STYLE[status] || "border-slate-300"}`}
      data-testid={`status-pill-${status}`}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function StepRow({ step, idx }) {
  const Icon = KIND_ICON[step.kind] || Cog;
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/40 p-3"
      data-testid={`step-row-${idx}`}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold">
        {idx + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{step.name}</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {step.kind}
          </Badge>
          {step.undoable && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-sky-200 bg-sky-50 text-sky-700">
              undoable
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] capitalize ${STEP_STATUS_STYLE[step.status] || ""}`}>
            {step.status.replaceAll("_", " ")}
          </Badge>
        </div>
        {step.output?.summary && (
          <div className="mt-1.5 text-xs text-muted-foreground">{step.output.summary}</div>
        )}
        {step.approved_by && (
          <div className="mt-1 text-xs text-emerald-700">Approved by {step.approved_by}</div>
        )}
        {step.error && <div className="mt-1 text-xs text-rose-600">Error: {step.error}</div>}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <div
      className="rounded-xl border border-border/70 bg-card/40 px-5 py-4"
      data-testid={`summary-${label.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone || "text-muted-foreground"}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default function Workflows() {
  const { current } = useInstitution();
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [runs, setRuns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startTemplate, setStartTemplate] = useState(null);
  const [entityName, setEntityName] = useState("");
  const [programme, setProgramme] = useState("");
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const [t, r, s] = await Promise.all([
        api.get(`/workflows/${current.id}/templates`),
        api.get(`/workflows/${current.id}/runs`),
        api.get(`/workflows/${current.id}/summary`),
      ]);
      setTemplates(t.data);
      setRuns(r.data);
      setSummary(s.data);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const pending = useMemo(() => runs.filter((r) => r.status === "awaiting_approval"), [runs]);

  const startRun = async () => {
    if (!startTemplate || !entityName.trim()) {
      toast.error("Provide an entity name to start the run.");
      return;
    }
    try {
      const { data } = await api.post(`/workflows/${current.id}/runs`, {
        institution_id: current.id,
        workflow_id: startTemplate.id,
        context: { entity_name: entityName, programme },
      });
      toast.success(`Run started · ${data.workflow_name}`);
      setStartOpen(false);
      setEntityName("");
      setProgramme("");
      setSelected(data);
      setTab("runs");
      await load();
    } catch (e) {
      toast.error("Failed to start run");
    }
  };

  const approve = async (runId) => {
    try {
      const { data } = await api.post(`/workflows/runs/${runId}/approve`);
      toast.success("Step approved");
      setSelected(data);
      await load();
    } catch (e) {
      toast.error("Approval failed");
    }
  };

  const reject = async (runId) => {
    try {
      const { data } = await api.post(`/workflows/runs/${runId}/reject`, {
        reason: rejectReason,
      });
      toast.success("Run rejected");
      setRejectReason("");
      setSelected(data);
      await load();
    } catch (e) {
      toast.error("Rejection failed");
    }
  };

  const rollback = async (runId) => {
    try {
      const { data } = await api.post(`/workflows/runs/${runId}/rollback`);
      toast.success("Run rolled back");
      setSelected(data);
      await load();
    } catch (e) {
      toast.error("Rollback failed");
    }
  };

  return (
    <div className="space-y-8 pb-12" data-testid="workflows-page">
      <PageHeader
        eyebrow="Module 4.8"
        title="Agentic Workflows"
        description="Governed multi-step AI agents with explicit human approval gates, audit trail and rollback console."
        actions={
          <Button
            onClick={() => {
              setStartTemplate(templates[0] || null);
              setStartOpen(true);
            }}
            disabled={!templates.length}
            data-testid="workflows-start-run-btn"
          >
            <Play className="mr-2 h-4 w-4" /> Start a run
          </Button>
        }
      />

      <div className="px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <SummaryCard icon={ClipboardList} label="Templates" value={summary?.templates ?? "—"} />
          <SummaryCard icon={Play} label="Running" value={summary?.running ?? "—"} tone="text-sky-600" />
          <SummaryCard icon={PauseCircle} label="Awaiting" value={summary?.awaiting_approval ?? "—"} tone="text-amber-600" />
          <SummaryCard icon={CheckCircle2} label="Completed" value={summary?.completed ?? "—"} tone="text-emerald-600" />
          <SummaryCard icon={ShieldAlert} label="Rejected" value={summary?.rejected ?? "—"} tone="text-rose-600" />
          <SummaryCard icon={Undo2} label="Rolled back" value={summary?.rolled_back ?? "—"} tone="text-slate-600" />
        </div>
      </div>

      <div className="px-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList data-testid="workflows-tabs">
            <TabsTrigger value="templates" data-testid="tab-templates">
              <Workflow className="mr-2 h-4 w-4" /> Workflow Builder
            </TabsTrigger>
            <TabsTrigger value="runs" data-testid="tab-runs">
              <ClipboardList className="mr-2 h-4 w-4" /> Run Monitor
            </TabsTrigger>
            <TabsTrigger value="approvals" data-testid="tab-approvals">
              <Hand className="mr-2 h-4 w-4" /> Approval Queue
              {pending.length > 0 && (
                <Badge variant="outline" className="ml-2 border-amber-300 bg-amber-50 text-amber-700">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <History className="mr-2 h-4 w-4" /> Audit Trail
            </TabsTrigger>
          </TabsList>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="mt-5">
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border/70 bg-card/40 p-5"
                  data-testid={`template-card-${t.key}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABEL[t.category] || t.category}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{t.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setStartTemplate(t);
                        setStartOpen(true);
                      }}
                      data-testid={`template-start-${t.key}`}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Start
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {t.steps.map((s, i) => {
                      const Icon = KIND_ICON[s.kind] || Cog;
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px]">
                            {i + 1}
                          </span>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-foreground">{s.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{s.kind}</Badge>
                          {s.undoable && (
                            <Badge variant="outline" className="text-[10px] border-sky-200 bg-sky-50 text-sky-700">
                              undoable
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!templates.length && !busy && (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  No workflow templates for this tenant.
                </div>
              )}
            </div>
          </TabsContent>

          {/* RUNS */}
          <TabsContent value="runs" className="mt-5">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-2" data-testid="runs-list">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:border-foreground/40 ${
                      selected?.id === r.id ? "border-foreground/60 bg-card" : "border-border/70 bg-card/40"
                    }`}
                    data-testid={`run-item-${r.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {CATEGORY_LABEL[r.category] || r.category}
                        </div>
                        <div className="truncate text-sm font-semibold text-foreground">{r.workflow_name}</div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{r.started_by}</span>
                      <span>{new Date(r.started_at).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
                {!runs.length && (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No runs yet. Start one from the builder tab.
                  </div>
                )}
              </div>
              <RunDetail
                run={selected}
                onApprove={approve}
                onReject={reject}
                onRollback={rollback}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
              />
            </div>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="mt-5">
            <div className="space-y-3" data-testid="approvals-list">
              {pending.map((r) => {
                const step = r.steps[r.current_step_index];
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"
                    data-testid={`approval-card-${r.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-amber-700">
                          {step?.kind === "hitl" ? "Human approval required" : "Awaiting review"}
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-foreground">{r.workflow_name}</h3>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          Step: <span className="text-foreground">{step?.name}</span>
                          {step?.role && <> · for {step.role}</>}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Started by <span className="text-foreground">{r.started_by}</span> · {new Date(r.started_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(r);
                            setTab("runs");
                          }}
                          data-testid={`approval-view-${r.id}`}
                        >
                          View <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approve(r.id)}
                          data-testid={`approval-approve-${r.id}`}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => reject(r.id)}
                          data-testid={`approval-reject-${r.id}`}
                        >
                          <XIcon className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!pending.length && (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Approval queue is empty. Nice.
                </div>
              )}
            </div>
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="mt-5">
            <AuditFeed run={selected} runs={runs} />
          </TabsContent>
        </Tabs>
      </div>

      {/* START RUN DIALOG */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent data-testid="start-run-dialog">
          <DialogHeader>
            <DialogTitle>Start workflow run</DialogTitle>
            <DialogDescription>
              Provide minimal context for the agent. Sensitive actions will pause for human approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Workflow template</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={startTemplate?.id || ""}
                onChange={(e) => setStartTemplate(templates.find((t) => t.id === e.target.value) || null)}
                data-testid="start-run-template-select"
              >
                <option value="" disabled>Select a template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Entity (learner / cohort / report)</Label>
              <Input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g. Vikram Singh"
                data-testid="start-run-entity-input"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Programme / context (optional)</Label>
              <Input
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                placeholder="e.g. PGP Class of 2026"
                data-testid="start-run-programme-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)} data-testid="start-run-cancel">
              Cancel
            </Button>
            <Button onClick={startRun} data-testid="start-run-confirm">
              <Sparkles className="mr-2 h-4 w-4" /> Start run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDetail({ run, onApprove, onReject, onRollback, rejectReason, setRejectReason }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Select a run from the list to inspect step traces, approval gates and audit timeline.
      </div>
    );
  }
  const awaiting = run.status === "awaiting_approval";
  const finished = ["completed", "rejected", "failed"].includes(run.status);
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-5" data-testid="run-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABEL[run.category] || run.category}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{run.workflow_name}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            Started by <span className="text-foreground">{run.started_by}</span> ·{" "}
            {new Date(run.started_at).toLocaleString()}
            {run.completed_at && (
              <> · finished {new Date(run.completed_at).toLocaleString()}</>
            )}
          </div>
        </div>
        <StatusPill status={run.status} />
      </div>

      {Object.keys(run.context || {}).length > 0 && (
        <div className="mt-3 rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          {Object.entries(run.context).map(([k, v]) => (
            <span key={k} className="mr-3">
              <span className="uppercase tracking-wide">{k}:</span>{" "}
              <span className="text-foreground">{String(v)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {run.steps.map((s, i) => (
          <StepRow key={s.key} step={s} idx={i} />
        ))}
      </div>

      {awaiting && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/40 p-3" data-testid="run-approval-block">
          <div className="text-sm font-medium text-amber-800">Awaiting human approval</div>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional rejection reason"
            className="mt-2 min-h-[60px]"
            data-testid="run-reject-reason"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={() => onApprove(run.id)} data-testid="run-approve-btn">
              <Check className="mr-1 h-4 w-4" /> Approve & continue
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => onReject(run.id)}
              data-testid="run-reject-btn"
            >
              <XIcon className="mr-1 h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}

      {finished && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRollback(run.id)}
            data-testid="run-rollback-btn"
          >
            <Undo2 className="mr-1 h-4 w-4" /> Rollback undoable steps
          </Button>
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Reasoning trail</div>
        <div className="mt-2 space-y-1.5 text-xs">
          {run.audit?.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="text-foreground/80">{e.actor}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground">{e.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditFeed({ run, runs }) {
  // Show the consolidated trail across all runs (most recent first)
  const items = useMemo(() => {
    const all = [];
    for (const r of runs) {
      for (const e of r.audit || []) {
        all.push({ ...e, workflow: r.workflow_name, run_id: r.id });
      }
    }
    return all.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [runs]);

  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Consolidated reasoning trail · {items.length} events
      </div>
      <div className="mt-3 space-y-2" data-testid="audit-feed">
        {items.slice(0, 80).map((e, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-2 border-b border-border/40 pb-2 text-xs">
            <span className="font-mono text-[11px] text-muted-foreground">
              {new Date(e.ts).toLocaleString()}
            </span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase">
              {e.workflow}
            </span>
            <span className="text-foreground/80">{e.actor}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground">{e.message}</span>
          </div>
        ))}
        {!items.length && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No audit events yet.
          </div>
        )}
      </div>
    </div>
  );
}
