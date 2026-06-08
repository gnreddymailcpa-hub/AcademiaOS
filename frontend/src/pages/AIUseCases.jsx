import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { useModuleName } from "../context/TenantConfigContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, Settings2, Zap } from "lucide-react";

/**
 * Provider / model catalog. Kept in sync with what the backend
 * `ai_service.resolve_model` accepts. Newer models first.
 *
 * Note: only models that are *actually available* via the Emergent LLM
 * key or institutional credentials should be listed here — picking a
 * non-existent model from the dropdown would fail at first invocation.
 */
const PROVIDERS = [
  {
    value: "anthropic", label: "Anthropic",
    models: ["claude-sonnet-4.5", "claude-haiku-4.5", "claude-opus-4.5"],
  },
  {
    value: "openai", label: "OpenAI",
    models: ["gpt-5.2", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"],
  },
  {
    value: "gemini", label: "Google",
    models: ["gemini-3-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-nano-banana"],
  },
];

const STATUS_STYLES = {
  active: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  coming_soon: "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  disabled: "border-border bg-muted text-muted-foreground",
};

// Canonical Claros module IDs we display section headers for. Order
// matches the sidebar grouping in /app/frontend/src/components/layout/Sidebar.jsx
const MODULE_ORDER = [
  "claros-insights", "claros-ai", "claros-enroll", "claros-core",
  "claros-learn", "claros-launch", "claros-research", "claros-people",
  "claros-alumni", "claros-safe", "claros-green", "claros-comply",
];

function ModuleHeader({ canonicalId, count }) {
  const resolved = useModuleName(canonicalId);
  return (
    <div className="flex items-baseline justify-between mt-8 mb-3 first:mt-0" data-testid={`uc-group-${canonicalId}`}>
      <h2 className="text-lg font-semibold tracking-tight">{resolved}</h2>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count} use case{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export default function AIUseCases() {
  const { current } = useInstitution();
  const { lang } = useLang();
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    if (!current) return;
    const r = await api.get(`/ai/use-cases/${current.id}`);
    setItems(r.data);
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    if (!edit) return;
    try {
      await api.patch(`/ai/use-cases/${current.id}/${edit.key}`, {
        provider: edit.provider,
        model: edit.model,
        status: edit.status,
        human_in_the_loop: edit.human_in_the_loop,
        citations_required: edit.citations_required,
      });
      toast.success("Use case updated", { description: "Change captured in audit log" });
      setEdit(null);
      load();
    } catch (e) {
      toast.error("Could not save");
    }
  }, [edit, current, load]);

  // Group items by canonical Claros module. Items without a mapping fall
  // into an "Other" bucket so legacy rows still appear during migration.
  const groups = useMemo(() => {
    const byModule = {};
    for (const uc of items) {
      const key = uc.canonical_module || "_other";
      (byModule[key] = byModule[key] || []).push(uc);
    }
    return [
      ...MODULE_ORDER.filter((m) => byModule[m]).map((m) => [m, byModule[m]]),
      ...(byModule._other ? [["_other", byModule._other]] : []),
    ];
  }, [items]);

  if (!current) return null;

  return (
    <div data-testid="ai-use-cases-page">
      <PageHeader
        eyebrow="AI Layer · Catalog"
        title="AI Use Cases"
        description="AI capabilities grouped by Claros module. Provider, model and governance policy live in the database — never in code."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            AI TRiSM · Policy active
          </Badge>
        }
      />

      <div className="p-6 lg:p-8">
        {groups.map(([mod, ucs]) => (
          <React.Fragment key={mod}>
            <ModuleHeader canonicalId={mod === "_other" ? "" : mod} count={ucs.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ucs.map((uc) => (
                <UseCaseCard
                  key={uc.key}
                  uc={uc}
                  lang={lang}
                  onEdit={() => setEdit({ ...uc })}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {edit?.name_en}
              <Badge variant="outline" className="text-[10px] font-mono">{edit?.code}</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure provider, model and governance policy for this AI use case.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Provider</label>
                  <Select
                    value={edit.provider}
                    onValueChange={(v) =>
                      setEdit((e) => ({
                        ...e,
                        provider: v,
                        model: PROVIDERS.find((p) => p.value === v)?.models[0] || e.model,
                      }))
                    }
                  >
                    <SelectTrigger data-testid="uc-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Model</label>
                  <Select value={edit.model} onValueChange={(v) => setEdit((e) => ({ ...e, model: v }))}>
                    <SelectTrigger data-testid="uc-model"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(PROVIDERS.find((p) => p.value === edit.provider)?.models || []).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Status</label>
                <Select value={edit.status} onValueChange={(v) => setEdit((e) => ({ ...e, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="coming_soon">Coming soon</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <div className="text-sm font-medium">Human-in-the-loop</div>
                  <div className="text-[11px] text-muted-foreground">Approval required on irreversible actions</div>
                </div>
                <Switch
                  checked={!!edit.human_in_the_loop}
                  onCheckedChange={(v) => setEdit((e) => ({ ...e, human_in_the_loop: v }))}
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <div className="text-sm font-medium">Citations required</div>
                  <div className="text-[11px] text-muted-foreground">Force RAG grounding on all responses</div>
                </div>
                <Switch
                  checked={!!edit.citations_required}
                  onCheckedChange={(v) => setEdit((e) => ({ ...e, citations_required: v }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} data-testid="uc-save">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UseCaseCard({ uc, lang, onEdit }) {
  // Only show Arabic name as a secondary label when the active interface
  // language is Arabic. Other locales (en/hi/te for VCE/ISB) just see the
  // English name — no irrelevant secondary line clutter.
  const isArabicUI = lang === "ar";
  const primary = isArabicUI ? uc.name_ar : uc.name_en;
  const secondary = isArabicUI ? uc.name_en : null;
  return (
    <div
      data-testid={`use-case-${uc.key}`}
      className="rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xl font-semibold"
            aria-hidden
          >
            {uc.glyph}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
              {uc.code}
            </div>
            <div className="text-sm font-semibold leading-tight truncate" title={primary}>
              {primary}
            </div>
            {secondary && (
              <div className="text-[11px] text-muted-foreground truncate" title={secondary}>
                {secondary}
              </div>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[uc.status] || ""}`}>
          {uc.status.replace("_", " ")}
        </Badge>
      </div>

      <p className="mt-4 text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {uc.description}
      </p>

      <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div>
          <div className="label-eyebrow">{uc.metric}</div>
          <div className="text-base font-semibold tabular-nums">{uc.latency}</div>
        </div>
        <Zap className="h-4 w-4 text-accent" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-border px-2 py-1.5">
          <div className="text-muted-foreground">Provider</div>
          <div className="font-mono">{uc.provider}</div>
        </div>
        <div className="rounded-md border border-border px-2 py-1.5">
          <div className="text-muted-foreground">Model</div>
          <div className="font-mono truncate">{uc.model}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex gap-1.5">
          {uc.human_in_the_loop && (
            <Badge variant="secondary" className="text-[10px]">HITL</Badge>
          )}
          {uc.citations_required && (
            <Badge variant="secondary" className="text-[10px]">Citations</Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`configure-${uc.key}`}>
          <Settings2 className="h-3.5 w-3.5 me-1" /> Configure
        </Button>
      </div>
    </div>
  );
}
