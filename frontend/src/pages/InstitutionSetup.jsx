import React, { useEffect, useState } from "react";
import { Check, Building2, Globe2, Sparkles, ShieldCheck, ChevronRight, ChevronLeft, Save } from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const STEPS = [
  { key: "identity", title: "Identity", icon: Building2, hint: "Name, type, branding" },
  { key: "locale", title: "Locale & language", icon: Globe2, hint: "Languages, timezone, residency" },
  { key: "ai", title: "AI configuration", icon: Sparkles, hint: "Providers, guardrails, tone" },
  { key: "governance", title: "Governance", icon: ShieldCheck, hint: "Compliance, audit, approvals" },
];

export default function InstitutionSetup() {
  const { current, refresh } = useInstitution();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    setForm({
      name: current.name || "",
      short_name: current.short_name || "",
      type: current.type || "University",
      country: current.country || "",
      primary_language: current.primary_language || "en",
      secondary_language: current.secondary_language || "",
      timezone: current.timezone || "UTC",
      data_residency: current.data_residency || "",
      compliance_framework: current.compliance_framework || "",
      description: current.description || "",
      ai_provider: "openai_gpt4o",
      ai_tone: "Professional · concise",
      embedding_model: "text-embedding-3-large",
      response_max: 480,
      citations_required: true,
      hitl_irreversible: true,
      bias_audit: true,
      consent_required: true,
      audit_level: "Verbose",
    });
    setStep(0);
  }, [current?.id]);

  if (!current || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/institutions/${current.id}`, {
        name: form.name,
        short_name: form.short_name,
        type: form.type,
        country: form.country,
        primary_language: form.primary_language,
        secondary_language: form.secondary_language || null,
        timezone: form.timezone,
        data_residency: form.data_residency || null,
        compliance_framework: form.compliance_framework || null,
        description: form.description || null,
      });
      await refresh();
      toast.success("Institution profile saved", { description: "Audit log updated" });
    } catch (e) {
      toast.error("Could not save", { description: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="institution-setup-page">
      <PageHeader
        eyebrow="Institution Setup Wizard"
        title="Configure tenant profile"
        description="Identity, locale, AI configuration and governance — all institution-specific values live in the database, never in code."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <span className="dot-pulse" />
            Live tenant · {current.short_name}
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        {/* Stepper */}
        <aside className="col-span-12 lg:col-span-3">
          <ol className="space-y-1" data-testid="wizard-stepper">
            {STEPS.map((s, idx) => {
              const active = idx === step;
              const done = idx < step;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setStep(idx)}
                    data-testid={`wizard-step-${s.key}`}
                    className={[
                      "flex w-full items-start gap-3 rounded-md border p-3 text-start transition",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        done
                          ? "bg-primary text-primary-foreground"
                          : active
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Form */}
        <section className="col-span-12 lg:col-span-9 rounded-lg border border-border bg-card p-6">
          {step === 0 && (
            <div className="space-y-5" data-testid="wizard-pane-identity">
              <h3 className="text-lg font-semibold">Institution identity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Legal name</Label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="form-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Short name</Label>
                  <Input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} data-testid="form-short-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Institution type</Label>
                  <Select value={form.type} onValueChange={(v) => set("type", v)}>
                    <SelectTrigger data-testid="form-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["University", "Business School", "Government Academy", "Corporate Academy", "Online Education Platform"].map(
                        (t) => <SelectItem key={t} value={t}>{t}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Input value={form.country} onChange={(e) => set("country", e.target.value)} data-testid="form-country" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Public description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  data-testid="form-description"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5" data-testid="wizard-pane-locale">
              <h3 className="text-lg font-semibold">Locale, language & data residency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Primary language</Label>
                  <Select value={form.primary_language} onValueChange={(v) => set("primary_language", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية (Arabic)</SelectItem>
                      <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Secondary language (optional)</Label>
                  <Select value={form.secondary_language || "none"} onValueChange={(v) => set("secondary_language", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="hi">हिन्दी</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timezone</Label>
                  <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data residency</Label>
                  <Input value={form.data_residency} onChange={(e) => set("data_residency", e.target.value)} placeholder="UAE-only · India · UK / EEA" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5" data-testid="wizard-pane-ai">
              <h3 className="text-lg font-semibold">AI provider & guardrails</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default LLM provider</Label>
                  <Select value={form.ai_provider} onValueChange={(v) => set("ai_provider", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai_gpt4o">OpenAI · GPT-4o</SelectItem>
                      <SelectItem value="claude_sonnet">Anthropic · Claude Sonnet</SelectItem>
                      <SelectItem value="azure_openai">Azure OpenAI (sovereign)</SelectItem>
                      <SelectItem value="jais">Jais (Arabic-first)</SelectItem>
                      <SelectItem value="allam">ALLaM (UAE government)</SelectItem>
                      <SelectItem value="local">Local / On-prem LLM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Embedding model</Label>
                  <Input value={form.embedding_model} onChange={(e) => set("embedding_model", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Response tone</Label>
                  <Input value={form.ai_tone} onChange={(e) => set("ai_tone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max response tokens</Label>
                  <Input
                    type="number"
                    value={form.response_max}
                    onChange={(e) => set("response_max", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <ToggleRow label="Require source citations" value={form.citations_required} onChange={(v) => set("citations_required", v)} />
                <ToggleRow label="Human-in-the-loop on irreversible actions" value={form.hitl_irreversible} onChange={(v) => set("hitl_irreversible", v)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5" data-testid="wizard-pane-governance">
              <h3 className="text-lg font-semibold">Compliance & audit</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Compliance framework(s)</Label>
                  <Input value={form.compliance_framework} onChange={(e) => set("compliance_framework", e.target.value)} placeholder="AACSB · EQUIS · GDPR" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Audit logging level</Label>
                  <Select value={form.audit_level} onValueChange={(v) => set("audit_level", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Minimal", "Standard", "Verbose", "Forensic"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <ToggleRow label="Bias & fairness audit dimension required" value={form.bias_audit} onChange={(v) => set("bias_audit", v)} />
                <ToggleRow label="Explicit learner consent required" value={form.consent_required} onChange={(v) => set("consent_required", v)} />
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              data-testid="wizard-back"
            >
              <ChevronLeft className="h-4 w-4 me-1" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} data-testid="wizard-next">
                Next
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button onClick={save} disabled={busy} data-testid="wizard-save">
                <Save className="h-4 w-4 me-1" />
                Save configuration
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
