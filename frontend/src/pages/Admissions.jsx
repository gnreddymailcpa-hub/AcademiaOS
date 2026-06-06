import React, { useMemo, useState } from "react";
import {
  UserPlus, TrendingUp, Phone, MessageSquare, ClipboardCheck,
  Sparkles, Calculator, ArrowRight, Briefcase, Mail, Smartphone,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../components/ui/select";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

/**
 * ARISE — AI Admissions & Enrolment Suite (Phase 1 net-new module).
 *
 * Phase-1 scope (per build plan):
 *   • Lead capture form with auto-scoring
 *   • Pipeline view: lead → counseled → applied → enrolled
 *   • EAPCET rank → branch probability predictor (rule-based; ML in P2)
 *   • Drip campaign trigger (WhatsApp / SMS / email simulated for demo)
 *   • Source attribution analytics
 *
 * Lead scoring uses a transparent heuristic (NOT real XGBoost yet, but the
 * payload shape matches the eventual model contract so the upgrade is a
 * drop-in replacement).
 */

const BRANCHES_BY_RANK = [
  { code: "CSE",  name: "B.Tech CSE",                     openRank: 1,     closeRank: 6500 },
  { code: "AIML", name: "B.Tech CSE (AI & ML)",           openRank: 1500,  closeRank: 12000 },
  { code: "DS",   name: "B.Tech CSE (Data Science)",      openRank: 2000,  closeRank: 14000 },
  { code: "ECE",  name: "B.Tech ECE",                     openRank: 4000,  closeRank: 22000 },
  { code: "EEE",  name: "B.Tech EEE",                     openRank: 12000, closeRank: 38000 },
  { code: "CIV",  name: "B.Tech Civil",                   openRank: 20000, closeRank: 60000 },
  { code: "MECH", name: "B.Tech Mechanical",              openRank: 18000, closeRank: 55000 },
];

function scoreLead(lead) {
  // Transparent heuristic — replaceable by XGBoost without UI changes
  let score = 50;
  const rank = parseInt(lead.eapcet_rank, 10) || 999999;
  if (rank < 5000) score += 25;
  else if (rank < 15000) score += 15;
  else if (rank < 30000) score += 5;
  else score -= 10;

  if (lead.budget_lakhs && parseFloat(lead.budget_lakhs) >= 3) score += 8;
  if (lead.preferred_branch === "CSE" || lead.preferred_branch === "AIML") score += 7;
  if (lead.source === "EAPCET counselling") score += 12;
  if (lead.source === "Reference / Alumni") score += 10;
  if (lead.source === "Walk-in") score += 6;
  if (lead.phone && lead.email) score += 4;
  return Math.max(0, Math.min(100, score));
}

function predictBranch(rank) {
  const r = parseInt(rank, 10);
  if (!r || r < 1) return [];
  return BRANCHES_BY_RANK.map((b) => {
    let prob = 0;
    if (r <= b.openRank) prob = 95;
    else if (r <= b.closeRank) {
      const span = b.closeRank - b.openRank;
      const inside = b.closeRank - r;
      prob = Math.round(20 + (inside / span) * 70);
    } else {
      const gap = r - b.closeRank;
      prob = Math.max(0, 18 - Math.round(gap / 500));
    }
    return { ...b, probability: prob };
  }).sort((a, b) => b.probability - a.probability);
}

// Seeded demo leads (would come from `/api/admissions/leads` in production)
const SEED_LEADS = [
  { id: "ld-1", name: "Akhil Reddy",     phone: "+91 98xx xx1212", email: "akhil@ex.com",     branch: "CSE",  rank: 3450,  source: "EAPCET counselling", stage: "counseled", score: 92 },
  { id: "ld-2", name: "Priya Sharma",    phone: "+91 99xx xx4521", email: "priya@ex.com",     branch: "AIML", rank: 8120,  source: "Reference / Alumni", stage: "applied",   score: 88 },
  { id: "ld-3", name: "Manikanta T.",    phone: "+91 90xx xx0987", email: "mani@ex.com",      branch: "CSE",  rank: 1240,  source: "Walk-in",            stage: "enrolled",  score: 96 },
  { id: "ld-4", name: "Aravind K.",      phone: "+91 87xx xx5544", email: "arav@ex.com",      branch: "ECE",  rank: 11400, source: "Online inquiry",     stage: "counseled", score: 71 },
  { id: "ld-5", name: "Lakshmi P.",      phone: "+91 80xx xx7676", email: "lak@ex.com",       branch: "DS",   rank: 6700,  source: "EAPCET counselling", stage: "applied",   score: 84 },
  { id: "ld-6", name: "Sai Kumar",       phone: "+91 70xx xx9999", email: "sai@ex.com",       branch: "MECH", rank: 28900, source: "Online inquiry",     stage: "new",       score: 58 },
  { id: "ld-7", name: "Sneha R.",        phone: "+91 88xx xx1010", email: "sneha@ex.com",     branch: "EEE",  rank: 19500, source: "Walk-in",            stage: "new",       score: 64 },
  { id: "ld-8", name: "Bhavana N.",      phone: "+91 89xx xx2020", email: "bhav@ex.com",      branch: "AIML", rank: 9100,  source: "Reference / Alumni", stage: "counseled", score: 79 },
];

const STAGES = ["new", "counseled", "applied", "enrolled"];

export default function Admissions() {
  const { current } = useInstitution();
  const [leads, setLeads] = useState(SEED_LEADS);
  const [draft, setDraft] = useState({
    name: "", phone: "", email: "",
    preferred_branch: "CSE", eapcet_rank: "",
    budget_lakhs: "", source: "Online inquiry",
  });
  const [rankInput, setRankInput] = useState("");

  const stats = useMemo(() => ({
    total: leads.length,
    enrolled: leads.filter((l) => l.stage === "enrolled").length,
    applied: leads.filter((l) => l.stage === "applied").length,
    counseled: leads.filter((l) => l.stage === "counseled").length,
    new: leads.filter((l) => l.stage === "new").length,
    avgScore: Math.round(leads.reduce((a, l) => a + l.score, 0) / Math.max(leads.length, 1)),
  }), [leads]);

  const conv = stats.enrolled / Math.max(stats.total, 1) * 100;

  const predictions = useMemo(() => predictBranch(rankInput), [rankInput]);

  const submit = () => {
    if (!draft.name || !draft.phone) {
      toast.error("Name and phone are required");
      return;
    }
    const score = scoreLead(draft);
    const lead = {
      id: `ld-${Date.now()}`,
      name: draft.name,
      phone: draft.phone,
      email: draft.email,
      branch: draft.preferred_branch,
      rank: parseInt(draft.eapcet_rank, 10) || null,
      source: draft.source,
      stage: "new",
      score,
    };
    setLeads([lead, ...leads]);
    toast.success(`${draft.name} captured · score ${score}/100 · drip campaign triggered`);
    setDraft({ name: "", phone: "", email: "", preferred_branch: "CSE", eapcet_rank: "", budget_lakhs: "", source: "Online inquiry" });
  };

  const moveStage = (id, dir) => {
    setLeads((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      const idx = STAGES.indexOf(l.stage);
      const next = STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + dir))];
      return { ...l, stage: next };
    }));
  };

  if (!current) return null;

  return (
    <div data-testid="admissions-page">
      <PageHeader
        eyebrow="ARISE · Admissions Intelligence"
        title={`${current.short_name} · Admissions Cockpit`}
        description="Capture leads, score enrolment probability, run the funnel and predict branch allotment from rank."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Phase 1 · Live
            </Badge>
            <Badge className="bg-primary text-primary-foreground">ARISE</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {/* KPI strip */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Leads · cycle" value={stats.total} icon={UserPlus} trend="+18" testid="arise-kpi-leads" />
          <Kpi label="Conversion" value={`${conv.toFixed(0)}%`} hint={`${stats.enrolled} enrolled / ${stats.total}`} icon={TrendingUp} trend="+4.2%" testid="arise-kpi-conv" />
          <Kpi label="Avg. lead score" value={stats.avgScore} hint="0–100 · enrolment probability" icon={Calculator} testid="arise-kpi-score" />
          <Kpi label="Hot leads · score ≥80" value={leads.filter((l) => l.score >= 80).length} hint="priority outreach today" icon={Sparkles} testid="arise-kpi-hot" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Capture form */}
          <Panel eyebrow="Inquiry" title="Capture a new lead" testid="arise-capture" className="lg:col-span-2">
            <div className="space-y-2.5 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="arise-name" />
                </div>
                <div>
                  <Label className="text-xs">Phone *</Label>
                  <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 …" data-testid="arise-phone" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} data-testid="arise-email" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Branch</Label>
                  <Select value={draft.preferred_branch} onValueChange={(v) => setDraft({ ...draft, preferred_branch: v })}>
                    <SelectTrigger className="h-9 text-xs" data-testid="arise-branch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRANCHES_BY_RANK.map((b) => (
                        <SelectItem key={b.code} value={b.code} className="text-xs">{b.code} · {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">EAPCET rank</Label>
                  <Input value={draft.eapcet_rank} onChange={(e) => setDraft({ ...draft, eapcet_rank: e.target.value })} placeholder="e.g. 12500" data-testid="arise-rank" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Budget (₹ Lakhs)</Label>
                  <Input value={draft.budget_lakhs} onChange={(e) => setDraft({ ...draft, budget_lakhs: e.target.value })} placeholder="3.0" />
                </div>
                <div>
                  <Label className="text-xs">Source</Label>
                  <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v })}>
                    <SelectTrigger className="h-9 text-xs" data-testid="arise-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Online inquiry", "EAPCET counselling", "Walk-in", "Reference / Alumni", "Education fair"].map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={submit} className="w-full mt-1 gap-1.5" data-testid="arise-submit">
                <UserPlus className="h-4 w-4" /> Capture & trigger drip campaign
              </Button>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" /> WhatsApp</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> SMS</span>
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> Counselor call</span>
              </div>
            </div>
          </Panel>

          {/* EAPCET rank predictor */}
          <Panel eyebrow="AI · Rank predictor" title="EAPCET → branch allotment probability" testid="arise-predictor" className="lg:col-span-3">
            <div className="flex items-end gap-3 mb-4">
              <div className="flex-1">
                <Label className="text-xs">EAPCET rank</Label>
                <Input value={rankInput} onChange={(e) => setRankInput(e.target.value)} placeholder="Enter rank (e.g. 12500)" data-testid="arise-predict-rank" />
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                Heuristic model · last cycle cut-offs. Replaceable by XGBoost in Phase 2.
              </div>
            </div>
            {predictions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Enter a rank above to see realistic branch allotment probabilities.
              </div>
            ) : (
              <div className="space-y-2.5">
                {predictions.map((p) => (
                  <div key={p.code} className="space-y-1" data-testid={`arise-predict-${p.code}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{p.code} · {p.name}</span>
                      <span className="tabular-nums font-mono text-muted-foreground">
                        {p.probability}% · cut-off {p.closeRank.toLocaleString()}
                      </span>
                    </div>
                    <MiniBar
                      value={p.probability}
                      color={p.probability > 70 ? "hsl(142, 71%, 45%)" : p.probability > 30 ? "hsl(35, 92%, 55%)" : "hsl(0, 84%, 60%)"}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        {/* CRM pipeline */}
        <Panel eyebrow="Pipeline" title="Lead → Counseled → Applied → Enrolled" testid="arise-pipeline">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {STAGES.map((stage) => {
              const items = leads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="rounded-md border border-border bg-muted/30 p-3" data-testid={`arise-col-${stage}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-mono uppercase tracking-wider text-foreground/80">{stage}</div>
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && (
                      <div className="text-[11px] text-muted-foreground italic">empty</div>
                    )}
                    {items.map((l) => (
                      <div
                        key={l.id}
                        className="rounded border border-border bg-card p-2.5 text-xs"
                        data-testid={`arise-lead-${l.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{l.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{l.phone}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              l.score >= 85 ? "bg-emerald-600/15 text-emerald-700 border-emerald-200"
                                : l.score >= 70 ? "bg-amber-500/15 text-amber-700 border-amber-200"
                                  : "bg-slate-500/15 text-slate-600 border-slate-300"
                            }`}
                          >
                            {l.score}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-mono">{l.branch}</span>
                          {l.rank && <span>· rank {l.rank.toLocaleString()}</span>}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground truncate">{l.source}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveStage(l.id, -1)}
                              disabled={stage === "new"}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-30"
                              data-testid={`arise-move-back-${l.id}`}
                            >←</button>
                            <button
                              onClick={() => moveStage(l.id, +1)}
                              disabled={stage === "enrolled"}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-30"
                              data-testid={`arise-move-fwd-${l.id}`}
                            >→</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Source attribution */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="Attribution" title="Source effectiveness · live cycle" testid="arise-source-attrib">
            {Object.entries(
              leads.reduce((acc, l) => {
                acc[l.source] = (acc[l.source] || 0) + 1;
                return acc;
              }, {})
            ).map(([src, n]) => (
              <div key={src} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{src}</span>
                  <span className="text-muted-foreground tabular-nums">{n} leads</span>
                </div>
                <MiniBar value={n} max={leads.length} />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Next 7 days" title="Counselor priority queue" testid="arise-priority"
                 action={<span className="text-xs text-muted-foreground">Sorted by score</span>}>
            <ItemList
              items={leads
                .filter((l) => l.stage !== "enrolled")
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
                .map((l) => ({
                  id: l.id,
                  title: `${l.name} · ${l.branch}`,
                  meta: `${l.source} · rank ${l.rank ? l.rank.toLocaleString() : "—"}`,
                  right: `${l.score}/100`,
                }))}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}
