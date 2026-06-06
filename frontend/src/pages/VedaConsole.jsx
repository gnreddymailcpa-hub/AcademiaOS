import React, { useEffect, useRef, useState } from "react";
import { Brain, Search, Mic, Layers, Sparkles, Upload } from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList } from "../components/dashboards/widgets";

/**
 * VEDA Console — full Phase-24 hardening surface:
 *  - Intent classifier (keyword + LLM hybrid)
 *  - Voice transcription (Whisper)
 *  - KB nightly ingestion
 */
export default function VedaConsole() {
  const { current } = useInstitution();
  if (!current) return null;
  return (
    <div data-testid="veda-console-page">
      <PageHeader
        eyebrow="VEDA · AI engine"
        title={`${current.short_name} · VEDA digital assistant`}
        description="Intent classifier across 60+ types, multilingual voice transcription via Whisper, and an incremental knowledge-base ingestion pipeline. Multi-role chat is wired into the existing Student Assistant view."
        actions={<Badge className="bg-primary text-primary-foreground gap-1.5"><Sparkles className="h-3 w-3" />VEDA+</Badge>}
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="intent" className="space-y-6">
          <TabsList data-testid="veda-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="intent" data-testid="veda-tab-intent"><Brain className="h-3.5 w-3.5 mr-1.5" />Intent</TabsTrigger>
            <TabsTrigger value="voice" data-testid="veda-tab-voice"><Mic className="h-3.5 w-3.5 mr-1.5" />Voice</TabsTrigger>
            <TabsTrigger value="kb" data-testid="veda-tab-kb"><Layers className="h-3.5 w-3.5 mr-1.5" />Knowledge Base</TabsTrigger>
          </TabsList>
          <TabsContent value="intent"><IntentTab iid={current.id} /></TabsContent>
          <TabsContent value="voice"><VoiceTab iid={current.id} /></TabsContent>
          <TabsContent value="kb"><KbTab iid={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============== Intent ==============
function IntentTab({ iid }) {
  const [text, setText] = useState("when are my exam dates");
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, c] = await Promise.all([
      api.get(`/veda/${iid}/intent-classify`),
      api.get(`/veda/${iid}/intent-catalog`),
    ]);
    setRecent(r.data || []); setCatalog(c.data);
  };
  useEffect(() => { load().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const classify = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await api.post(`/veda/${iid}/intent-classify`, { text, persist: true });
      setResult(r.data);
      toast.success(`${r.data.category} / ${r.data.intent} · ${r.data.method}`);
      load();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="VEDA" title="Classify a query" testid="intent-form-panel">
        <p className="text-xs text-muted-foreground mb-2">Keyword catalog first (word-boundary + plural-aware), Claude fallback on miss.</p>
        <Label className="text-xs">Query</Label>
        <Input value={text} onChange={(e) => setText(e.target.value)}
               data-testid="intent-input" placeholder="Ask anything…" />
        <Button onClick={classify} disabled={busy} className="w-full mt-2" data-testid="intent-classify-btn">
          {busy ? "Classifying…" : "Classify"}
        </Button>
        {result && (
          <div className="mt-3 text-xs space-y-1.5 border-t pt-3" data-testid="intent-result">
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><Badge>{result.category}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Intent</span><Badge variant="outline">{result.intent}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span className="tabular-nums">{result.confidence}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Method</span><Badge variant={result.method === "keyword" ? "default" : "outline"} className="text-[10px]">{result.method}</Badge></div>
            {result.matched_keywords && result.matched_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {result.matched_keywords.map((k) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel eyebrow="VEDA" title="Intent catalog coverage" testid="intent-catalog-panel">
        {catalog && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Categories" value={catalog.categories.length} testid="intent-cat-n" />
              <Kpi label="Total intents" value={catalog.total_intents} testid="intent-int-n" />
            </div>
            <div className="mt-3 space-y-1.5">
              {catalog.categories.map((c) => (
                <div key={c} className="flex justify-between text-xs border-b last:border-0 pb-1">
                  <span className="capitalize">{c}</span>
                  <span className="tabular-nums text-muted-foreground">{Object.keys(catalog.catalog[c]).length}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel eyebrow="VEDA" title="Recent classifications" testid="intent-recent-panel">
        <ItemList
          testid="intent-recent-list"
          items={recent.slice(0, 12).map((r) => ({
            id: r.id,
            title: (r.text || "").slice(0, 50),
            meta: `${r.category} / ${r.intent} · ${r.method}`,
            right: r.confidence ?? "—",
          }))}
        />
      </Panel>
    </div>
  );
}

// ============== Voice ==============
function VoiceTab({ iid }) {
  const [file, setFile] = useState(null);
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);

  const load = async () => {
    const r = await api.get(`/veda/${iid}/voice/transcribe`);
    setRecent(r.data || []);
  };
  useEffect(() => { load().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const upload = async () => {
    if (!file) { toast.error("Pick an audio file first"); return; }
    setBusy(true); setResult(null);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("language", lang);
      const r = await api.post(`/veda/${iid}/voice/transcribe`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data); toast.success("Transcribed");
      load();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="VEDA" title="Voice transcription (Whisper)" testid="voice-form-panel">
        <p className="text-xs text-muted-foreground mb-2">Drop a clip (mp3/wav/m4a/webm — up to 25 MB). Transcribed with whisper-1 in your chosen language.</p>
        <div className="flex gap-2 mb-2">
          {["en", "hi", "te", "ar"].map((l) => (
            <Button key={l} size="sm" variant={lang === l ? "default" : "outline"}
                    onClick={() => setLang(l)} data-testid={`voice-lang-${l}`}>
              {l.toUpperCase()}
            </Button>
          ))}
        </div>
        <input
          ref={inputRef} type="file" accept=".mp3,.mp4,.m4a,.wav,.webm,.mpeg,.mpga"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs file:rounded file:border file:bg-muted file:px-3 file:py-1.5 file:mr-2"
          data-testid="voice-file-input"
        />
        {file && <div className="mt-2 text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>}
        <Button onClick={upload} disabled={busy || !file} className="w-full mt-2" data-testid="voice-upload-btn">
          {busy ? "Transcribing…" : <><Upload className="h-3.5 w-3.5 mr-1.5" />Transcribe</>}
        </Button>
        {result && (
          <div className="mt-3 rounded border p-3 text-sm" data-testid="voice-result">
            <div className="text-[10px] text-muted-foreground mb-1">{result.language} · {result.model} · {result.bytes} bytes</div>
            <div className="whitespace-pre-wrap">{result.transcript}</div>
          </div>
        )}
      </Panel>

      <Panel eyebrow="VEDA" title="Recent transcripts" testid="voice-recent-panel">
        <ItemList
          testid="voice-recent-list"
          items={recent.slice(0, 12).map((r) => ({
            id: r.id,
            title: (r.transcript || "").slice(0, 60),
            meta: `${r.filename || "audio"} · ${r.language}`,
            right: `${Math.round((r.bytes || 0) / 1024)} KB`,
          }))}
        />
      </Panel>
    </div>
  );
}

// ============== KB ==============
function KbTab({ iid }) {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [onlyPending, setOnlyPending] = useState(true);

  const load = async () => {
    const [s, h] = await Promise.all([
      api.get(`/veda/${iid}/kb/status`),
      api.get(`/veda/${iid}/kb/ingest-run`),
    ]);
    setStatus(s.data); setHistory(h.data || []);
  };
  useEffect(() => { load().catch(() => {}); /* eslint-disable-next-line */ }, [iid]);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/veda/${iid}/kb/ingest-run`, { only_pending: onlyPending });
      toast.success(`Processed ${r.data.sources_processed} sources · ${r.data.chunks_created} chunks`);
      load();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel eyebrow="VEDA" title="Ingestion status" testid="kb-status-panel">
        {status && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Total sources" value={status.sources_total} testid="kb-stat-total" />
              <Kpi label="Ingested" value={status.sources_ingested} testid="kb-stat-ingested" />
              <Kpi label="Pending" value={status.sources_pending} testid="kb-stat-pending" />
              <Kpi label="Chunks" value={status.chunks_total} testid="kb-stat-chunks" />
            </div>
            {status.last_run && (
              <div className="mt-3 text-xs text-muted-foreground" data-testid="kb-stat-last-run">
                Last run · {(status.last_run.completed_at || "").slice(0, 16).replace("T", " ")} · {status.last_run.sources_processed} src / {status.last_run.chunks_created} chunks
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel eyebrow="VEDA" title="Run ingestion" testid="kb-run-panel">
        <p className="text-xs text-muted-foreground mb-2">Marks each `content_sources` row as `ingested` after re-chunking. Designed to be invoked nightly via cron.</p>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} data-testid="kb-only-pending" />
          Only process pending sources (incremental)
        </label>
        <Button onClick={run} disabled={busy} className="w-full" data-testid="kb-run-btn">
          {busy ? "Running…" : "Run ingestion"}
        </Button>
      </Panel>

      <Panel eyebrow="VEDA" title="Run history" testid="kb-history-panel">
        <ItemList
          testid="kb-history-list"
          items={history.slice(0, 10).map((h) => ({
            id: h.id,
            title: (h.completed_at || "").slice(0, 16).replace("T", " "),
            meta: `${h.only_pending ? "incremental" : "full"} · by ${h.run_by}`,
            right: `${h.sources_processed} src · ${h.chunks_created} chunks`,
          }))}
        />
      </Panel>
    </div>
  );
}
