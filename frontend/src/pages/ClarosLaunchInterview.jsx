import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { MessageCircle, Loader2, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";

const QTYPES = ["TECHNICAL", "HR", "APTITUDE"];

export default function ClarosLaunchInterview() {
  const { current } = useInstitution();
  const [companies, setCompanies] = useState([]);
  const [draft, setDraft] = useState({ company_id: "", target_role: "SDE-1", question_type: "TECHNICAL" });
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [history, setHistory] = useState([]);

  const loadCompanies = useCallback(async () => {
    try { const { data } = await api.get(`/v1/launch/companies`); setCompanies(data.items || []); } catch {}
  }, []);
  const loadHistory = useCallback(async () => {
    try { const { data } = await api.get(`/v1/launch/interview/history`); setHistory(data.items || []); } catch {}
  }, []);
  useEffect(() => { loadCompanies(); loadHistory(); }, [loadCompanies, loadHistory]);

  const getQ = async () => {
    setLoadingQ(true); setQuestion(""); setAnswer(""); setFeedback(null);
    try {
      const { data } = await api.post(`/v1/launch/interview/question`, draft);
      setQuestion(data.question || "");
    } catch { toast.error("Could not generate question"); } finally { setLoadingQ(false); }
  };
  const evaluate = async () => {
    if (!answer.trim()) return toast.error("Add an answer first");
    setEvaluating(true);
    try {
      const company = companies.find(c => c.id === draft.company_id);
      const { data } = await api.post(`/v1/launch/interview/evaluate`, {
        question, answer, role: draft.target_role,
        company_name: company?.name || "", company_id: draft.company_id || null,
      });
      setFeedback(data);
      toast.success(`AI scored: ${data.ai_score}/10`);
      loadHistory();
    } catch { toast.error("Evaluation failed"); } finally { setEvaluating(false); }
  };

  if (!current) return null;
  return (
    <div data-testid="claros-launch-interview-page">
      <PageHeader eyebrow="Claros Launch · Mock Interview" moduleId="claros-launch" title="AI Mock Interview Room"
        description="Practice technical, HR or aptitude rounds. Claude scores your answer 1-10 with strengths + improvements."
      />
      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="launch-interview-config">
            <div>
              <label className="text-xs text-muted-foreground">Target role</label>
              <Input value={draft.target_role} onChange={(e) => setDraft({ ...draft, target_role: e.target.value })} data-testid="launch-interview-role-input" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Company</label>
              <Select value={draft.company_id} onValueChange={(v) => setDraft({ ...draft, company_id: v })}>
                <SelectTrigger data-testid="launch-interview-company-select"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Question type</label>
              <Select value={draft.question_type} onValueChange={(v) => setDraft({ ...draft, question_type: v })}>
                <SelectTrigger data-testid="launch-interview-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{QTYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={getQ} disabled={loadingQ} className="w-full" data-testid="launch-interview-get-q-btn">
            {loadingQ ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <MessageCircle className="h-4 w-4 me-2" />}Get Question
          </Button>
          {question && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="launch-interview-question-card">
                <Badge variant="outline" className="text-[10px] mb-2">{draft.question_type}</Badge>
                <p className="text-sm leading-relaxed">{question}</p>
              </div>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} placeholder="Type your answer here…" data-testid="launch-interview-answer-input" />
              <Button onClick={evaluate} disabled={evaluating || !answer.trim()} className="w-full" data-testid="launch-interview-submit-btn">
                {evaluating ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />}Submit for AI Feedback
              </Button>
            </>
          )}
          {feedback && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3" data-testid="launch-interview-feedback">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold" data-testid="launch-feedback-score">{feedback.ai_score}/10</div>
                <div className="text-sm font-medium">AI Feedback</div>
              </div>
              {feedback.ai_strengths?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-700 mb-1.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Strengths</div>
                  <ul className="space-y-1">{feedback.ai_strengths.map((s, i) => <li key={i} className="text-sm" data-testid={`launch-feedback-strength-${i}`}>✓ {s}</li>)}</ul>
                </div>
              )}
              {feedback.ai_improvements?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Improvements</div>
                  <ul className="space-y-1">{feedback.ai_improvements.map((s, i) => <li key={i} className="text-sm" data-testid={`launch-feedback-improvement-${i}`}>⚠ {s}</li>)}</ul>
                </div>
              )}
              {feedback.ai_feedback && (
                <div className="bg-muted/40 rounded p-3 flex gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{feedback.ai_feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-lg border border-border bg-card" data-testid="launch-interview-history">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <h3 className="font-semibold text-sm">Past interviews</h3>
              <Badge variant="outline" className="ms-auto text-[10px]">{history.length}</Badge>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No history yet.</div>
            ) : (
              <ul className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {history.map(h => (
                  <li key={h.id} className="px-5 py-3" data-testid={`launch-history-${h.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{h.target_role}</Badge>
                      <Badge className="text-[10px]" variant={h.ai_score >= 7 ? "default" : h.ai_score >= 5 ? "secondary" : "destructive"}>{h.ai_score}/10</Badge>
                      <span className="text-[10px] text-muted-foreground ms-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs line-clamp-2">{h.question_text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
