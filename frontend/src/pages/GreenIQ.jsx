import React, { useEffect, useState } from "react";
import {
  Sparkles, Leaf, Droplets, Cloud, Plus, Target, Zap,
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
 * GREENIQ — Energy & Sustainability Intelligence (Phase 3 · final platform).
 *
 * Tracks energy, water and carbon emissions per period, computes a composite
 * 0-100 ESG score across 5 weighted dimensions (E 30 / S 20 / G 20 / C 20 / W 10)
 * with a NAAC-Green grade projection.
 */
export default function GreenIQ() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isOps = ["super_admin", "institution_admin", "facilities_admin", "sustainability_admin", "registrar"].includes(user?.role);
  const [esg, setEsg] = useState(null);

  const loadEsg = async () => {
    if (!current?.id) return;
    try { setEsg((await api.get(`/greeniq/${current.id}/esg`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadEsg(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current) return null;

  return (
    <div data-testid="greeniq-page">
      <PageHeader
        eyebrow="GREENIQ · Sustainability Intelligence"
        title={`${current.short_name} · ESG Cockpit`}
        description="Live energy, water, carbon — and a composite 0-100 ESG score with NAAC-Green grade projection."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 3 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">GREENIQ</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {esg && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="ESG composite" value={esg.composite} hint="of 100" icon={Target} testid="greeniq-kpi-composite" />
              <Kpi label="NAAC-Green grade" value={esg.grade} icon={Leaf} testid="greeniq-kpi-grade" />
              <Kpi label="Renewable share" value={`${esg.totals.renewable_pct}%`} hint={`${esg.totals.energy_kwh.toLocaleString()} kWh`} icon={Zap} testid="greeniq-kpi-renew" />
              <Kpi label="Carbon footprint" value={`${esg.totals.carbon_tco2e} tCO₂e`} hint="lower = better" icon={Cloud} testid="greeniq-kpi-carbon" />
            </section>

            <Panel
              eyebrow="ESG report card"
              title="5-dimension breakdown"
              testid="greeniq-esg-panel"
              action={<Badge className="bg-primary text-primary-foreground" data-testid="greeniq-esg-grade">{esg.grade}</Badge>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {esg.dimensions.map((d) => (
                  <div key={d.name} className="space-y-1" data-testid={`greeniq-dim-${d.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <span className="font-mono">{d.value}</span> · w {d.weight}%
                      </span>
                    </div>
                    <MiniBar
                      value={d.value}
                      color={d.value >= 70 ? "hsl(142, 71%, 45%)" : d.value >= 50 ? "hsl(35, 92%, 55%)" : "hsl(0, 84%, 60%)"}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" />
                  Composite = weighted average. Adjust weights in Phase 4.
                </div>
                <div className="text-2xl font-semibold tabular-nums" data-testid="greeniq-esg-composite">{esg.composite}/100</div>
              </div>
            </Panel>

            {esg.energy_trend?.length > 0 && (
              <Panel eyebrow="Trend" title="Energy consumption (kWh) — last 6 periods" testid="greeniq-trend-panel">
                <div className="space-y-2.5">
                  {esg.energy_trend.map((t) => (
                    <div key={t.period} data-testid={`greeniq-trend-${t.period}`}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{t.period}</span>
                        <span className="font-mono text-muted-foreground">{t.kwh.toLocaleString()} kWh</span>
                      </div>
                      <MiniBar value={t.kwh} max={Math.max(...esg.energy_trend.map((x) => x.kwh), 1) * 1.1} />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        <Tabs defaultValue="energy" className="space-y-4">
          <TabsList data-testid="greeniq-tabs">
            <TabsTrigger value="energy" data-testid="greeniq-tab-energy">Energy</TabsTrigger>
            <TabsTrigger value="water" data-testid="greeniq-tab-water">Water</TabsTrigger>
            <TabsTrigger value="carbon" data-testid="greeniq-tab-carbon">Carbon</TabsTrigger>
          </TabsList>
          <TabsContent value="energy"><EnergyTab institutionId={current.id} isOps={isOps} onChange={loadEsg} /></TabsContent>
          <TabsContent value="water"><WaterTab institutionId={current.id} isOps={isOps} onChange={loadEsg} /></TabsContent>
          <TabsContent value="carbon"><CarbonTab institutionId={current.id} isOps={isOps} onChange={loadEsg} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function defaultPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EnergyTab({ institutionId, isOps, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ meter_id: "", location: "", kwh: "", source: "grid", period: defaultPeriod() });

  const refresh = async () => {
    try { setRows((await api.get(`/greeniq/${institutionId}/energy`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/greeniq/${institutionId}/energy`, { ...draft, kwh: parseFloat(draft.kwh) });
      toast.success("Energy reading recorded");
      setOpen(false);
      setDraft({ meter_id: "", location: "", kwh: "", source: "grid", period: defaultPeriod() });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Meters"
      title="Energy readings"
      testid="greeniq-energy-panel"
      action={isOps && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="greeniq-en-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record energy reading</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Meter ID</Label><Input value={draft.meter_id} onChange={(e) => setDraft({ ...draft, meter_id: e.target.value })} data-testid="greeniq-en-meter" /></div>
                <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="greeniq-en-loc" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">kWh</Label><Input type="number" value={draft.kwh} onChange={(e) => setDraft({ ...draft, kwh: e.target.value })} data-testid="greeniq-en-kwh" /></div>
                <div>
                  <Label className="text-xs">Source</Label>
                  <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="greeniq-en-source">
                    {["grid", "solar", "wind", "diesel", "other"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Period</Label><Input value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} placeholder="2026-02" data-testid="greeniq-en-period" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="greeniq-en-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No energy readings yet.</div>
      ) : (
        <ItemList
          testid="greeniq-en-list"
          items={rows.slice(0, 15).map((r) => ({
            id: r.id, title: `${r.meter_id} · ${r.location}`,
            meta: `${r.period} · ${r.source} · ${r.tco2e || 0} tCO₂e`,
            right: `${r.kwh.toLocaleString()} kWh`,
          }))}
        />
      )}
    </Panel>
  );
}

function WaterTab({ institutionId, isOps, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ source_id: "", location: "", kilolitres: "", source: "municipal", period: defaultPeriod() });

  const refresh = async () => {
    try { setRows((await api.get(`/greeniq/${institutionId}/water`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/greeniq/${institutionId}/water`, { ...draft, kilolitres: parseFloat(draft.kilolitres) });
      toast.success("Water reading recorded");
      setOpen(false);
      setDraft({ source_id: "", location: "", kilolitres: "", source: "municipal", period: defaultPeriod() });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Sources"
      title="Water readings"
      testid="greeniq-water-panel"
      action={isOps && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="greeniq-wa-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record water reading</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Source ID</Label><Input value={draft.source_id} onChange={(e) => setDraft({ ...draft, source_id: e.target.value })} data-testid="greeniq-wa-source" /></div>
                <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="greeniq-wa-loc" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">kL</Label><Input type="number" value={draft.kilolitres} onChange={(e) => setDraft({ ...draft, kilolitres: e.target.value })} data-testid="greeniq-wa-kl" /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="greeniq-wa-type">
                    {["municipal", "borewell", "rainwater", "recycled", "other"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Period</Label><Input value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} data-testid="greeniq-wa-period" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="greeniq-wa-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No water readings yet.</div>
      ) : (
        <ItemList
          testid="greeniq-wa-list"
          items={rows.slice(0, 15).map((r) => ({
            id: r.id, title: `${r.source_id} · ${r.location}`,
            meta: `${r.period} · ${r.source}`,
            right: `${r.kilolitres.toLocaleString()} kL`,
          }))}
        />
      )}
    </Panel>
  );
}

function CarbonTab({ institutionId, isOps, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ scope: 1, activity: "", tco2e: "", period: defaultPeriod(), note: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/greeniq/${institutionId}/carbon`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/greeniq/${institutionId}/carbon`, {
        ...draft, scope: parseInt(draft.scope, 10), tco2e: parseFloat(draft.tco2e),
      });
      toast.success("Emission recorded");
      setOpen(false);
      setDraft({ scope: 1, activity: "", tco2e: "", period: defaultPeriod(), note: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="GHG ledger"
      title="Carbon emissions"
      testid="greeniq-carbon-panel"
      action={isOps && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="greeniq-co-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record carbon emission</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Scope</Label>
                  <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="greeniq-co-scope">
                    {[1, 2, 3].map((s) => <option key={s} value={s}>Scope {s}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Activity</Label><Input value={draft.activity} onChange={(e) => setDraft({ ...draft, activity: e.target.value })} data-testid="greeniq-co-activity" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">tCO₂e</Label><Input type="number" step="0.001" value={draft.tco2e} onChange={(e) => setDraft({ ...draft, tco2e: e.target.value })} data-testid="greeniq-co-tco2e" /></div>
                <div><Label className="text-xs">Period</Label><Input value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} data-testid="greeniq-co-period" /></div>
              </div>
              <div><Label className="text-xs">Note</Label><Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} data-testid="greeniq-co-note" /></div>
              <Button onClick={submit} className="w-full" data-testid="greeniq-co-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No emissions logged yet.</div>
      ) : (
        <ItemList
          testid="greeniq-co-list"
          items={rows.slice(0, 15).map((r) => ({
            id: r.id, title: r.activity,
            meta: `Scope ${r.scope} · ${r.period}${r.note ? " · " + r.note : ""}`,
            right: `${r.tco2e} tCO₂e`,
          }))}
        />
      )}
    </Panel>
  );
}
