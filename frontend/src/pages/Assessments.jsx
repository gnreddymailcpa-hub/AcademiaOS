import React, { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import {
  ClipboardCheck,
  Plus,
  Sparkles,
  Play,
  Check,
  X as XIcon,
  Loader2,
  TrendingUp,
  TimerReset,
  Target,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const DIFFICULTY_COLOR = {
  easy: "border-emerald-300 bg-emerald-50 text-emerald-700",
  intermediate: "border-amber-300 bg-amber-50 text-amber-700",
  hard: "border-rose-300 bg-rose-50 text-rose-700",
};

export default function Assessments() {
  const { current } = useInstitution();
  const [assessments, setAssessments] = useState([]);
  const [sources, setSources] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [taking, setTaking] = useState(null);

  const load = async () => {
    if (!current) return;
    const [a, s] = await Promise.all([
      api.get(`/assessments/${current.id}`),
      api.get(`/ai/content/sources/${current.id}`),
    ]);
    setAssessments(a.data);
    setSources(s.data);
  };

  useEffect(() => {
    setSelected(null);
    setTaking(null);
    load();
  }, [current?.id]);

  return (
    <div data-testid="assessments-page">
      <PageHeader
        eyebrow="Module 4.7 · Advanced Assessment Engine"
        title="Assessments"
        description="Item bank · adaptive testing · auto-scoring · faculty review · competency report."
        actions={
          <CreateAssessmentDialog
            open={createOpen}
            setOpen={setCreateOpen}
            institutionId={current?.id}
            onCreated={load}
          />
        }
      />

      <div className="p-6 lg:p-8">
        {taking ? (
          <TakeAttempt
            attempt={taking}
            assessment={assessments.find((a) => a.id === taking.assessment_id)}
            onExit={() => {
              setTaking(null);
              load();
            }}
          />
        ) : selected ? (
          <AssessmentDetail
            assessment={selected}
            sources={sources}
            onBack={() => {
              setSelected(null);
              load();
            }}
            onStart={(payload) => setTaking(payload)}
            onChanged={load}
          />
        ) : (
          <AssessmentGrid
            list={assessments}
            onPick={(a) => setSelected(a)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------- List ----------------
function AssessmentGrid({ list, onPick }) {
  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No assessments yet. Create one above.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {list.map((a) => (
        <button
          key={a.id}
          onClick={() => onPick(a)}
          data-testid={`assessment-${a.id}`}
          className="text-start rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={a.status === "published" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : ""}
            >
              {a.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{a.adaptive ? "Adaptive" : "Linear"}</Badge>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-snug">{a.title}</h3>
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{a.description}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Items" value={a.item_count} />
            <Stat label="Attempts" value={a.attempts_count} />
            <Stat label="Pass" value={`${a.pass_score}%`} />
          </div>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ---------------- Create dialog ----------------
function CreateAssessmentDialog({ open, setOpen, institutionId, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "mcq",
    time_limit_minutes: 30,
    pass_score: 60,
    adaptive: true,
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.title) return toast.error("Title required");
    setBusy(true);
    try {
      await api.post(`/assessments/`, { institution_id: institutionId, ...form });
      toast.success("Assessment created");
      setOpen(false);
      setForm({ ...form, title: "", description: "" });
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
        <Button data-testid="create-assessment-trigger">
          <Plus className="h-4 w-4 me-1.5" /> New assessment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create assessment</DialogTitle>
          <DialogDescription className="text-xs">
            Configure the shell; add items in the next step (manual or AI-generated).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="new-assessment-title" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Time limit (min)</Label>
              <Input type="number" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: parseInt(e.target.value) || 30 })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pass score</Label>
              <Input type="number" value={form.pass_score} onChange={(e) => setForm({ ...form, pass_score: parseInt(e.target.value) || 60 })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={form.adaptive ? "adaptive" : "linear"} onValueChange={(v) => setForm({ ...form, adaptive: v === "adaptive" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adaptive">Adaptive</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} data-testid="new-assessment-save">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Detail / item bank ----------------
function AssessmentDetail({ assessment, sources, onBack, onStart, onChanged }) {
  const [items, setItems] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ source_id: "", count: 6, difficulty: "intermediate", bloom: "Apply", language: "en" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [it, at] = await Promise.all([
      api.get(`/assessments/${assessment.id}/items`),
      api.get(`/assessments/attempts/list/${assessment.institution_id}`),
    ]);
    setItems(it.data);
    setAttempts(at.data.filter((a) => a.assessment_id === assessment.id));
  };
  useEffect(() => { load(); }, [assessment.id]);

  const start = async () => {
    try {
      const { data } = await api.post(`/assessments/${assessment.id}/start`);
      onStart({ ...data, assessment_id: assessment.id });
    } catch (e) {
      toast.error("Could not start", { description: e?.response?.data?.detail });
    }
  };

  const generate = async () => {
    if (!gen.source_id) return toast.error("Pick a source");
    setBusy(true);
    try {
      const { data } = await api.post(`/assessments/${assessment.id}/items/generate`, {
        institution_id: assessment.institution_id,
        assessment_id: assessment.id,
        ...gen,
      });
      toast.success(`Generated ${data.inserted} items`);
      setGenOpen(false);
      load();
      onChanged();
    } catch (e) {
      toast.error("Generation failed", { description: e?.response?.data?.detail });
    } finally {
      setBusy(false);
    }
  };

  const byDifficulty = useMemo(() => {
    const map = { easy: 0, intermediate: 0, hard: 0 };
    items.forEach((i) => { map[i.difficulty || "intermediate"] = (map[i.difficulty || "intermediate"] || 0) + 1; });
    return [
      { difficulty: "easy", count: map.easy, color: "hsl(142 71% 45%)" },
      { difficulty: "intermediate", count: map.intermediate, color: "hsl(38 92% 50%)" },
      { difficulty: "hard", count: map.hard, color: "hsl(346 77% 50%)" },
    ];
  }, [items]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-to-assessments">
          <ChevronLeft className="h-4 w-4 me-1" /> All assessments
        </Button>
        <Badge variant="outline">{assessment.status}</Badge>
        <h2 className="text-xl font-semibold">{assessment.title}</h2>
        <div className="ms-auto flex gap-2">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="generate-items-trigger">
                <Sparkles className="h-4 w-4 me-1.5" /> Generate items from source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate items from source</DialogTitle>
                <DialogDescription className="text-xs">
                  AI-generated items from an approved knowledge source. Auto-added to the item bank.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Source</Label>
                  <Select value={gen.source_id} onValueChange={(v) => setGen({ ...gen, source_id: v })}>
                    <SelectTrigger data-testid="gen-items-source"><SelectValue placeholder="Pick an approved source" /></SelectTrigger>
                    <SelectContent>
                      {sources.filter((s) => s.approved).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Count</Label>
                    <Input type="number" min={3} max={12} value={gen.count} onChange={(e) => setGen({ ...gen, count: parseInt(e.target.value) || 6 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Difficulty</Label>
                    <Select value={gen.difficulty} onValueChange={(v) => setGen({ ...gen, difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bloom's</Label>
                    <Select value={gen.bloom} onValueChange={(v) => setGen({ ...gen, bloom: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"].map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
                <Button onClick={generate} disabled={busy} data-testid="gen-items-submit">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={start} disabled={items.length === 0} data-testid="start-attempt">
            <Play className="h-4 w-4 me-1.5" /> Take adaptive test
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank" data-testid="tab-item-bank">Item bank ({items.length})</TabsTrigger>
          <TabsTrigger value="attempts" data-testid="tab-attempts">Attempts ({attempts.length})</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-asm-analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="bank" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
              {items.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No items yet. Use "Generate items from source" to seed the bank.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((it, idx) => (
                    <li key={it.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-snug">{idx + 1}. {it.stem}</div>
                          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            {(it.options || []).map((o, j) => (
                              <li key={j} className={`flex gap-1.5 ${j === it.correct_index ? "text-emerald-700 font-medium" : "text-foreground/80"}`}>
                                <span className="font-mono">{String.fromCharCode(65 + j)}.</span>
                                <span>{o}</span>
                                {j === it.correct_index && <Check className="h-3 w-3 ms-0.5 mt-0.5" />}
                              </li>
                            ))}
                          </ul>
                          {it.explanation && (
                            <div className="mt-2 text-[11px] text-muted-foreground italic">{it.explanation}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_COLOR[it.difficulty] || ""}`}>
                            {it.difficulty}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{it.bloom}</Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <aside className="rounded-lg border border-border bg-card p-5">
              <div className="label-eyebrow mb-3">Difficulty mix</div>
              <div className="h-40 min-h-[10rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDifficulty} layout="vertical">
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="difficulty" tick={{ fontSize: 11 }} width={80} />
                    <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {byDifficulty.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-[11px] text-muted-foreground">
                Adaptive engine starts on <span className="font-semibold text-foreground">easy</span> and bumps difficulty after each correct answer.
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="attempts" className="mt-5">
          {attempts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No attempts yet.</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-3 text-start font-medium">Learner</th>
                    <th className="p-3 text-start font-medium">Started</th>
                    <th className="p-3 text-end font-medium">Answered</th>
                    <th className="p-3 text-end font-medium">Score</th>
                    <th className="p-3 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attempts.map((at) => (
                    <tr key={at.id}>
                      <td className="p-3">{at.user_name}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(at.started_at).toLocaleString()}</td>
                      <td className="p-3 text-end tabular-nums">{at.answers?.length || 0}</td>
                      <td className="p-3 text-end tabular-nums font-semibold">{at.score != null ? `${at.score}%` : "—"}</td>
                      <td className="p-3">
                        {at.completed_at ? (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">Completed</Badge>
                        ) : (
                          <Badge variant="outline">In progress</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-5">
          <AssessmentAnalytics attempts={attempts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AssessmentAnalytics({ attempts }) {
  const completed = attempts.filter((a) => a.score != null);
  const avg = completed.length ? Math.round(completed.reduce((s, a) => s + a.score, 0) / completed.length) : 0;
  const passed = completed.filter((a) => a.score >= 60).length;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="kpi-card">
        <div className="label-eyebrow">Avg. score</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{avg}%</div>
      </div>
      <div className="kpi-card">
        <div className="label-eyebrow">Pass rate</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">
          {completed.length ? Math.round((100 * passed) / completed.length) : 0}%
        </div>
      </div>
      <div className="kpi-card">
        <div className="label-eyebrow">Completed</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{completed.length}</div>
      </div>
    </div>
  );
}

// ---------------- Take attempt ----------------
function TakeAttempt({ attempt, assessment, onExit }) {
  const [current, setCurrent] = useState(attempt.item);
  const [answered, setAnswered] = useState(0);
  const [limit, setLimit] = useState(attempt.remaining_estimate || 8);
  const [selection, setSelection] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [triggered, setTriggered] = useState([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const startTime = useRef(Date.now());

  const submit = async () => {
    if (selection == null || busy) return;
    setBusy(true);
    const responseTime = Date.now() - startTime.current;
    try {
      const { data } = await api.post(`/assessments/attempts/${attempt.attempt_id}/answer`, {
        item_id: current.id,
        response_index: selection,
        response_time_ms: responseTime,
        hints_used: hintsUsed,
      });
      setFeedback({
        correct: data.correct,
        correct_index: data.correct_index,
        explanation: data.explanation,
      });
      setAnswered(data.answered);
      setLimit(data.limit);
      if (data.triggered_interventions?.length) {
        setTriggered((t) => [...t, ...data.triggered_interventions]);
      }
      if (data.completed) {
        setCompleted(true);
        setScore(data.score);
      } else {
        setTimeout(() => {
          setCurrent(data.next_item);
          setSelection(null);
          setFeedback(null);
          setHintsUsed(0);
          startTime.current = Date.now();
        }, 1200);
      }
    } catch (e) {
      toast.error("Submission failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (completed) {
      api.get(`/assessments/attempts/${attempt.attempt_id}/report`).then((r) => setReport(r.data));
    }
  }, [completed]);

  if (completed) {
    return (
      <div className="max-w-4xl mx-auto" data-testid="attempt-completed">
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <ClipboardCheck className="h-8 w-8 mx-auto text-primary" />
          <h2 className="mt-3 text-2xl font-semibold">Test completed</h2>
          <div className="mt-2 text-5xl font-bold tabular-nums">{score}%</div>
          <div className="mt-1 text-xs text-muted-foreground">{assessment?.title}</div>
          {triggered.length > 0 && (
            <div className="mt-5 mx-auto max-w-md rounded-md border border-amber-200 bg-amber-50 p-3 text-start text-xs text-amber-900">
              <div className="label-eyebrow text-amber-700 mb-1">Interventions queued for human review</div>
              <ul className="space-y-1">
                {triggered.map((t, i) => (
                  <li key={i}>• <span className="font-mono">{t.signal}</span> → {t.intervention.replace(/_/g, " ")}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {report?.competency_bloom?.length > 0 && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Competency title="By Bloom's level" rows={report.competency_bloom.map((r) => ({ label: r.bloom, ...r }))} />
            <Competency title="By difficulty" rows={report.competency_difficulty.map((r) => ({ label: r.difficulty, ...r }))} />
          </div>
        )}

        <div className="mt-6 text-center">
          <Button onClick={onExit} data-testid="attempt-back">Back to assessment</Button>
        </div>
      </div>
    );
  }

  if (!current)
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">No more items.</div>
    );

  const correctSelected = feedback && selection === feedback.correct_index;

  return (
    <div className="max-w-3xl mx-auto" data-testid="attempt-active">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4 flex items-center gap-4">
          <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_COLOR[current.difficulty] || ""}`}>{current.difficulty}</Badge>
          <Badge variant="secondary" className="text-[10px]">{current.bloom}</Badge>
          <div className="ms-auto text-xs text-muted-foreground tabular-nums">
            Question {answered + 1} / {limit}
          </div>
        </div>
        <div className="p-3 border-b border-border">
          <Progress value={(answered / Math.max(1, limit)) * 100} className="h-1" />
        </div>
        <div className="p-6">
          <div className="text-lg font-medium leading-relaxed">{current.stem}</div>
          <div className="mt-5 space-y-2">
            {current.options.map((o, i) => {
              const isSelected = selection === i;
              const showCorrect = feedback && i === feedback.correct_index;
              const showWrong = feedback && isSelected && !feedback.correct;
              return (
                <button
                  key={i}
                  disabled={!!feedback}
                  onClick={() => setSelection(i)}
                  data-testid={`option-${i}`}
                  className={[
                    "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-start text-sm transition",
                    feedback
                      ? showCorrect
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : showWrong
                        ? "border-rose-400 bg-rose-50 text-rose-900"
                        : "border-border bg-card opacity-70"
                      : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isSelected || showCorrect ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{o}</span>
                  {showCorrect && <Check className="h-4 w-4 text-emerald-700" />}
                  {showWrong && <XIcon className="h-4 w-4 text-rose-700" />}
                </button>
              );
            })}
          </div>
          {feedback?.explanation && (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs italic text-muted-foreground">
              {feedback.explanation}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHintsUsed((h) => h + 1)}
            disabled={!!feedback}
            data-testid="hint-button"
          >
            <Sparkles className="h-3.5 w-3.5 me-1" /> Use hint ({hintsUsed})
          </Button>
          <div className="ms-auto flex gap-2">
            <Button variant="outline" onClick={onExit}>Exit</Button>
            <Button onClick={submit} disabled={selection == null || busy || !!feedback} data-testid="submit-answer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : feedback ? "Loading next…" : "Submit"}
              {!busy && !feedback && <ChevronRight className="h-4 w-4 ms-1" />}
            </Button>
          </div>
        </div>
      </div>

      {triggered.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="intervention-banner">
          <span className="font-semibold">Behavioural signal detected</span> · queued for human review.
        </div>
      )}
    </div>
  );
}

function Competency({ title, rows }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="label-eyebrow mb-3 flex items-center gap-2">
        <Target className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums">{r.correct}/{r.total} · {r.pct}%</span>
            </div>
            <Progress value={r.pct} className="h-1.5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
