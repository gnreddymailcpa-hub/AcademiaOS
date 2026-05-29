import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  ScrollText,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

const RISK_OPTIONS = ["low", "medium", "high"];
const STATUS_OPTIONS = ["active", "coming_soon", "paused"];

export default function Governance() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!current) return;
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        api.get(`/ai/use-cases/${current.id}`),
        api.get(`/audit/${current.id}`, { params: { limit: 30 } }),
      ]);
      setCases(u.data || []);
      const items = a.data?.items || a.data || [];
      setAudit(items.filter((e) => (e.action || "").startsWith("ai.")));
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [current?.id]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => c.status === "active").length;
    const pending = cases.filter((c) => c.status !== "active").length;
    const hitl = cases.filter((c) => c.human_in_the_loop || c.hitl_required).length;
    const cites = cases.filter((c) => c.citations_required).length;
    return { active, pending, hitl, cites };
  }, [cases]);

  const patchUseCase = async (uc, payload) => {
    try {
      await api.patch(`/ai/use-cases/${current.id}/${uc.key}`, payload);
      toast.success(`${uc.code} updated`);
      refresh();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  if (!current) return null;
  const canEdit = ["super_admin", "institution_admin", "ai_governance_admin"].includes(user?.role);

  return (
    <div data-testid="governance-page">
      <PageHeader
        eyebrow="AI TRiSM · Policy & Audit"
        title={`${current.short_name} · AI Governance`}
        description="Prompt policy approvals, risk classification, HITL coverage and bias audit signal."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> {current.compliance_framework || "Framework —"}
            </Badge>
            <Badge className="bg-primary text-primary-foreground">{canEdit ? "Editable" : "Read-only"}</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Active use-cases" value={stats.active} icon={Sparkles} testid="gov-kpi-active" />
          <Kpi label="Pending policy review" value={stats.pending} icon={AlertTriangle} testid="gov-kpi-pending" />
          <Kpi label="HITL enforced on" value={stats.hitl} hint="of 8 modules" icon={ShieldCheck} testid="gov-kpi-hitl" />
          <Kpi label="Citations required on" value={stats.cites} hint="of 8 modules" icon={ScrollText} testid="gov-kpi-cites" />
        </section>

        {/* Prompt-policy approval queue */}
        <Panel
          eyebrow="Queue"
          title="Prompt-policy approvals"
          testid="gov-queue"
          action={loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="gov-queue-table">
              <thead>
                <tr className="text-start text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-start py-2 ps-1">Module</th>
                  <th className="text-start py-2">Risk</th>
                  <th className="text-start py-2">HITL</th>
                  <th className="text-start py-2">Citations</th>
                  <th className="text-start py-2">Status</th>
                  <th className="text-end py-2 pe-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id || c.key} className="border-b border-border/60" data-testid={`gov-row-${c.key}`}>
                    <td className="py-3 ps-1 pe-3">
                      <div className="font-medium">{c.code} · {c.name_en}</div>
                      <div className="text-[11px] text-muted-foreground">{c.name_ar || ""}</div>
                    </td>
                    <td className="py-3 pe-3">
                      {canEdit ? (
                        <Select
                          value={c.risk_score || "medium"}
                          onValueChange={(v) => patchUseCase(c, { risk_score: v })}
                        >
                          <SelectTrigger className="h-7 w-[110px] text-xs" data-testid={`gov-risk-${c.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RISK_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{c.risk_score || "—"}</Badge>
                      )}
                    </td>
                    <td className="py-3 pe-3">
                      <Switch
                        checked={!!(c.human_in_the_loop ?? c.hitl_required)}
                        onCheckedChange={(v) => patchUseCase(c, { human_in_the_loop: v })}
                        disabled={!canEdit}
                        data-testid={`gov-hitl-${c.key}`}
                      />
                    </td>
                    <td className="py-3 pe-3">
                      <Switch
                        checked={!!c.citations_required}
                        onCheckedChange={(v) => patchUseCase(c, { citations_required: v })}
                        disabled={!canEdit}
                        data-testid={`gov-cites-${c.key}`}
                      />
                    </td>
                    <td className="py-3 pe-3">
                      <Badge
                        variant={c.status === "active" ? "default" : "outline"}
                        className={`text-[10px] ${c.status === "active" ? "bg-emerald-600/15 text-emerald-700 border-emerald-200" : ""}`}
                        data-testid={`gov-status-${c.key}`}
                      >
                        {c.status || "—"}
                      </Badge>
                    </td>
                    <td className="py-3 pe-1 text-end">
                      {canEdit && c.status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => patchUseCase(c, { status: "active" })}
                          data-testid={`gov-approve-${c.key}`}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </Button>
                      )}
                      {canEdit && c.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => patchUseCase(c, { status: "paused" })}
                          data-testid={`gov-pause-${c.key}`}
                        >
                          <XCircle className="h-3 w-3" /> Pause
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No AI use-cases registered for this tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* HITL coverage + Bias audit */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel eyebrow="HITL coverage" title="Human-in-the-loop gates" testid="gov-hitl-cov">
            {[
              ["Content publish", 100],
              ["Certificate issuance", 100],
              ["At-risk escalation", 88],
              ["Workflow rollback", 100],
              ["Prompt policy change", 100],
            ].map(([k, v]) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <MiniBar value={v} color="hsl(258, 90%, 66%)" />
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Bias audit" title="Last 90 days" testid="gov-bias">
            <ItemList
              items={[
                { title: "Module 4.1 · AI Instructor", meta: "0 deviations · passed", right: "14d" },
                { title: "Module 4.2 · AI Advisor", meta: "1 minor deviation · resolved", right: "21d" },
                { title: "Module 4.4 · Content Studio", meta: "scheduled", right: "in 3d" },
                { title: "Module 4.6 · Assessments", meta: "passed", right: "28d" },
              ]}
            />
          </Panel>
        </section>

        {/* Recent governance events */}
        <Panel eyebrow="Audit feed" title="Recent governance events" testid="gov-events"
               action={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Activity className="h-3 w-3" /> {audit.length} events</span>}>
          <ItemList
            testid="gov-events-list"
            items={audit.slice(0, 8).map((e) => ({
              id: e.id,
              title: e.action,
              meta: `${e.actor} · ${e.target || "—"}`,
              right: new Date(e.ts).toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
            }))}
            empty="No governance audit events yet."
          />
        </Panel>
      </div>
    </div>
  );
}
