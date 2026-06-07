import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { Loader2, Award, TrendingUp, Users, DollarSign, Plus, Briefcase, Calendar } from "lucide-react";
import { toast } from "sonner";

function NewCompanyDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", industry: "", website: "", avg_package: "", max_package: "",
    typical_roles: "", skills_required: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      await api.post("/v1/launch/companies", {
        ...form,
        avg_package: Number(form.avg_package || 0),
        max_package: Number(form.max_package || 0),
        typical_roles: form.typical_roles.split(",").map(s => s.trim()).filter(Boolean),
        skills_required: form.skills_required.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast.success("Company added");
      setOpen(false);
      setForm({ name: "", industry: "", website: "", avg_package: "", max_package: "", typical_roles: "", skills_required: "" });
      onCreated();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="launch-add-company-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Company
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="launch-company-dialog">
        <DialogHeader><DialogTitle>Add recruiting company</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input data-testid="company-name" placeholder="Company name" value={form.name}
            onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} />
          <Input data-testid="company-industry" placeholder="Industry" value={form.industry}
            onChange={(e) => setForm(s => ({ ...s, industry: e.target.value }))} />
          <Input data-testid="company-website" placeholder="Website (optional)" value={form.website}
            onChange={(e) => setForm(s => ({ ...s, website: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="company-avg-pkg" type="number" placeholder="Avg package (LPA)"
              value={form.avg_package}
              onChange={(e) => setForm(s => ({ ...s, avg_package: e.target.value }))} />
            <Input data-testid="company-max-pkg" type="number" placeholder="Max package (LPA)"
              value={form.max_package}
              onChange={(e) => setForm(s => ({ ...s, max_package: e.target.value }))} />
          </div>
          <Input data-testid="company-roles" placeholder="Typical roles (comma separated)"
            value={form.typical_roles}
            onChange={(e) => setForm(s => ({ ...s, typical_roles: e.target.value }))} />
          <Input data-testid="company-skills" placeholder="Skills required (comma separated)"
            value={form.skills_required}
            onChange={(e) => setForm(s => ({ ...s, skills_required: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="company-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDriveDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    company_id: "", drive_date: new Date().toISOString().slice(0, 10),
    status: "UPCOMING", min_cgpa: 6.0, package_offered: "",
    eligible_programs: "", roles: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/v1/launch/companies")
      .then(r => setCompanies((r.data?.items) || []))
      .catch(() => setCompanies([]));
  }, [open]);

  const save = async () => {
    if (!form.company_id) return toast.error("Pick a company");
    setSaving(true);
    try {
      await api.post("/v1/launch/drives", {
        ...form,
        min_cgpa: Number(form.min_cgpa || 0),
        package_offered: Number(form.package_offered || 0),
        eligible_programs: form.eligible_programs.split(",").map(s => s.trim()).filter(Boolean),
        roles: form.roles.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast.success("Drive created");
      setOpen(false);
      setForm({ company_id: "", drive_date: new Date().toISOString().slice(0, 10),
                status: "UPCOMING", min_cgpa: 6.0, package_offered: "",
                eligible_programs: "", roles: "", notes: "" });
      onCreated();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="launch-add-drive-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Drive
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="launch-drive-dialog">
        <DialogHeader><DialogTitle>Schedule a placement drive</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select data-testid="drive-company-select"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={form.company_id}
            onChange={(e) => setForm(s => ({ ...s, company_id: e.target.value }))}>
            <option value="">— Pick a company —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Input data-testid="drive-date" type="date" value={form.drive_date}
            onChange={(e) => setForm(s => ({ ...s, drive_date: e.target.value }))} />
          <select data-testid="drive-status" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={form.status}
            onChange={(e) => setForm(s => ({ ...s, status: e.target.value }))}>
            {["UPCOMING", "OPEN", "CLOSED", "CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="drive-cgpa" type="number" step="0.1" placeholder="Min CGPA"
              value={form.min_cgpa}
              onChange={(e) => setForm(s => ({ ...s, min_cgpa: e.target.value }))} />
            <Input data-testid="drive-pkg" type="number" placeholder="Package (LPA)"
              value={form.package_offered}
              onChange={(e) => setForm(s => ({ ...s, package_offered: e.target.value }))} />
          </div>
          <Input data-testid="drive-programs" placeholder="Eligible programs (comma separated)"
            value={form.eligible_programs}
            onChange={(e) => setForm(s => ({ ...s, eligible_programs: e.target.value }))} />
          <Input data-testid="drive-roles" placeholder="Roles (comma separated)"
            value={form.roles}
            onChange={(e) => setForm(s => ({ ...s, roles: e.target.value }))} />
          <Textarea data-testid="drive-notes" rows={2} placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm(s => ({ ...s, notes: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="drive-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosLaunchAdmin() {
  const { current } = useInstitution();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try { const { data } = await api.get(`/v1/launch/stats`); setStats(data); }
    catch { setStats(null); } finally { setLoading(false); }
  }, [current]);
  useEffect(() => { load(); }, [load]);

  if (!current) return null;
  const maxRec = Math.max(1, ...(stats?.top_recruiters || []).map(r => r.count));

  return (
    <div data-testid="claros-launch-admin-page">
      <PageHeader eyebrow="Claros Launch · Admin Analytics" moduleId="claros-launch" title="Placement Analytics"
        description={`Year-over-year placement performance for ${current.short_name || current.name}.`}
        actions={
          <div className="flex items-center gap-2">
            <NewCompanyDialog onCreated={load} />
            <NewDriveDialog onCreated={load} />
          </div>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        {loading ? <div className="text-center py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" />Loading…</div> :
         !stats ? <div className="text-center py-12 text-sm text-muted-foreground">No stats available.</div> :
         <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="launch-admin-kpis">
            <Kpi icon={Users} label="Placed students" value={stats.placed_count} testid="launch-kpi-placed" />
            <Kpi icon={TrendingUp} label="Placement %" value={`${stats.placement_pct}%`} testid="launch-kpi-pct" tone={stats.placement_pct >= 80 ? "emerald" : stats.placement_pct >= 60 ? "amber" : "red"} />
            <Kpi icon={DollarSign} label="Avg package" value={`₹${stats.avg_package}L`} testid="launch-kpi-avg" />
            <Kpi icon={Award} label="Highest package" value={`₹${stats.max_package}L`} testid="launch-kpi-max" tone="emerald" />
          </div>
          <div className="rounded-lg border border-border bg-card p-5" data-testid="launch-admin-top-recruiters">
            <h3 className="font-semibold text-sm mb-4">Top recruiters</h3>
            {stats.top_recruiters?.length === 0 ? <div className="text-center py-6 text-sm text-muted-foreground">No placements recorded yet.</div> :
             <div className="space-y-2.5">
              {stats.top_recruiters.map(r => {
                const w = (r.count / maxRec) * 100;
                return (
                  <div key={r.company} className="flex items-center gap-3" data-testid={`launch-recruiter-${r.company}`}>
                    <div className="w-40 text-sm font-medium">{r.company}</div>
                    <div className="flex-1 h-6 bg-muted/40 rounded">
                      <div className="h-full bg-primary rounded flex items-center justify-end pe-2 text-[10px] text-primary-foreground font-medium tabular-nums" style={{ width: `${Math.max(w, 8)}%` }}>{r.count}</div>
                    </div>
                  </div>
                );
              })}
             </div>
            }
          </div>
         </>
        }
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, testid }) {
  const toneCls = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span></div>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
