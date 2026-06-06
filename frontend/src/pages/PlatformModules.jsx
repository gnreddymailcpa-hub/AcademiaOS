import React, { useEffect, useMemo, useState } from "react";
import {
  Cpu, Users as UsersIcon, Database, Award, Briefcase, BarChart2,
  BookOpen, Search, Shield, Network, GraduationCap, Leaf, Sparkles,
  CheckCircle2, CircleSlash, Clock,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../components/ui/select";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel } from "../components/dashboards/widgets";

const ICONS = {
  Cpu, Users: UsersIcon, Database, Award, Briefcase, BarChart2,
  BookOpen, Search, Shield, Network, GraduationCap, Leaf,
};

const STATUS_LABEL = {
  active: { label: "Active", className: "bg-emerald-600/15 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  coming_soon: { label: "Coming soon", className: "bg-amber-500/15 text-amber-700 border-amber-200", icon: Clock },
  disabled: { label: "Disabled", className: "bg-slate-500/15 text-slate-600 border-slate-300", icon: CircleSlash },
};

const PHASE_LABEL = {
  1: { label: "Phase 1", className: "bg-primary/15 text-primary border-primary/30" },
  2: { label: "Phase 2", className: "bg-teal-600/15 text-teal-700 border-teal-300" },
  3: { label: "Phase 3", className: "bg-amber-600/15 text-amber-700 border-amber-300" },
};

export default function PlatformModules() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("all");

  const canEdit = user?.role === "super_admin" || user?.role === "institution_admin";

  const refresh = async () => {
    if (!current) return;
    setLoading(true);
    try {
      const r = await api.get(`/modules/${current.id}`);
      setModules(r.data || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [current?.id]);

  const setStatus = async (code, status) => {
    try {
      await api.patch(`/modules/${current.id}/${code}`, { status });
      toast.success(`${code} → ${status}`);
      refresh();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || `Cannot change ${code}`);
    }
  };

  const stats = useMemo(() => {
    const active = modules.filter((m) => m.status === "active").length;
    const pending = modules.filter((m) => m.status === "coming_soon").length;
    const disabled = modules.filter((m) => m.status === "disabled").length;
    const phase1Active = modules.filter((m) => m.phase === 1 && m.status === "active").length;
    return { active, pending, disabled, phase1Active };
  }, [modules]);

  const visible = phase === "all" ? modules : modules.filter((m) => String(m.phase) === phase);

  if (!current) return null;

  return (
    <div data-testid="platform-modules-page">
      <PageHeader
        eyebrow="Platform Configuration · 12 Module Registry"
        title={`${current.short_name} · Module Activation`}
        description="Enable, disable or mark each platform module as coming soon. Modules are platform-wide and admin-configurable per tenant. Dependencies are enforced."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> {stats.phase1Active} of 6 Phase-1 active
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {canEdit ? "Editable" : "Read-only"}
            </Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active modules" value={stats.active} hint="of 12" icon={CheckCircle2} testid="mod-kpi-active" />
          <Kpi label="Coming soon" value={stats.pending} hint="seeded but not live" icon={Clock} testid="mod-kpi-pending" />
          <Kpi label="Disabled" value={stats.disabled} hint="hidden from users" icon={CircleSlash} testid="mod-kpi-disabled" />
          <Kpi label="Phase-1 progress" value={`${stats.phase1Active}/6`} hint="VEDA · ARISE · NEXUS · COMPASS · PATHFINDER · COMMAND" icon={Sparkles} testid="mod-kpi-phase1" />
        </section>

        <Panel
          eyebrow="Registry"
          title="Module catalog"
          testid="modules-catalog"
          action={
            <div className="flex gap-2">
              {["all", "1", "2", "3"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition ${
                    phase === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`mod-filter-${p}`}
                >
                  {p === "all" ? "All" : `Phase ${p}`}
                </button>
              ))}
            </div>
          }
        >
          {loading && <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>}
          <div className="space-y-2.5">
            {visible.map((m) => {
              const Icon = ICONS[m.icon] || Cpu;
              const phStyle = PHASE_LABEL[m.phase] || PHASE_LABEL[1];
              const stStyle = STATUS_LABEL[m.status] || STATUS_LABEL.disabled;
              return (
                <div
                  key={m.code}
                  className="rounded-md border border-border bg-card p-4 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-4 items-center"
                  data-testid={`mod-row-${m.code}`}
                >
                  <div className="flex items-start gap-3 lg:w-[260px]">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{m.code}</span>
                        <Badge variant="outline" className={`text-[10px] ${phStyle.className}`}>
                          {phStyle.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.name}</div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs text-foreground/85 leading-relaxed">{m.tagline}</div>
                    {m.depends_on?.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                        <span>Depends on:</span>
                        {m.depends_on.map((d) => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-mono">{d}</span>
                        ))}
                      </div>
                    )}
                    {m.route && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        Route: <span className="font-mono text-foreground/80">{m.route}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 justify-end lg:w-[200px]">
                    <Badge variant="outline" className={`text-[10px] gap-1 ${stStyle.className}`}>
                      <stStyle.icon className="h-3 w-3" /> {stStyle.label}
                    </Badge>
                    {canEdit ? (
                      <Select
                        value={m.status}
                        onValueChange={(v) => setStatus(m.code, v)}
                      >
                        <SelectTrigger className="h-7 w-[125px] text-xs" data-testid={`mod-status-${m.code}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active" className="text-xs">Active</SelectItem>
                          <SelectItem value="coming_soon" className="text-xs">Coming soon</SelectItem>
                          <SelectItem value="disabled" className="text-xs">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel eyebrow="Implementation status" title="Phase 1 — what's live today" testid="mod-implementation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              ["VEDA", "AI Instructor + Student Assistant + bell notifications — multi-role RAG over course documents."],
              ["ARISE", "Net-new: admissions CRM at /admissions with lead capture, pipeline + EAPCET rank predictor."],
              ["NEXUS", "Academic Structure + Users & Roles + Institution Setup — campus/dept/programme/course CRUD."],
              ["COMPASS", "Compliance & Audit + AI Governance + audit log — NAAC framework on /governance."],
              ["PATHFINDER", "Career Services dashboard + Student Assistant tickets — placement KPIs from real tenant metrics."],
              ["COMMAND", "Analytics + role-tailored dashboards — live KPIs, AI sessions, predictive enrolment hooks."],
            ].map(([code, body]) => (
              <div key={code} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-mono font-semibold text-primary">{code}</div>
                <div className="mt-1 text-xs text-foreground/85 leading-relaxed">{body}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
