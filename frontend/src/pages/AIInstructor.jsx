import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import { GraduationCap, Send, Sparkles, Loader2, BookOpen, ShieldCheck } from "lucide-react";

const SUGGESTED = {
  en: [
    "Explain Porter's Five Forces with a digital industry example.",
    "What are the four stages of UAE border inspection workflow?",
    "Summarise generative AI use cases for the finance function.",
    "How do biometric thresholds affect secondary verification?",
  ],
  ar: [
    "ما هي مراحل سير عمل تفتيش الحدود الإماراتية الأربع؟",
    "ما هو الحد الفيدرالي للتحقق البيومتري أحادي الوسيط؟",
    "اشرح أساسيات الذكاء الاصطناعي لقادة الأعمال.",
  ],
};

export default function AIInstructor() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!current) return;
    api.get(`/academic/${current.id}/courses`).then((r) => {
      setCourses(r.data);
      setCourseId(r.data[0]?.id || "");
      setMessages([]);
    });
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
      const { data } = await api.post(`/ai/instructor/message`, {
        institution_id: current.id,
        course_id: courseId || null,
        text: value,
        language: lang,
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply, citations: data.citations, model: data.model },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "I could not reach the AI provider. Please try again.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;
  const currentCourse = courses.find((c) => c.id === courseId);

  return (
    <div data-testid="ai-instructor-page" className="flex flex-col h-[calc(100vh-0px)]">
      <PageHeader
        eyebrow="Module 4.1 · Virtual AI Instructor"
        title="AI Instructor"
        description="Course-grounded teaching assistant — citations on every answer, faculty escalation when confidence drops."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Grounded RAG · {lang === "ar" ? "العربية" : "English"}
            </Badge>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-[260px]" data-testid="instructor-course-select">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="flex-1 grid grid-cols-12 gap-4 p-6 lg:p-8 min-h-0">
        {/* Chat */}
        <div className="col-span-12 lg:col-span-8 rounded-lg border border-border bg-card flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Instructor</div>
              <div className="text-[11px] text-muted-foreground">
                {currentCourse ? `${currentCourse.code} · ${currentCourse.title}` : "No course selected"}
              </div>
            </div>
            <div className="ms-auto text-[11px] text-muted-foreground">Cited answers · audit logged</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <Sparkles className="h-6 w-6 mx-auto text-primary" />
                <div className="mt-3 text-sm font-medium">
                  Ask anything about {currentCourse?.title || "this course"}.
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Answers are grounded in approved course material with citations.
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {(SUGGESTED[lang] || SUGGESTED.en).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted/60 transition text-start"
                      data-testid="instructor-suggested"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <Message key={i} m={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI Instructor is thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "ar" ? "اسأل المعلم الذكي…" : "Ask the AI Instructor…"}
              data-testid="instructor-input"
              disabled={busy}
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !input.trim()} data-testid="instructor-send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow">Knowledge base</div>
            <h3 className="text-sm font-semibold mt-1 mb-3">Approved sources for this course</h3>
            <CourseSources courseId={courseId} institutionId={current.id} />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow">Governance</div>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                ["Source grounding", "Required"],
                ["Citations", "Required"],
                ["Language", lang === "ar" ? "Arabic" : "English"],
                ["Escalation", "Faculty inbox · 24h SLA"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-border last:border-0 pb-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Message({ m }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end" data-testid="msg-user">
        <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3" data-testid="msg-assistant">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {m.text}
        </div>
        {m.citations?.length > 0 && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {m.citations.map((c) => (
              <div key={c.n} className="rounded-md border border-border bg-muted/30 p-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold">[{c.n}] {c.title}</span>
                  <span className="text-muted-foreground tabular-nums">{(c.score * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-1 text-muted-foreground italic line-clamp-2">"{c.snippet}…"</div>
              </div>
            ))}
          </div>
        )}
        {m.model && <div className="mt-1 text-[10px] text-muted-foreground font-mono">{m.model}</div>}
      </div>
    </div>
  );
}

function CourseSources({ courseId, institutionId }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!institutionId) return;
    api.get(`/ai/content/sources/${institutionId}`).then((r) => {
      const list = r.data.filter((s) => s.approved && (!courseId || s.course_id === courseId));
      setItems(list);
    });
  }, [institutionId, courseId]);
  if (items.length === 0)
    return <div className="text-xs text-muted-foreground">No approved sources for this course yet.</div>;
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id} className="flex items-start gap-2 text-xs">
          <BookOpen className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{s.title}</div>
            <div className="text-[10px] text-muted-foreground">{s.kind.replace("_", " ")} · {s.uploaded_by}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
