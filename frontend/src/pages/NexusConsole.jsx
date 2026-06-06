import React, { useEffect, useState } from "react";
import {
  Calendar, AlertTriangle, BookMarked, Cable, MessageSquareWarning,
  FileCheck, Database as DbIcon, Megaphone, Wallet, BellRing,
  GraduationCap, Sparkles,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList } from "../components/dashboards/widgets";

export default function NexusConsole() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="nexus-console-page">
      <PageHeader
        eyebrow="NEXUS · Campus ERP deepening"
        title={`${current.short_name} · NEXUS closeout`}
        description="CSP timetable solver · 14-day defaulter prediction · collaborative-filtering library recs · JNTUH sync · grievance management · cert hash-chain · CampX migration · AI noticeboard · instalment plans · lifecycle graduate→alumni."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />NEXUS+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="timetable" className="space-y-6">
          <TabsList data-testid="nexus2-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="timetable" data-testid="nexus2-tab-timetable"><Calendar className="h-3.5 w-3.5 mr-1.5" />Timetable</TabsTrigger>
            <TabsTrigger value="defaulters" data-testid="nexus2-tab-defaulters"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Defaulters</TabsTrigger>
            <TabsTrigger value="library" data-testid="nexus2-tab-library"><BookMarked className="h-3.5 w-3.5 mr-1.5" />Library AI</TabsTrigger>
            <TabsTrigger value="jntuh" data-testid="nexus2-tab-jntuh"><Cable className="h-3.5 w-3.5 mr-1.5" />JNTUH</TabsTrigger>
            <TabsTrigger value="grievance" data-testid="nexus2-tab-grievance"><MessageSquareWarning className="h-3.5 w-3.5 mr-1.5" />Grievance</TabsTrigger>
            <TabsTrigger value="cert" data-testid="nexus2-tab-cert"><FileCheck className="h-3.5 w-3.5 mr-1.5" />Cert Chain</TabsTrigger>
            <TabsTrigger value="migrate" data-testid="nexus2-tab-migrate"><DbIcon className="h-3.5 w-3.5 mr-1.5" />CampX</TabsTrigger>
            <TabsTrigger value="notice" data-testid="nexus2-tab-notice"><Megaphone className="h-3.5 w-3.5 mr-1.5" />Notice AI</TabsTrigger>
            <TabsTrigger value="feeplan" data-testid="nexus2-tab-feeplan"><Wallet className="h-3.5 w-3.5 mr-1.5" />Fee Plans</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="nexus2-tab-alerts"><BellRing className="h-3.5 w-3.5 mr-1.5" />Auto-alerts</TabsTrigger>
            <TabsTrigger value="lifecycle" data-testid="nexus2-tab-lifecycle"><GraduationCap className="h-3.5 w-3.5 mr-1.5" />Graduate</TabsTrigger>
          </TabsList>
          <TabsContent value="timetable"><TimetableTab iid={current.id} /></TabsContent>
          <TabsContent value="defaulters"><DefaultersTab iid={current.id} /></TabsContent>
          <TabsContent value="library"><LibraryTab iid={current.id} /></TabsContent>
          <TabsContent value="jntuh"><JntuhTab iid={current.id} /></TabsContent>
          <TabsContent value="grievance"><GrievanceTab iid={current.id} /></TabsContent>
          <TabsContent value="cert"><CertTab iid={current.id} /></TabsContent>
          <TabsContent value="migrate"><MigrateTab iid={current.id} /></TabsContent>
          <TabsContent value="notice"><NoticeTab iid={current.id} /></TabsContent>
          <TabsContent value="feeplan"><FeePlanTab iid={current.id} /></TabsContent>
          <TabsContent value="alerts"><AlertsTab iid={current.id} /></TabsContent>
          <TabsContent value="lifecycle"><LifecycleTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const Card = ({ children, ...rest }) => <div className="rounded-md border p-3 text-xs" {...rest}>{children}</div>;

