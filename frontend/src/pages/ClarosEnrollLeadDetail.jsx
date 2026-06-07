import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Star, Sparkles, Loader2, Plus,
  Trash2, MessageSquareText, Send, FileText, BadgeCheck, AlertCircle,
} from "lucide-react";

const STAGES = ["NEW", "CONTACTED", "COUNSELED", "APPLIED", "OFFERED", "ENROLLED", "DROPPED"];
const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "VISIT", "NOTE"];

const ACTIVITY_COLORS = {
  CALL: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  EMAIL: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  WHATSAPP: "bg-green-500/10 text-green-700 border-green-500/30",
  VISIT: "bg-violet-500/10 text-violet-700 border-violet-500/30",
  NOTE: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  STATUS_CHANGE: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

export default function ClarosEnrollLeadDetail() {
  const { id } = useParams();
  const { current } = useInstitution();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [counselLoading, setCounselLoading] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState([]);
  const [actDraft, setActDraft] = useState({ activity_type: "CALL", description: "" });
  const [postingAct, setPostingAct] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: d } = await api.get(`/v1/enroll/leads/${id}`);
      setData(d);
    } catch (e) {
      toast.error("Could not load lead");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (toStatus) => {
    setSavingStatus(true);
    try {
      await api.put(`/v1/enroll/leads/${id}`, { status: toStatus });
      toast.success(`Status: ${toStatus}`);
      await load();
    } catch (e) {
      toast.error("Could not update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const generateAi = async () => {
    setCounselLoading(true);
    setTalkingPoints([]);
    try {
      const { data: d } = await api.post(`/v1/enroll/leads/${id}/ai-counsel`);
      setTalkingPoints(d.talking_points || []);
      toast.success("Counseling script generated");
    } catch (e) {
      toast.error("Could not generate counseling script");
    } finally {
      setCounselLoading(false);
    }
  };

  const addActivity = async () => {
    if (!actDraft.description.trim()) {
      toast.error("Add a description first");
      return;
    }
    setPostingAct(true);
    try {
      await api.post(`/v1/enroll/leads/${id}/activity`, actDraft);
      setActDraft({ activity_type: "CALL", description: "" });
      await load();
      toast.success("Activity logged");
    } catch (e) {
      toast.error("Could not log activity");
    } finally {
      setPostingAct(false);
    }
  };

  const deleteLead = async () => {
    if (!window.confirm("Delete this lead and all its activities?")) return;
    try {
      await api.delete(`/v1/enroll/leads/${id}`);
      toast.success("Lead deleted");
      navigate("/enroll");
    } catch (e) {
      toast.error("Could not delete");
    }
  };

  if (!current) return null;

  const lead = data?.lead;
  const activities = data?.activities || [];
  const programs = data?.programs || [];

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading lead…
      </div>
    );
  }
  if (!lead) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Lead not found. <Link to="/enroll" className="text-primary underline">Back to pipeline</Link>
      </div>
    );
  }

  const nextStageIdx = STAGES.indexOf(lead.status) + 1;
  const nextStage = STAGES[nextStageIdx];

  return (
    <div data-testid="claros-enroll-lead-detail-page">
      <PageHeader
        eyebrow="Claros Enroll · Lead Detail"
        title={lead.full_name}
        description={`${lead.program_interest || "Program TBD"} · ${lead.source} · ${lead.city || "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/enroll" data-testid="enroll-detail-back"><ArrowLeft className="h-3.5 w-3.5 me-1.5" /> Pipeline</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={deleteLead} data-testid="enroll-detail-delete">
              <Trash2 className="h-3.5 w-3.5 me-1.5" /> Delete
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        {/* ----- Left column ----- */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Score card */}
          <div className="rounded-lg border border-border bg-card p-5" data-testid="enroll-detail-score-card">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lead score</div>
                <div className="text-3xl font-semibold">{lead.lead_score}<span className="text-base text-muted-foreground"> / 100</span></div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div className={lead.lead_score >= 70 ? "h-full bg-emerald-500" : lead.lead_score >= 40 ? "h-full bg-amber-500" : "h-full bg-red-500"} style={{ width: `${lead.lead_score}%` }} />
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Rank + source + activity count + status all factor into this score (auto-computed).
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-2.5 text-sm">
            <h3 className="font-semibold tracking-tight">Contact</h3>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {lead.email}</div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {lead.phone}</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {lead.city}, {lead.state}</div>
            {lead.eapcet_rank && <div className="flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" /> EAPCET rank · {lead.eapcet_rank.toLocaleString()}</div>}
          </div>

          {/* Programs */}
          {programs.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold tracking-tight mb-2 text-sm">Program interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {programs.map(p => <Badge key={p.id} variant="secondary" className="text-[10px]">{p.program_name}</Badge>)}
              </div>
            </div>
          )}

          {/* Quick stage change */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold tracking-tight mb-2 text-sm">Stage</h3>
            <Select value={lead.status} onValueChange={changeStatus} disabled={savingStatus}>
              <SelectTrigger data-testid="enroll-detail-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {nextStage && (
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => changeStatus(nextStage)} disabled={savingStatus} data-testid="enroll-detail-next-stage">
                Move to <span className="font-mono ms-1">{nextStage}</span> →
              </Button>
            )}
          </div>

          {/* AI counsel */}
          <div className="rounded-lg border border-border bg-card p-5" data-testid="enroll-detail-ai-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold tracking-tight text-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Counseling Script
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Claude generates a 5-point personalised pitch based on this lead&apos;s profile.
            </p>
            <Button onClick={generateAi} disabled={counselLoading} className="w-full" data-testid="enroll-detail-ai-btn">
              {counselLoading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Sparkles className="h-4 w-4 me-2" />}
              {talkingPoints.length === 0 ? "Generate" : "Re-generate"}
            </Button>
            {talkingPoints.length > 0 && (
              <ol className="mt-4 space-y-2.5 text-sm" data-testid="enroll-detail-talking-points">
                {talkingPoints.map((t, i) => (
                  <li key={i} className="flex gap-2.5" data-testid={`enroll-ai-point-${i}`}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ----- Right column: activity timeline ----- */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Add activity */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold tracking-tight mb-3 text-sm flex items-center gap-1.5">
              <MessageSquareText className="h-3.5 w-3.5 text-primary" /> Log activity
            </h3>
            <div className="space-y-2.5">
              <Select value={actDraft.activity_type} onValueChange={(v) => setActDraft({ ...actDraft, activity_type: v })}>
                <SelectTrigger data-testid="enroll-act-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea value={actDraft.description} onChange={(e) => setActDraft({ ...actDraft, description: e.target.value })} placeholder="What happened? E.g. Talked for 12 minutes; parent will visit campus next Tue." rows={3} data-testid="enroll-act-desc-input" />
              <Button onClick={addActivity} disabled={postingAct || !actDraft.description.trim()} data-testid="enroll-act-submit-btn">
                {postingAct ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
                Log activity
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-card" data-testid="enroll-detail-timeline">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <h3 className="font-semibold text-sm">Activity timeline</h3>
              <Badge variant="outline" className="ms-auto text-[10px]">{activities.length}</Badge>
            </div>
            {activities.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground" data-testid="enroll-detail-timeline-empty">
                No activities yet. Log the first call or note above.
              </div>
            ) : (
              <ol className="divide-y divide-border" data-testid="enroll-detail-timeline-list">
                {activities.map(a => (
                  <li key={a.id} className="px-5 py-3" data-testid={`enroll-activity-${a.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`${ACTIVITY_COLORS[a.activity_type] || ""} border text-[10px]`}>
                        {a.activity_type}
                      </Badge>
                      {a.activity_type === "STATUS_CHANGE" && (
                        <span className="text-[10px] text-muted-foreground"><AlertCircle className="h-2.5 w-2.5 inline me-0.5" /> {a.old_status} → {a.new_status}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ms-auto">
                        {a.created_at && new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{a.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
