import React, { useEffect, useState } from "react";
import {
  Sparkles, BellRing, Heart, MessageCircle, MessagesSquare, GitBranch,
  Building, Library, Megaphone, Users, Calendar, TrendingDown, Mic,
  Briefcase, Target, BarChart, Award, ScrollText, AlertCircle, Coins,
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
 * Phase 1 Complete — single console exposing the 25 endpoints that close
 * the remaining feature bullets from the original VCE Build Plan across
 * VEDA / ARISE / NEXUS / PATHFINDER / COMPASS / COMMAND. Each tab is a
 * thin form + list pair over the corresponding routes in routes_phase1_complete.py.
 */
export default function Phase1Complete() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="phase1-complete-page">
      <PageHeader
        eyebrow="Phase 1 · Completion sprint"
        title={`${current.short_name} · Build Plan closeout`}
        description="The remaining Phase-1 feature bullets from the VCE Build Plan — each tenant-isolated, audit-logged and pulling live data."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />Phase 1+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="veda" className="space-y-6">
          <TabsList data-testid="p1-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="veda" data-testid="p1-tab-veda">VEDA</TabsTrigger>
            <TabsTrigger value="arise" data-testid="p1-tab-arise">ARISE</TabsTrigger>
            <TabsTrigger value="nexus" data-testid="p1-tab-nexus">NEXUS</TabsTrigger>
            <TabsTrigger value="pathfinder" data-testid="p1-tab-pathfinder">PATHFINDER</TabsTrigger>
            <TabsTrigger value="compass" data-testid="p1-tab-compass">COMPASS</TabsTrigger>
            <TabsTrigger value="command" data-testid="p1-tab-command">COMMAND</TabsTrigger>
          </TabsList>
          <TabsContent value="veda"><VedaTab iid={current.id} /></TabsContent>
          <TabsContent value="arise"><AriseTab iid={current.id} /></TabsContent>
          <TabsContent value="nexus"><NexusTab iid={current.id} /></TabsContent>
          <TabsContent value="pathfinder"><PathfinderTab iid={current.id} /></TabsContent>
          <TabsContent value="compass"><CompassTab iid={current.id} /></TabsContent>
          <TabsContent value="command"><CommandTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Lightweight reusable form + list pattern
function MiniForm({ fields, onSubmit, btnLabel = "Submit", testid }) {
  const [draft, setDraft] = useState(Object.fromEntries(fields.map((f) => [f.k, f.default ?? ""])));
  return (
    <div className="space-y-2" data-testid={testid}>
      {fields.map((f) => (
        <div key={f.k}>
          <Label className="text-xs">{f.label}</Label>
          <Input
            type={f.type || "text"}
            value={draft[f.k]}
            onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
            placeholder={f.placeholder}
            data-testid={`${testid}-${f.k}`}
          />
        </div>
      ))}
      <Button size="sm" className="w-full mt-2" onClick={() => onSubmit(draft, () => setDraft(Object.fromEntries(fields.map((f) => [f.k, f.default ?? ""]))))} data-testid={`${testid}-submit`}>{btnLabel}</Button>
    </div>
  );
}

// ============== VEDA ==============
function VedaTab({ iid }) {
  const [alerts, setAlerts] = useState([]);
  const [sent, setSent] = useState([]);
  const [gaps, setGaps] = useState([]);
  const refresh = async () => {
    const [a, s, g] = await Promise.all([
      api.get(`/phase1/${iid}/veda/alerts`),
      api.get(`/phase1/${iid}/veda/sentiment?only_flagged=true`),
      api.get(`/phase1/${iid}/veda/query-gap`),
    ]);
    setAlerts(a.data || []); setSent(s.data || []); setGaps(g.data || []);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="VEDA" title="Proactive alerts" testid="veda-alerts">
        <MiniForm
          testid="veda-alert-form"
          fields={[
            { k: "audience", label: "Audience", placeholder: "student | faculty | parent | admin", default: "student" },
            { k: "title", label: "Title" },
            { k: "body", label: "Body" },
          ]}
          btnLabel="Push alert"
          onSubmit={async (d, reset) => {
            try { await api.post(`/phase1/${iid}/veda/alerts`, d); toast.success("Alert pushed"); reset(); refresh(); }
            catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="veda-alert-list" items={alerts.slice(0, 8).map((a) => ({ id: a.id, title: a.title, meta: a.body, right: a.audience }))} />
      </Panel>
      <Panel eyebrow="VEDA" title="Counsellor-flagged sentiment" testid="veda-sentiment">
        <p className="text-xs text-muted-foreground mb-2">Logs scoring &le; -0.5 are auto-flagged.</p>
        <ItemList testid="veda-sent-list" items={sent.map((s) => ({ id: s.id, title: s.student_id, meta: s.message, right: s.score.toFixed(2) }))} />
      </Panel>
      <Panel eyebrow="VEDA" title="KB gap queries" testid="veda-gaps">
        <p className="text-xs text-muted-foreground mb-2">Unanswered queries surface here for KB curation.</p>
        <ItemList testid="veda-gap-list" items={gaps.slice(0, 10).map((g) => ({ id: g.id, title: g.query, meta: g.asked_by, right: (g.logged_at || "").slice(0, 10) }))} />
      </Panel>
    </div>
  );
}

// ============== ARISE ==============
function AriseTab({ iid }) {
  const [drips, setDrips] = useState([]);
  const [match, setMatch] = useState(null);
  const [text, setText] = useState("I love building software and ML models");
  const refresh = async () => {
    const r = await api.get(`/phase1/${iid}/arise/drip`);
    setDrips(r.data || []);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);
  const doMatch = async () => {
    try { const r = await api.post(`/phase1/${iid}/arise/program-match`, { aptitude_text: text, interests: [] }); setMatch(r.data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ARISE" title="Drip campaign log" testid="arise-drip-panel">
        <MiniForm
          testid="arise-drip-form"
          fields={[
            { k: "lead_id", label: "Lead ID" },
            { k: "channel", label: "Channel", placeholder: "whatsapp | sms | email", default: "whatsapp" },
            { k: "template", label: "Template" },
          ]}
          btnLabel="Dispatch"
          onSubmit={async (d, reset) => {
            try { await api.post(`/phase1/${iid}/arise/drip`, d); toast.success("Dispatched"); reset(); refresh(); }
            catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="arise-drip-list" items={drips.slice(0, 8).map((d) => ({ id: d.id, title: d.lead_name || d.lead_id, meta: d.template, right: d.channel }))} />
      </Panel>
      <Panel eyebrow="ARISE" title="Program matcher" testid="arise-match-panel">
        <Label className="text-xs">Describe aptitude / interests</Label>
        <Input value={text} onChange={(e) => setText(e.target.value)} data-testid="arise-match-input" />
        <Button size="sm" onClick={doMatch} className="w-full mt-2" data-testid="arise-match-btn">Match</Button>
        {match?.ranked && (
          <ul className="mt-3 space-y-1 text-xs" data-testid="arise-match-list">
            {match.ranked.slice(0, 5).map((r) => (
              <li key={r.code} className="flex justify-between"><span className="font-medium">{r.code} · {r.name}</span><Badge variant="outline" className="text-[10px]">{r.score}</Badge></li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel eyebrow="ARISE" title="Application status lookup" testid="arise-status-panel">
        <ApplicationStatus iid={iid} />
      </Panel>
    </div>
  );
}
function ApplicationStatus({ iid }) {
  const [lid, setLid] = useState("");
  const [res, setRes] = useState(null);
  return (
    <>
      <Label className="text-xs">Lead ID</Label>
      <Input value={lid} onChange={(e) => setLid(e.target.value)} data-testid="arise-status-input" />
      <Button size="sm" className="w-full mt-2" data-testid="arise-status-btn" onClick={async () => {
        try { const r = await api.get(`/phase1/${iid}/arise/application-status/${lid}`); setRes(r.data); }
        catch (e) { setRes(null); toast.error("Not found"); }
      }}>Lookup</Button>
      {res && <pre className="mt-3 text-[10px] bg-muted/30 p-2 rounded font-mono" data-testid="arise-status-result">{JSON.stringify(res, null, 2)}</pre>}
    </>
  );
}

// ============== NEXUS ==============
function NexusTab({ iid }) {
  const [hostel, setHostel] = useState([]);
  const [notices, setNotices] = useState([]);
  const [defs, setDefs] = useState([]);
  const refresh = async () => {
    const [h, n, d] = await Promise.all([
      api.get(`/phase1/${iid}/nexus/hostel`),
      api.get(`/phase1/${iid}/nexus/notices`),
      api.get(`/phase1/${iid}/nexus/defaulters`),
    ]);
    setHostel(h.data || []); setNotices(n.data || []); setDefs(d.data || []);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="NEXUS" title="Hostel allocation" testid="nexus-hostel-panel">
        <MiniForm
          testid="nexus-hostel-form"
          fields={[
            { k: "student_id", label: "Student ID" },
            { k: "student_name", label: "Student name" },
            { k: "room_no", label: "Room no" },
            { k: "block", label: "Block" },
          ]}
          btnLabel="Allocate"
          onSubmit={async (d, reset) => {
            try { await api.post(`/phase1/${iid}/nexus/hostel`, { ...d, preference_score: 50 }); toast.success("Allocated"); reset(); refresh(); }
            catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="nexus-hostel-list" items={hostel.slice(0, 10).map((h) => ({ id: h.id, title: h.student_name, meta: `Block ${h.block} · Room ${h.room_no}`, right: h.preference_score }))} />
      </Panel>
      <Panel eyebrow="NEXUS" title="Digital noticeboard" testid="nexus-notice-panel">
        <MiniForm
          testid="nexus-notice-form"
          fields={[
            { k: "title", label: "Title" },
            { k: "body", label: "Body" },
            { k: "audience", label: "Audience", default: "all" },
          ]}
          btnLabel="Post notice"
          onSubmit={async (d, reset) => {
            try { await api.post(`/phase1/${iid}/nexus/notices`, d); toast.success("Posted"); reset(); refresh(); }
            catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="nexus-notice-list" items={notices.slice(0, 8).map((n) => ({ id: n.id, title: n.title, meta: n.body, right: n.audience }))} />
      </Panel>
      <Panel eyebrow="NEXUS" title="Fee defaulter prediction" testid="nexus-default-panel" className="lg:col-span-2">
        <p className="text-xs text-muted-foreground mb-2">Heuristic risk score: 60 for past-due + (1-paid_ratio)×40. Sorted desc.</p>
        <ItemList testid="nexus-default-list" items={defs.slice(0, 10).map((d) => ({ id: d.fee_id, title: d.student_name, meta: `outstanding ₹${d.outstanding}`, right: `risk ${d.risk_score}` }))} />
      </Panel>
    </div>
  );
}

// ============== PATHFINDER ==============
function PathfinderTab({ iid }) {
  const [intel, setIntel] = useState([]);
  const [trends, setTrends] = useState(null);
  const [mi, setMi] = useState(null);
  const refresh = async () => {
    const [c, t] = await Promise.all([
      api.get(`/phase1/${iid}/pathfinder/company-intel`),
      api.get(`/phase1/${iid}/pathfinder/industry-trends`),
    ]);
    setIntel(c.data || []); setTrends(t.data || null);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="PATHFINDER" title="Mock interview" testid="pf-mi-panel">
        <MiniForm
          testid="pf-mi-form"
          fields={[
            { k: "student_id", label: "Student ID" },
            { k: "student_name", label: "Student name" },
            { k: "target_company", label: "Target company", default: "Google" },
            { k: "answers", label: "Answers (| separated)", placeholder: "I led a team that..." },
          ]}
          btnLabel="Score interview"
          onSubmit={async (d, reset) => {
            try {
              const r = await api.post(`/phase1/${iid}/pathfinder/mock-interview`, {
                ...d, answers: (d.answers || "").split("|").map((s) => s.trim()).filter(Boolean),
              });
              setMi(r.data); toast.success(`Readiness ${r.data.readiness} · ${r.data.band}`); reset();
            } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        {mi && (
          <div className="mt-3 text-xs space-y-1" data-testid="pf-mi-result">
            <div className="flex justify-between"><span>Readiness</span><span className="font-mono">{mi.readiness}/100</span></div>
            <div className="flex justify-between"><span>Band</span><Badge>{mi.band}</Badge></div>
          </div>
        )}
      </Panel>
      <Panel eyebrow="PATHFINDER" title="Company intelligence" testid="pf-intel-panel">
        <MiniForm
          testid="pf-intel-form"
          fields={[
            { k: "name", label: "Company" },
            { k: "sector", label: "Sector" },
            { k: "interview_pattern", label: "Interview pattern" },
            { k: "prep_tip", label: "Prep tip" },
          ]}
          btnLabel="Add intel"
          onSubmit={async (d, reset) => {
            try { await api.post(`/phase1/${iid}/pathfinder/company-intel`, { ...d, avg_package_lpa: 0 }); toast.success("Added"); reset(); refresh(); }
            catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="pf-intel-list" items={intel.slice(0, 8).map((i) => ({ id: i.id, title: i.name, meta: i.interview_pattern, right: i.sector }))} />
      </Panel>
      <Panel eyebrow="PATHFINDER" title="Industry trends" testid="pf-trends-panel">
        {!trends ? null : (
          <div className="space-y-3" data-testid="pf-trends-content">
            <div>
              <div className="label-eyebrow mb-2">Top hiring roles</div>
              <ul className="space-y-1 text-xs">{(trends.top_roles || []).map((r) => <li key={r.role} className="flex justify-between"><span>{r.role}</span><Badge variant="outline" className="text-[10px]">{r.drives}</Badge></li>)}</ul>
            </div>
            <div>
              <div className="label-eyebrow mb-2">Top mentioned skills</div>
              <ul className="space-y-1 text-xs">{(trends.top_skills || []).map((s) => <li key={s.skill} className="flex justify-between"><span>{s.skill}</span><Badge variant="outline" className="text-[10px]">{s.mentions}</Badge></li>)}</ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============== COMPASS ==============
function CompassTab({ iid }) {
  const [obe, setObe] = useState(null);
  const [meets, setMeets] = useState([]);
  const [nirf, setNirf] = useState(null);
  const [gaps, setGaps] = useState(null);
  const refresh = async () => {
    const [o, m, n, g] = await Promise.all([
      api.get(`/phase1/${iid}/compass/obe/summary`),
      api.get(`/phase1/${iid}/compass/iqac-meetings`),
      api.get(`/phase1/${iid}/compass/nirf`),
      api.get(`/phase1/${iid}/compass/gap-analysis`),
    ]);
    setObe(o.data); setMeets(m.data || []); setNirf(n.data); setGaps(g.data);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="COMPASS" title="OBE attainment" testid="compass-obe-panel">
        <MiniForm
          testid="compass-obe-form"
          fields={[
            { k: "course_id", label: "Course ID" },
            { k: "co_id", label: "CO ID" },
            { k: "po_ids", label: "PO IDs (csv)", default: "PO1,PO2" },
            { k: "attainment_pct", label: "Attainment %", type: "number" },
          ]}
          btnLabel="Save attainment"
          onSubmit={async (d, reset) => {
            try {
              await api.post(`/phase1/${iid}/compass/obe`, {
                ...d, attainment_pct: parseFloat(d.attainment_pct),
                po_ids: (d.po_ids || "").split(",").map((s) => s.trim()).filter(Boolean),
              });
              toast.success("Saved"); reset(); refresh();
            } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        {obe && (
          <div className="mt-3 text-xs" data-testid="compass-obe-summary">
            <div className="flex justify-between mb-1"><span>Avg attainment</span><Badge>{obe.avg_attainment}%</Badge></div>
            <ul className="space-y-1">{(obe.po_rollup || []).map((p) => <li key={p.po} className="flex justify-between"><span>{p.po}</span><span className="font-mono">{p.avg}% · n={p.n}</span></li>)}</ul>
          </div>
        )}
      </Panel>
      <Panel eyebrow="COMPASS" title="IQAC meetings" testid="compass-iqac-panel">
        <MiniForm
          testid="compass-iqac-form"
          fields={[
            { k: "title", label: "Title" },
            { k: "date", label: "Date", type: "date" },
            { k: "agenda", label: "Agenda (| separated)" },
          ]}
          btnLabel="Record meeting"
          onSubmit={async (d, reset) => {
            try {
              await api.post(`/phase1/${iid}/compass/iqac-meetings`, {
                ...d, agenda: (d.agenda || "").split("|").map((s) => s.trim()).filter(Boolean),
              });
              toast.success("Recorded"); reset(); refresh();
            } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
          }}
        />
        <ItemList testid="compass-iqac-list" items={meets.slice(0, 8).map((m) => ({ id: m.id, title: m.title, meta: (m.agenda || []).slice(0, 2).join(" · "), right: m.date }))} />
      </Panel>
      {nirf && (
        <Panel eyebrow="COMPASS" title="NIRF auto-compile" testid="compass-nirf-panel" className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs" data-testid="compass-nirf-content">
            {Object.entries(nirf).filter(([k]) => ["TLR", "RP", "GO", "OI", "PR"].includes(k)).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border bg-card p-2">
                <div className="label-eyebrow">{k}</div>
                <ul className="mt-1 space-y-0.5">{Object.entries(v).map(([kk, vv]) => <li key={kk} className="flex justify-between"><span className="text-muted-foreground">{kk}</span><span className="font-mono">{String(vv)}</span></li>)}</ul>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {gaps && (
        <Panel eyebrow="COMPASS" title="Gap analysis" testid="compass-gap-panel" className="lg:col-span-2">
          <ul className="space-y-2 text-sm" data-testid="compass-gap-list">{(gaps.gaps || []).map((g, i) => (
            <li key={i} className={`rounded-md border p-2 ${g.severity === "high" ? "bg-rose-500/10 border-rose-200" : g.severity === "medium" ? "bg-amber-500/10 border-amber-200" : "bg-emerald-600/10 border-emerald-200"}`}>
              <div className="flex justify-between"><span className="font-medium">{g.area}</span><Badge variant="outline" className="text-[10px]">{g.severity}</Badge></div>
              <div className="text-xs text-muted-foreground mt-0.5">{g.msg}</div>
            </li>
          ))}</ul>
        </Panel>
      )}
    </div>
  );
}

// ============== COMMAND ==============
function CommandTab({ iid }) {
  const [fin, setFin] = useState(null);
  const [bench, setBench] = useState(null);
  useEffect(() => {
    Promise.all([api.get(`/phase1/${iid}/command/finance`), api.get(`/phase1/${iid}/command/benchmark`)])
      .then(([f, b]) => { setFin(f.data); setBench(b.data); })
      .catch(() => {});
  }, [iid]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {fin && (
        <Panel eyebrow="COMMAND" title="Finance deep-dive" testid="cmd-fin-panel">
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <Kpi label="Billed" value={`₹${fin.billed.toLocaleString()}`} testid="cmd-fin-billed" />
            <Kpi label="Collected" value={`₹${fin.collected.toLocaleString()}`} hint={`${fin.collection_pct}%`} testid="cmd-fin-collected" />
          </div>
          <div className="label-eyebrow mb-2">By term</div>
          <ul className="space-y-1 text-xs" data-testid="cmd-fin-terms">
            {(fin.by_term || []).map((t) => (<li key={t.term} className="flex justify-between"><span>{t.term}</span><span className="font-mono">{t.collection_pct}% (₹{t.collected.toLocaleString()})</span></li>))}
          </ul>
        </Panel>
      )}
      {bench && (
        <Panel eyebrow="COMMAND" title={`Benchmark vs ${bench.peers_compared} peer tenant(s)`} testid="cmd-bench-panel">
          <ul className="space-y-3 text-xs" data-testid="cmd-bench-list">
            {Object.keys(bench.tenant_metrics).map((k) => {
              const mine = bench.tenant_metrics[k];
              const peer = bench.peer_average[k];
              const max = Math.max(mine, peer, 1) * 1.2;
              return (
                <li key={k}>
                  <div className="flex justify-between mb-1"><span className="font-medium capitalize">{k.replace(/_/g, " ")}</span><span className="font-mono">{mine} <span className="text-muted-foreground">vs peer {peer}</span></span></div>
                  <MiniBar value={mine} max={max} />
                  <MiniBar value={peer} max={max} color="hsl(35, 92%, 55%)" />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
