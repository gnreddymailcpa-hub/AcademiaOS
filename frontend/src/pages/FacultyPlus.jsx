import React, { useEffect, useState } from "react";
import {
  Sparkles, GraduationCap, Plus, Trophy, Users2, BookOpen,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

/**
 * FACULTY+ — Faculty operations (Phase 2 MVP).
 * 3 tabs: Profiles · FDP (Faculty Development) · Appraisals.
 */
export default function FacultyPlus() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isHR = ["super_admin", "institution_admin", "hr_admin"].includes(user?.role);
  const [summary, setSummary] = useState(null);

  const loadSummary = async () => {
    if (!current?.id) return;
    try { setSummary((await api.get(`/faculty-plus/${current.id}/summary`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current) return null;
  return (
    <div data-testid="faculty-page">
      <PageHeader
        eyebrow="FACULTY+ · Faculty Excellence"
        title={`${current.short_name} · Faculty Operations`}
        description="Profiles, FDP tracking and CAS-weighted appraisals — the people layer behind every NAAC criterion."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 2 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">FACULTY+</Badge>
          </>
        }
      />
      <div className="p-6 lg:p-8 space-y-8">
        {summary && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Faculty" value={summary.faculty_count} hint={`${summary.departments} depts`} icon={GraduationCap} testid="faculty-kpi-count" />
            <Kpi label="FDP completed" value={summary.fdp_completed} hint={`${summary.fdp_total_hours}h`} icon={BookOpen} testid="faculty-kpi-fdp" />
            <Kpi label="Appraisals" value={summary.appraisals_done} hint={`avg ${summary.avg_appraisal_composite}/100`} icon={Trophy} testid="faculty-kpi-app" />
            <Kpi label="Coverage" value={summary.faculty_count > 0 ? `${Math.round(summary.appraisals_done / summary.faculty_count * 100)}%` : "0%"} hint="appraised" icon={Users2} testid="faculty-kpi-cov" />
          </section>
        )}

        <Tabs defaultValue="profiles" className="space-y-4">
          <TabsList data-testid="faculty-tabs">
            <TabsTrigger value="profiles" data-testid="faculty-tab-profiles">Profiles</TabsTrigger>
            <TabsTrigger value="fdp" data-testid="faculty-tab-fdp">FDP</TabsTrigger>
            <TabsTrigger value="appraisals" data-testid="faculty-tab-appraisals">Appraisals</TabsTrigger>
          </TabsList>
          <TabsContent value="profiles">
            <ProfilesTab institutionId={current.id} isHR={isHR} onChange={loadSummary} />
            {summary && summary.by_department?.length > 0 && (
              <Panel eyebrow="By department" title="Faculty distribution" testid="faculty-dept-panel" className="mt-4">
                <div className="space-y-2">
                  {summary.by_department.map((d) => (
                    <div key={d.department}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{d.department}</span>
                        <span className="font-mono text-muted-foreground">{d.count}</span>
                      </div>
                      <MiniBar value={d.count} max={Math.max(...summary.by_department.map((x) => x.count), 1) * 1.1} />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </TabsContent>
          <TabsContent value="fdp"><FdpTab institutionId={current.id} onChange={loadSummary} /></TabsContent>
          <TabsContent value="appraisals"><AppraisalsTab institutionId={current.id} isHR={isHR} onChange={loadSummary} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProfilesTab({ institutionId, isHR, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "", email: "", department: "CSE", designation: "Assistant Professor",
    expertise: "", joined_year: new Date().getFullYear(),
  });

  const refresh = async () => {
    try { setRows((await api.get(`/faculty-plus/${institutionId}/profiles`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/faculty-plus/${institutionId}/profiles`, {
        ...draft, joined_year: parseInt(draft.joined_year, 10),
        expertise: draft.expertise.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Faculty profile added");
      setOpen(false);
      setDraft({ name: "", email: "", department: "CSE", designation: "Assistant Professor", expertise: "", joined_year: new Date().getFullYear() });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Roster"
      title="Faculty profiles"
      testid="faculty-profiles-panel"
      action={isHR && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="faculty-prof-new"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add faculty</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="faculty-prof-name" /></div>
                <div><Label className="text-xs">Email</Label><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} data-testid="faculty-prof-email" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Department</Label><Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} data-testid="faculty-prof-dept" /></div>
                <div><Label className="text-xs">Designation</Label><Input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} data-testid="faculty-prof-desig" /></div>
                <div><Label className="text-xs">Joined</Label><Input type="number" value={draft.joined_year} onChange={(e) => setDraft({ ...draft, joined_year: e.target.value })} data-testid="faculty-prof-joined" /></div>
              </div>
              <div><Label className="text-xs">Expertise (csv)</Label><Input value={draft.expertise} onChange={(e) => setDraft({ ...draft, expertise: e.target.value })} data-testid="faculty-prof-expertise" /></div>
              <Button onClick={submit} className="w-full" data-testid="faculty-prof-submit">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No faculty profiles yet.</div>
      ) : (
        <ul className="space-y-2" data-testid="faculty-prof-list">
          {rows.map((r) => (
            <FacultyRow key={r.id} faculty={r} institutionId={institutionId} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * FacultyRow — expandable card that lazy-loads PRISM publications for the
 * faculty member when the user clicks "Show publications". Cross-platform
 * glue between FACULTY+ and PRISM.
 */
function FacultyRow({ faculty, institutionId }) {
  const [open, setOpen] = useState(false);
  const [pubs, setPubs] = useState(null);
  const [loading, setLoading] = useState(false);

  const togglePubs = async () => {
    if (!open && pubs === null) {
      setLoading(true);
      try {
        const r = await api.get(
          `/prism/${institutionId}/publications-by-author?author=${encodeURIComponent(faculty.name)}`
        );
        setPubs(r.data || []);
      } catch (e) {
        setPubs([]);
        toast.error(formatApiError(e?.response?.data?.detail) || "Could not fetch publications");
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  };

  return (
    <li className="rounded-md border border-border bg-card" data-testid={`faculty-prof-row-${faculty.id}`}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="font-medium text-sm">{faculty.name}</div>
          <div className="text-xs text-muted-foreground">
            {faculty.designation} · {faculty.department} · since {faculty.joined_year}
          </div>
          {faculty.expertise?.length > 0 && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {faculty.expertise.slice(0, 4).map((e) => (
                <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={togglePubs}
          data-testid={`faculty-prof-pubs-toggle-${faculty.id}`}
          className="shrink-0"
        >
          {open ? "Hide" : "Show"} publications
          {pubs !== null && (
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">({pubs.length})</span>
          )}
        </Button>
      </div>
      {open && (
        <div className="border-t border-border px-4 py-3 bg-muted/30" data-testid={`faculty-prof-pubs-${faculty.id}`}>
          <div className="label-eyebrow mb-2">PRISM · Publications</div>
          {loading && <div className="text-xs text-muted-foreground py-2">Loading…</div>}
          {!loading && pubs?.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">
              No publications attributed to <span className="font-mono">{faculty.name}</span> in PRISM yet.
            </div>
          )}
          {!loading && pubs?.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {pubs.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 border-b border-border/60 last:border-0 pb-1.5">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.venue} · {p.year} · {(p.authors || []).slice(0, 3).join(", ")}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">{p.citations} cited</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function FdpTab({ institutionId, onChange }) {
  const [profiles, setProfiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ faculty_id: "", faculty_name: "", programme: "", hours: 8, completion_date: "", status: "enrolled" });

  const refresh = async () => {
    try {
      const [p, f] = await Promise.all([
        api.get(`/faculty-plus/${institutionId}/profiles`),
        api.get(`/faculty-plus/${institutionId}/fdp`),
      ]);
      setProfiles(p.data || []);
      setRows(f.data || []);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    if (!draft.faculty_id) { toast.error("Pick a faculty"); return; }
    const prof = profiles.find((p) => p.id === draft.faculty_id);
    try {
      await api.post(`/faculty-plus/${institutionId}/fdp`, {
        ...draft, faculty_name: prof?.name || draft.faculty_name,
        hours: parseInt(draft.hours, 10),
      });
      toast.success("FDP recorded");
      setOpen(false);
      setDraft({ faculty_id: "", faculty_name: "", programme: "", hours: 8, completion_date: "", status: "enrolled" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Development"
      title="Faculty Development Programmes"
      testid="faculty-fdp-panel"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="faculty-fdp-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record FDP</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs">Faculty</Label>
                <select value={draft.faculty_id} onChange={(e) => setDraft({ ...draft, faculty_id: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="faculty-fdp-faculty">
                  <option value="">— select —</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Programme</Label><Input value={draft.programme} onChange={(e) => setDraft({ ...draft, programme: e.target.value })} data-testid="faculty-fdp-programme" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Hours</Label><Input type="number" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} data-testid="faculty-fdp-hours" /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="faculty-fdp-status">
                    {["enrolled", "completed", "dropped"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Done on</Label><Input type="date" value={draft.completion_date} onChange={(e) => setDraft({ ...draft, completion_date: e.target.value })} data-testid="faculty-fdp-date" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="faculty-fdp-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No FDP records yet.</div>
      ) : (
        <ItemList
          testid="faculty-fdp-list"
          items={rows.map((r) => ({
            id: r.id, title: `${r.faculty_name} · ${r.programme}`,
            meta: `${r.hours}h${r.completion_date ? " · " + r.completion_date : ""}`,
            right: r.status,
          }))}
        />
      )}
    </Panel>
  );
}

function AppraisalsTab({ institutionId, isHR, onChange }) {
  const [profiles, setProfiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    faculty_id: "", faculty_name: "", cycle: "AY 2025-26",
    teaching: 80, research: 70, institutional_service: 75, student_feedback: 80,
  });

  const refresh = async () => {
    try {
      const [p, a] = await Promise.all([
        api.get(`/faculty-plus/${institutionId}/profiles`),
        api.get(`/faculty-plus/${institutionId}/appraisals`),
      ]);
      setProfiles(p.data || []);
      setRows(a.data || []);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    if (!draft.faculty_id) { toast.error("Pick a faculty"); return; }
    const prof = profiles.find((p) => p.id === draft.faculty_id);
    try {
      const r = await api.post(`/faculty-plus/${institutionId}/appraisals`, {
        ...draft, faculty_name: prof?.name || draft.faculty_name,
        teaching: parseFloat(draft.teaching), research: parseFloat(draft.research),
        institutional_service: parseFloat(draft.institutional_service),
        student_feedback: parseFloat(draft.student_feedback),
      });
      toast.success(`Composite ${r.data.composite}/100 · ${r.data.band}`);
      setOpen(false);
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="CAS-weighted (T 40 · R 30 · S 15 · F 15)"
      title="Appraisal cycle"
      testid="faculty-app-panel"
      action={isHR && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="faculty-app-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record appraisal</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs">Faculty</Label>
                <select value={draft.faculty_id} onChange={(e) => setDraft({ ...draft, faculty_id: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="faculty-app-faculty">
                  <option value="">— select —</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Cycle</Label><Input value={draft.cycle} onChange={(e) => setDraft({ ...draft, cycle: e.target.value })} data-testid="faculty-app-cycle" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Teaching (0-100)</Label><Input type="number" value={draft.teaching} onChange={(e) => setDraft({ ...draft, teaching: e.target.value })} data-testid="faculty-app-t" /></div>
                <div><Label className="text-xs">Research (0-100)</Label><Input type="number" value={draft.research} onChange={(e) => setDraft({ ...draft, research: e.target.value })} data-testid="faculty-app-r" /></div>
                <div><Label className="text-xs">Service (0-100)</Label><Input type="number" value={draft.institutional_service} onChange={(e) => setDraft({ ...draft, institutional_service: e.target.value })} data-testid="faculty-app-s" /></div>
                <div><Label className="text-xs">Feedback (0-100)</Label><Input type="number" value={draft.student_feedback} onChange={(e) => setDraft({ ...draft, student_feedback: e.target.value })} data-testid="faculty-app-f" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="faculty-app-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No appraisals yet.</div>
      ) : (
        <ul className="space-y-2 text-sm" data-testid="faculty-app-list">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border pb-2 last:border-0" data-testid={`faculty-app-row-${r.id}`}>
              <div>
                <div className="font-medium">{r.faculty_name} <span className="text-xs text-muted-foreground">· {r.cycle}</span></div>
                <div className="text-xs text-muted-foreground">T {r.teaching} · R {r.research} · S {r.institutional_service} · F {r.student_feedback}</div>
              </div>
              <div className="font-mono tabular-nums text-sm text-right">{r.composite}/100</div>
              <Badge className={
                r.band === "Exceeds" ? "bg-emerald-600 text-white" :
                r.band === "Meets" ? "bg-primary text-primary-foreground" :
                "bg-rose-500 text-white"
              }>{r.band}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
