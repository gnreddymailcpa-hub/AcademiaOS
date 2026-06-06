import React, { useEffect, useState } from "react";
import {
  Sparkles, Users, Plus, Network, HeartHandshake, IndianRupee, Trophy,
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
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

/**
 * ALUMNI360 — Alumni network (Phase 2 MVP).
 * 3 tabs: Directory · Mentorship · Giving.
 */
export default function Alumni() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isAlumniAdmin = ["super_admin", "institution_admin", "registrar", "alumni_admin"].includes(user?.role);
  const [summary, setSummary] = useState(null);

  const loadSummary = async () => {
    if (!current?.id) return;
    try { setSummary((await api.get(`/alumni/${current.id}/summary`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current) return null;
  return (
    <div data-testid="alumni-page">
      <PageHeader
        eyebrow="ALUMNI360 · Engagement Network"
        title={`${current.short_name} · Alumni Community`}
        description="Directory, mentorship pairings and giving — every alumnus discoverable, every gift attributed."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 2 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">ALUMNI360</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {summary && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Alumni" value={summary.alumni} icon={Users} testid="alumni-kpi-total" />
            <Kpi label="Available mentors" value={summary.available_mentors} icon={Network} testid="alumni-kpi-mentors" />
            <Kpi label="Active mentorships" value={summary.active_mentorships} icon={HeartHandshake} testid="alumni-kpi-mp" />
            <Kpi label="Giving" value={`₹${(summary.total_giving_inr || 0).toLocaleString()}`} hint={`${summary.total_donations} gifts`} icon={IndianRupee} testid="alumni-kpi-giving" />
          </section>
        )}

        <Tabs defaultValue="directory" className="space-y-4">
          <TabsList data-testid="alumni-tabs">
            <TabsTrigger value="directory" data-testid="alumni-tab-directory">Directory</TabsTrigger>
            <TabsTrigger value="mentorship" data-testid="alumni-tab-mentorship">Mentorship</TabsTrigger>
            <TabsTrigger value="giving" data-testid="alumni-tab-giving">Giving</TabsTrigger>
          </TabsList>
          <TabsContent value="directory"><DirectoryTab institutionId={current.id} isAlumniAdmin={isAlumniAdmin} onChange={loadSummary} /></TabsContent>
          <TabsContent value="mentorship"><MentorshipTab institutionId={current.id} onChange={loadSummary} /></TabsContent>
          <TabsContent value="giving"><GivingTab institutionId={current.id} isAlumniAdmin={isAlumniAdmin} summary={summary} onChange={loadSummary} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DirectoryTab({ institutionId, isAlumniAdmin, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({
    name: "", email: "", graduation_year: new Date().getFullYear() - 5, branch: "CSE",
    company: "", role: "", location: "", available_for_mentorship: false,
  });

  const refresh = async () => {
    try { setRows((await api.get(`/alumni/${institutionId}/directory`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/alumni/${institutionId}/directory`, {
        ...draft, graduation_year: parseInt(draft.graduation_year, 10),
      });
      toast.success("Alumnus added");
      setOpen(false);
      setDraft({ name: "", email: "", graduation_year: new Date().getFullYear() - 5, branch: "CSE", company: "", role: "", location: "", available_for_mentorship: false });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => [r.name, r.email, r.branch, r.company, r.role, r.location]
        .filter(Boolean).join(" ").toLowerCase().includes(q))
    : rows;

  return (
    <Panel
      eyebrow="Directory"
      title="Alumni"
      testid="alumni-dir-panel"
      action={isAlumniAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="alumni-dir-new"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add alumnus</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="alumni-dir-name" /></div>
                <div><Label className="text-xs">Email</Label><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} data-testid="alumni-dir-email" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Graduated</Label><Input type="number" value={draft.graduation_year} onChange={(e) => setDraft({ ...draft, graduation_year: e.target.value })} data-testid="alumni-dir-year" /></div>
                <div><Label className="text-xs">Branch</Label><Input value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value })} data-testid="alumni-dir-branch" /></div>
                <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="alumni-dir-loc" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Company</Label><Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} data-testid="alumni-dir-company" /></div>
                <div><Label className="text-xs">Role</Label><Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} data-testid="alumni-dir-role" /></div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={draft.available_for_mentorship} onCheckedChange={(v) => setDraft({ ...draft, available_for_mentorship: v })} data-testid="alumni-dir-mentor" />
                <Label className="text-xs">Available for mentorship</Label>
              </div>
              <Button onClick={submit} className="w-full" data-testid="alumni-dir-submit">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      <Input
        placeholder="Search by name, branch, company or location…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3"
        data-testid="alumni-dir-search"
      />
      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{rows.length === 0 ? "No alumni yet." : "No matches."}</div>
      ) : (
        <ul className="space-y-2 text-sm" data-testid="alumni-dir-list">
          {filtered.slice(0, 50).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0" data-testid={`alumni-dir-row-${r.id}`}>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name} <span className="text-xs text-muted-foreground">· {r.branch} '{String(r.graduation_year).slice(-2)}</span></div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.role}{r.company ? " · " + r.company : ""}{r.location ? " · " + r.location : ""}
                </div>
              </div>
              {r.available_for_mentorship && <Badge className="bg-emerald-600 text-white text-[10px] shrink-0">Mentor</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MentorshipTab({ institutionId, onChange }) {
  const [alumni, setAlumni] = useState([]);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ mentor_alumni_id: "", mentee_student_id: "", mentee_name: "", focus_area: "Placement prep" });

  const refresh = async () => {
    try {
      const [a, m] = await Promise.all([
        api.get(`/alumni/${institutionId}/directory`),
        api.get(`/alumni/${institutionId}/mentorships`),
      ]);
      setAlumni(a.data || []);
      setRows(m.data || []);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    if (!draft.mentor_alumni_id) { toast.error("Pick a mentor"); return; }
    try {
      await api.post(`/alumni/${institutionId}/mentorships`, draft);
      toast.success("Mentorship paired");
      setOpen(false);
      setDraft({ mentor_alumni_id: "", mentee_student_id: "", mentee_name: "", focus_area: "Placement prep" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const availableMentors = alumni.filter((a) => a.available_for_mentorship);

  return (
    <Panel
      eyebrow="Pairings"
      title="Mentor ↔ Mentee"
      testid="alumni-mp-panel"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="alumni-mp-new"><Plus className="h-4 w-4" />Pair</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Pair mentor with mentee</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs">Mentor</Label>
                <select value={draft.mentor_alumni_id} onChange={(e) => setDraft({ ...draft, mentor_alumni_id: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="alumni-mp-mentor">
                  <option value="">— select —</option>
                  {availableMentors.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.branch} '{String(a.graduation_year).slice(-2)} · {a.company || "—"}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Mentee ID</Label><Input value={draft.mentee_student_id} onChange={(e) => setDraft({ ...draft, mentee_student_id: e.target.value })} data-testid="alumni-mp-menteeid" /></div>
                <div><Label className="text-xs">Mentee name</Label><Input value={draft.mentee_name} onChange={(e) => setDraft({ ...draft, mentee_name: e.target.value })} data-testid="alumni-mp-menteename" /></div>
              </div>
              <div><Label className="text-xs">Focus area</Label><Input value={draft.focus_area} onChange={(e) => setDraft({ ...draft, focus_area: e.target.value })} data-testid="alumni-mp-focus" /></div>
              <Button onClick={submit} className="w-full" data-testid="alumni-mp-submit">Pair</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No mentorships yet.</div>
      ) : (
        <ItemList
          testid="alumni-mp-list"
          items={rows.map((r) => ({
            id: r.id, title: `${r.mentor_name} → ${r.mentee_name}`,
            meta: r.focus_area, right: r.status,
          }))}
        />
      )}
    </Panel>
  );
}

function GivingTab({ institutionId, isAlumniAdmin, summary, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ donor_alumni_id: "", donor_name: "", campaign: "Scholarship Fund", amount_inr: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/alumni/${institutionId}/donations`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/alumni/${institutionId}/donations`, {
        ...draft, amount_inr: parseFloat(draft.amount_inr) || 0,
      });
      toast.success("Donation recorded");
      setOpen(false);
      setDraft({ donor_alumni_id: "", donor_name: "", campaign: "Scholarship Fund", amount_inr: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const maxCampaign = Math.max(...(summary?.top_campaigns || [{ amount_inr: 1 }]).map((c) => c.amount_inr), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel
        eyebrow="Ledger"
        title="Recent gifts"
        testid="alumni-giving-panel"
        action={isAlumniAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="alumni-giving-new"><Plus className="h-4 w-4" />Record</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record donation</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Donor alumni ID</Label><Input value={draft.donor_alumni_id} onChange={(e) => setDraft({ ...draft, donor_alumni_id: e.target.value })} data-testid="alumni-giving-id" /></div>
                  <div><Label className="text-xs">Donor name</Label><Input value={draft.donor_name} onChange={(e) => setDraft({ ...draft, donor_name: e.target.value })} data-testid="alumni-giving-donor" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Campaign</Label><Input value={draft.campaign} onChange={(e) => setDraft({ ...draft, campaign: e.target.value })} data-testid="alumni-giving-campaign" /></div>
                  <div><Label className="text-xs">Amount (₹)</Label><Input type="number" value={draft.amount_inr} onChange={(e) => setDraft({ ...draft, amount_inr: e.target.value })} data-testid="alumni-giving-amount" /></div>
                </div>
                <Button onClick={submit} className="w-full" data-testid="alumni-giving-submit">Record</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No donations yet.</div>
        ) : (
          <ItemList
            testid="alumni-giving-list"
            items={rows.slice(0, 10).map((r) => ({
              id: r.id, title: r.donor_name,
              meta: `${r.campaign} · ${(r.received_at || "").slice(0, 10)}`,
              right: `₹${(r.amount_inr || 0).toLocaleString()}`,
            }))}
          />
        )}
      </Panel>

      <Panel eyebrow="Leaderboard" title="Top campaigns" testid="alumni-leaderboard-panel" action={<Trophy className="h-4 w-4 text-amber-500" />}>
        {(summary?.top_campaigns || []).length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No data yet.</div>
        ) : (
          <ul className="space-y-3" data-testid="alumni-leaderboard-list">
            {summary.top_campaigns.map((c) => (
              <li key={c.campaign} data-testid={`alumni-campaign-${c.campaign}`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{c.campaign}</span>
                  <span className="font-mono text-muted-foreground">₹{c.amount_inr.toLocaleString()}</span>
                </div>
                <MiniBar value={c.amount_inr} max={maxCampaign * 1.1} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
