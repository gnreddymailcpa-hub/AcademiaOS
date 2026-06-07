import React, { useCallback, useEffect, useState } from "react";
import {
  FileText, BookOpen, Award, DollarSign, Sparkles, Loader2, Plus,
  ExternalLink, Search, Copy, Beaker,
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

function StatCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div className="card p-4 border border-border" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-tight mt-1">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AddPubDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", journal_name: "", publication_type: "JOURNAL",
    year_of_publication: new Date().getFullYear(), doi: "", citations_count: 0,
    is_indexed: false, indexing_db: "", abstract: "", url: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      await api.post("/v1/research/publications", {
        ...form, authors: [],
        year_of_publication: Number(form.year_of_publication),
        citations_count: Number(form.citations_count || 0),
      });
      toast.success("Publication added");
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="research-add-pub-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Publication
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="research-pub-dialog">
        <DialogHeader><DialogTitle>Add Publication</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input data-testid="pub-title" placeholder="Title" value={form.title}
            onChange={(e) => setForm(s => ({ ...s, title: e.target.value }))} />
          <Input data-testid="pub-journal" placeholder="Journal / Conference"
            value={form.journal_name}
            onChange={(e) => setForm(s => ({ ...s, journal_name: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <select data-testid="pub-type" className="border rounded-md px-2 py-2 text-sm bg-background"
              value={form.publication_type}
              onChange={(e) => setForm(s => ({ ...s, publication_type: e.target.value }))}>
              {["JOURNAL", "CONFERENCE", "BOOK_CHAPTER", "PATENT"].map(t =>
                <option key={t} value={t}>{t}</option>
              )}
            </select>
            <Input data-testid="pub-year" type="number" placeholder="Year"
              value={form.year_of_publication}
              onChange={(e) => setForm(s => ({ ...s, year_of_publication: e.target.value }))} />
            <Input data-testid="pub-cites" type="number" placeholder="Citations"
              value={form.citations_count}
              onChange={(e) => setForm(s => ({ ...s, citations_count: e.target.value }))} />
          </div>
          <Input data-testid="pub-doi" placeholder="DOI" value={form.doi}
            onChange={(e) => setForm(s => ({ ...s, doi: e.target.value }))} />
          <Textarea data-testid="pub-abstract" rows={3} placeholder="Abstract"
            value={form.abstract}
            onChange={(e) => setForm(s => ({ ...s, abstract: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="pub-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosResearchHome() {
  const [tab, setTab] = useState("DASH");
  const [stats, setStats] = useState(null);
  const [pubs, setPubs] = useState([]);
  const [grants, setGrants] = useState([]);
  const [filter, setFilter] = useState("");
  const [matches, setMatches] = useState([]);
  const [matching, setMatching] = useState(false);

  const [litTopic, setLitTopic] = useState("");
  const [litContext, setLitContext] = useState("");
  const [litResult, setLitResult] = useState("");
  const [litLoading, setLitLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, g] = await Promise.all([
        api.get("/v1/research/stats").then(r => r.data),
        api.get("/v1/research/publications").then(r => r.data),
        api.get("/v1/research/grants").then(r => r.data),
      ]);
      setStats(s); setPubs(p || []); setGrants(g || []);
    } catch (e) { toast.error("Failed to load research data"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? pubs.filter(p => (p.title || "").toLowerCase().includes(filter.toLowerCase()))
    : pubs;

  const matchGrants = async () => {
    setMatching(true);
    try {
      const r = await api.post("/v1/research/grants/match", {});
      setMatches(r.data.matches || []);
      toast.success(`Found ${r.data.matches?.length || 0} match(es)`);
    } catch (e) { toast.error("Match failed"); }
    finally { setMatching(false); }
  };

  const runLit = async () => {
    if (!litTopic.trim()) return toast.error("Topic required");
    setLitLoading(true); setLitResult("");
    try {
      const r = await api.post("/v1/research/literature-review", {
        topic: litTopic, context: litContext,
      });
      setLitResult(r.data.content || "");
    } catch (e) { toast.error("Generation failed"); }
    finally { setLitLoading(false); }
  };

  const tabs = [
    { id: "DASH", label: "Dashboard" }, { id: "PUBS", label: "Publications" },
    { id: "GRANTS", label: "Grants" }, { id: "LIT", label: "Literature Review" },
  ];

  return (
    <div className="space-y-6" data-testid="research-page">
      <PageHeader eyebrow="Claros Research" moduleId="claros-research" title="Research Intelligence"
        description="Publications, patents, grants, AI literature review."
      />
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            data-testid={`research-tab-${t.id.toLowerCase()}`}
            className={`px-3 py-2 -mb-px border-b-2 text-sm ${tab === t.id
              ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "DASH" && (
        <div className="space-y-4" data-testid="research-dash-pane">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard testid="stat-pubs" icon={FileText} label="Publications"
              value={stats?.publications_total}
              sub={`${stats?.publications_this_year ?? 0} this year`} />
            <StatCard testid="stat-patents" icon={Award} label="Patents"
              value={stats?.patents_total} />
            <StatCard testid="stat-projects" icon={Beaker} label="Active Projects"
              value={stats?.projects_active}
              sub={`₹${(stats?.grants_total_value || 0).toLocaleString("en-IN")} total grant`} />
            <StatCard testid="stat-hindex" icon={BookOpen} label="Avg H-index"
              value={stats?.h_index_avg} />
          </div>
          <div className="card p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Recent publications</h3>
              <AddPubDialog onCreated={load} />
            </div>
            {pubs.slice(0, 5).map(p => (
              <div key={p.id} className="py-2 border-b last:border-0 text-sm flex justify-between gap-3" data-testid={`research-pub-mini-${p.id}`}>
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.journal_name} · {p.year_of_publication}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] self-start">{p.publication_type}</Badge>
              </div>
            ))}
          </div>
          <div className="card p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Upcoming grant deadlines</h3>
              <Button size="sm" variant="outline" onClick={matchGrants} disabled={matching} data-testid="research-match-btn">
                {matching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Find Matching Grants
              </Button>
            </div>
            {grants.slice(0, 3).map(g => (
              <div key={g.id} className="py-2 border-b last:border-0 text-sm flex justify-between gap-3">
                <div>
                  <div className="font-medium">{g.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.funding_agency} · ₹{(g.max_grant_amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] self-start">Due {g.deadline}</Badge>
              </div>
            ))}
            {matches.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3" data-testid="research-matches">
                <div className="label-eyebrow">AI Matches</div>
                {matches.map(m => (
                  <div key={m.grant_id} className="flex items-start justify-between gap-3 text-sm" data-testid={`match-row-${m.grant_id}`}>
                    <div>
                      <div className="font-medium">{m.grant?.title || m.grant_id}</div>
                      <div className="text-xs text-muted-foreground">{m.reason}</div>
                    </div>
                    <Badge className="bg-violet-600 text-white text-[10px]">{m.match_score}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "PUBS" && (
        <div className="space-y-3" data-testid="research-pubs-pane">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search publications"
                value={filter} onChange={(e) => setFilter(e.target.value)}
                data-testid="pub-filter-input" />
            </div>
            <AddPubDialog onCreated={load} />
          </div>
          <div className="card border border-border divide-y">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground" data-testid="research-pubs-empty">No publications.</div>
            )}
            {filtered.map(p => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3" data-testid={`research-pub-row-${p.id}`}>
                <div>
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.journal_name} · {p.year_of_publication}</div>
                  {p.abstract && <div className="text-xs mt-1 text-muted-foreground line-clamp-2">{p.abstract}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{p.publication_type}</Badge>
                  {p.is_indexed && <Badge variant="outline" className="bg-emerald-50 text-emerald-700">{p.indexing_db || "Indexed"}</Badge>}
                  <span className="text-muted-foreground">{p.citations_count} cites</span>
                  {p.doi && <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="text-primary underline">DOI</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "GRANTS" && (
        <div className="space-y-3" data-testid="research-grants-pane">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Open grant opportunities</h3>
            <Button size="sm" variant="outline" onClick={matchGrants} disabled={matching} data-testid="research-grants-match-btn">
              {matching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Match to My Research
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {grants.map(g => {
              const match = matches.find(m => m.grant_id === g.id);
              return (
                <div key={g.id} className="card p-4 border border-border space-y-2" data-testid={`grant-card-${g.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{g.title}</div>
                    {match && <Badge className="bg-violet-600 text-white text-[10px]">{match.match_score}%</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{g.funding_agency}</div>
                  <div className="text-xs">{g.description}</div>
                  <div className="flex flex-wrap gap-1">
                    {(g.domain_tags || []).map(d => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>₹{(g.max_grant_amount || 0).toLocaleString("en-IN")}</span>
                    <span className="text-muted-foreground">Due {g.deadline}</span>
                  </div>
                  {g.url && (
                    <a href={g.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                      Apply <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "LIT" && (
        <div className="space-y-3" data-testid="research-lit-pane">
          <div className="card p-5 border border-border space-y-3">
            <Input placeholder="Topic (e.g. Federated learning in education)"
              value={litTopic} onChange={(e) => setLitTopic(e.target.value)}
              data-testid="lit-topic-input" />
            <Textarea rows={3} placeholder="Context (optional)" value={litContext}
              onChange={(e) => setLitContext(e.target.value)}
              data-testid="lit-context-input" />
            <Button onClick={runLit} disabled={litLoading} data-testid="lit-generate-btn">
              {litLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Review
            </Button>
          </div>
          {litResult && (
            <div className="card p-5 border border-border space-y-3" data-testid="lit-result">
              <div className="flex items-center justify-end">
                <Button size="sm" variant="outline"
                  onClick={() => { navigator.clipboard.writeText(litResult); toast.success("Copied"); }}
                  data-testid="lit-copy-btn">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{litResult}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
