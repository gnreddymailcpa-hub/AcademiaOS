import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
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
import {
  GraduationCap,
  Send,
  Sparkles,
  Loader2,
  BookOpen,
  ShieldCheck,
  Mic,
  Volume2,
  Brain,
  Activity,
  Quote,
  Zap,
  Layers,
  Languages,
  MessageSquareQuote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const PERSONAS = [
  { id: "lecturer", labelEn: "Lecturer", labelAr: "محاضر", hint: "Structured · example · source callback" },
  { id: "tutor", labelEn: "Tutor", labelAr: "مدرّس خاص", hint: "Worked micro-example + follow-up" },
  { id: "coach", labelEn: "Coach", labelAr: "مدرّب", hint: "Action-first · one weekly step" },
  { id: "examiner", labelEn: "Examiner", labelAr: "ممتحن", hint: "Answer + retrieval question" },
];

const DEPTHS = [
  { id: "concise", label: "Concise", subtitle: "< 90 words" },
  { id: "standard", label: "Standard", subtitle: "~ 180 words" },
  { id: "deep", label: "Deep dive", subtitle: "300+ words" },
];

export default function AIInstructor() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState("lecturer");
  const [depth, setDepth] = useState("standard");
  const [showReasoning, setShowReasoning] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sources, setSources] = useState([]);
  const [latencyAvg, setLatencyAvg] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!current) return;
    api.get(`/academic/${current.id}/courses`).then((r) => {
      setCourses(r.data);
      setCourseId(r.data[0]?.id || "");
      setMessages([]);
    });
    api.get(`/ai/content/sources/${current.id}`).then((r) => {
      setSources(r.data.filter((s) => s.approved));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    api
      .get(`/ai/instructor/suggestions/${current.id}`, {
        params: { course_id: courseId || undefined, language: lang },
      })
      .then((r) => setSuggestions(r.data.items || []))
      .catch(() => setSuggestions([]));
  }, [current?.id, courseId, lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    setInput("");
    const startedAt = performance.now();
    setMessages((m) => [...m, { role: "user", text: value }]);
    setBusy(true);
    try {
      const { data } = await api.post(`/ai/instructor/message`, {
        institution_id: current.id,
        course_id: courseId || null,
        text: value,
        language: lang,
        persona,
        depth,
        show_reasoning: showReasoning,
      });
      const dur = data.latency_ms || Math.round(performance.now() - startedAt);
      setLatencyAvg((prev) => (prev ? Math.round((prev + dur) / 2) : dur));
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
          citations: data.citations,
          model: data.model,
          reasoning: data.reasoning,
          latency_ms: dur,
          persona: data.persona,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            lang === "ar"
              ? "تعذّر الوصول إلى مزوّد الذكاء الاصطناعي. حاول مرة أخرى."
              : "I could not reach the AI provider. Please try again.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;
  const currentCourse = courses.find((c) => c.id === courseId);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const trustBadges = [
    { icon: ShieldCheck, label: lang === "ar" ? "محمية للمستأجر" : "Tenant-isolated" },
    { icon: Quote, label: lang === "ar" ? "إجابات موثّقة" : "Source-grounded" },
    { icon: Activity, label: lang === "ar" ? "سجل تدقيق" : "Audit-logged" },
    { icon: ShieldCheck, label: lang === "ar" ? "تدخل بشري عند الحاجة" : "HITL on flag" },
  ];

  return (
    <div data-testid="ai-instructor-page" className="instructor-shell flex flex-col min-h-full">
      {/* Editorial dual-language hero */}
      <header className="instructor-hero relative overflow-hidden border-b border-instructor-edge">
        <div className="absolute inset-0 instructor-hero-bg pointer-events-none" />
        <div className="relative px-5 md:px-10 py-7 md:py-10 max-w-screen-2xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 text-instructor-accent text-[10px] tracking-[0.42em] font-mono uppercase">
                <span className="instructor-glyph">◈</span>
                <span data-testid="instructor-eyebrow">Module 4.1 · Virtual AI Instructor</span>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-5">
                <h1 className="instructor-title-ar" dir="rtl">
                  المعلم الذكي
                </h1>
                <div className="instructor-divider" />
                <h2 className="instructor-title-en">Virtual AI Instructor</h2>
              </div>
              <p className="mt-3 max-w-2xl text-sm md:text-base text-instructor-muted leading-relaxed">
                {lang === "ar"
                  ? "وكيل تعليمي تكيفي يقدّم محتوى دورات منظّمًا بالعربية والإنجليزية، مع استشهادات من المصادر المعتمدة وتسريع تصعيد التقييم."
                  : "Adaptive conversational agent delivering structured course content in English & Arabic — every answer cited from approved sources, with faculty escalation when confidence drops."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {trustBadges.map((b) => (
                  <span
                    key={b.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-instructor-edge bg-instructor-pillBg px-3 py-1 text-[11px] text-instructor-fg"
                  >
                    <b.icon className="h-3 w-3 text-instructor-accent" />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Live metric panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-[280px]" data-testid="instructor-metrics">
              <Stat
                icon={Zap}
                value={latencyAvg ? `${(latencyAvg / 1000).toFixed(1)}s` : "< 3s"}
                label="Median latency"
              />
              <Stat icon={Quote} value="100%" label="Cited answers" />
              <Stat icon={Languages} value="AR + EN" label="Bilingual" />
              <Stat icon={Layers} value={sources.length || "—"} label="Approved sources" />
            </div>
          </div>

          {/* Course + controls strip */}
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.32em] font-mono uppercase text-instructor-accent">
              <span>Knowledge scope</span>
            </div>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger
                className="w-[260px] bg-instructor-pillBg border-instructor-edge text-instructor-fg"
                data-testid="instructor-course-select"
              >
                <SelectValue placeholder={lang === "ar" ? "اختر مساقًا" : "Select course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-instructor-muted/60">·</span>
            <PersonaPicker value={persona} onChange={setPersona} lang={lang} />
            <span className="text-instructor-muted/60">·</span>
            <DepthPicker value={depth} onChange={setDepth} />
            <span className="text-instructor-muted/60">·</span>
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
                showReasoning
                  ? "border-instructor-accent bg-instructor-accent/10 text-instructor-accent"
                  : "border-instructor-edge bg-instructor-pillBg text-instructor-fg/80 hover:border-instructor-accent/50"
              }`}
              data-testid="instructor-reasoning-toggle"
            >
              <Brain className="h-3.5 w-3.5" /> Show reasoning
            </button>
          </div>
        </div>
      </header>

      {/* AI Core canvas */}
      <div className="instructor-canvas flex-1 grid grid-cols-12 gap-4 lg:gap-6 p-4 md:p-6 lg:p-10 min-h-0">
        {/* CHAT — protagonist */}
        <div
          className="col-span-12 lg:col-span-8 instructor-panel flex flex-col min-h-[68vh]"
          data-testid="instructor-core"
        >
          <div className="flex items-center gap-3 border-b border-instructor-edge px-5 py-3.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-instructor-accent/15 text-instructor-accent">
              <GraduationCap className="h-4 w-4" />
              <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-emerald-400 instructor-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-instructor-fg tracking-tight">
                AcademiaOS Intelligence Core
              </div>
              <div className="text-[11px] text-instructor-muted truncate">
                {currentCourse
                  ? `${currentCourse.code} · ${currentCourse.title}`
                  : lang === "ar"
                  ? "لا يوجد مساق محدد"
                  : "No course scope"}{" "}
                · {PERSONAS.find((p) => p.id === persona)?.labelEn} ·{" "}
                {DEPTHS.find((d) => d.id === depth)?.label}
              </div>
            </div>
            <div className="ms-auto hidden md:flex items-center gap-2 text-[10px] tracking-[0.28em] font-mono uppercase text-instructor-muted">
              <span className="instructor-status-dot" /> Ready ·{" "}
              {lastAssistant?.model?.split("/").pop() || "claude-sonnet-4.6"}
            </div>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
            {messages.length === 0 ? (
              <EmptyState
                lang={lang}
                course={currentCourse}
                suggestions={suggestions}
                onPick={send}
              />
            ) : (
              messages.map((m, i) => <Message key={i} m={m} lang={lang} />)
            )}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-instructor-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-instructor-accent" />
                {lang === "ar" ? "المعلم الذكي يفكر…" : "Intelligence Core is reasoning over sources…"}
              </div>
            )}
          </div>

          {/* composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-instructor-edge bg-instructor-composerBg px-3 py-3 md:px-5 md:py-4"
          >
            <div className="rounded-xl border border-instructor-edge bg-instructor-pillBg focus-within:border-instructor-accent transition-colors">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  lang === "ar"
                    ? "اسأل المعلم الذكي… (Shift+Enter لسطر جديد)"
                    : "Ask the Intelligence Core anything… (Shift+Enter for newline)"
                }
                data-testid="instructor-input"
                disabled={busy}
                rows={2}
                className="min-h-[60px] max-h-[180px] resize-none bg-transparent border-0 text-instructor-fg placeholder:text-instructor-muted focus-visible:ring-0"
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-instructor-edge/60">
                <div className="flex items-center gap-1.5">
                  <ComposerIcon
                    icon={Mic}
                    active={voiceOn}
                    onClick={() => setVoiceOn((v) => !v)}
                    title={lang === "ar" ? "إدخال صوتي (قريبًا)" : "Voice input (coming soon)"}
                    testid="instructor-voice"
                  />
                  <ComposerIcon
                    icon={Volume2}
                    title={lang === "ar" ? "قراءة الإجابة (قريبًا)" : "Read aloud (coming soon)"}
                    testid="instructor-tts"
                  />
                  <span className="ms-1 hidden sm:inline text-[10px] text-instructor-muted/70 font-mono uppercase tracking-wider">
                    {input.length}/2000
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={busy || !input.trim()}
                  data-testid="instructor-send"
                  className="instructor-send"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 me-1.5" /> {lang === "ar" ? "إرسال" : "Send"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT RAIL */}
        <aside className="col-span-12 lg:col-span-4 space-y-4" data-testid="instructor-rail">
          {/* Live citations */}
          <Panel
            eyebrow={lang === "ar" ? "الاستشهادات الحية" : "Live citations"}
            title={
              lastAssistant?.citations?.length
                ? `${lastAssistant.citations.length} ${lang === "ar" ? "مصدر" : "sources used"}`
                : lang === "ar"
                ? "بانتظار الرد"
                : "Awaiting answer"
            }
            icon={Quote}
          >
            {lastAssistant?.citations?.length ? (
              <div className="space-y-2.5">
                {lastAssistant.citations.map((c) => (
                  <div
                    key={c.n}
                    className="rounded-md border border-instructor-edge bg-instructor-pillBg/60 p-2.5"
                    data-testid={`citation-${c.n}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-instructor-fg">
                        [{c.n}] {c.title}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-instructor-accent">
                        {(c.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-instructor-edge overflow-hidden">
                      <div
                        className="h-full bg-instructor-accent/80"
                        style={{ width: `${Math.min(100, Math.max(6, c.score * 100))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-instructor-muted italic line-clamp-2">
                      &ldquo;{c.snippet}…&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-instructor-muted">
                {lang === "ar"
                  ? "ستظهر الاستشهادات هنا فور إجابة المعلم الذكي."
                  : "Citations will populate the moment the Core responds."}
              </div>
            )}
          </Panel>

          {/* Reasoning */}
          {lastAssistant?.reasoning && (
            <Panel
              eyebrow={lang === "ar" ? "سلسلة التفكير" : "Reasoning trail"}
              title={lang === "ar" ? "ما الذي فكرت فيه" : "What I weighed"}
              icon={Brain}
            >
              <p
                className="text-[12px] text-instructor-fg/80 leading-relaxed whitespace-pre-wrap"
                data-testid="instructor-reasoning-text"
              >
                {lastAssistant.reasoning}
              </p>
            </Panel>
          )}

          {/* Knowledge base */}
          <Panel
            eyebrow={lang === "ar" ? "قاعدة المعرفة" : "Knowledge base"}
            title={`${sources.length} ${lang === "ar" ? "مصدر معتمد" : "approved sources"}`}
            icon={BookOpen}
          >
            {sources.length === 0 ? (
              <div className="text-[11px] text-instructor-muted">
                {lang === "ar" ? "لا توجد مصادر معتمدة بعد." : "No approved sources yet for this tenant."}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sources.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-[11px]">
                    <BookOpen className="h-3 w-3 mt-0.5 text-instructor-muted shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-instructor-fg truncate">{s.title}</div>
                      <div className="text-[10px] text-instructor-muted">
                        {s.kind.replace("_", " ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Stat({ icon: Icon, value, label }) {
  return (
    <div className="instructor-stat-card">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-instructor-muted">
        <Icon className="h-3 w-3 text-instructor-accent" /> {label}
      </div>
      <div className="mt-2 text-xl md:text-2xl font-semibold text-instructor-fg tabular-nums">
        {value}
      </div>
    </div>
  );
}

function PersonaPicker({ value, onChange, lang }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="w-[170px] bg-instructor-pillBg border-instructor-edge text-instructor-fg"
        data-testid="instructor-persona"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERSONAS.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex flex-col">
              <span>{lang === "ar" ? p.labelAr : p.labelEn}</span>
              <span className="text-[10px] text-muted-foreground">{p.hint}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DepthPicker({ value, onChange }) {
  return (
    <div
      className="flex items-center rounded-full border border-instructor-edge bg-instructor-pillBg overflow-hidden"
      data-testid="instructor-depth"
    >
      {DEPTHS.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition ${
            value === d.id
              ? "bg-instructor-accent text-instructor-accentFg"
              : "text-instructor-fg/70 hover:text-instructor-fg"
          }`}
          data-testid={`instructor-depth-${d.id}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function ComposerIcon({ icon: Icon, onClick, active, title, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
        active
          ? "border-instructor-accent bg-instructor-accent/10 text-instructor-accent"
          : "border-transparent text-instructor-muted hover:text-instructor-fg hover:bg-instructor-pillBg"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Panel({ eyebrow, title, icon: Icon, children }) {
  return (
    <div className="instructor-panel p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-instructor-accent">
          {eyebrow}
        </div>
        {Icon && <Icon className="h-3.5 w-3.5 text-instructor-muted" />}
      </div>
      <div className="mt-1 text-sm font-semibold text-instructor-fg">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyState({ lang, course, suggestions, onPick }) {
  return (
    <div className="instructor-empty text-center max-w-2xl mx-auto py-8">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-instructor-accent/40 bg-instructor-accent/10 text-instructor-accent">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg md:text-xl font-semibold tracking-tight text-instructor-fg">
        {lang === "ar"
          ? `${course?.title || "ابدأ المحادثة"} — كل إجابة موثّقة من المصادر المعتمدة`
          : `${course?.title || "Start a session"} — every answer cited from approved sources`}
      </h3>
      <p className="mt-2 text-sm text-instructor-muted">
        {lang === "ar"
          ? "اختر شخصية المعلم وعمق الإجابة من الأعلى ثم اطرح سؤالًا أو ابدأ بإحدى المقترحات أدناه."
          : "Pick a persona and answer depth above, then ask a question or start with one of the prompts below."}
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="instructor-suggestion text-start"
            data-testid="instructor-suggested"
          >
            <MessageSquareQuote className="h-3.5 w-3.5 text-instructor-accent shrink-0 mt-0.5" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ m, lang }) {
  const [open, setOpen] = useState(true);
  if (m.role === "user") {
    return (
      <div className="flex justify-end" data-testid="msg-user">
        <div className="instructor-bubble-user max-w-[78%] rounded-2xl px-4 py-2.5 text-sm">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3" data-testid="msg-assistant">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-instructor-accent/15 text-instructor-accent shrink-0">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="instructor-bubble-ai rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-instructor-fg">
          {m.text}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.16em] text-instructor-muted/80">
          {m.model && <span>{m.model.split("/").pop()}</span>}
          {typeof m.latency_ms === "number" && <span>{(m.latency_ms / 1000).toFixed(2)}s</span>}
          {m.persona && <span>{m.persona}</span>}
          {m.citations?.length > 0 && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 hover:text-instructor-fg transition"
              data-testid="msg-citations-toggle"
            >
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {m.citations.length} {lang === "ar" ? "استشهادات" : "citations"}
            </button>
          )}
        </div>
        {open && m.citations?.length > 0 && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {m.citations.map((c) => (
              <div
                key={c.n}
                className="rounded-md border border-instructor-edge bg-instructor-pillBg/60 p-2 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-instructor-fg">
                    [{c.n}] {c.title}
                  </span>
                  <span className="text-instructor-accent tabular-nums">
                    {(c.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 text-instructor-muted italic line-clamp-2">
                  &ldquo;{c.snippet}…&rdquo;
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
