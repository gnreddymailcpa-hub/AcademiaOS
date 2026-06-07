import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Plus, Loader2, BarChart3, Globe, MessageCircle, UserPlus,
  Footprints, Smartphone, CalendarDays, Star,
} from "lucide-react";

const STAGES = [
  { key: "NEW", label: "New", tone: "bg-slate-500/10 border-slate-500/30" },
  { key: "CONTACTED", label: "Contacted", tone: "bg-blue-500/10 border-blue-500/30" },
  { key: "COUNSELED", label: "Counseled", tone: "bg-indigo-500/10 border-indigo-500/30" },
  { key: "APPLIED", label: "Applied", tone: "bg-amber-500/10 border-amber-500/30" },
  { key: "OFFERED", label: "Offered", tone: "bg-violet-500/10 border-violet-500/30" },
  { key: "ENROLLED", label: "Enrolled", tone: "bg-emerald-500/10 border-emerald-500/30" },
  { key: "DROPPED", label: "Dropped", tone: "bg-red-500/10 border-red-500/30" },
];

const SOURCE_ICONS = {
  WEBSITE: Globe, WHATSAPP: MessageCircle, REFERRAL: UserPlus,
  WALKIN: Footprints, SOCIAL: Smartphone, EVENT: CalendarDays,
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreToColor(score) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function ClarosEnrollKanban() {
  const { current } = useInstitution();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    full_name: "", email: "", phone: "", program_interest: "",
    source: "WEBSITE", city: "", eapcet_rank: "", notes: "",
  });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/v1/enroll/leads?page_size=500`);
      setLeads(data.items || []);
    } catch (e) {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { load(); }, [load]);

  const byStage = useMemo(() => {
    const out = {};
    STAGES.forEach(s => { out[s.key] = []; });
    for (const l of leads) {
      const k = l.status || "NEW";
      out[k] = out[k] || [];
      out[k].push(l);
    }
    return out;
  }, [leads]);

  const move = async (lead, toStatus) => {
    if (lead.status === toStatus) return;
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: toStatus } : l));
    try {
      await api.put(`/v1/enroll/leads/${lead.id}`, { status: toStatus });
      toast.success(`Moved to ${toStatus}`);
      load();  // refresh score (server recomputes)
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not move lead");
      load();
    }
  };

  const onDragStart = (e, lead) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e, stage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const lead = leads.find(l => l.id === id);
    if (lead) move(lead, stage);
  };

  const submitNew = async () => {
    if (!draft.full_name.trim() || !draft.email.trim() || !draft.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    setPosting(true);
    try {
      const payload = {
        ...draft,
        institution_id: current.id,
        eapcet_rank: draft.eapcet_rank ? parseInt(draft.eapcet_rank, 10) : null,
      };
      await api.post(`/v1/enroll/leads`, payload);
      toast.success("Lead created");
      setDraft({
        full_name: "", email: "", phone: "", program_interest: "",
        source: "WEBSITE", city: "", eapcet_rank: "", notes: "",
      });
      setOpenCreate(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create lead");
    } finally {
      setPosting(false);
    }
  };

  if (!current) return null;

  return (
    <div data-testid="claros-enroll-kanban-page">
      <PageHeader
        eyebrow="Claros Enroll · Admissions CRM"
        title="Admissions Pipeline"
        description={`Drag a lead card across stages — score recomputes automatically. ${leads.length} active leads.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/enroll/analytics")} data-testid="enroll-analytics-link">
              <BarChart3 className="h-3.5 w-3.5 me-1.5" /> Analytics
            </Button>
            <Sheet open={openCreate} onOpenChange={setOpenCreate}>
              <SheetTrigger asChild>
                <Button size="sm" data-testid="enroll-add-lead-btn"><Plus className="h-3.5 w-3.5 me-1.5" /> Add Lead</Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader><SheetTitle>Add a new lead</SheetTitle></SheetHeader>
                <div className="space-y-3 mt-4">
                  <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} placeholder="Full name *" data-testid="enroll-draft-name" />
                  <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email *" type="email" data-testid="enroll-draft-email" />
                  <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone *" data-testid="enroll-draft-phone" />
                  <Input value={draft.program_interest} onChange={(e) => setDraft({ ...draft, program_interest: e.target.value })} placeholder="Program interest" data-testid="enroll-draft-program" />
                  <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="City" />
                  <Input value={draft.eapcet_rank} onChange={(e) => setDraft({ ...draft, eapcet_rank: e.target.value })} placeholder="EAPCET rank" type="number" data-testid="enroll-draft-rank" />
                  <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v })}>
                    <SelectTrigger data-testid="enroll-draft-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["WEBSITE", "WHATSAPP", "REFERRAL", "WALKIN", "SOCIAL", "EVENT"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" rows={3} />
                  <Button onClick={submitNew} disabled={posting} className="w-full" data-testid="enroll-draft-submit">
                    {posting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
                    Create Lead
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading leads…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="enroll-kanban-board">
            {STAGES.map(s => {
              const items = byStage[s.key] || [];
              return (
                <div
                  key={s.key}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, s.key)}
                  className={`rounded-lg border-2 border-dashed ${s.tone} min-h-[400px]`}
                  data-testid={`enroll-column-${s.key}`}
                >
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{s.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="space-y-2 p-2">
                    {items.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground/70 text-center py-6">No leads</div>
                    ) : (
                      items.slice(0, 30).map(l => {
                        const SrcIcon = SOURCE_ICONS[l.source] || Globe;
                        return (
                          <div
                            key={l.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, l)}
                            onClick={() => navigate(`/enroll/leads/${l.id}`)}
                            className="rounded-md bg-card border border-border p-2.5 cursor-grab hover:shadow-md hover:border-primary/30 transition"
                            data-testid={`enroll-card-${l.id}`}
                          >
                            <div className="text-sm font-medium leading-tight">{l.full_name}</div>
                            {l.program_interest && (
                              <Badge variant="outline" className="mt-1 text-[9px] font-normal">{l.program_interest}</Badge>
                            )}
                            <div className="mt-2 flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${scoreToColor(l.lead_score)}`} style={{ width: `${l.lead_score}%` }} />
                              </div>
                              <span className="text-[9px] tabular-nums text-muted-foreground flex items-center">
                                <Star className="h-2.5 w-2.5 me-0.5" /> {l.lead_score}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><SrcIcon className="h-3 w-3" />{l.source}</span>
                              <span>{formatDate(l.last_contacted_at || l.created_at)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
