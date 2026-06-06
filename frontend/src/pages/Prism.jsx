import React, { useEffect, useState } from "react";
import {
  Sparkles, BookText, Lightbulb, Banknote, Plus, TrendingUp, Quote,
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
 * PRISM — Research & Innovation Management (Phase 2 MVP).
 * 3 tabs: Publications · Patents · Grants. KPI strip + summary panel.
 */
export default function Prism() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isResearch = ["super_admin", "institution_admin", "faculty", "instructor", "research_admin"].includes(user?.role);

  const [summary, setSummary] = useState(null);

  const loadSummary = async () => {
    if (!current?.id) return;
    try { setSummary((await api.get(`/prism/${current.id}/summary`)).data); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current) return null;
  return (
    <div data-testid="prism-page">
      <PageHeader
        eyebrow="PRISM · Research Intelligence"
        title={`${current.short_name} · Research Cockpit`}
        description="Publications, patents and grants — h-index, citation analytics and grant value, recomputed live."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 2 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">PRISM</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {summary && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Publications" value={summary.publications} hint={`${summary.total_citations} citations`} icon={BookText} testid="prism-kpi-pubs" />
            <Kpi label="h-index" value={summary.h_index} icon={Quote} testid="prism-kpi-h" />
            <Kpi label="Patents granted" value={summary.patents_granted} hint={`${summary.patents_filed} filed`} icon={Lightbulb} testid="prism-kpi-pat" />
            <Kpi label="Active grants" value={`₹${summary.grant_value_lakhs}L`} hint={`${summary.active_grants} active`} icon={Banknote} testid="prism-kpi-grt" />
          </section>
        )}

        <Tabs defaultValue="publications" className="space-y-4">
          <TabsList data-testid="prism-tabs">
            <TabsTrigger value="publications" data-testid="prism-tab-pubs">Publications</TabsTrigger>
            <TabsTrigger value="patents" data-testid="prism-tab-patents">Patents</TabsTrigger>
            <TabsTrigger value="grants" data-testid="prism-tab-grants">Grants</TabsTrigger>
          </TabsList>

          <TabsContent value="publications">
            <PubsTab institutionId={current.id} isResearch={isResearch} onChange={loadSummary} />
            {summary && summary.publications_by_year?.length > 0 && (
              <Panel eyebrow="Trend" title="Publications by year" testid="prism-trend-panel" className="mt-4">
                <div className="space-y-2">
                  {summary.publications_by_year.map((y) => (
                    <div key={y.year}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{y.year}</span>
                        <span className="font-mono text-muted-foreground">{y.count}</span>
                      </div>
                      <MiniBar value={y.count} max={Math.max(...summary.publications_by_year.map((x) => x.count), 1) * 1.2} />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </TabsContent>
          <TabsContent value="patents"><PatentsTab institutionId={current.id} isResearch={isResearch} onChange={loadSummary} /></TabsContent>
          <TabsContent value="grants"><GrantsTab institutionId={current.id} isResearch={isResearch} onChange={loadSummary} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PubsTab({ institutionId, isResearch, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", venue: "", year: new Date().getFullYear(), citations: 0, authors: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/prism/${institutionId}/publications`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/prism/${institutionId}/publications`, {
        ...draft, year: parseInt(draft.year, 10), citations: parseInt(draft.citations, 10) || 0,
        authors: draft.authors.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Publication added");
      setOpen(false);
      setDraft({ title: "", venue: "", year: new Date().getFullYear(), citations: 0, authors: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Catalogue"
      title="Publications"
      testid="prism-pubs-panel"
      action={isResearch && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="prism-pub-new"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add publication</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="prism-pub-title" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Venue</Label><Input value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} data-testid="prism-pub-venue" /></div>
                <div><Label className="text-xs">Year</Label><Input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} data-testid="prism-pub-year" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Citations</Label><Input type="number" value={draft.citations} onChange={(e) => setDraft({ ...draft, citations: e.target.value })} data-testid="prism-pub-cites" /></div>
                <div><Label className="text-xs">Authors (csv)</Label><Input value={draft.authors} onChange={(e) => setDraft({ ...draft, authors: e.target.value })} data-testid="prism-pub-authors" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="prism-pub-submit">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No publications yet.</div>
      ) : (
        <ItemList
          testid="prism-pubs-list"
          items={rows.map((r) => ({
            id: r.id, title: r.title,
            meta: `${r.venue} · ${r.year} · ${(r.authors || []).slice(0, 3).join(", ")}`,
            right: `${r.citations} cited`,
          }))}
        />
      )}
    </Panel>
  );
}

function PatentsTab({ institutionId, isResearch, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", status: "filed", year: new Date().getFullYear(), inventors: "", patent_number: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/prism/${institutionId}/patents`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/prism/${institutionId}/patents`, {
        ...draft, year: parseInt(draft.year, 10),
        inventors: draft.inventors.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Patent added");
      setOpen(false);
      setDraft({ title: "", status: "filed", year: new Date().getFullYear(), inventors: "", patent_number: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="IP portfolio"
      title="Patents"
      testid="prism-patents-panel"
      action={isResearch && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="prism-pat-new"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add patent</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="prism-pat-title" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Status</Label>
                  <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm" data-testid="prism-pat-status">
                    {["filed", "granted", "abandoned"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Year</Label><Input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} data-testid="prism-pat-year" /></div>
                <div><Label className="text-xs">Patent #</Label><Input value={draft.patent_number} onChange={(e) => setDraft({ ...draft, patent_number: e.target.value })} data-testid="prism-pat-num" /></div>
              </div>
              <div><Label className="text-xs">Inventors (csv)</Label><Input value={draft.inventors} onChange={(e) => setDraft({ ...draft, inventors: e.target.value })} data-testid="prism-pat-inventors" /></div>
              <Button onClick={submit} className="w-full" data-testid="prism-pat-submit">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No patents yet.</div>
      ) : (
        <ItemList
          testid="prism-pat-list"
          items={rows.map((r) => ({
            id: r.id, title: r.title,
            meta: `${r.year} · ${(r.inventors || []).slice(0, 3).join(", ")} ${r.patent_number ? "· " + r.patent_number : ""}`,
            right: r.status,
          }))}
        />
      )}
    </Panel>
  );
}

function GrantsTab({ institutionId, isResearch, onChange }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ agency: "", title: "", amount_lakhs: "", pi: "", status: "active", start_year: new Date().getFullYear(), end_year: "" });

  const refresh = async () => {
    try { setRows((await api.get(`/prism/${institutionId}/grants`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/prism/${institutionId}/grants`, {
        ...draft,
        amount_lakhs: parseFloat(draft.amount_lakhs) || 0,
        start_year: parseInt(draft.start_year, 10),
        end_year: draft.end_year ? parseInt(draft.end_year, 10) : null,
      });
      toast.success("Grant added");
      setOpen(false);
      setDraft({ agency: "", title: "", amount_lakhs: "", pi: "", status: "active", start_year: new Date().getFullYear(), end_year: "" });
      refresh(); onChange?.();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Funding"
      title="Grants"
      testid="prism-grants-panel"
      action={isResearch && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" data-testid="prism-grt-new"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add grant</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Agency</Label><Input value={draft.agency} onChange={(e) => setDraft({ ...draft, agency: e.target.value })} data-testid="prism-grt-agency" /></div>
                <div><Label className="text-xs">PI</Label><Input value={draft.pi} onChange={(e) => setDraft({ ...draft, pi: e.target.value })} data-testid="prism-grt-pi" /></div>
              </div>
              <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="prism-grt-title" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Amount (₹L)</Label><Input type="number" value={draft.amount_lakhs} onChange={(e) => setDraft({ ...draft, amount_lakhs: e.target.value })} data-testid="prism-grt-amount" /></div>
                <div><Label className="text-xs">Start</Label><Input type="number" value={draft.start_year} onChange={(e) => setDraft({ ...draft, start_year: e.target.value })} data-testid="prism-grt-start" /></div>
                <div><Label className="text-xs">End</Label><Input type="number" value={draft.end_year} onChange={(e) => setDraft({ ...draft, end_year: e.target.value })} data-testid="prism-grt-end" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="prism-grt-submit">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No grants yet.</div>
      ) : (
        <ItemList
          testid="prism-grt-list"
          items={rows.map((r) => ({
            id: r.id, title: r.title,
            meta: `${r.agency} · PI ${r.pi} · ${r.start_year}${r.end_year ? "–" + r.end_year : ""}`,
            right: `₹${r.amount_lakhs}L · ${r.status}`,
          }))}
        />
      )}
    </Panel>
  );
}
