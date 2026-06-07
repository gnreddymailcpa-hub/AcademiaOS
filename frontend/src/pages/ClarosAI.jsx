import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Trash2,
  Loader2,
  MessageSquareText,
  BookOpen,
  KeyRound,
} from "lucide-react";

const SUGGESTED = [
  "What courses are available this semester?",
  "What is the fee structure?",
  "How do I apply for a bonafide certificate?",
  "What is the attendance policy?",
];

function formatTs(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ClarosAI() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const scrollRef = useRef(null);

  const loadSessions = useCallback(async () => {
    if (!current) return;
    try {
      const { data } = await api.get(`/ai/sessions/list/${current.id}`);
      setSessions(data || []);
    } catch (e) {
      // tolerate empty
      setSessions([]);
    }
  }, [current]);

  useEffect(() => {
    loadSessions();
    setActiveId(null);
    setMessages([]);
  }, [current?.id, loadSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const openSession = async (sid) => {
    if (sid === activeId) return;
    setActiveId(sid);
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/ai/sessions/detail/${sid}`);
      setMessages(data?.messages || []);
    } catch (e) {
      toast.error("Could not load conversation");
      setMessages([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const newChat = async () => {
    if (!current) return;
    try {
      await api.post(`/ai/sessions/new/${current.id}`);
      setActiveId(null);
      setMessages([]);
      await loadSessions();
    } catch (e) {
      toast.error("Could not start a new chat");
    }
  };

  const deleteSession = async (sid, e) => {
    e?.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await api.delete(`/ai/sessions/${sid}`);
      if (activeId === sid) {
        setActiveId(null);
        setMessages([]);
      }
      await loadSessions();
      toast.success("Conversation deleted");
    } catch (e) {
      toast.error("Could not delete");
    }
  };

  const send = async (textOverride) => {
    const value = (textOverride ?? input).trim();
    if (!value || busy || !current) return;
    setInput("");
    const userMsg = { role: "user", text: value, ts: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const { data } = await api.post(`/ai/assistant/message`, {
        institution_id: current.id,
        text: value,
        language: lang || "en",
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
          model: data.model,
          citations: data.citations || [],
          ts: new Date().toISOString(),
        },
      ]);
      // refresh sidebar so the new session shows up + title updates
      loadSessions();
      if (!activeId) setActiveId(data.session_id);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            "I'm having trouble reaching the Claros AI service right now. Please retry in a few seconds.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  };

  if (!current) return null;

  const moduleName = "Claros AI";
  const emptyState = messages.length === 0 && !loadingDetail;

  return (
    <div data-testid="claros-ai-page" className="h-full">
      <PageHeader
        eyebrow="Institutional AI · RAG-grounded"
        title={moduleName}
        description={`Ask anything about ${current.short_name || current.name}. Grounded in your uploaded knowledge base.`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Claude · {current.short_name}
            </Badge>
            <Button variant="outline" size="sm" asChild data-testid="open-knowledge-link">
              <Link to="/ai/knowledge"><BookOpen className="h-3.5 w-3.5 me-1.5" />Knowledge Base</Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[560px]">
          {/* ---------- LEFT — Sessions ---------- */}
          <aside
            className="col-span-12 md:col-span-3 lg:col-span-3 border border-border rounded-lg bg-card flex flex-col"
            style={{ minWidth: 0 }}
            data-testid="claros-sessions-panel"
          >
            <div className="p-3 border-b border-border">
              <Button
                onClick={newChat}
                className="w-full justify-start gap-2"
                size="sm"
                data-testid="claros-new-chat-btn"
              >
                <Plus className="h-4 w-4" /> New Chat
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center px-3 py-6">
                    Your conversations will appear here.
                  </div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openSession(s.id)}
                      data-testid={`claros-session-${s.id}`}
                      className={`group w-full text-left rounded-md px-3 py-2 text-sm transition flex items-start gap-2 ${
                        activeId === s.id
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <MessageSquareText className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-medium text-foreground">
                          {s.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTs(s.created_at)} · {s.message_count} msgs
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* ---------- RIGHT — Chat ---------- */}
          <section
            className="col-span-12 md:col-span-9 lg:col-span-9 border border-border rounded-lg bg-card flex flex-col overflow-hidden"
            data-testid="claros-chat-panel"
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{moduleName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {current.name} · grounded in your knowledge base
                </div>
              </div>
              <div className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <KeyRound className="h-3 w-3" /> Tenant-isolated · audited
              </div>
            </div>

            {/* messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
              data-testid="claros-messages"
            >
              {loadingDetail ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 me-2 animate-spin" /> Loading conversation…
                </div>
              ) : emptyState ? (
                <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight mb-1">
                    Ask {moduleName} anything
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Course catalog, fee structure, certificates, attendance policy,
                    placement statistics — Claros AI answers from your institution's
                    own knowledge base, with citations.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        data-testid={`claros-suggested-${q.slice(0, 20).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                        className="text-left rounded-md border border-border bg-background px-3 py-2.5 text-sm hover:border-primary hover:bg-primary/5 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <ChatBubble key={i} m={m} institution={current} />
                ))
              )}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claros AI is
                  thinking…
                </div>
              )}
            </div>

            {/* composer */}
            <div className="border-t border-border p-3 shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask Claros AI… (Ctrl + Enter to send)"
                  rows={2}
                  className="resize-none"
                  data-testid="claros-composer-textarea"
                />
                <Button
                  onClick={() => send()}
                  disabled={busy || !input.trim()}
                  className="gap-1.5"
                  data-testid="claros-send-btn"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>Ctrl + Enter · send</span>
                <span data-testid="claros-char-count">{input.length} chars</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ m, institution }) {
  const isUser = m.role === "user";
  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`claros-bubble-${m.role}`}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : m.error
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-muted/60 border border-border text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{m.text}</div>
        {!isUser && Array.isArray(m.citations) && m.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
            {m.citations.map((c, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] font-normal"
              >
                {c.title || `Doc ${i + 1}`}
                {typeof c.score === "number" && (
                  <span className="ms-1 opacity-70">
                    · {(c.score * 100).toFixed(0)}%
                  </span>
                )}
              </Badge>
            ))}
          </div>
        )}
        {!isUser && m.model && (
          <div className="mt-1.5 text-[10px] text-muted-foreground opacity-80">
            {m.model}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background mt-0.5">
          <UserIcon className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
