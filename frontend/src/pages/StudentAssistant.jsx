import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { MessageSquareText, Send, Loader2, LifeBuoy, Clock } from "lucide-react";

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
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages([]);
  }, [current?.id]);

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
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow mb-3">Need a human?</div>
            <p className="text-xs text-muted-foreground">
              If the assistant cannot resolve your query, it will open a ticket with the programme
              office and you'll receive an answer within 24 hours.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <LifeBuoy className="h-3.5 w-3.5 me-1.5" />
              Open ticket
            </Button>
          </div>
        </aside>
      </div>
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
