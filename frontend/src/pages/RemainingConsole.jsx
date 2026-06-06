import React, { useEffect, useState } from "react";
import {
  Briefcase, Award, Crown, GraduationCap, BookOpen,
  HeartHandshake, Users, Shield, Leaf, Sparkles,
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

const PIcon = ({ I, ...r }) => <I className="h-3.5 w-3.5 mr-1.5" {...r} />;

export default function RemainingConsole() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="remaining-console-page">
      <PageHeader
        eyebrow="Bulk closeout · 9 platforms"
        title={`${current.short_name} · Cross-platform deepening`}
        description="Audit-blind closure for PATHFINDER, COMPASS, COMMAND, ILLUMINATE, PRISM, ALUMNI360, FACULTY+, GUARDIAN, GREENIQ — high-value endpoints in one console."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />Bulk+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="cmd" className="space-y-6">
          <TabsList data-testid="bulk-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="cmd" data-testid="bulk-tab-cmd"><PIcon I={Crown} />COMMAND</TabsTrigger>
            <TabsTrigger value="path" data-testid="bulk-tab-path"><PIcon I={Briefcase} />PATHFINDER</TabsTrigger>
            <TabsTrigger value="cmp" data-testid="bulk-tab-cmp"><PIcon I={Award} />COMPASS</TabsTrigger>
            <TabsTrigger value="ill" data-testid="bulk-tab-ill"><PIcon I={BookOpen} />ILLUMINATE</TabsTrigger>
            <TabsTrigger value="prsm" data-testid="bulk-tab-prsm"><PIcon I={Sparkles} />PRISM</TabsTrigger>
            <TabsTrigger value="alm" data-testid="bulk-tab-alm"><PIcon I={HeartHandshake} />ALUMNI</TabsTrigger>
            <TabsTrigger value="fac" data-testid="bulk-tab-fac"><PIcon I={Users} />FACULTY+</TabsTrigger>
            <TabsTrigger value="gd" data-testid="bulk-tab-gd"><PIcon I={Shield} />GUARDIAN</TabsTrigger>
            <TabsTrigger value="gr" data-testid="bulk-tab-gr"><PIcon I={Leaf} />GREENIQ</TabsTrigger>
          </TabsList>
          <TabsContent value="cmd"><CmdTab iid={current.id} /></TabsContent>
          <TabsContent value="path"><PathTab iid={current.id} /></TabsContent>
          <TabsContent value="cmp"><CmpTab iid={current.id} /></TabsContent>
          <TabsContent value="ill"><IllTab iid={current.id} /></TabsContent>
          <TabsContent value="prsm"><PrsmTab iid={current.id} /></TabsContent>
          <TabsContent value="alm"><AlmTab iid={current.id} /></TabsContent>
          <TabsContent value="fac"><FacTab iid={current.id} /></TabsContent>
          <TabsContent value="gd"><GdTab iid={current.id} /></TabsContent>
          <TabsContent value="gr"><GrTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CmdTab({ iid }) {
  const [kpi, setKpi] = useState(null);
  const [deck, setDeck] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/closeout/${iid}/command/kpi-stream`).then(r => setKpi(r.data)); }, [iid]);
  const gen = async () => {
    setBusy(true);
    try { const r = await api.post(`/closeout/${iid}/command/board-deck`, { quarter: "Q4 2026", audience: "board" }); setDeck(r.data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="COMMAND" title="All-platform KPI stream" testid="cmd-kpi-panel">
        {kpi && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Students" value={kpi.students} testid="cmd-kpi-students" />
            <Kpi label="Leads" value={kpi.leads_total} testid="cmd-kpi-leads" />
            <Kpi label="Enrolled" value={kpi.leads_enrolled} testid="cmd-kpi-enr" />
            <Kpi label="Conv %" value={kpi.lead_to_enrol_pct} testid="cmd-kpi-conv" />
            <Kpi label="Publications" value={kpi.publications} testid="cmd-kpi-pub" />
            <Kpi label="Alumni" value={kpi.alumni} testid="cmd-kpi-alm" />
            <Kpi label="Open grievances" value={kpi.grievances_open} testid="cmd-kpi-grv" />
            <Kpi label="Open incidents" value={kpi.incidents_open} testid="cmd-kpi-inc" />
          </div>
        )}
      </Panel>
      <Panel eyebrow="COMMAND" title="AI-generated board deck" testid="cmd-deck-panel">
        <Button onClick={gen} disabled={busy} className="w-full mb-2" data-testid="cmd-deck-btn">{busy ? "Generating…" : "Generate board deck"}</Button>
        {deck && (
          <div data-testid="cmd-deck-result">
            <div className="font-medium text-sm">{deck.deck_title}</div>
            <ol className="text-xs space-y-2 mt-2">
              {deck.slides.map((s, i) => (
                <li key={i} className="border-b last:border-0 pb-2">
                  <div className="font-medium">{i + 1}. {s.title}</div>
                  <ul className="text-muted-foreground list-disc pl-4 mt-1">
                    {(s.bullets || []).slice(0, 3).map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Panel>
    </div>
  );
}

function PathTab({ iid }) {
  const [skills, setSkills] = useState("python, java, sql");
  const [role, setRole] = useState("swe");
  const [out, setOut] = useState(null);
  const run = async () => {
    try {
      const r = await api.post(`/closeout/${iid}/pathfinder/skill-gap`, {
        student_skills: skills.split(",").map(s => s.trim()).filter(Boolean), target_role: role,
      });
      setOut(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <Panel eyebrow="PATHFINDER" title="Skill-gap radar" testid="path-gap-panel">
      <Label className="text-xs">Student skills (comma)</Label>
      <Input value={skills} onChange={(e) => setSkills(e.target.value)} data-testid="path-skills" />
      <Label className="text-xs mt-2">Target role</Label>
      <select className="w-full text-xs border rounded p-1.5 bg-background" value={role} onChange={(e) => setRole(e.target.value)} data-testid="path-role">
        {["swe", "data_scientist", "frontend", "backend", "devops", "qa"].map(r => <option key={r}>{r}</option>)}
      </select>
      <Button onClick={run} className="w-full mt-2" data-testid="path-btn">Compute gap</Button>
      {out && (
        <div className="mt-3 grid grid-cols-3 gap-2" data-testid="path-result">
          <Kpi label="Coverage" value={`${out.coverage_pct}%`} testid="path-cov" />
          <Kpi label="Missing" value={out.missing.length} testid="path-miss" />
          <Kpi label="Band" value={out.readiness_band} testid="path-band" />
        </div>
      )}
    </Panel>
  );
}

function CmpTab({ iid }) {
  const [tl, setTl] = useState(null);
  useEffect(() => { api.get(`/closeout/${iid}/compass/accreditation-timeline`).then(r => setTl(r.data)); }, [iid]);
  return (
    <Panel eyebrow="COMPASS" title="Accreditation timeline" testid="cmp-tl-panel">
      {tl && (
        <ItemList
          testid="cmp-tl-list"
          items={tl.items.map((i, idx) => ({
            id: `${i.body}-${idx}`, title: `${i.body} · ${i.milestone}`,
            meta: i.due_date, right: i.band,
          }))}
        />
      )}
    </Panel>
  );
}

function IllTab({ iid }) {
  const [msg, setMsg] = useState("share answer to question 5");
  const [out, setOut] = useState(null);
  const check = async () => {
    try { setOut((await api.post(`/closeout/${iid}/illuminate/moderate`, { message: msg })).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <Panel eyebrow="ILLUMINATE" title="Discussion moderator" testid="ill-mod-panel">
      <Label className="text-xs">Message</Label>
      <Input value={msg} onChange={(e) => setMsg(e.target.value)} data-testid="ill-msg" />
      <Button onClick={check} className="w-full mt-2" data-testid="ill-btn">Moderate</Button>
      {out && (
        <div className="mt-3 text-xs" data-testid="ill-result">
          <div className="flex justify-between"><span>Decision</span><Badge variant={out.decision === "block" ? "destructive" : out.decision === "review" ? "default" : "outline"}>{out.decision}</Badge></div>
          <div className="flex flex-wrap gap-1 mt-2">{out.categories_hit.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}</div>
        </div>
      )}
    </Panel>
  );
}

function PrsmTab({ iid }) {
  const [author, setAuthor] = useState("Hinton");
  const [h, setH] = useState(null);
  const [pipe, setPipe] = useState(null);
  useEffect(() => { api.get(`/closeout/${iid}/prism/grants/pipeline`).then(r => setPipe(r.data)); }, [iid]);
  const run = async () => {
    try { setH((await api.get(`/closeout/${iid}/prism/h-index/${encodeURIComponent(author)}`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="PRISM" title="H-index computer" testid="prsm-h-panel">
        <Label className="text-xs">Author</Label>
        <Input value={author} onChange={(e) => setAuthor(e.target.value)} data-testid="prsm-author" />
        <Button onClick={run} className="w-full mt-2" data-testid="prsm-btn">Compute</Button>
        {h && (
          <div className="mt-3 grid grid-cols-2 gap-2" data-testid="prsm-h-result">
            <Kpi label="H-index" value={h.h_index} testid="prsm-h" />
            <Kpi label="i10" value={h.i10} testid="prsm-i10" />
            <Kpi label="Pubs" value={h.publications} testid="prsm-pubs" />
            <Kpi label="Citations" value={h.total_citations} testid="prsm-cit" />
          </div>
        )}
      </Panel>
      <Panel eyebrow="PRISM" title="Grant pipeline" testid="prsm-grant-panel">
        {pipe && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Total" value={pipe.total} testid="prsm-gtotal" />
            <Kpi label="Awarded ₹L" value={pipe.awarded_amount_lakhs} testid="prsm-gaward" />
          </div>
        )}
      </Panel>
    </div>
  );
}

function AlmTab({ iid }) {
  const [interests, setInterests] = useState("python, ai");
  const [out, setOut] = useState(null);
  const [sum, setSum] = useState(null);
  useEffect(() => { api.get(`/closeout/${iid}/alumni/giving/summary`).then(r => setSum(r.data)); }, [iid]);
  const run = async () => {
    try {
      const r = await api.post(`/closeout/${iid}/alumni/mentor-match`, {
        student_id: "s1", interests: interests.split(",").map(s => s.trim()), target_industry: "tech",
      });
      setOut(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="ALUMNI" title="Mentor matcher" testid="alm-match-panel">
        <Label className="text-xs">Interests (comma)</Label>
        <Input value={interests} onChange={(e) => setInterests(e.target.value)} data-testid="alm-int" />
        <Button onClick={run} className="w-full mt-2" data-testid="alm-btn">Find mentors</Button>
        {out && (
          <ItemList
            testid="alm-match-list"
            items={out.matches.map(m => ({
              id: m.alumni_id, title: m.name, meta: `${m.current_role || ""} · ${m.current_company || ""}`,
              right: m.score,
            }))}
          />
        )}
      </Panel>
      <Panel eyebrow="ALUMNI" title="Giving summary" testid="alm-giv-panel">
        {sum && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Donations" value={sum.total_donations} testid="alm-giv-n" />
              <Kpi label="Total ₹" value={sum.total_inr} testid="alm-giv-tot" />
              <Kpi label="Donors" value={sum.unique_donors} testid="alm-giv-d" />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function FacTab({ iid }) {
  const [fdp, setFdp] = useState(null);
  useEffect(() => { api.get(`/closeout/${iid}/faculty/fdp/summary`).then(r => setFdp(r.data)); }, [iid]);
  return (
    <Panel eyebrow="FACULTY+" title="FDP rollup" testid="fac-fdp-panel">
      {fdp && (
        <>
          <Kpi label="Total events" value={fdp.total_events} testid="fac-fdp-total" />
          <ItemList
            testid="fac-fdp-list"
            items={fdp.by_faculty.slice(0, 10).map(f => ({
              id: f.faculty_id, title: f.name || f.faculty_id,
              meta: `${f.events} events`, right: `${f.hours}h`,
            }))}
          />
        </>
      )}
    </Panel>
  );
}

function GdTab({ iid }) {
  const [dash, setDash] = useState(null);
  useEffect(() => { api.get(`/closeout/${iid}/guardian/incident-dashboard`).then(r => setDash(r.data)); }, [iid]);
  return (
    <Panel eyebrow="GUARDIAN" title="Incident dashboard" testid="gd-dash-panel">
      {dash && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Total" value={dash.total} testid="gd-total" />
            <Kpi label="Open" value={dash.open} testid="gd-open" />
          </div>
          <div className="mt-3 text-xs">
            <div className="label-eyebrow mb-1">By type</div>
            <ul className="space-y-1" data-testid="gd-type-list">
              {dash.by_type.slice(0, 8).map(t => (
                <li key={t.type} className="flex justify-between border-b last:border-0 pb-1">
                  <span>{t.type}</span><span className="tabular-nums">{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Panel>
  );
}

function GrTab({ iid }) {
  const [cf, setCf] = useState(null);
  const [esg, setEsg] = useState(null);
  useEffect(() => {
    api.get(`/closeout/${iid}/greeniq/carbon-footprint`).then(r => setCf(r.data));
    api.get(`/closeout/${iid}/greeniq/esg-composite`).then(r => setEsg(r.data));
  }, [iid]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="GREENIQ" title="Carbon footprint" testid="gr-cf-panel">
        {cf && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Grid kWh" value={cf.grid_kwh} testid="gr-grid" />
            <Kpi label="Solar kWh" value={cf.solar_kwh} testid="gr-solar" />
            <Kpi label="Emissions kg" value={cf.emissions_kg_co2e} testid="gr-em" />
            <Kpi label="Net tons" value={cf.tons_co2e} testid="gr-tons" />
          </div>
        )}
      </Panel>
      <Panel eyebrow="GREENIQ" title="ESG composite" testid="gr-esg-panel">
        {esg && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="E" value={esg.E_environment} testid="gr-e" />
            <Kpi label="S" value={esg.S_social} testid="gr-s" />
            <Kpi label="G" value={esg.G_governance} testid="gr-g" />
            <Kpi label="Band" value={esg.band} testid="gr-band" />
          </div>
        )}
      </Panel>
    </div>
  );
}