function TimetableTab({ iid }) {
  const [n, setN] = useState(9);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const solve = async () => {
    setBusy(true);
    try {
      const sessions = [];
      for (let c = 0; c < n; c++) for (let k = 0; k < 3; k++)
        sessions.push({ cohort_id: `C${c}`, course_id: `CS-${c}-${k}`, faculty_id: `F${(c + k) % 6}`, room_type: "lecture" });
      const rooms = [1, 2, 3].map((i) => ({ room_id: `L${i}`, type: "lecture", capacity: 60 }));
      const r = await api.post(`/nexus2/${iid}/timetable/solve`, { sessions, rooms, max_seconds: 55 });
      setOut(r.data);
      toast.success(`${r.data.solved ? "Solved" : "Unsolved"} · ${r.data.elapsed_seconds}s`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="NEXUS" title="CSP timetable solver" testid="tt-panel">
        <p className="text-xs text-muted-foreground mb-2">Backtracking solver with MRV heuristic. Constraints: no faculty/room/cohort clash per (day, slot).</p>
        <Label className="text-xs">Departments (cohorts)</Label>
        <Input type="number" value={n} min="1" max="20" onChange={(e) => setN(parseInt(e.target.value || "9", 10))} data-testid="tt-n" />
        <Button onClick={solve} disabled={busy} className="w-full mt-2" data-testid="tt-solve-btn">{busy ? "Solving…" : "Solve"}</Button>
      </Panel>
      <Panel eyebrow="NEXUS" title="Result" testid="tt-result-panel" className="lg:col-span-2">
        {out && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <Kpi label="Solved" value={out.solved ? "Yes" : "No"} testid="tt-solved" />
              <Kpi label="Departments" value={out.departments} testid="tt-depts" />
              <Kpi label="Sessions" value={out.sessions_count} testid="tt-sess" />
              <Kpi label="Elapsed (s)" value={out.elapsed_seconds} testid="tt-elapsed" />
            </div>
            <ItemList
              testid="tt-list"
              items={(out.sessions || []).slice(0, 24).map((s) => ({
                id: s.course_id, title: `${s.cohort_id} · ${s.course_id}`,
                meta: `${s.day || "—"} ${s.slot || ""} · ${s.faculty_id}`,
                right: s.room || "—",
              }))}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function DefaultersTab({ iid }) {
  const [horizon, setHorizon] = useState(14);
  const [data, setData] = useState(null);
  const run = async () => {
    try {
      const r = await api.get(`/nexus2/${iid}/fees/predict-defaulters`, { params: { horizon_days: horizon } });
      setData(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, [iid]);
  return (
    <Panel eyebrow="NEXUS" title={`${horizon}-day defaulter prediction`} testid="def-panel">
      <div className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <Label className="text-xs">Horizon (days)</Label>
          <Input type="number" min="1" max="60" value={horizon} onChange={(e) => setHorizon(parseInt(e.target.value || "14", 10))} data-testid="def-horizon" />
        </div>
        <Button onClick={run} data-testid="def-btn">Recompute</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Kpi label="Students" value={data.n_students} testid="def-n" />
            <Kpi label="At risk" value={data.n_at_risk} testid="def-risk" />
            <Kpi label="Model" value={data.model.split("_").slice(0, 2).join(" ")} testid="def-model" />
          </div>
          <ItemList
            testid="def-list"
            items={data.predictions.slice(0, 14).map((p) => ({
              id: p.student_id, title: p.student_name,
              meta: `overdue ${p.overdue_days}d · paid ratio ${p.paid_ratio}`,
              right: `${(p.default_probability * 100).toFixed(0)}% · ${p.risk_band}`,
            }))}
          />
        </>
      )}
    </Panel>
  );
}

function LibraryTab({ iid }) {
  const [sid, setSid] = useState("s1");
  const [out, setOut] = useState(null);
  const recommend = async () => {
    try {
      const r = await api.get(`/nexus2/${iid}/library/recommend/${sid}`, { params: { top_k: 5 } });
      setOut(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <Panel eyebrow="NEXUS" title="Library AI — Jaccard collaborative filter" testid="lib-panel">
      <div className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <Label className="text-xs">Student ID</Label>
          <Input value={sid} onChange={(e) => setSid(e.target.value)} data-testid="lib-sid" />
        </div>
        <Button onClick={recommend} data-testid="lib-btn">Recommend</Button>
      </div>
      {out && (
        <>
          <div className="text-xs text-muted-foreground mb-2" data-testid="lib-method">Method: {out.method}{out.neighbour_count !== undefined ? ` · neighbours ${out.neighbour_count}` : ""}</div>
          <ItemList
            testid="lib-list"
            items={(out.recommendations || []).map((r) => ({ id: r.isbn, title: r.title, meta: r.isbn, right: r.score }))}
          />
        </>
      )}
    </Panel>
  );
}

function JntuhTab({ iid }) {
  const [form, setForm] = useState({ kind: "results", payload: '{"semester":"6","rows":[]}', published_at: new Date().toISOString() });
  const [history, setHistory] = useState([]);
  const load = async () => { setHistory((await api.get(`/nexus2/${iid}/jntuh/sync`)).data || []); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [iid]);
  const sync = async () => {
    try {
      const payload = JSON.parse(form.payload);
      const r = await api.post(`/nexus2/${iid}/jntuh/sync`, { ...form, payload });
      toast.success(`Synced · SLA ${r.data.sla_ok ? "OK" : "BREACH"} (${r.data.sla_minutes}m)`);
      load();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail || e?.message)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="NEXUS" title="JNTUH sync (results / syllabus / exam_schedule / regulations)" testid="jntuh-form-panel">
        <Label className="text-xs">Kind</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} data-testid="jntuh-kind">
          {["results", "syllabus", "exam_schedule", "regulations"].map((k) => <option key={k}>{k}</option>)}
        </select>
        <Label className="text-xs mt-2">Payload (JSON)</Label>
        <textarea className="w-full text-xs border rounded p-2 h-24 bg-background" value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} data-testid="jntuh-payload" />
        <Label className="text-xs mt-2">Published at (ISO)</Label>
        <Input value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} data-testid="jntuh-pub" />
        <Button onClick={sync} className="w-full mt-2" data-testid="jntuh-sync-btn">Sync</Button>
      </Panel>
      <Panel eyebrow="NEXUS" title="Sync history" testid="jntuh-history-panel">
        <ItemList
          testid="jntuh-history-list"
          items={history.slice(0, 12).map((r) => ({
            id: r.id, title: r.kind, meta: r.synced_at.slice(0, 16).replace("T", " "),
            right: `${r.sla_ok ? "✓" : "✗"} ${r.sla_minutes ?? "—"}m`,
          }))}
        />
      </Panel>
    </div>
  );
}

function GrievanceTab({ iid }) {
  const [form, setForm] = useState({ category: "academic", title: "", description: "", severity: "medium" });
  const [rows, setRows] = useState([]);
  const load = async () => { setRows((await api.get(`/nexus2/${iid}/grievances`)).data || []); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [iid]);
  const create = async () => {
    try { await api.post(`/nexus2/${iid}/grievances`, form); toast.success("Filed"); load(); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  const update = async (id, status) => {
    try { await api.patch(`/nexus2/${iid}/grievances/${id}`, { status }); toast.success(status); load(); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="NEXUS" title="File grievance" testid="grv-form-panel">
        <Label className="text-xs">Category</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="grv-category">
          {["academic", "hostel", "fees", "harassment", "infrastructure", "library", "other"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <Label className="text-xs mt-2">Severity</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} data-testid="grv-severity">
          {["low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Label className="text-xs mt-2">Title</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="grv-title" />
        <Label className="text-xs mt-2">Description</Label>
        <textarea className="w-full text-xs border rounded p-2 h-20 bg-background" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="grv-desc" />
        <Button onClick={create} className="w-full mt-2" data-testid="grv-create-btn">File</Button>
      </Panel>
      <Panel eyebrow="NEXUS" title="Open grievances" testid="grv-list-panel" className="lg:col-span-2">
        <ul className="space-y-2 text-xs" data-testid="grv-list">
          {rows.slice(0, 12).map((r) => (
            <li key={r.id} className="border-b last:border-0 pb-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="text-muted-foreground">{r.category} · {r.severity} · SLA {r.sla_hours}h{r.sla_breach ? " · BREACH" : ""}</div>
              </div>
              <Badge variant={r.status === "open" ? "destructive" : "default"} className="text-[10px]">{r.status}</Badge>
              {r.status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={() => update(r.id, "resolved")} data-testid={`grv-resolve-${r.id}`}>Resolve</Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function CertTab({ iid }) {
  const [form, setForm] = useState({ student_id: "s1", student_name: "Mani", cert_type: "bonafide", issued_for: "visa" });
  const [issued, setIssued] = useState(null);
  const [verify, setVerify] = useState(null);
  const issue = async () => {
    try {
      const r = await api.post(`/nexus2/${iid}/certificates/issue`, form);
      setIssued(r.data);
      toast.success(`Issued · ${r.data.id}`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  const doVerify = async () => {
    if (!issued) return;
    try {
      const r = await api.get(`/nexus2/${iid}/certificates/verify/${issued.id}`);
      setVerify(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="NEXUS" title="Issue certificate" testid="cert-form-panel">
        {[["student_id", "Student ID"], ["student_name", "Student name"], ["issued_for", "Issued for"]].map(([k, lbl]) => (
          <div key={k} className="mb-2">
            <Label className="text-xs">{lbl}</Label>
            <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`cert-${k.replace(/_/g, "-")}`} />
          </div>
        ))}
        <Label className="text-xs">Type</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} data-testid="cert-type">
          {["bonafide", "degree", "tc", "provisional", "conduct", "noc"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <Button onClick={issue} className="w-full mt-2" data-testid="cert-issue-btn">Issue</Button>
        {issued && (
          <div className="mt-3 text-xs border-t pt-2" data-testid="cert-issued">
            <div className="text-muted-foreground">ID</div>
            <div className="break-all">{issued.id}</div>
            <div className="text-muted-foreground mt-1">Block hash</div>
            <div className="break-all">{issued.block_hash.slice(0, 32)}…</div>
          </div>
        )}
      </Panel>
      <Panel eyebrow="NEXUS" title="Verify hash chain" testid="cert-verify-panel">
        <Button onClick={doVerify} disabled={!issued} className="w-full" data-testid="cert-verify-btn">Verify last issued</Button>
        {verify && (
          <div className="mt-3 text-xs" data-testid="cert-verify-result">
            <div className="flex justify-between"><span>Valid</span><Badge variant={verify.valid ? "default" : "destructive"}>{String(verify.valid)}</Badge></div>
            <div className="flex justify-between mt-1"><span>Content hash</span><span>{verify.content_hash_ok ? "✓" : "✗"}</span></div>
            <div className="flex justify-between"><span>Block hash</span><span>{verify.block_hash_ok ? "✓" : "✗"}</span></div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function MigrateTab({ iid }) {
  const [rows, setRows] = useState('[{"id":"mig-1","name":"Alice","branch":"CSE"},{"id":"mig-2","name":"Bob","branch":"ECE"}]');
  const [target, setTarget] = useState("students");
  const [out, setOut] = useState(null);
  const run = async () => {
    try {
      const parsed = JSON.parse(rows);
      const r = await api.post(`/nexus2/${iid}/migration/campx`, { target_collection: target, rows: parsed });
      setOut(r.data);
      toast.success(`Fidelity ${r.data.fidelity_pct}%`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail || e.message)); }
  };
  return (
    <Panel eyebrow="NEXUS" title="CampX migration tool" testid="mig-panel">
      <Label className="text-xs">Target collection</Label>
      <select className="w-full text-xs border rounded p-1.5 bg-background mb-2" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="mig-target">
        {["students", "attendance", "fees", "certificates"].map((t) => <option key={t}>{t}</option>)}
      </select>
      <Label className="text-xs">Rows (JSON array)</Label>
      <textarea className="w-full text-xs border rounded p-2 h-28 bg-background font-mono" value={rows} onChange={(e) => setRows(e.target.value)} data-testid="mig-rows" />
      <Button onClick={run} className="w-full mt-2" data-testid="mig-btn">Migrate</Button>
      {out && (
        <div className="mt-3 grid grid-cols-4 gap-2" data-testid="mig-result">
          <Kpi label="Total" value={out.rows_total} testid="mig-total" />
          <Kpi label="Inserted" value={out.inserted} testid="mig-inserted" />
          <Kpi label="Updated" value={out.updated} testid="mig-updated" />
          <Kpi label="Fidelity" value={`${out.fidelity_pct}%`} testid="mig-fidelity" />
        </div>
      )}
    </Panel>
  );
}

function NoticeTab({ iid }) {
  const [form, setForm] = useState({ topic: "library reopens after maintenance", audience: "student", tone: "warm" });
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const draft = async () => {
    setBusy(true);
    try { const r = await api.post(`/nexus2/${iid}/notices/draft`, form); setOut(r.data); toast.success("Drafted"); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="NEXUS" title="AI noticeboard draft" testid="not-form-panel">
        <Label className="text-xs">Topic</Label>
        <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} data-testid="not-topic" />
        <Label className="text-xs mt-2">Audience</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} data-testid="not-aud">
          {["all", "student", "faculty", "parent", "staff"].map((a) => <option key={a}>{a}</option>)}
        </select>
        <Label className="text-xs mt-2">Tone</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} data-testid="not-tone">
          {["formal", "warm", "urgent"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <Button onClick={draft} disabled={busy} className="w-full mt-2" data-testid="not-btn">{busy ? "Drafting…" : "Draft notice"}</Button>
      </Panel>
      <Panel eyebrow="NEXUS" title="Draft preview" testid="not-result-panel">
        {out && (
          <div className="text-xs space-y-2" data-testid="not-result">
            <div className="font-medium text-sm">{out.title}</div>
            <p className="whitespace-pre-wrap">{out.body}</p>
            <div className="flex gap-2 flex-wrap mt-2">
              <Badge className="text-[10px]">{out.recommended_schedule}</Badge>
              {(out.tags || []).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function FeePlanTab({ iid }) {
  const [form, setForm] = useState({ student_id: "s1", student_name: "Mani", total_amount: 100000, instalments: 4, first_due_date: "2026-04-01", interval_days: 30 });
  const [plan, setPlan] = useState(null);
  const create = async () => {
    try {
      const r = await api.post(`/nexus2/${iid}/fees/plan`, {
        ...form,
        total_amount: parseFloat(form.total_amount),
        instalments: parseInt(form.instalments, 10),
        interval_days: parseInt(form.interval_days, 10),
      });
      setPlan(r.data); toast.success(`${r.data.rows.length} instalments`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="NEXUS" title="Create instalment plan" testid="fp-form-panel">
        {[["student_id", "Student ID"], ["student_name", "Student name"], ["total_amount", "Total ₹"], ["instalments", "Instalments"], ["first_due_date", "First due ISO"], ["interval_days", "Interval days"]].map(([k, lbl]) => (
          <div key={k} className="mb-2">
            <Label className="text-xs">{lbl}</Label>
            <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`fp-${k.replace(/_/g, "-")}`} />
          </div>
        ))}
        <Button onClick={create} className="w-full" data-testid="fp-btn">Create plan</Button>
      </Panel>
      <Panel eyebrow="NEXUS" title="Plan instalments" testid="fp-list-panel">
        {plan && (
          <ItemList
            testid="fp-list"
            items={plan.rows.map((r) => ({
              id: r.id, title: `Instalment ${r.instalment_no}/${r.instalment_of}`,
              meta: r.due_date.slice(0, 10), right: `₹${r.amount}`,
            }))}
          />
        )}
      </Panel>
    </div>
  );
}

function AlertsTab({ iid }) {
  const [thr, setThr] = useState(75);
  const [out, setOut] = useState(null);
  const run = async () => {
    try { const r = await api.post(`/nexus2/${iid}/attendance/auto-alert`, null, { params: { threshold_pct: thr } }); setOut(r.data); toast.success(`${r.data.alerts_emitted} alerts emitted`); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <Panel eyebrow="NEXUS" title="Attendance auto-alert sweep" testid="aut-panel">
      <p className="text-xs text-muted-foreground mb-2">Scans nexus_attendance per (student, course); if attendance% &lt; threshold, idempotently emits a VEDA alert to parents.</p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Threshold %</Label>
          <Input type="number" min="50" max="100" value={thr} onChange={(e) => setThr(parseFloat(e.target.value || "75"))} data-testid="aut-thr" />
        </div>
        <Button onClick={run} data-testid="aut-btn">Run sweep</Button>
      </div>
      {out && (
        <div className="mt-3 grid grid-cols-3 gap-2" data-testid="aut-result">
          <Kpi label="Threshold" value={`${out.threshold_pct}%`} testid="aut-thr-val" />
          <Kpi label="Scanned" value={out.students_scanned} testid="aut-scanned" />
          <Kpi label="Emitted" value={out.alerts_emitted} testid="aut-emitted" />
        </div>
      )}
    </Panel>
  );
}

function LifecycleTab({ iid }) {
  const [form, setForm] = useState({ student_id: "", graduation_year: 2026, cgpa: 8.5, degree: "B.Tech", branch: "CSE" });
  const [out, setOut] = useState(null);
  const graduate = async () => {
    try {
      const r = await api.post(`/nexus2/${iid}/students/graduate`, {
        ...form, graduation_year: parseInt(form.graduation_year, 10),
        cgpa: parseFloat(form.cgpa),
      });
      setOut(r.data); toast.success(r.data.created ? "Created alumni" : "Already alumni");
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <Panel eyebrow="NEXUS" title="Graduate → Alumni handoff" testid="grad-panel">
      {[["student_id", "Student ID"], ["graduation_year", "Year"], ["cgpa", "CGPA"], ["degree", "Degree"], ["branch", "Branch"]].map(([k, lbl]) => (
        <div key={k} className="mb-2">
          <Label className="text-xs">{lbl}</Label>
          <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`grad-${k.replace(/_/g, "-")}`} />
        </div>
      ))}
      <Button onClick={graduate} className="w-full mt-2" data-testid="grad-btn">Graduate</Button>
      {out && (
        <Card className="mt-3" data-testid="grad-result">
          <div>{out.created ? "✓ Alumni created" : "Already an alumni"}</div>
          <div className="text-muted-foreground mt-1">{out.alumni?.name} · {out.alumni?.graduation_year}</div>
        </Card>
      )}
    </Panel>
  );
}
