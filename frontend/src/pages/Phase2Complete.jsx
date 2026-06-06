import React, { useEffect, useState } from "react";
import {
  Sparkles, BookOpen, Search, HeartHandshake, GraduationCap, ShieldCheck,
  Brain, Activity, Building, Cpu, AlertTriangle, Camera,
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
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

/**
 * Phase 2 Complete — single console covering the remaining feature bullets for
 * the 5 Phase-2 platforms (ILLUMINATE, PRISM, ALUMNI360, FACULTY+, GUARDIAN).
 * Each tab is a thin form/list pair over routes_phase2_complete.py.
 */
export default function Phase2Complete() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="phase2-complete-page">
      <PageHeader
        eyebrow="Phase 2 · Completion sprint"
        title={`${current.short_name} · Phase-2 gap closure`}
        description="Feature bullets that close the Phase-2 platforms — AI quiz-gen, at-risk scoring, OpenAlex / CrossRef sync, alumni enrichment, workload-optimiser, 360° peer review, and YOLOv8 ingestion."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />Phase 2+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="illuminate" className="space-y-6">
          <TabsList data-testid="p2-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="illuminate" data-testid="p2-tab-illuminate"><BookOpen className="h-3.5 w-3.5 mr-1.5" />ILLUMINATE</TabsTrigger>
            <TabsTrigger value="prism" data-testid="p2-tab-prism"><Search className="h-3.5 w-3.5 mr-1.5" />PRISM</TabsTrigger>
            <TabsTrigger value="alumni" data-testid="p2-tab-alumni"><HeartHandshake className="h-3.5 w-3.5 mr-1.5" />ALUMNI360</TabsTrigger>
            <TabsTrigger value="faculty" data-testid="p2-tab-faculty"><GraduationCap className="h-3.5 w-3.5 mr-1.5" />FACULTY+</TabsTrigger>
            <TabsTrigger value="guardian" data-testid="p2-tab-guardian"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />GUARDIAN</TabsTrigger>
          </TabsList>
          <TabsContent value="illuminate"><IlluminateTab iid={current.id} /></TabsContent>
          <TabsContent value="prism"><PrismTab iid={current.id} /></TabsContent>
          <TabsContent value="alumni"><AlumniTab iid={current.id} /></TabsContent>
          <TabsContent value="faculty"><FacultyTab iid={current.id} /></TabsContent>
          <TabsContent value="guardian"><GuardianTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============== ILLUMINATE ==============
function IlluminateTab({ iid }) {
  const [topic, setTopic] = useState("Binary search trees");
  const [n, setN] = useState(3);
  const [diff, setDiff] = useState("intermediate");
  const [gen, setGen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [risk, setRisk] = useState([]);
  const refresh = async () => {
    try { const r = await api.get(`/phase2/${iid}/illuminate/at-risk`); setRisk(r.data || []); }
    catch { /* empty */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [iid]);

  const generate = async () => {
    setBusy(true); setGen(null);
    try {
      const r = await api.post(`/phase2/${iid}/illuminate/quiz-gen`, {
        topic, num_questions: parseInt(n, 10) || 3, difficulty: diff,
      });
      setGen(r.data);
      toast.success(`Generated ${r.data.questions?.length || 0} MCQs · ${r.data.grounding}`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const counts = risk.reduce((a, r) => { a[r.band] = (a[r.band] || 0) + 1; return a; }, {});
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ILLUMINATE" title="AI quiz generator (RAG-grounded)" testid="ill-quiz-panel" className="lg:col-span-2">
        <p className="text-xs text-muted-foreground mb-3">Uses approved Content Studio sources for grounding when available; falls back to general knowledge with rationale='general'.</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="col-span-2">
            <Label className="text-xs">Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="ill-quiz-topic" />
          </div>
          <div>
            <Label className="text-xs">N</Label>
            <Input type="number" min="1" max="15" value={n} onChange={(e) => setN(e.target.value)} data-testid="ill-quiz-n" />
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          {["easy", "intermediate", "hard"].map((d) => (
            <Button key={d} size="sm" variant={diff === d ? "default" : "outline"} onClick={() => setDiff(d)} data-testid={`ill-quiz-diff-${d}`}>{d}</Button>
          ))}
        </div>
        <Button className="w-full" disabled={busy} onClick={generate} data-testid="ill-quiz-generate">{busy ? "Generating…" : "Generate quiz"}</Button>
        {gen && (
          <div className="mt-4 space-y-3" data-testid="ill-quiz-result">
            <div className="flex items-center justify-between text-xs">
              <span className="label-eyebrow">{gen.model}</span>
              <Badge variant={gen.grounding === "rag" ? "default" : "outline"} className="text-[10px]">{gen.grounding}</Badge>
            </div>
            {(gen.questions || []).map((q, i) => (
              <div key={q.id} className="rounded-md border border-border p-3 text-xs" data-testid={`ill-quiz-q-${i}`}>
                <div className="font-medium text-sm mb-2">{i + 1}. {q.stem}</div>
                <ol className="list-[lower-alpha] ml-4 space-y-0.5">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={oi === q.correct_index ? "text-emerald-700 font-medium" : ""}>{opt}{oi === q.correct_index && " ✓"}</li>
                  ))}
                </ol>
                <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{q.bloom_level}</Badge>
                  <span>{q.rationale}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel eyebrow="ILLUMINATE" title="At-risk learners (heuristic)" testid="ill-risk-panel">
        <p className="text-xs text-muted-foreground mb-2">Multi-signal score over learner_progress: completion gap + engagement gap + recency gap + blank-submissions.</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Kpi label="High" value={counts.high || 0} testid="ill-risk-high" />
          <Kpi label="Med"  value={counts.medium || 0} testid="ill-risk-med" />
          <Kpi label="Low"  value={counts.low || 0} testid="ill-risk-low" />
        </div>
        <ItemList
          testid="ill-risk-list"
          items={risk.slice(0, 12).map((r) => ({
            id: `${r.student_id}-${r.course_id}`,
            title: r.student_name || r.student_id,
            meta: `${r.course_id} · comp ${r.signals.completion_pct}% · ${r.signals.days_since_activity}d idle`,
            right: `${r.score} · ${r.band}`,
          }))}
        />
      </Panel>
    </div>
  );
}

// ============== PRISM ==============
function PrismTab({ iid }) {
  const [author, setAuthor] = useState("Yann LeCun");
  const [doi, setDoi] = useState("10.1038/nature12373");
  const [syncRes, setSyncRes] = useState(null);
  const [doiRes, setDoiRes] = useState(null);
  const [busyA, setBusyA] = useState(false);
  const [busyD, setBusyD] = useState(false);

  const sync = async () => {
    setBusyA(true); setSyncRes(null);
    try {
      const r = await api.post(`/phase2/${iid}/prism/openalex-sync`, { author_name: author, max_results: 5 });
      setSyncRes(r.data);
      toast.success(`Synced ${r.data.total_synced} works (${r.data.inserted} new · ${r.data.updated} updated)`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusyA(false); }
  };
  const lookup = async () => {
    setBusyD(true); setDoiRes(null);
    try {
      const r = await api.post(`/phase2/${iid}/prism/doi-lookup`, { doi });
      setDoiRes(r.data); toast.success("DOI resolved via CrossRef");
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusyD(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="PRISM" title="OpenAlex publication sync" testid="prism-openalex-panel">
        <p className="text-xs text-muted-foreground mb-2">Idempotent upsert into prism_publications by openalex_id. Updates citation counts on re-sync.</p>
        <Label className="text-xs">Author name</Label>
        <Input value={author} onChange={(e) => setAuthor(e.target.value)} data-testid="prism-author-input" />
        <Button onClick={sync} disabled={busyA} className="w-full mt-2" data-testid="prism-sync-btn">{busyA ? "Querying OpenAlex…" : "Sync from OpenAlex"}</Button>
        {syncRes && (
          <div className="mt-3 text-xs space-y-2" data-testid="prism-sync-result">
            <div className="flex justify-between"><span>Matched</span><Badge>{syncRes.matched_author || "—"}</Badge></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Kpi label="New" value={syncRes.inserted} testid="prism-sync-new" />
              <Kpi label="Updated" value={syncRes.updated} testid="prism-sync-updated" />
              <Kpi label="Total" value={syncRes.total_synced} testid="prism-sync-total" />
            </div>
            <ul className="space-y-1 mt-2" data-testid="prism-sync-works">
              {(syncRes.works || []).slice(0, 5).map((w, i) => (
                <li key={i} className="flex justify-between border-b last:border-0 pb-1">
                  <span className="truncate pr-2">{w.title}</span>
                  <span className="font-mono text-[10px] whitespace-nowrap">{w.year} · {w.citations} cit</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel eyebrow="PRISM" title="CrossRef DOI resolver" testid="prism-doi-panel">
        <p className="text-xs text-muted-foreground mb-2">Look up any DOI and read structured metadata + citation count from CrossRef.</p>
        <Label className="text-xs">DOI</Label>
        <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/yyyy" data-testid="prism-doi-input" />
        <Button onClick={lookup} disabled={busyD} className="w-full mt-2" data-testid="prism-doi-btn">{busyD ? "Resolving…" : "Resolve DOI"}</Button>
        {doiRes && (
          <div className="mt-3 text-xs space-y-1" data-testid="prism-doi-result">
            <div className="font-medium text-sm">{doiRes.title}</div>
            <div className="text-muted-foreground">{(doiRes.authors || []).slice(0, 4).join(", ")}{(doiRes.authors || []).length > 4 ? " et al" : ""}</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Kpi label="Year" value={doiRes.year || "—"} testid="prism-doi-year" />
              <Kpi label="Venue" value={(doiRes.venue || "—").slice(0, 12)} testid="prism-doi-venue" />
              <Kpi label="Citations" value={doiRes.citations} testid="prism-doi-citations" />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============== ALUMNI360 ==============
function AlumniTab({ iid }) {
  const [dir, setDir] = useState([]);
  const [enr, setEnr] = useState([]);
  const [utm, setUtm] = useState(null);
  const [campaign, setCampaign] = useState("giving_day_2026");
  const [source, setSource] = useState("email");
  const [pickId, setPickId] = useState("");
  const refresh = async () => {
    const [d, e, u] = await Promise.all([
      api.get(`/alumni/${iid}/directory`),
      api.get(`/phase2/${iid}/alumni/enrichment`),
      api.get(`/phase2/${iid}/alumni/utm-summary`),
    ]);
    const items = Array.isArray(d.data) ? d.data : d.data.items || [];
    setDir(items); setEnr(e.data || []); setUtm(u.data);
    if (!pickId && items.length) setPickId(items[0].id);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const enrich = async () => {
    if (!pickId) return;
    try {
      const r = await api.post(`/phase2/${iid}/alumni/enrich-profile`, { alumni_id: pickId });
      toast.success(`Enriched · ${r.data.industries.join(", ")} · ${r.data.seniority}`);
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  const click = async () => {
    try {
      await api.post(`/phase2/${iid}/alumni/utm-click`, { campaign, source });
      toast.success("UTM click logged"); refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ALUMNI360" title="Profile enrichment" testid="al-enrich-panel">
        <p className="text-xs text-muted-foreground mb-2">Deterministic industry / seniority / skill inference from current_role + current_company + graduation_year.</p>
        <Label className="text-xs">Alumni</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background" value={pickId} onChange={(e) => setPickId(e.target.value)} data-testid="al-enrich-select">
          {dir.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.current_role || ""} · {a.current_company || ""}</option>)}
        </select>
        <Button onClick={enrich} className="w-full mt-2" data-testid="al-enrich-btn">Enrich profile</Button>
        <div className="mt-3 text-xs">
          <div className="label-eyebrow mb-2">Recently enriched ({enr.length})</div>
          <ItemList
            testid="al-enrich-list"
            items={enr.slice(0, 8).map((e) => ({
              id: e.alumni_id,
              title: e.alumni_id,
              meta: `${(e.industries || []).join(", ")} · ${e.years_experience}y exp`,
              right: e.seniority,
            }))}
          />
        </div>
      </Panel>
      <Panel eyebrow="ALUMNI360" title="UTM campaign click tracker" testid="al-utm-panel" className="lg:col-span-2">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <Label className="text-xs">Campaign</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} data-testid="al-utm-campaign" />
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} data-testid="al-utm-source" />
          </div>
          <div className="flex items-end">
            <Button onClick={click} className="w-full" data-testid="al-utm-btn">Log click</Button>
          </div>
        </div>
        {utm && (
          <>
            <Kpi label="Total clicks" value={utm.total_clicks} testid="al-utm-total" />
            <div className="mt-3 space-y-2" data-testid="al-utm-summary">
              {(utm.by_campaign || []).map((c) => (
                <div key={c.campaign} className="border-b last:border-0 pb-2">
                  <div className="flex justify-between text-sm font-medium"><span>{c.campaign}</span><span className="tabular-nums">{c.clicks}</span></div>
                  <div className="flex gap-2 mt-1">
                    {Object.entries(c.sources).map(([s, n]) => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}: {n}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

// ============== FACULTY+ ==============
function FacultyTab({ iid }) {
  const [loads, setLoads] = useState("Suresh:24\nKumar:12\nRavi:18\nAnitha:20");
  const [target, setTarget] = useState(18);
  const [plan, setPlan] = useState(null);
  const [pr, setPr] = useState({ faculty_id: "fac-001", faculty_name: "Dr Suresh", reviewer_role: "peer", teaching: 4, research: 4, mentorship: 4, collaboration: 4, comment: "" });
  const [summary, setSummary] = useState(null);

  const optimise = async () => {
    const list = loads.split("\n").map((ln, i) => {
      const [name, h] = ln.split(":");
      if (!name) return null;
      return { faculty_id: `f${i + 1}`, name: name.trim(), hours_assigned: parseFloat(h || "0") };
    }).filter(Boolean);
    try {
      const r = await api.post(`/phase2/${iid}/faculty/workload-optimise`, { faculty_loads: list, target_hours_per_week: parseFloat(target) });
      setPlan(r.data); toast.success(`Variance ${r.data.variance} · avg ${r.data.cohort_avg}h`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const submitReview = async () => {
    try {
      await api.post(`/phase2/${iid}/faculty/peer-review`, pr);
      toast.success("Review submitted");
      const r = await api.get(`/phase2/${iid}/faculty/peer-review/${pr.faculty_id}`);
      setSummary(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  const fetchSummary = async () => {
    try { const r = await api.get(`/phase2/${iid}/faculty/peer-review/${pr.faculty_id}`); setSummary(r.data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { fetchSummary().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="FACULTY+" title="Workload optimiser" testid="fac-workload-panel">
        <p className="text-xs text-muted-foreground mb-2">Enter `Name:hours` per line. Bands: overloaded &gt; 115% · balanced · underloaded &lt; 85% of target.</p>
        <Label className="text-xs">Loads</Label>
        <textarea
          className="w-full text-xs border rounded p-2 h-24 bg-background font-mono"
          value={loads} onChange={(e) => setLoads(e.target.value)}
          data-testid="fac-workload-input"
        />
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <Label className="text-xs">Target h/wk</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="fac-workload-target" />
          </div>
          <Button onClick={optimise} className="self-end" data-testid="fac-workload-btn">Optimise</Button>
        </div>
        {plan && (
          <div className="mt-3 text-xs space-y-2" data-testid="fac-workload-result">
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Faculty" value={plan.n_faculty} testid="fac-workload-n" />
              <Kpi label="Avg h/wk" value={plan.cohort_avg} testid="fac-workload-avg" />
              <Kpi label="Variance" value={plan.variance} testid="fac-workload-variance" />
            </div>
            <ul className="space-y-1.5 mt-2" data-testid="fac-workload-list">
              {plan.plan.map((p) => (
                <li key={p.faculty_id} className="flex items-center gap-2 border-b last:border-0 pb-1.5">
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">{p.current_hours}h</span>
                  <Badge variant={p.band === "overloaded" ? "destructive" : p.band === "balanced" ? "default" : "outline"} className="text-[10px]">{p.band}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel eyebrow="FACULTY+" title="360° peer review" testid="fac-review-panel">
        <p className="text-xs text-muted-foreground mb-2">Submit a 1–5 rating across 4 dimensions. Composite = simple average.</p>
        <Label className="text-xs">Faculty ID</Label>
        <Input value={pr.faculty_id} onChange={(e) => setPr({ ...pr, faculty_id: e.target.value })} data-testid="fac-review-faculty-id" />
        <Label className="text-xs mt-2">Faculty name</Label>
        <Input value={pr.faculty_name} onChange={(e) => setPr({ ...pr, faculty_name: e.target.value })} data-testid="fac-review-faculty-name" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {["teaching", "research", "mentorship", "collaboration"].map((k) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k}</Label>
              <Input type="number" min="1" max="5" value={pr[k]} onChange={(e) => setPr({ ...pr, [k]: parseInt(e.target.value, 10) })} data-testid={`fac-review-${k}`} />
            </div>
          ))}
        </div>
        <Button onClick={submitReview} className="w-full mt-2" data-testid="fac-review-submit">Submit review</Button>
        {summary && (
          <div className="mt-3 text-xs space-y-2" data-testid="fac-review-summary">
            <div className="flex justify-between">
              <span>{summary.n_reviews} reviews</span>
              <Badge>{summary.overall_composite}/5</Badge>
            </div>
            <ul className="space-y-1">
              {Object.entries(summary.by_dim || {}).map(([d, v]) => (
                <li key={d} className="flex items-center gap-2">
                  <span className="w-24 capitalize">{d}</span>
                  <MiniBar value={v} max={5} />
                  <span className="tabular-nums w-8 text-right">{v}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap mt-1">
              {(summary.by_role || []).map((r) => (
                <Badge key={r.role} variant="outline" className="text-[10px]">{r.role}: {r.composite} (n={r.n})</Badge>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============== GUARDIAN ==============
function GuardianTab({ iid }) {
  const [evt, setEvt] = useState({
    camera_id: "CAM-GATE-01", location: "Main Gate", detection_type: "intrusion",
    severity: "high", confidence: 0.92,
  });
  const [events, setEvents] = useState([]);
  const refresh = async () => {
    try { const r = await api.get(`/phase2/${iid}/guardian/yolov8-detect`); setEvents(r.data || []); }
    catch { /* empty */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [iid]);

  const ingest = async () => {
    try {
      const r = await api.post(`/phase2/${iid}/guardian/yolov8-detect`, {
        ...evt, confidence: parseFloat(evt.confidence),
      });
      toast.success(r.data.auto_escalated ? `Auto-escalated → incident ${r.data.incident_id}` : "Detection logged (no escalation)");
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const escalated = events.filter((e) => e.severity === "high" || e.severity === "critical").length;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="GUARDIAN" title="YOLOv8 detection webhook" testid="gd-yolo-panel">
        <p className="text-xs text-muted-foreground mb-2">External YOLO workers POST here. Auto-creates an incident when severity ≥ medium AND confidence ≥ 0.6.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Camera</Label>
            <Input value={evt.camera_id} onChange={(e) => setEvt({ ...evt, camera_id: e.target.value })} data-testid="gd-yolo-camera" />
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input value={evt.location} onChange={(e) => setEvt({ ...evt, location: e.target.value })} data-testid="gd-yolo-location" />
          </div>
          <div>
            <Label className="text-xs">Detection</Label>
            <select className="w-full text-xs border rounded p-1.5 bg-background" value={evt.detection_type} onChange={(e) => setEvt({ ...evt, detection_type: e.target.value })} data-testid="gd-yolo-type">
              {["intrusion", "crowd", "fire", "fall", "weapon", "loitering", "other"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <select className="w-full text-xs border rounded p-1.5 bg-background" value={evt.severity} onChange={(e) => setEvt({ ...evt, severity: e.target.value })} data-testid="gd-yolo-severity">
              {["info", "low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Confidence (0..1)</Label>
            <Input type="number" step="0.01" min="0" max="1" value={evt.confidence} onChange={(e) => setEvt({ ...evt, confidence: e.target.value })} data-testid="gd-yolo-confidence" />
          </div>
        </div>
        <Button onClick={ingest} className="w-full mt-2" data-testid="gd-yolo-btn">Ingest detection</Button>
      </Panel>
      <Panel eyebrow="GUARDIAN" title="YOLO event stream" testid="gd-yolo-stream-panel">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Kpi label="Total events" value={events.length} testid="gd-yolo-total" />
          <Kpi label="Escalated" value={escalated} testid="gd-yolo-escalated" />
        </div>
        <ItemList
          testid="gd-yolo-list"
          items={events.slice(0, 12).map((e) => ({
            id: e.id,
            title: `${e.detection_type.toUpperCase()} · ${e.camera_id}`,
            meta: `${e.location} · conf ${e.confidence}`,
            right: e.severity,
          }))}
        />
      </Panel>
    </div>
  );
}
