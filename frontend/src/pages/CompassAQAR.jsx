import React, { useEffect, useState } from "react";
import { Sparkles, FileText, Award, Lock, Layers } from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, MiniBar } from "../components/dashboards/widgets";

/**
 * COMPASS — NAAC AQAR auto-generator (Phase 1).
 *
 * Pulls live tenant data from `/api/compass/{tenant}/aqar/preview`, renders a
 * 7-criterion AQAR draft with editable narrative + computed metrics, and lets
 * an IQAC/compliance officer "Freeze" the draft into a versioned snapshot.
 */
export default function CompassAQAR() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isOfficer = ["super_admin", "institution_admin", "compliance_officer", "ai_governance_admin"].includes(user?.role);

  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);

  const refresh = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get(`/compass/${current.id}/aqar/preview`),
        api.get(`/compass/${current.id}/aqar/history`),
      ]);
      setDraft(a.data);
      setHistory(b.data || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not load AQAR");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [current?.id]);

  const freeze = async () => {
    setFreezing(true);
    try {
      const r = await api.post(`/compass/${current.id}/aqar/freeze`);
      toast.success(`AQAR ${r.data.id} frozen · projected grade ${r.data.projected_grade}`);
      refresh();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not freeze AQAR");
    } finally {
      setFreezing(false);
    }
  };

  if (!current) return null;

  return (
    <div data-testid="compass-aqar-page">
      <PageHeader
        eyebrow="COMPASS · NAAC AQAR Generator"
        title={`${current.short_name} · AQAR 2025-26 draft`}
        description="Live-computed Annual Quality Assurance Report across all 7 NAAC criteria. Freeze to snapshot for IQAC submission."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 1 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">COMPASS</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {loading && <div className="py-8 text-center text-xs text-muted-foreground">Computing AQAR…</div>}

        {draft && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Composite score" value={draft.computed_score} hint="of 100" icon={Award} testid="compass-kpi-score" />
              <Kpi label="Projected grade" value={draft.projected_grade} hint="NAAC equivalent" icon={Award} testid="compass-kpi-grade" />
              <Kpi label="Active programmes" value={draft.totals.programmes} hint={`${draft.totals.departments} departments`} icon={Layers} testid="compass-kpi-programmes" />
              <Kpi label="Audit events" value={draft.totals.audit_events} hint="for compliance trail" icon={FileText} testid="compass-kpi-audit" />
            </section>

            <Panel
              eyebrow="Snapshot"
              title="Lock current AQAR for IQAC submission"
              testid="compass-freeze-panel"
              action={isOfficer && (
                <Button onClick={freeze} disabled={freezing} className="gap-1.5" data-testid="compass-freeze-btn">
                  <Lock className="h-4 w-4" />{freezing ? "Freezing…" : "Freeze AQAR snapshot"}
                </Button>
              )}
            >
              <div className="text-xs text-muted-foreground">
                Freezing captures every metric + computed score at this moment into an
                immutable record (collection: <span className="font-mono">compass_aqar</span>) and
                writes a <span className="font-mono">compass.aqar.freeze</span> audit event.
                Use for end-of-cycle accreditation submissions.
              </div>
            </Panel>

            <section className="space-y-4">
              {draft.criteria.map((c) => (
                <Panel key={c.id} eyebrow={c.id} title={c.title} testid={`compass-crit-${c.id}`}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-2.5">
                      {c.metrics.map((m) => (
                        <div key={m.key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{m.key.replace(/_/g, " ")}</span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {typeof m.value === "number" ? m.value.toLocaleString() : m.value} {m.unit}
                            </span>
                          </div>
                          <MiniBar value={typeof m.value === "number" ? Math.min(m.value, 200) : 1} max={200} />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-foreground/85 leading-relaxed bg-muted/30 rounded-md p-3 border border-border">
                      <div className="label-eyebrow mb-1.5">Narrative</div>
                      {c.narrative}
                    </div>
                  </div>
                </Panel>
              ))}
            </section>

            <Panel eyebrow="History" title="Frozen AQAR snapshots" testid="compass-history-panel">
              {history.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No snapshots yet.</div>
              ) : (
                <ul className="space-y-2 text-sm" data-testid="compass-history-list">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <div className="font-medium font-mono text-xs">{h.id}</div>
                        <div className="text-xs text-muted-foreground">frozen {(h.frozen_at || "").slice(0, 19)} by {h.frozen_by}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{h.computed_score}/100</Badge>
                        <Badge className="bg-primary text-primary-foreground">{h.projected_grade}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
