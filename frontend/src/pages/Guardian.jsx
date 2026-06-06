import React, { useEffect, useState } from "react";
import {
  Sparkles, Shield, AlertTriangle, Camera, Car, UserCheck,
  Activity, Plus,
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
 * GUARDIAN — Campus Safety & Smart Infrastructure (Phase 2 MVP).
 *
 * Acts as the system-of-record for the underlying YOLOv8 CCTV, NFC readers,
 * ANPR cameras and IoT asset sensors which would push events to these
 * endpoints in production. This UI lets ops record events manually for
 * pilots and surface live counts + asset health.
 */
export default function Guardian() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isOps = ["super_admin", "institution_admin", "security_admin", "facilities_admin", "registrar"].includes(user?.role);
  const [summary, setSummary] = useState(null);

  const loadSummary = async () => {
    if (!current?.id) return;
    try { setSummary((await api.get(`/guardian/${current.id}/summary`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current) return null;
  return (
    <div data-testid="guardian-page">
      <PageHeader
        eyebrow="GUARDIAN · Campus Safety & Infrastructure"
        title={`${current.short_name} · Safety Operations`}
        description="CCTV detections, NFC access, ANPR vehicle entries and predictive maintenance — every signal logged, every asset monitored."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 2 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">GUARDIAN</Badge>
          </>
        }
      />
      <div className="p-6 lg:p-8 space-y-8">
        {summary && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Open incidents" value={summary.incidents_open} hint={`${summary.incidents_today} today`} icon={AlertTriangle} testid="guardian-kpi-incidents" />
            <Kpi label="People inside now" value={summary.people_inside_now} hint={`${summary.access_events} events`} icon={UserCheck} testid="guardian-kpi-inside" />
            <Kpi label="Vehicles in today" value={summary.vehicles_in_today} hint={`${summary.vehicles_total} total`} icon={Car} testid="guardian-kpi-vehicles" />
            <Kpi label="Assets need attention" value={summary.assets_needing_attention} hint={`${summary.assets_total} total`} icon={Activity} testid="guardian-kpi-assets" />
          </section>
        )}

        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList data-testid="guardian-tabs">
            <TabsTrigger value="incidents" data-testid="guardian-tab-incidents">Incidents (CCTV)</TabsTrigger>
            <TabsTrigger value="access" data-testid="guardian-tab-access">Access (NFC)</TabsTrigger>
            <TabsTrigger value="vehicles" data-testid="guardian-tab-vehicles">Vehicles (ANPR)</TabsTrigger>
            <TabsTrigger value="assets" data-testid="guardian-tab-assets">Asset Health</TabsTrigger>
          </TabsList>
          <TabsContent value="incidents">
            <IncidentsTab institutionId={current.id} isOps={isOps} summary={summary} onChange={loadSummary} />
          </TabsContent>
          <TabsContent value="access"><AccessTab institutionId={current.id} onChange={loadSummary} /></TabsContent>
          <TabsContent value="vehicles"><VehiclesTab institutionId={current.id} onChange={loadSummary} /></TabsContent>
          <TabsContent value="assets"><AssetsTab institutionId={current.id} isOps={isOps} summary={summary} onChange={loadSummary} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function IncidentsTab({ institutionId, isOps, summary, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    camera_id: "CAM-MAIN-01", location: "Main Gate",
    detection_type: "intrusion", severity: "medium", confidence: 0.85, note: "",
  });

  const refresh = async () => {
    try { setRows((await api.get(`/guardian/${institutionId}/incidents`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/guardian/${institutionId}/incidents`, {
        ...draft, confidence: parseFloat(draft.confidence),
      });
      toast.success("Incident pushed");
      setOpen(false);
      setDraft({ ...draft, note: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const resolve = async (id) => {
    try {
      await api.patch(`/guardian/${institutionId}/incidents/${id}/resolve`);
      toast.success("Resolved");
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const bySev = summary?.incidents_by_severity || { low: 0, medium: 0, high: 0, critical: 0 };
  const maxSev = Math.max(...Object.values(bySev), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel
        eyebrow="Live feed"
        title="Incidents"
        className="lg:col-span-2"
        testid="guardian-incidents-panel"
        action={isOps && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="guardian-inc-new"><Plus className="h-4 w-4" />Push event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Push detection event</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Camera ID</Label><Input value={draft.camera_id} onChange={(e) => setDraft({ ...draft, camera_id: e.target.value })} data-testid="guardian-inc-cam" /></div>
                  <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="guardian-inc-loc" /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Detection</Label>
                    <select value={draft.detection_type} onChange={(e) => setDraft({ ...draft, detection_type: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="guardian-inc-type">
                      {["intrusion", "crowd", "fire", "fall", "weapon", "loitering", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Severity</Label>
                    <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="guardian-inc-sev">
                      {["low", "medium", "high", "critical"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-xs">Confidence</Label><Input type="number" step="0.01" min="0" max="1" value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })} data-testid="guardian-inc-conf" /></div>
                </div>
                <div><Label className="text-xs">Note</Label><Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} data-testid="guardian-inc-note" /></div>
                <Button onClick={submit} className="w-full" data-testid="guardian-inc-submit">Push</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No incidents captured.</div>
        ) : (
          <ul className="space-y-2 text-sm" data-testid="guardian-inc-list">
            {rows.slice(0, 12).map((r) => (
              <li key={r.id} className={`rounded-md border p-3 ${
                r.severity === "critical" ? "bg-rose-500/10 border-rose-200" :
                r.severity === "high" ? "bg-amber-500/10 border-amber-200" :
                r.severity === "medium" ? "bg-blue-500/10 border-blue-200" :
                "bg-emerald-600/10 border-emerald-200"
              }`} data-testid={`guardian-inc-row-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Camera className="h-4 w-4" />{r.detection_type} · {r.location}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.camera_id} · confidence {Math.round((r.confidence || 0) * 100)}% · {(r.detected_at || "").slice(0, 19)}
                      {r.note ? " · " + r.note : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={
                      r.severity === "critical" ? "bg-rose-500/15 text-rose-700 border-rose-200" :
                      r.severity === "high" ? "bg-amber-500/15 text-amber-700 border-amber-200" :
                      r.severity === "medium" ? "bg-blue-500/15 text-blue-700 border-blue-200" :
                      "bg-emerald-600/15 text-emerald-700 border-emerald-200"
                    }>{r.severity}</Badge>
                    {isOps && r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => resolve(r.id)} data-testid={`guardian-inc-resolve-${r.id}`}>Resolve</Button>
                    )}
                    {r.status === "resolved" && <Badge className="bg-emerald-600 text-white text-[10px]">resolved</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel eyebrow="By severity" title="Distribution" testid="guardian-sev-panel">
        <div className="space-y-3" data-testid="guardian-sev-bars">
          {["critical", "high", "medium", "low"].map((sev) => (
            <div key={sev}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium capitalize">{sev}</span>
                <span className="font-mono text-muted-foreground">{bySev[sev] || 0}</span>
              </div>
              <MiniBar value={bySev[sev] || 0} max={maxSev * 1.1}
                color={sev === "critical" ? "hsl(0,84%,55%)" :
                       sev === "high" ? "hsl(35,92%,55%)" :
                       sev === "medium" ? "hsl(210,90%,60%)" : "hsl(142,71%,45%)"} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AccessTab({ institutionId, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ card_id: "", user_name: "", zone: "Library", direction: "in" });

  const refresh = async () => {
    try { setRows((await api.get(`/guardian/${institutionId}/access`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/guardian/${institutionId}/access`, draft);
      toast.success(`${draft.user_name} scanned ${draft.direction.toUpperCase()} at ${draft.zone}`);
      setOpen(false);
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="NFC log"
      title="Access events"
      testid="guardian-access-panel"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="guardian-acc-new"><Plus className="h-4 w-4" />Scan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record NFC scan</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Card ID</Label><Input value={draft.card_id} onChange={(e) => setDraft({ ...draft, card_id: e.target.value })} data-testid="guardian-acc-card" /></div>
                <div><Label className="text-xs">User name</Label><Input value={draft.user_name} onChange={(e) => setDraft({ ...draft, user_name: e.target.value })} data-testid="guardian-acc-user" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Zone</Label><Input value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} data-testid="guardian-acc-zone" /></div>
                <div>
                  <Label className="text-xs">Direction</Label>
                  <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="guardian-acc-dir">
                    <option value="in">in</option><option value="out">out</option>
                  </select>
                </div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="guardian-acc-submit">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No access events yet.</div>
      ) : (
        <ItemList
          testid="guardian-acc-list"
          items={rows.slice(0, 20).map((r) => ({
            id: r.id, title: `${r.user_name} · ${r.zone}`,
            meta: `${r.card_id} · ${(r.ts || "").slice(0, 19)}`,
            right: r.direction.toUpperCase(),
          }))}
        />
      )}
    </Panel>
  );
}

function VehiclesTab({ institutionId, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ plate: "", vehicle_type: "car", direction: "in", gate: "Main Gate" });

  const refresh = async () => {
    try { setRows((await api.get(`/guardian/${institutionId}/vehicles`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/guardian/${institutionId}/vehicles`, draft);
      toast.success(`Plate ${draft.plate.toUpperCase()} logged ${draft.direction.toUpperCase()}`);
      setOpen(false);
      setDraft({ ...draft, plate: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="ANPR log"
      title="Vehicle entries"
      testid="guardian-veh-panel"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="guardian-veh-new"><Plus className="h-4 w-4" />Log</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log vehicle</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Plate</Label><Input value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} data-testid="guardian-veh-plate" /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select value={draft.vehicle_type} onChange={(e) => setDraft({ ...draft, vehicle_type: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="guardian-veh-type">
                    {["car", "bike", "bus", "truck", "auto", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Gate</Label><Input value={draft.gate} onChange={(e) => setDraft({ ...draft, gate: e.target.value })} data-testid="guardian-veh-gate" /></div>
                <div>
                  <Label className="text-xs">Direction</Label>
                  <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="guardian-veh-dir">
                    <option value="in">in</option><option value="out">out</option>
                  </select>
                </div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="guardian-veh-submit">Log</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No vehicles yet.</div>
      ) : (
        <ItemList
          testid="guardian-veh-list"
          items={rows.slice(0, 20).map((r) => ({
            id: r.id, title: r.plate,
            meta: `${r.vehicle_type} · ${r.gate} · ${(r.ts || "").slice(0, 19)}`,
            right: r.direction.toUpperCase(),
          }))}
        />
      )}
    </Panel>
  );
}

function AssetsTab({ institutionId, isOps, summary, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ asset_id: "", asset_type: "HVAC", location: "", health_score: 85, last_serviced: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/guardian/${institutionId}/assets`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      const r = await api.post(`/guardian/${institutionId}/assets`, {
        ...draft, health_score: parseFloat(draft.health_score),
        last_serviced: draft.last_serviced || null,
      });
      toast.success(`Asset upserted · status ${r.data.status}`);
      setOpen(false);
      setDraft({ asset_id: "", asset_type: "HVAC", location: "", health_score: 85, last_serviced: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const stat = summary?.asset_status || { operational: 0, warning: 0, critical: 0, down: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel
        eyebrow="Predictive maintenance"
        title="Asset health (lowest first)"
        className="lg:col-span-2"
        testid="guardian-assets-panel"
        action={isOps && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="guardian-ast-new"><Plus className="h-4 w-4" />Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upsert asset</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Asset ID</Label><Input value={draft.asset_id} onChange={(e) => setDraft({ ...draft, asset_id: e.target.value })} data-testid="guardian-ast-id" /></div>
                  <div><Label className="text-xs">Type</Label><Input value={draft.asset_type} onChange={(e) => setDraft({ ...draft, asset_type: e.target.value })} data-testid="guardian-ast-type" /></div>
                </div>
                <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="guardian-ast-loc" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Health (0-100)</Label><Input type="number" min="0" max="100" value={draft.health_score} onChange={(e) => setDraft({ ...draft, health_score: e.target.value })} data-testid="guardian-ast-health" /></div>
                  <div><Label className="text-xs">Last serviced</Label><Input type="date" value={draft.last_serviced} onChange={(e) => setDraft({ ...draft, last_serviced: e.target.value })} data-testid="guardian-ast-serviced" /></div>
                </div>
                <Button onClick={submit} className="w-full" data-testid="guardian-ast-submit">Upsert</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No assets tracked yet.</div>
        ) : (
          <ul className="space-y-2.5 text-sm" data-testid="guardian-ast-list">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-card p-3" data-testid={`guardian-ast-row-${r.asset_id}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-medium">{r.asset_id} · {r.asset_type}</div>
                    <div className="text-xs text-muted-foreground">{r.location}{r.last_serviced ? " · serviced " + r.last_serviced : ""}</div>
                  </div>
                  <Badge className={
                    r.status === "operational" ? "bg-emerald-600 text-white" :
                    r.status === "warning" ? "bg-amber-500 text-white" :
                    r.status === "critical" ? "bg-rose-500 text-white" :
                    "bg-slate-700 text-white"
                  }>{r.status}</Badge>
                </div>
                <MiniBar value={r.health_score} max={100}
                  color={r.health_score >= 80 ? "hsl(142,71%,45%)" :
                         r.health_score >= 60 ? "hsl(35,92%,55%)" :
                         r.health_score > 0 ? "hsl(0,84%,55%)" : "hsl(0,0%,40%)"} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel eyebrow="Fleet status" title="Status rollup" testid="guardian-rollup-panel">
        <div className="space-y-3" data-testid="guardian-rollup-bars">
          {[
            { k: "operational", color: "hsl(142,71%,45%)" },
            { k: "warning", color: "hsl(35,92%,55%)" },
            { k: "critical", color: "hsl(0,84%,55%)" },
            { k: "down", color: "hsl(0,0%,40%)" },
          ].map(({ k, color }) => (
            <div key={k}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium capitalize">{k}</span>
                <span className="font-mono text-muted-foreground">{stat[k] || 0}</span>
              </div>
              <MiniBar value={stat[k] || 0} max={Math.max(...Object.values(stat), 1) * 1.1} color={color} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
