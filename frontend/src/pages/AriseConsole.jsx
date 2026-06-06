import React, { useEffect, useState } from "react";
import {
  Brain, TrendingUp, Award, MessageCircle, BarChart3, Layers, Sparkles,
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

const BRANCHES = ["CSE", "AIML", "DS", "ECE", "EEE", "MECH", "CIVIL"];
const GEOS = ["urban_hyd", "urban_other_ts", "ap", "other_state", "rural_ts", "unknown"];

/**
 * ARISE Intelligence Console — Phase 25 deepening.
 * 5 tabs: Lead Scorer · Enrollment Predictor · EAPCET · Source Mix · B-Category
 */
export default function AriseConsole() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="arise-console-page">
      <PageHeader
        eyebrow="ARISE · Recruitment intelligence"
        title={`${current.short_name} · ARISE deepening`}
        description="40+ feature logistic-regression lead scorer (AUC reported live), rank-aware enrollment predictor, EAPCET counseling probability, source-attribution conversion analytics, and B-category / spot allocation."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />ARISE+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="scorer" className="space-y-6">
          <TabsList data-testid="arise-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="scorer" data-testid="arise-tab-scorer"><Brain className="h-3.5 w-3.5 mr-1.5" />Lead Scorer</TabsTrigger>
            <TabsTrigger value="predict" data-testid="arise-tab-predict"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Enrollment</TabsTrigger>
            <TabsTrigger value="eapcet" data-testid="arise-tab-eapcet"><Award className="h-3.5 w-3.5 mr-1.5" />EAPCET</TabsTrigger>
            <TabsTrigger value="source" data-testid="arise-tab-source"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Source mix</TabsTrigger>
            <TabsTrigger value="bcat" data-testid="arise-tab-bcat"><Layers className="h-3.5 w-3.5 mr-1.5" />B-Category</TabsTrigger>
          </TabsList>
          <TabsContent value="scorer"><ScorerTab iid={current.id} /></TabsContent>
          <TabsContent value="predict"><PredictTab iid={current.id} /></TabsContent>
          <TabsContent value="eapcet"><EapcetTab iid={current.id} /></TabsContent>
          <TabsContent value="source"><SourceTab iid={current.id} /></TabsContent>
          <TabsContent value="bcat"><BCatTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ================ Scorer ================
function ScorerTab({ iid }) {
  const [model, setModel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(null);
  const [lead, setLead] = useState({
    name: "TestLead", phone: "9876543210", email: "a@b.com",
    preferred_branch: "CSE", eapcet_rank: 3000, budget_lakhs: 5,
    source: "EAPCET counselling", city: "Hyderabad",
  });

  const loadModel = async () => {
    try {
      const r = await api.get(`/arise/${iid}/scoring/model`);
      setModel(r.data);
    } catch (e) { if (e?.response?.status !== 404) toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadModel(); /* eslint-disable-next-line */ }, [iid]);

  const train = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/arise/${iid}/scoring/train`, { test_fraction: 0.25, epochs: 600 });
      setModel(r.data);
      toast.success(`Trained · AUC holdout ${r.data.auc_holdout.toFixed(3)} · ${r.data.feature_names.length} features`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const doScore = async () => {
    try {
      const r = await api.post(`/arise/${iid}/scoring/score`, {
        ...lead,
        eapcet_rank: parseInt(lead.eapcet_rank, 10),
        budget_lakhs: parseFloat(lead.budget_lakhs),
      });
      setScore(r.data);
      toast.success(`Score ${r.data.score_0_100}/100 · enrol prob ${(r.data.probability_enrolled * 100).toFixed(1)}%`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ARISE" title="Active lead-scoring model" testid="scorer-model-panel">
        {model ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="AUC holdout" value={model.auc_holdout.toFixed(3)} testid="scorer-auc-holdout" />
              <Kpi label="AUC train" value={model.auc_train.toFixed(3)} testid="scorer-auc-train" />
              <Kpi label="Features" value={model.feature_names.length} testid="scorer-feat-n" />
              <Kpi label="N train" value={model.n_train} testid="scorer-n-train" />
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground" data-testid="scorer-meta">
              {model.algorithm} · {model.epochs} epochs · trained {model.trained_at.slice(0, 16).replace("T", " ")}
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-muted-foreground">Threshold</span>
              <Badge variant={model.auc_holdout >= 0.78 ? "default" : "destructive"} className="text-[10px]">
                {model.auc_holdout >= 0.78 ? "≥ 0.78 ✓" : "< 0.78"}
              </Badge>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No active model yet. Train one to begin scoring new leads.</p>
        )}
        <Button onClick={train} disabled={busy} className="w-full mt-3" data-testid="scorer-train-btn">
          {busy ? "Training…" : "Train / re-train model"}
        </Button>
      </Panel>

      <Panel eyebrow="ARISE" title="Score a new lead" testid="scorer-score-panel" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["name", "Name", "text"],
            ["phone", "Phone", "text"],
            ["eapcet_rank", "EAPCET rank", "number"],
            ["budget_lakhs", "Budget (₹L)", "number"],
            ["city", "City", "text"],
          ].map(([k, lbl, typ]) => (
            <div key={k}>
              <Label className="text-xs">{lbl}</Label>
              <Input type={typ} value={lead[k]} onChange={(e) => setLead({ ...lead, [k]: e.target.value })} data-testid={`scorer-${k.replace(/_/g, "-")}`} />
            </div>
          ))}
          <div>
            <Label className="text-xs">Branch</Label>
            <select className="w-full text-xs border rounded p-1.5 bg-background"
                    value={lead.preferred_branch}
                    onChange={(e) => setLead({ ...lead, preferred_branch: e.target.value })}
                    data-testid="scorer-branch">
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <Input value={lead.source} onChange={(e) => setLead({ ...lead, source: e.target.value })} data-testid="scorer-source" />
          </div>
        </div>
        <Button onClick={doScore} disabled={!model} className="w-full mt-2" data-testid="scorer-score-btn">Score lead</Button>
        {score && (
          <div className="mt-3 grid grid-cols-3 gap-2" data-testid="scorer-result">
            <Kpi label="Score" value={`${score.score_0_100}/100`} testid="scorer-score-val" />
            <Kpi label="Enrol prob" value={`${(score.probability_enrolled * 100).toFixed(1)}%`} testid="scorer-prob" />
            <Kpi label="Model AUC" value={score.model_auc_holdout.toFixed(3)} testid="scorer-model-auc" />
          </div>
        )}
      </Panel>
    </div>
  );
}

// ================ Enrollment Predictor ================
function PredictTab({ iid }) {
  const [form, setForm] = useState({ rank: 5000, branch: "CSE", geo: "urban_hyd" });
  const [out, setOut] = useState(null);
  const predict = async () => {
    try {
      const r = await api.post(`/arise/${iid}/predict-enrollment`, {
        rank: parseInt(form.rank, 10), branch: form.branch, geo: form.geo,
      });
      setOut(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="ARISE" title="Logistic regression — (rank, branch, geo)" testid="predict-form-panel">
        <p className="text-xs text-muted-foreground mb-2">Trained live on each call against the tenant's labelled lead history (enrolled = positive class).</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Rank</Label>
            <Input type="number" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} data-testid="predict-rank" />
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <select className="w-full text-xs border rounded p-1.5 bg-background"
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    data-testid="predict-branch">
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Geo</Label>
            <select className="w-full text-xs border rounded p-1.5 bg-background"
                    value={form.geo}
                    onChange={(e) => setForm({ ...form, geo: e.target.value })}
                    data-testid="predict-geo">
              {GEOS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={predict} className="w-full mt-2" data-testid="predict-btn">Predict enrollment</Button>
        {out && (
          <div className="mt-3 grid grid-cols-3 gap-2" data-testid="predict-result">
            <Kpi label="Probability" value={`${(out.probability_enrolled * 100).toFixed(1)}%`} testid="predict-prob" />
            <Kpi label="Trained on" value={out.trained_on_n} testid="predict-n" />
            <Kpi label="Model" value="LR" testid="predict-model" />
          </div>
        )}
      </Panel>
      <Panel eyebrow="ARISE" title="How to read this" testid="predict-help-panel">
        <ol className="text-xs space-y-2 list-decimal pl-4 text-muted-foreground">
          <li>The model is fit on every call against the tenant's current lead pool. As your funnel matures, the predictor sharpens automatically.</li>
          <li>Use the output as a counseling-priority signal — not an admission decision. Geography buckets are heuristic; flag misroutes for refinement.</li>
          <li>Pair with the EAPCET tab for branch-level cutoff windows.</li>
        </ol>
      </Panel>
    </div>
  );
}

// ================ EAPCET ================
function EapcetTab({ iid }) {
  const [rank, setRank] = useState(12000);
  const [out, setOut] = useState(null);
  const predict = async () => {
    try {
      const r = await api.post(`/arise/${iid}/eapcet/predict-counseling`, { rank: parseInt(rank, 10) });
      setOut(r.data);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ARISE" title="EAPCET rank predictor" testid="eapcet-form-panel">
        <p className="text-xs text-muted-foreground mb-2">Per-branch counseling probability derived from your tenant's historical enrolled-rank distribution. P50/P90 cutoffs reflect your actual cohort.</p>
        <Label className="text-xs">Candidate EAPCET rank</Label>
        <Input type="number" value={rank} onChange={(e) => setRank(e.target.value)} data-testid="eapcet-rank" />
        <Button onClick={predict} className="w-full mt-2" data-testid="eapcet-btn">Predict counseling</Button>
        {out && out.best_match && (
          <div className="mt-3" data-testid="eapcet-best">
            <div className="text-xs text-muted-foreground">Best match</div>
            <div className="text-lg font-semibold">{out.best_match.branch}</div>
            <div className="text-xs text-muted-foreground">{(out.best_match.counseling_probability * 100).toFixed(0)}% counseling probability · P50 cutoff {out.best_match.p50_cutoff}</div>
          </div>
        )}
      </Panel>
      <Panel eyebrow="ARISE" title="Per-branch counseling windows" testid="eapcet-list-panel" className="lg:col-span-2">
        {out && (
          <ItemList
            testid="eapcet-list"
            items={(out.branches || []).map((b) => ({
              id: b.branch,
              title: b.branch,
              meta: `P50 ${b.p50_cutoff ?? "—"} · P90 ${b.p90_cutoff ?? "—"} · n=${b.n_enrolled}`,
              right: `${(b.counseling_probability * 100).toFixed(0)}%`,
            }))}
          />
        )}
      </Panel>
    </div>
  );
}

// ================ Source attribution ================
function SourceTab({ iid }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/arise/${iid}/source-attribution`).then((r) => setData(r.data)).catch(() => {});
  }, [iid]);
  return (
    <Panel eyebrow="ARISE" title="Source attribution — channel conversion ranking" testid="source-panel">
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Kpi label="Total leads" value={data.total_leads} testid="source-total" />
            <Kpi label="Best channel" value={data.best_channel || "—"} testid="source-best" />
          </div>
          <table className="w-full text-xs" data-testid="source-table">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="text-left py-1">Source</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Counseled</th>
                <th className="text-right">Applied</th>
                <th className="text-right">Enrolled</th>
                <th className="text-right">Dropped</th>
                <th className="text-right">Conv %</th>
              </tr>
            </thead>
            <tbody>
              {(data.by_source || []).map((s) => (
                <tr key={s.source} className="border-b last:border-0" data-testid={`source-row-${s.source}`}>
                  <td className="py-1.5">{s.source}</td>
                  <td className="text-right tabular-nums">{s.leads}</td>
                  <td className="text-right tabular-nums">{s.counseled}</td>
                  <td className="text-right tabular-nums">{s.applied}</td>
                  <td className="text-right tabular-nums">{s.enrolled}</td>
                  <td className="text-right tabular-nums">{s.dropped}</td>
                  <td className="text-right tabular-nums">
                    <Badge variant={s.conversion_pct >= 30 ? "default" : "outline"} className="text-[10px]">{s.conversion_pct}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

// ================ B-Category ================
function BCatTab({ iid }) {
  const [leads, setLeads] = useState([]);
  const [allocs, setAllocs] = useState([]);
  const [pick, setPick] = useState("");
  const [quota, setQuota] = useState("b_category");
  const [branch, setBranch] = useState("CSE");
  const [fee, setFee] = useState(11);

  const refresh = async () => {
    const [l, a] = await Promise.all([
      api.get(`/admissions/${iid}/leads`),
      api.get(`/arise/${iid}/b-category`),
    ]);
    setLeads((l.data || []).filter((x) => x.stage !== "enrolled"));
    setAllocs(a.data || []);
    if (!pick && l.data?.length) setPick(l.data[0].id);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const allocate = async () => {
    if (!pick) { toast.error("Pick a lead first"); return; }
    try {
      await api.post(`/arise/${iid}/b-category/allocate`, {
        lead_id: pick, quota, branch, fee_quoted_lakhs: parseFloat(fee),
      });
      toast.success("Allocated"); refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="ARISE" title="Quota allocation" testid="bcat-form-panel">
        <p className="text-xs text-muted-foreground mb-2">B-category / spot / management / NRI seats. Each quota has a soft cap per branch.</p>
        <Label className="text-xs">Lead</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background"
                value={pick} onChange={(e) => setPick(e.target.value)} data-testid="bcat-lead">
          {leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.preferred_branch} · {l.stage}</option>)}
        </select>
        <Label className="text-xs mt-2">Quota</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background"
                value={quota} onChange={(e) => setQuota(e.target.value)} data-testid="bcat-quota">
          {["b_category", "spot", "management", "nri"].map((q) => <option key={q}>{q}</option>)}
        </select>
        <Label className="text-xs mt-2">Branch</Label>
        <select className="w-full text-xs border rounded p-1.5 bg-background"
                value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="bcat-branch">
          {BRANCHES.map((b) => <option key={b}>{b}</option>)}
        </select>
        <Label className="text-xs mt-2">Fee quoted (₹L)</Label>
        <Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} data-testid="bcat-fee" />
        <Button onClick={allocate} className="w-full mt-2" data-testid="bcat-btn">Allocate</Button>
      </Panel>
      <Panel eyebrow="ARISE" title="Recent allocations" testid="bcat-list-panel" className="lg:col-span-2">
        <ItemList
          testid="bcat-list"
          items={allocs.slice(0, 16).map((a) => ({
            id: a.id,
            title: `${a.lead_name} · ${a.branch}`,
            meta: `${a.quota} · ${a.allocated_at.slice(0, 16).replace("T", " ")}`,
            right: `₹${a.fee_quoted_lakhs || "—"}L`,
          }))}
        />
      </Panel>
    </div>
  );
}
