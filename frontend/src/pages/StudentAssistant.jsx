import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { MessageSquareText, Send, Loader2, LifeBuoy, Clock, CheckCircle2 } from "lucide-react";

const SUGGESTED = {
  en: [
    "What is my attendance policy?",
    "When are exam dates published?",
    "How do I get my certificate?",
    "What are graduation requirements?",
  ],
  ar: [
    "ما هي سياسة الحضور؟",
    "متى تُعلَن مواعيد الامتحانات؟",
    "كيف أحصل على الشهادة؟",
    "ما متطلبات التخرج؟",
  ],
};

export default function StudentAssistant() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [openTicketDialog, setOpenTicketDialog] = useState(false);
  const [draft, setDraft] = useState({ subject: "", body: "", category: "general", severity: "normal" });
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const loadTickets = async () => {
    if (!current) return;
    try {
      const { data } = await api.get(`/tickets/${current.id}`);
      setTickets(data);
    } catch {
      /* ignore */
    }
  };

  const submitTicket = async () => {
    if (!draft.subject.trim() || !draft.body.trim()) {
      toast.error("Subject and details are required");
      return;
    }
    try {
      await api.post("/tickets", {
        institution_id: current.id,
        subject: draft.subject,
        body: draft.body,
        category: draft.category,
        severity: draft.severity,
        source: "student_assistant",
      });
      toast.success("Ticket opened · the programme office will reply within SLA");
      setOpenTicketDialog(false);
      setDraft({ subject: "", body: "", category: "general", severity: "normal" });
      loadTickets();
    } catch (e) {
      toast.error("Could not open ticket");
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setBusy(true);
    try {
      const { data } = await api.post(`/ai/assistant/message`, {
        institution_id: current.id,
        text: value,
        language: lang,
      });
      setMessages((m) => [...m, { role: "assistant", text: data.reply, model: data.model }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "I could not reach the assistant. Please try again.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;

  return (
    <div data-testid="student-assistant-page">
      <PageHeader
        eyebrow="Module 4.3 · AI Student Assistant"
        title="Student Assistant"
        description="Self-service academic support — enrolment, timetable, attendance, deadlines, certificates."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3 w-3" /> SLA · 24h
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 rounded-lg border border-border bg-card flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Student Assistant</div>
              <div className="text-[11px] text-muted-foreground">{current.short_name} · Self-service</div>
            </div>
            <div className="ms-auto text-[11px] text-muted-foreground">Escalation routed to programme office</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <MessageSquareText className="h-6 w-6 mx-auto text-primary" />
                <div className="mt-3 text-sm font-medium">How can I help with your academics today?</div>
                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {(SUGGESTED[lang] || SUGGESTED.en).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted/60 transition text-start"
                      data-testid="assistant-suggested"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <Msg key={i} m={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking that up…
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "ar" ? "اسأل المساعد الطلابي…" : "Ask anything about your studies…"}
              data-testid="assistant-input"
              disabled={busy}
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !input.trim()} data-testid="assistant-send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow mb-3">Service categories</div>
            <ul className="space-y-2 text-sm">
              {["Enrolment", "Timetable", "Attendance", "Assignments", "Exams", "Certificates", "Graduation"].map((c) => (
                <li key={c} className="flex justify-between border-b border-border last:border-0 pb-1.5">
                  <span>{c}</span>
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5" id="tickets">
            <div className="flex items-center justify-between mb-3">
              <div className="label-eyebrow">Your tickets</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenTicketDialog(true)}
                data-testid="open-ticket-btn"
              >
                <LifeBuoy className="h-3.5 w-3.5 me-1.5" />
                Open ticket
              </Button>
            </div>
            {tickets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                If the assistant cannot resolve your query, open a ticket and the programme office
                will reply within 24 hours.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="tickets-list">
                {tickets.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs"
                    data-testid={`ticket-${t.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">{t.subject}</span>
                      <Badge
                        variant="outline"
                        className={
                          t.status === "open"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700"
                        }
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.category} · {new Date(t.ts).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={openTicketDialog} onOpenChange={setOpenTicketDialog}>
        <DialogContent data-testid="open-ticket-dialog">
          <DialogHeader>
            <DialogTitle>Open a support ticket</DialogTitle>
            <DialogDescription>
              The programme office is notified instantly and will reply within the SLA window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</label>
              <Input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="One-line summary"
                data-testid="ticket-subject"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Details</label>
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="What do you need help with?"
                className="min-h-[120px]"
                data-testid="ticket-body"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Category</label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger data-testid="ticket-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["enrolment", "timetable", "attendance", "assessment", "certificate", "general"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Severity</label>
                <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v })}>
                  <SelectTrigger data-testid="ticket-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "normal", "high"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTicketDialog(false)}>Cancel</Button>
            <Button onClick={submitTicket} data-testid="ticket-submit">
              <CheckCircle2 className="me-2 h-4 w-4" /> Open ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Msg({ m }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end" data-testid="assistant-msg-user">
        <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm">{m.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3" data-testid="assistant-msg-assistant">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        <MessageSquareText className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {m.text}
        </div>
        {m.model && <div className="mt-1 text-[10px] text-muted-foreground font-mono">{m.model}</div>}
      </div>
    </div>
  );
}
