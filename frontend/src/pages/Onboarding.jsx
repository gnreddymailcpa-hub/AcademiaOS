import React, { useEffect, useMemo, useState } from "react";
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
import { useTenantConfig } from "../context/TenantConfigContext";
import { api, formatApiError } from "../lib/api";
import { notifyModulesChanged } from "../lib/useTenantModules";

/**
 * Onboarding Wizard — guided 3-step flow for a new tenant: review profile →
 * pick which of the 12 platforms to activate → review & launch. Wraps
 * `/api/modules/catalog` + `/api/modules/{tenant}/{code}` (PATCH) so this
 * UI is purely a thin orchestrator on the existing platform registry API.
 *
 * Module labels are sourced from the tenant's resolved canonical Claros
 * config so that every name in this wizard reflects the tenant's rebrand
 * (e.g. VCE sees "VEDA" for Claros AI, default tenants see "Claros AI").
 */

// Legacy-code → canonical-claros-id map. The platform registry
// (routes_modules.py) and the canonical tenant config (routes_tenant_config.py)
// are two parallel systems; this is the single source of truth that joins them.
const LEGACY_TO_CLAROS = {
  VEDA: "claros-ai",
  ARISE: "claros-enroll",
  NEXUS: "claros-core",
  COMPASS: "claros-comply",
  PATHFINDER: "claros-launch",
  COMMAND: "claros-insights",
  ILLUMINATE: "claros-learn",
  PRISM: "claros-research",
  GUARDIAN: "claros-safe",
  ALUMNI360: "claros-alumni",
  FACULTY: "claros-people",
  GREENIQ: "claros-green",
};

// Resolve a legacy registry code (e.g. "VEDA") to the tenant's display label
// (e.g. "VEDA" for VCE, "Claros AI" for default tenants).
function useTenantLabelForLegacyCode() {
  const { config } = useTenantConfig();
  return (legacyCode) => {
    const claros = LEGACY_TO_CLAROS[legacyCode];
    if (!claros) return legacyCode;
    return config?.modules?.[claros]?.display_name || legacyCode;
  };
}

export default function Onboarding() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [tenantModules, setTenantModules] = useState([]);
  const [selection, setSelection] = useState({});  // code -> bool
  const [saving, setSaving] = useState(false);
  const labelFor = useTenantLabelForLegacyCode();

  useEffect(() => {
    if (!current?.id) return;
    Promise.all([
      api.get("/modules/catalog"),
      api.get(`/modules/${current.id}`, { params: { _: Date.now() } }),
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

      // Refetch our own snapshot so Step 2 reflects the new server state if
      // the user navigates Back. Also broadcast so the Sidebar +
      // ModuleGate consumers refetch without a page reload.
      try {
        const fresh = await api.get(`/modules/${current.id}`, { params: { _: Date.now() } });
        setTenantModules(fresh.data || []);
      } catch { /* non-fatal */ }
      notifyModulesChanged();

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

          {step === 1 && <StepOne current={current} catalog={catalog} labelFor={labelFor} onNext={() => setStep(2)} />}
          {step === 2 && (
            <StepTwo
              catalog={catalog}
              selection={selection}
              setSelection={setSelection}
              tenantModules={tenantModules}
              labelFor={labelFor}
              onBack={() => setStep(1)}
              onNext={launch}
              saving={saving}
            />
          )}
          {step === 3 && <StepThree current={current} catalog={catalog} selection={selection} labelFor={labelFor} onDone={() => nav("/")} />}
        </div>
      </div>
    </div>
  );
}

function StepOne({ current, catalog, labelFor, onNext }) {
  // Group catalog by phase and resolve to tenant display names so the wizard
  // shows VCE "VEDA · ARISE · NEXUS…" and a default tenant "Claros AI ·
  // Claros Enroll · Claros Core…".
  const phaseGroups = useMemo(() => {
    const byPhase = { 1: [], 2: [], 3: [] };
    (catalog || []).forEach((c) => {
      if (byPhase[c.phase]) byPhase[c.phase].push(labelFor(c.code));
    });
    return byPhase;
  }, [catalog, labelFor]);

  const PHASE_META = [
    { n: 1, name: "Foundational", desc: "Day-1 essentials — recruitment, ERP, compliance & analytics" },
    { n: 2, name: "Engagement",   desc: "Adaptive learning, research, alumni, faculty & safety" },
    { n: 3, name: "Strategic",    desc: "Sustainability intelligence & long-tail platforms" },
  ];

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
          <ul className="mt-5 space-y-3 text-xs text-foreground/85" data-testid="onboarding-phase-overview">
            {PHASE_META.map((p) => (
              <li key={p.n} data-testid={`onboarding-phase-${p.n}-overview`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Phase {p.n}</span>
                  <Badge variant="outline" className="text-[10px]">{p.name}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">{p.desc}</div>
                <div className="mt-1.5 font-mono text-[11px] text-foreground/90">
                  {phaseGroups[p.n].length > 0
                    ? phaseGroups[p.n].join(" · ")
                    : <span className="text-muted-foreground italic">loading…</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={onNext} className="gap-1.5" data-testid="onboarding-step1-next" disabled={!catalog?.length}>
          Pick your platforms <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepTwo({ catalog, selection, setSelection, tenantModules, labelFor, onBack, onNext, saving }) {
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
            {inPhase(phase).map((c) => {
              const display = labelFor(c.code);
              const isRebranded = display !== c.code;
              return (
                <li key={c.code} className="flex items-start justify-between gap-3" data-testid={`onboarding-module-${c.code}`}>
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      <span data-testid={`onboarding-module-name-${c.code}`}>{display}</span>
                      {isRebranded && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono" title="Platform code">
                          {c.code}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-normal">· {c.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.tagline}</div>
                    {c.depends_on?.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        depends on: {c.depends_on.map(labelFor).join(", ")}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={!!selection[c.code]}
                    onCheckedChange={(v) => setSelection({ ...selection, [c.code]: v })}
                    data-testid={`onboarding-toggle-${c.code}`}
                  />
                </li>
              );
            })}
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

function StepThree({ current, catalog, selection, labelFor, onDone }) {
  const enabled = catalog.filter((c) => selection[c.code] && c.route);
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-600/5 p-8 text-center" data-testid="onboarding-step-3">
      <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
      <h2 className="text-xl font-semibold tracking-tight mt-3">You&apos;re live, {current.short_name}!</h2>
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
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate">{labelFor(c.code)}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{c.code}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
