import React, { useEffect, useState } from "react";
import { Activity, Sun, Leaf, AlertTriangle, Sparkles } from "lucide-react";
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

/**
 * Phase 3 Complete — GREENIQ gap-closure console.
 * 3 tabs:
 *  - Anomalies (z-score over energy/water)
 *  - Solar Ingest (inverter webhook + live summary)
 *  - Action Plan (Claude-grounded sustainability roadmap)
 */
export default function Phase3Complete() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="phase3-complete-page">
      <PageHeader
        eyebrow="Phase 3 · Completion sprint"
        title={`${current.short_name} · GREENIQ closeout`}
        description="Sustainability gap-closure: z-score anomaly detection on energy/water, solar inverter ingestion (with performance ratio), and a Claude-grounded sustainability action plan."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />Phase 3+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="anomalies" className="space-y-6">
          <TabsList data-testid="p3-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="anomalies" data-testid="p3-tab-anomalies"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Anomalies</TabsTrigger>
            <TabsTrigger value="solar" data-testid="p3-tab-solar"><Sun className="h-3.5 w-3.5 mr-1.5" />Solar</TabsTrigger>
            <TabsTrigger value="plan" data-testid="p3-tab-plan"><Leaf className="h-3.5 w-3.5 mr-1.5" />Action Plan</TabsTrigger>
          </TabsList>
          <TabsContent value="anomalies"><AnomaliesTab iid={current.id} /></TabsContent>
          <TabsContent value="solar"><SolarTab iid={current.id} /></TabsContent>
          <TabsContent value="plan"><PlanTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// =============== Anomalies ===============
