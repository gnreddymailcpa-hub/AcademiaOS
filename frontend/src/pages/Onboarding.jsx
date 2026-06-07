import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Sparkles, ChevronRight, ChevronLeft, CheckCircle2, Rocket, Building2,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";

/**
 * Onboarding Wizard — guided 3-step flow for a new tenant: review profile →
 * pick which of the 12 platforms to activate → review & launch. Wraps
 * `/api/modules/catalog` + `/api/modules/{tenant}/{code}` (PATCH) so this
 * UI is purely a thin orchestrator on the existing platform registry API.
 */
export default function Onboarding() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [tenantModules, setTenantModules] = useState([]);
  const [selection, setSelection] = useState({});  // code -> bool
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current?.id) return;
    Promise.all([
      api.get("/modules/catalog"),
      api.get(`/modules/${current.id}`),
    ]).then(([c, t]) => {
      setCatalog(c.data || []);
      setTenantModules(t.data || []);
      const initial = {};
      (t.data || []).forEach((m) => { initial[m.code] = m.status === "active"; });
      setSelection(initial);
    }).catch((e) => toast.error(formatApiError(e?.response?.data?.detail)));
  }, [current?.id]);

  const isAdmin = ["super_admin", "institution_admin"].includes(user?.role);
  if (!isAdmin) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground" data-testid="onboarding-not-allowed">
        Only Institution Admins can run the onboarding wizard.
      </div>
    );
  }

  const launch = async () => {
    if (!current?.id) return;
    setSaving(true);
    try {
      // Diff selection vs server state, only PATCH what changed
      const changes = catalog.map((c) => {
        const current_status = tenantModules.find((t) => t.code === c.code)?.status || c.default_status;
        const want_status = selection[c.code] ? "active" : "disabled";
        return { code: c.code, current_status, want_status, depends_on: c.depends_on };
      }).filter((x) => x.current_status !== x.want_status);

      for (const ch of changes) {
        await api.patch(`/modules/${current.id}/${ch.code}`, { status: ch.want_status });
      }
      toast.success(`Activated ${Object.values(selection).filter(Boolean).length} platforms`);
      setStep(3);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not apply selection");
    } finally {
      setSaving(false);
    }
  };

  if (!current) return null;

  return (
    <div data-testid="onboarding-page">
      <PageHeader
        eyebrow="Onboarding Wizard"
        title={`${current.short_name} · Get started in 3 steps`}
        description="Pick the platforms you want live on day 1. You can change this anytime in Platform Modules."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" />Step {step} of 3</Badge>
            <Badge className="bg-primary text-primary-foreground">{current.type}</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Step indicator */}
          <ol className="flex items-center gap-2 mb-8" data-testid="onboarding-stepper">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex-1 flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  n < step ? "bg-emerald-600 text-white" :
                  n === step ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {n < step ? <CheckCircle2 className="h-4 w-4" /> : n}
                </div>
                <div className={`flex-1 h-px ${n < step ? "bg-emerald-600" : "bg-border"} ${n === 3 && "hidden"}`} />
              </li>
            ))}
          </ol>

          {step === 1 && <StepOne current={current} onNext={() => setStep(2)} />}
          {step === 2 && (
            <StepTwo
              catalog={catalog}
              selection={selection}
              setSelection={setSelection}
              tenantModules={tenantModules}
              onBack={() => setStep(1)}
              onNext={launch}
              saving={saving}
            />
          )}
          {step === 3 && <StepThree current={current} catalog={catalog} selection={selection} onDone={() => nav("/")} />}
        </div>
      </div>
    </div>
  );
}

function StepOne({ current, onNext }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8" data-testid="onboarding-step-1">
      <div className="flex items-start gap-4">
        <Building2 className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">Welcome, {current.short_name}</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Claros ships 12 platforms grouped across 3 phases. This wizard
            lets you pick exactly which ones to launch on day 1. You can change
            this anytime in <span className="font-mono">Platform Modules</span>.
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-foreground/85">
            <li>· <span className="font-semibold text-foreground">Phase 1 (Foundational)</span> — VEDA · ARISE · NEXUS · COMPASS · PATHFINDER · COMMAND</li>
            <li>· <span className="font-semibold text-foreground">Phase 2 (Engagement)</span> — ILLUMINATE · PRISM · ALUMNI360 · FACULTY+ · GUARDIAN</li>
            <li>· <span className="font-semibold text-foreground">Phase 3 (Strategic)</span> — GREENIQ</li>
          </ul>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={onNext} className="gap-1.5" data-testid="onboarding-step1-next">
          Pick your platforms <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepTwo({ catalog, selection, setSelection, tenantModules, onBack, onNext, saving }) {
  const phases = [1, 2, 3];
  const inPhase = (n) => catalog.filter((c) => c.phase === n);
  const setAll = (phase, val) => {
    const update = { ...selection };
    inPhase(phase).forEach((c) => { update[c.code] = val; });
    setSelection(update);
  };
  const enabledCount = Object.values(selection).filter(Boolean).length;

  return (
    <div className="space-y-4" data-testid="onboarding-step-2">
      {phases.map((phase) => (
        <div key={phase} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="label-eyebrow">Phase {phase}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAll(phase, true)} data-testid={`onboarding-phase-${phase}-all`}>All</Button>
              <Button size="sm" variant="ghost" onClick={() => setAll(phase, false)} data-testid={`onboarding-phase-${phase}-none`}>None</Button>
            </div>
          </div>
          <ul className="space-y-2.5">
            {inPhase(phase).map((c) => (
              <li key={c.code} className="flex items-start justify-between gap-3" data-testid={`onboarding-module-${c.code}`}>
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {c.code}
                    <span className="text-[10px] text-muted-foreground font-normal">{c.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.tagline}</div>
                  {c.depends_on?.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      depends on: {c.depends_on.join(", ")}
                    </div>
                  )}
                </div>
                <Switch
                  checked={!!selection[c.code]}
                  onCheckedChange={(v) => setSelection({ ...selection, [c.code]: v })}
                  data-testid={`onboarding-toggle-${c.code}`}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5" data-testid="onboarding-step2-back">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{enabledCount}/12 active</span>
          <Button onClick={onNext} disabled={saving} className="gap-1.5" data-testid="onboarding-step2-launch">
            <Rocket className="h-4 w-4" />{saving ? "Launching…" : "Launch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepThree({ current, catalog, selection, onDone }) {
  const enabled = catalog.filter((c) => selection[c.code] && c.route);
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-600/5 p-8 text-center" data-testid="onboarding-step-3">
      <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
      <h2 className="text-xl font-semibold tracking-tight mt-3">You're live, {current.short_name}!</h2>
      <p className="text-sm text-muted-foreground mt-1.5">
        {enabled.length} platforms activated. Jump in below or head back to the dashboard.
      </p>
      <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-6 text-left" data-testid="onboarding-launch-list">
        {enabled.map((c) => (
          <li key={c.code}>
            <Link
              to={c.route}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 hover:border-primary transition"
              data-testid={`onboarding-launch-${c.code}`}
            >
              <span className="text-sm font-medium">{c.code}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <Button onClick={onDone} className="mt-6 gap-1.5" data-testid="onboarding-finish">
        Go to Dashboard <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
