import React, { useCallback, useEffect, useState } from "react";
import {
  Users2, AlertTriangle, ShieldAlert, LogIn, LogOut, Loader2, Plus,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { api } from "../lib/api";
import { toast } from "sonner";

const SEV_TONE = {
  CRITICAL: "bg-red-50 text-red-700 border-red-300",
  HIGH: "bg-red-50 text-red-700 border-red-300",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-300",
  LOW: "bg-slate-50 text-slate-700 border-slate-300",
};
const STATUS_TONE = {
  OPEN: "bg-red-50 text-red-700",
  INVESTIGATING: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-50 text-slate-700",
};

function AddVisitorDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    visitor_name: "", phone: "", purpose: "",
    visit_date: new Date().toISOString().slice(0, 10),
    id_type: "Aadhaar", id_number: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.visitor_name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      await api.post("/v1/safe/visitors", form);
      toast.success("Visitor added");
      setOpen(false);
      setForm({ visitor_name: "", phone: "", purpose: "",
                visit_date: new Date().toISOString().slice(0, 10),
                id_type: "Aadhaar", id_number: "" });
      onCreated();
    } catch (e) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="safe-add-visitor-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Visitor
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="safe-visitor-dialog">
        <DialogHeader><DialogTitle>Pre-register visitor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input data-testid="visitor-name" placeholder="Visitor name" value={form.visitor_name}
            onChange={(e) => setForm(s => ({ ...s, visitor_name: e.target.value }))} />
          <Input data-testid="visitor-phone" placeholder="Phone" value={form.phone}
            onChange={(e) => setForm(s => ({ ...s, phone: e.target.value }))} />
          <Input data-testid="visitor-purpose" placeholder="Purpose" value={form.purpose}
            onChange={(e) => setForm(s => ({ ...s, purpose: e.target.value }))} />
          <Input data-testid="visitor-date" type="date" value={form.visit_date}
            onChange={(e) => setForm(s => ({ ...s, visit_date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="visitor-id-type" placeholder="ID Type" value={form.id_type}
              onChange={(e) => setForm(s => ({ ...s, id_type: e.target.value }))} />
            <Input data-testid="visitor-id-num" placeholder="ID Number" value={form.id_number}
              onChange={(e) => setForm(s => ({ ...s, id_number: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="visitor-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportIncidentDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    incident_type: "OTHER", severity: "MEDIUM",
    description: "", location: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.description.trim()) return toast.error("Description required");
    setSaving(true);
    try {
      await api.post("/v1/safe/incidents", form);
      toast.success("Incident reported");
      setOpen(false);
      setForm({ incident_type: "OTHER", severity: "MEDIUM", description: "", location: "" });
      onCreated();
    } catch (e) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="safe-report-incident-btn">
          <ShieldAlert className="h-4 w-4 mr-2" /> Report Incident
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="safe-incident-dialog">
        <DialogHeader><DialogTitle>Report incident</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select data-testid="incident-type" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={form.incident_type}
            onChange={(e) => setForm(s => ({ ...s, incident_type: e.target.value }))}>
            {["THEFT", "INJURY", "RAGGING", "UNAUTHORIZED_ACCESS", "DAMAGE", "OTHER"].map(t =>
              <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <select data-testid="incident-severity" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={form.severity}
            onChange={(e) => setForm(s => ({ ...s, severity: e.target.value }))}>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input data-testid="incident-location" placeholder="Location" value={form.location}
            onChange={(e) => setForm(s => ({ ...s, location: e.target.value }))} />
          <Textarea data-testid="incident-desc" rows={4} placeholder="Description"
            value={form.description}
            onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="incident-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosSafeHome() {
  const [tab, setTab] = useState("VIS");
  const [stats, setStats] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, v, i] = await Promise.all([
        api.get("/v1/safe/stats").then(r => r.data).catch(() => null),
        api.get("/v1/safe/visitors").then(r => r.data).catch(() => []),
        api.get("/v1/safe/incidents").then(r => r.data).catch(() => []),
      ]);
      setStats(s); setVisitors(v || []); setIncidents(i || []);
    } catch { toast.error("Failed to load safe data"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const checkin = async (id) => {
    try { await api.put(`/v1/safe/visitors/${id}/checkin`); toast.success("Checked in"); load(); }
    catch { toast.error("Failed"); }
  };
  const checkout = async (id) => {
    try { await api.put(`/v1/safe/visitors/${id}/checkout`); toast.success("Checked out"); load(); }
    catch { toast.error("Failed"); }
  };
  const updateIncident = async (id, status) => {
    try { await api.put(`/v1/safe/incidents/${id}`, { status }); toast.success(`Marked ${status}`); load(); }
    catch { toast.error("Update failed"); }
  };

  return (
    <div className="space-y-6" data-testid="safe-page">
      <PageHeader eyebrow="Claros Safe" title="Campus Safety"
        description="Visitor management and incident response." />
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Visitors today", stats.visitors_today, Users2, "safe-stat-visitors"],
            ["Checked in now", stats.checked_in_now, LogIn, "safe-stat-checkedin"],
            ["Open incidents", stats.open_incidents, AlertTriangle, "safe-stat-open"],
            ["Critical open", stats.critical_open, ShieldAlert, "safe-stat-critical"],
          ].map(([l, v, I, tid]) => (
            <div key={tid} className="card p-4 border border-border" data-testid={tid}>
              <div className="flex items-center justify-between">
                <div className="label-eyebrow">{l}</div>
                <I className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-b">
        {[
          ["VIS", "Visitors"], ["INC", "Incidents"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            data-testid={`safe-tab-${id.toLowerCase()}`}
            className={`px-3 py-2 -mb-px border-b-2 text-sm ${tab === id
              ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "VIS" && (
        <div className="space-y-3" data-testid="safe-vis-pane">
          <div className="flex justify-end"><AddVisitorDialog onCreated={load} /></div>
          <div className="card border border-border divide-y">
            {visitors.length === 0 && <div className="p-4 text-sm text-muted-foreground" data-testid="visitors-empty">No visitors expected today.</div>}
            {visitors.map(v => (
              <div key={v.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid={`visitor-row-${v.id}`}>
                <div>
                  <div className="font-medium text-sm">{v.visitor_name}</div>
                  <div className="text-xs text-muted-foreground">{v.purpose} · Pass: {v.visitor_pass_code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
                  {v.status === "EXPECTED" && (
                    <Button size="sm" variant="outline" onClick={() => checkin(v.id)} data-testid={`checkin-btn-${v.id}`}>
                      <LogIn className="h-3 w-3 mr-1" /> Check in
                    </Button>
                  )}
                  {v.status === "CHECKED_IN" && (
                    <Button size="sm" variant="outline" onClick={() => checkout(v.id)} data-testid={`checkout-btn-${v.id}`}>
                      <LogOut className="h-3 w-3 mr-1" /> Check out
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "INC" && (
        <div className="space-y-3" data-testid="safe-inc-pane">
          <div className="flex justify-end"><ReportIncidentDialog onCreated={load} /></div>
          <div className="card border border-border divide-y">
            {incidents.length === 0 && <div className="p-4 text-sm text-muted-foreground" data-testid="incidents-empty">No incidents logged.</div>}
            {incidents.map(i => (
              <div key={i.id} className={`p-3 border-l-4 ${SEV_TONE[i.severity] || ""}`} data-testid={`incident-row-${i.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{i.incident_type.replace("_", " ")}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{i.severity}</Badge>
                    <Badge className={`text-[10px] ${STATUS_TONE[i.status] || ""}`}>{i.status}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{i.location} · {new Date(i.incident_datetime).toLocaleString()}</div>
                <div className="text-sm mt-2">{i.description}</div>
                {i.resolution_notes && <div className="text-xs mt-2 italic text-muted-foreground">Resolution: {i.resolution_notes}</div>}
                <div className="flex items-center gap-2 mt-2">
                  {i.status === "OPEN" && (
                    <Button size="sm" variant="outline" onClick={() => updateIncident(i.id, "INVESTIGATING")} data-testid={`incident-investigate-${i.id}`}>
                      Investigate
                    </Button>
                  )}
                  {["OPEN", "INVESTIGATING"].includes(i.status) && (
                    <Button size="sm" variant="outline" onClick={() => updateIncident(i.id, "RESOLVED")} data-testid={`incident-resolve-${i.id}`}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