function AnomaliesTab({ iid }) {
  const [metric, setMetric] = useState("energy");
  const [threshold, setThreshold] = useState(2.0);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.get(`/phase3/${iid}/greeniq/anomalies`, { params: { metric, threshold } });
      setData(r.data);
      toast.success(`${r.data.anomalies.length} anomaly(ies) flagged across ${r.data.groups_analysed} groups`);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  useEffect(() => { run().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="GREENIQ" title="Detection controls" testid="anom-controls-panel">
        <p className="text-xs text-muted-foreground mb-3">
          Transparent z-score over historical readings per meter (energy) or
          source (water). |z| ≥ threshold flagged.
        </p>
        <Label className="text-xs">Metric</Label>
        <div className="flex gap-2 mb-2">
          {["energy", "water"].map((m) => (
            <Button key={m} size="sm" variant={metric === m ? "default" : "outline"}
                    onClick={() => setMetric(m)} data-testid={`anom-metric-${m}`}>{m}</Button>
          ))}
        </div>
        <Label className="text-xs mt-2">Threshold (|z|)</Label>
        <Input type="number" step="0.1" min="0.5" max="5" value={threshold}
               onChange={(e) => setThreshold(parseFloat(e.target.value))}
               data-testid="anom-threshold-input" />
        <Button onClick={run} disabled={busy} className="w-full mt-3"
                data-testid="anom-run-btn">{busy ? "Scanning…" : "Run scan"}</Button>
      </Panel>

      <Panel eyebrow="GREENIQ" title="Anomalies detected" testid="anom-result-panel" className="lg:col-span-2">
        {data && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Kpi label="Groups" value={data.groups_analysed} testid="anom-groups" />
              <Kpi label="Anomalies" value={data.anomalies.length} testid="anom-count" />
              <Kpi label="Threshold" value={data.threshold} testid="anom-thr" />
            </div>
            <ItemList
              testid="anom-list"
              items={data.anomalies.slice(0, 14).map((a, i) => ({
                id: `${a.group_id}-${i}`,
                title: `${a.group_id} · ${a.period}`,
                meta: `μ=${a.mean} · σ=${a.stdev} · value=${a.value} (${a.direction})`,
                right: `z=${a.z_score}`,
              }))}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

// =============== Solar ===============
function SolarTab({ iid }) {
  const [form, setForm] = useState({
    inverter_id: "INV-A1", location: "Block A", generation_kwh: 42.5,
    irradiance_wm2: 850, panel_temp_c: 48, capacity_kwp: 50,
    period: new Date().toISOString().slice(0, 13) + ":00",
  });
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);

  const refresh = async () => {
    const [s, r] = await Promise.all([
      api.get(`/phase3/${iid}/greeniq/solar/summary`),
      api.get(`/phase3/${iid}/greeniq/solar/readings`),
    ]);
    setSummary(s.data); setReadings(r.data || []);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const ingest = async () => {
    try {
      const payload = {
        ...form,
        generation_kwh: parseFloat(form.generation_kwh),
        irradiance_wm2: parseFloat(form.irradiance_wm2),
        panel_temp_c: parseFloat(form.panel_temp_c),
        capacity_kwp: parseFloat(form.capacity_kwp),
      };
      const r = await api.post(`/phase3/${iid}/greeniq/solar/ingest`, payload);
      const pr = r.data.performance_ratio;
      toast.success(`Logged · PR ${pr ?? "n/a"}`);
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="GREENIQ" title="Solar inverter webhook" testid="solar-form-panel">
        <p className="text-xs text-muted-foreground mb-2">External inverter / SCADA workers POST hourly readings here. Performance Ratio = gen_kWh / (irradiance/1000 × kWp).</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["inverter_id", "Inverter ID", "text"],
            ["location", "Location", "text"],
            ["generation_kwh", "kWh", "number"],
            ["irradiance_wm2", "Irradiance W/m²", "number"],
            ["panel_temp_c", "Panel temp °C", "number"],
            ["capacity_kwp", "Capacity kWp", "number"],
            ["period", "Period (ISO hr)", "text"],
          ].map(([k, lbl, typ]) => (
            <div key={k} className={k === "period" ? "col-span-2" : ""}>
              <Label className="text-xs">{lbl}</Label>
              <Input type={typ} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`solar-${k.replace(/_/g, "-")}`} />
            </div>
          ))}
        </div>
        <Button onClick={ingest} className="w-full mt-2" data-testid="solar-ingest-btn">Ingest reading</Button>
      </Panel>

      <Panel eyebrow="GREENIQ" title="Solar fleet KPIs" testid="solar-summary-panel">
        {summary && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Total kWh" value={summary.total_kwh} testid="solar-kpi-total" />
              <Kpi label="Today kWh" value={summary.today_kwh} testid="solar-kpi-today" />
              <Kpi label="Week kWh" value={summary.week_kwh} testid="solar-kpi-week" />
              <Kpi label="Avg PR" value={summary.avg_performance_ratio ?? "—"} testid="solar-kpi-pr" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Avg irradiance: {summary.avg_irradiance} W/m² · {summary.total_readings} readings</div>
            <div className="mt-3">
              <div className="label-eyebrow mb-2">Top inverters</div>
              <ItemList
                testid="solar-inv-list"
                items={(summary.inverters || []).slice(0, 8).map((i) => ({
                  id: i.inverter_id,
                  title: i.inverter_id,
                  meta: `${i.location} · ${i.readings} readings`,
                  right: `${i.total_kwh} kWh · PR ${i.avg_pr ?? "—"}`,
                }))}
              />
            </div>
          </>
        )}
      </Panel>

      <Panel eyebrow="GREENIQ" title="Recent readings" testid="solar-readings-panel">
        <ItemList
          testid="solar-readings-list"
          items={readings.slice(0, 12).map((r) => ({
            id: r.id,
            title: `${r.inverter_id} · ${r.location}`,
            meta: `${r.period}`,
            right: `${r.generation_kwh} kWh`,
          }))}
        />
      </Panel>
    </div>
  );
}

// =============== Action Plan ===============
function PlanTab({ iid }) {
  const [focus, setFocus] = useState("overall");
  const [horizon, setHorizon] = useState(12);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try { const r = await api.get(`/phase3/${iid}/greeniq/action-plan`); setHistory(r.data || []); }
    catch { /* empty */ }
  };
  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [iid]);

  const generate = async () => {
    setBusy(true); setPlan(null);
    try {
      const r = await api.post(`/phase3/${iid}/greeniq/action-plan`, { focus, horizon_months: parseInt(horizon, 10) });
      setPlan(r.data);
      toast.success(`Generated ${r.data.actions.length} actions`);
      loadHistory();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="GREENIQ" title="Generate sustainability plan" testid="plan-controls-panel">
        <p className="text-xs text-muted-foreground mb-2">Claude grounds every action in live metrics from greeniq_energy / water / carbon / solar collections.</p>
        <Label className="text-xs">Focus</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {["overall", "energy", "water", "carbon", "waste"].map((f) => (
            <Button key={f} size="sm" variant={focus === f ? "default" : "outline"}
                    onClick={() => setFocus(f)} data-testid={`plan-focus-${f}`}>{f}</Button>
          ))}
        </div>
        <Label className="text-xs">Horizon (months)</Label>
        <Input type="number" min="1" max="36" value={horizon}
               onChange={(e) => setHorizon(e.target.value)} data-testid="plan-horizon" />
        <Button onClick={generate} disabled={busy} className="w-full mt-3" data-testid="plan-generate-btn">
          {busy ? "Generating…" : "Generate plan"}
        </Button>
        <div className="mt-3 text-xs">
          <div className="label-eyebrow mb-2">Previous plans ({history.length})</div>
          <ItemList
            testid="plan-history-list"
            items={history.slice(0, 6).map((h) => ({
              id: h.id,
              title: `${h.focus} · ${h.horizon_months}mo`,
              meta: (h.generated_at || "").slice(0, 16).replace("T", " "),
              right: `${(h.actions || []).length} actions`,
            }))}
          />
        </div>
      </Panel>

      <Panel eyebrow="GREENIQ" title="Generated plan" testid="plan-result-panel" className="lg:col-span-2">
        {plan && (
          <div className="space-y-3" data-testid="plan-result">
            <p className="text-xs italic text-muted-foreground">{plan.baseline_summary}</p>
            <div className="grid grid-cols-4 gap-2">
              <Kpi label="Total kWh" value={plan.baseline_metrics.total_kwh} testid="plan-kpi-kwh" />
              <Kpi label="Solar %" value={plan.baseline_metrics.solar_share_pct} testid="plan-kpi-solar" />
              <Kpi label="Anomalies" value={plan.baseline_metrics.anomalies_flagged} testid="plan-kpi-anom" />
              <Kpi label="Actions" value={plan.actions.length} testid="plan-kpi-n" />
            </div>
            <ol className="space-y-3 mt-3" data-testid="plan-actions-list">
              {plan.actions.map((a, i) => (
                <li key={a.id} className="rounded-md border border-border p-3" data-testid={`plan-action-${i}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium flex-1">{i + 1}. {a.title}</div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{a.target_metric}</Badge>
                      <Badge variant={a.impact === "high" ? "default" : "outline"} className="text-[10px]">impact {a.impact}</Badge>
                      <Badge variant="outline" className="text-[10px]">effort {a.effort}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{a.rationale}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    <span>{a.timeline_months}mo</span>
                    <span>· owner: {a.owner_role}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="text-[10px] text-muted-foreground text-right">{plan.model}</div>
          </div>
        )}
      </Panel>
    </div>
  );
}
