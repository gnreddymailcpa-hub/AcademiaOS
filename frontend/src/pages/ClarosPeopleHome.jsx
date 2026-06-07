import React, { useCallback, useEffect, useState } from "react";
import {
  Users2, Award, BookOpen, Trophy, Loader2, Plus, Sparkles, X, Copy,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

function Stat({ icon: Icon, label, value, testid }) {
  return (
    <div className="card p-4 border border-border" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-tight mt-1">{value ?? "—"}</div>
    </div>
  );
}

function ApiGauge({ score, maxScore = 140 }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  return (
    <div className="space-y-2" data-testid="api-gauge">
      <div className="text-3xl font-semibold tabular-nums">{score?.toFixed(0) ?? 0}<span className="text-sm font-normal text-muted-foreground">/{maxScore}</span></div>
      <div className="h-3 w-full bg-muted rounded overflow-hidden">
        <div className={`h-full transition-all ${pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{pct.toFixed(0)}% of maximum</div>
    </div>
  );
}

function LogTrainingDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    training_type: "FDP", title: "", organiser: "", duration_days: 1,
    completion_date: new Date().toISOString().slice(0, 10),
    certificate_url: "", platform: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      await api.post("/v1/people/training", {
        ...form, duration_days: Number(form.duration_days),
      });
      toast.success("Logged");
      setOpen(false); onCreated();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="people-log-training-btn">
          <Plus className="h-4 w-4 mr-2" /> Log Training
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="people-training-dialog">
        <DialogHeader><DialogTitle>Log Training Record</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select data-testid="training-type" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={form.training_type}
            onChange={(e) => setForm(s => ({ ...s, training_type: e.target.value }))}>
            {["FDP", "STTP", "WORKSHOP", "ONLINE_COURSE", "CONFERENCE"].map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </select>
          <Input data-testid="training-title" placeholder="Title" value={form.title}
            onChange={(e) => setForm(s => ({ ...s, title: e.target.value }))} />
          <Input data-testid="training-org" placeholder="Organiser" value={form.organiser}
            onChange={(e) => setForm(s => ({ ...s, organiser: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="training-days" type="number" placeholder="Days"
              value={form.duration_days}
              onChange={(e) => setForm(s => ({ ...s, duration_days: e.target.value }))} />
            <Input data-testid="training-date" type="date" value={form.completion_date}
              onChange={(e) => setForm(s => ({ ...s, completion_date: e.target.value }))} />
          </div>
          <Input data-testid="training-cert" placeholder="Certificate URL (optional)"
            value={form.certificate_url}
            onChange={(e) => setForm(s => ({ ...s, certificate_url: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="training-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosPeopleHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState("DASH");
  const [me, setMe] = useState(null);
  const [apiScore, setApiScore] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [training, setTraining] = useState([]);
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [allFaculty, setAllFaculty] = useState([]);

  const isAdmin = user && ["super_admin", "institution_admin", "hod", "dean"].includes(user.role);

  const load = useCallback(async () => {
    try {
      const promises = [
        api.get("/v1/people/faculty/me").then(r => r.data).catch(() => null),
        api.get("/v1/people/workload/me").then(r => r.data).catch(() => null),
        api.get("/v1/people/training").then(r => r.data).catch(() => []),
      ];
      if (isAdmin) {
        promises.push(api.get("/v1/people/stats").then(r => r.data).catch(() => null));
        promises.push(api.get("/v1/people/faculty").then(r => r.data).catch(() => []));
      }
      const [meR, wlR, trR, stR, facR] = await Promise.all(promises);
      setMe(meR); setWorkload(wlR); setTraining(trR || []);
      if (stR) setStats(stR);
      if (facR) setAllFaculty(facR);
      if (meR) {
        const a = await api.get(`/v1/people/faculty/${meR.id}/api`).then(r => r.data).catch(() => null);
        setApiScore(a);
        const p = await api.get(`/v1/people/faculty/${meR.id}/development-plan`).then(r => r.data).catch(() => null);
        setPlan(p);
      }
    } catch (e) { toast.error("Failed to load people data"); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const genPlan = async () => {
    if (!me) return toast.error("Faculty record required");
    setPlanLoading(true);
    try {
      const r = await api.post(`/v1/people/faculty/${me.id}/development-plan`, {});
      setPlan(r.data); toast.success("Plan generated");
    } catch (e) { toast.error("Generation failed"); }
    finally { setPlanLoading(false); }
  };

  const computeApi = async (fid) => {
    try {
      const r = await api.post(`/v1/people/faculty/${fid}/api/compute`);
      toast.success(`API recomputed: ${r.data.total_api}/140`);
      if (me && fid === me.id) setApiScore(r.data);
      load();
    } catch (e) { toast.error("Compute failed"); }
  };

  const deleteTraining = async (tid) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api.delete(`/v1/people/training/${tid}`);
      toast.success("Deleted"); load();
    } catch { toast.error("Delete failed"); }
  };

  const tabs = [
    { id: "DASH", label: "My Dashboard" },
    { id: "TRAIN", label: "Training" },
    { id: "PLAN", label: "Development Plan" },
    ...(isAdmin ? [{ id: "ADMIN", label: "Faculty Admin" }] : []),
  ];

  return (
    <div className="space-y-6" data-testid="people-page">
      <PageHeader eyebrow="Claros People" title="Faculty Development"
        description="API scores, training, AI-generated development plans." />
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            data-testid={`people-tab-${t.id.toLowerCase()}`}
            className={`px-3 py-2 -mb-px border-b-2 text-sm ${tab === t.id
              ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "DASH" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="people-dash-pane">
          <div className="card p-5 border border-border lg:col-span-1">
            <div className="label-eyebrow mb-1">Academic Performance Index</div>
            <ApiGauge score={apiScore?.total_api} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted-foreground">Teaching</div><div className="font-semibold tabular-nums">{apiScore?.teaching_score ?? 0}/50</div></div>
              <div><div className="text-muted-foreground">Research</div><div className="font-semibold tabular-nums">{apiScore?.research_score ?? 0}/60</div></div>
              <div><div className="text-muted-foreground">Service</div><div className="font-semibold tabular-nums">{apiScore?.service_score ?? 0}/30</div></div>
            </div>
            {me && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => computeApi(me.id)} data-testid="recompute-api-btn">
                Recompute
              </Button>
            )}
          </div>
          <div className="card p-5 border border-border">
            <div className="label-eyebrow mb-2">Current workload</div>
            <Stat testid="workload-courses" icon={BookOpen} label="Courses this semester" value={workload?.courses_count} />
            <div className="mt-2 text-xs text-muted-foreground">
              {workload?.teaching_hours_week ?? 0} hours/week · {workload?.students_count ?? 0} students
            </div>
          </div>
          <div className="card p-5 border border-border">
            <div className="label-eyebrow mb-2">Training summary</div>
            <Stat testid="training-count" icon={Award} label="Records" value={training.length} />
            <div className="mt-2 text-xs text-muted-foreground">
              Last: {training[0]?.title || "—"}
            </div>
          </div>
          {plan && (
            <div className="card p-5 border border-border lg:col-span-3" data-testid="latest-plan">
              <div className="label-eyebrow mb-2">Latest development plan goals</div>
              <ul className="list-disc ml-5 text-sm space-y-1">
                {(plan.goals?.goals || []).map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "TRAIN" && (
        <div className="space-y-3" data-testid="people-train-pane">
          <div className="flex items-center justify-end"><LogTrainingDialog onCreated={load} /></div>
          <div className="card border border-border divide-y">
            {training.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground" data-testid="training-empty">No training records yet.</div>
            ) : training.map(t => (
              <div key={t.id} className="p-3 flex items-start justify-between gap-3" data-testid={`training-row-${t.id}`}>
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.organiser} · {t.duration_days} day(s)</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{t.training_type}</Badge>
                  <span className="text-xs text-muted-foreground">{t.completion_date}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteTraining(t.id)} data-testid={`training-delete-${t.id}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "PLAN" && (
        <div className="space-y-3" data-testid="people-plan-pane">
          <div className="card p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">AI Development Plan</h3>
              <Button onClick={genPlan} disabled={planLoading} data-testid="generate-plan-btn">
                {planLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate My Plan
              </Button>
            </div>
            {!plan && <div className="text-sm text-muted-foreground">No plan yet — click Generate.</div>}
            {plan && plan.goals && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="plan-output">
                <div className="border rounded p-3">
                  <div className="label-eyebrow mb-2">Goals</div>
                  <ul className="list-disc ml-5 text-sm space-y-1">
                    {(plan.goals.goals || []).map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
                <div className="border rounded p-3">
                  <div className="label-eyebrow mb-2">Recommended courses</div>
                  <ul className="list-disc ml-5 text-sm space-y-1">
                    {(plan.goals.courses || []).map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
                <div className="border rounded p-3">
                  <div className="label-eyebrow mb-2">Research direction</div>
                  <p className="text-sm">{plan.goals.research_tip}</p>
                </div>
                <div className="border rounded p-3">
                  <div className="label-eyebrow mb-2">Service activity</div>
                  <p className="text-sm">{plan.goals.service}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "ADMIN" && isAdmin && (
        <div className="space-y-3" data-testid="people-admin-pane">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat testid="admin-total" icon={Users2} label="Total Faculty" value={stats.total_faculty} />
              <Stat testid="admin-avg-api" icon={Trophy} label="Avg API" value={stats.avg_api?.toFixed(1)} />
              <Stat testid="admin-phds" icon={Award} label="PhD Holders" value={stats.phd_holders} />
              <Stat testid="admin-trained" icon={BookOpen} label="Trained this year" value={stats.trained_this_year} />
            </div>
          )}
          <div className="card border border-border divide-y">
            {allFaculty.map(f => (
              <div key={f.id} className="p-3 flex items-center justify-between gap-3 text-sm" data-testid={`faculty-row-${f.id}`}>
                <div>
                  <div className="font-medium">{f.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.designation || "Faculty"} · {f.qualification || "—"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => computeApi(f.id)} data-testid={`faculty-compute-${f.id}`}>
                  Compute API
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
