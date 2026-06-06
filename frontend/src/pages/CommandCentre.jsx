import React, { useEffect, useState } from "react";
import {
  Sparkles, LineChart, AlertTriangle, Trophy, Activity, Target,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, MiniBar } from "../components/dashboards/widgets";

/**
 * COMMAND — Executive Command Centre (Phase 1 MVP).
 *
 * Aggregates three live signals for the tenant:
 *   1. Enrolment forecast (linear projection, next 3 cycles)
 *   2. Anomaly alerts on KPIs (placement, at-risk, audit, HITL backlog)
 *   3. Composite NIRF-style readiness score with 5-dimension breakdown
 */
export default function CommandCentre() {
  const { current } = useInstitution();
  const [forecast, setForecast] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current?.id) return;
    setLoading(true);
    Promise.all([
      api.get(`/command/${current.id}/forecast`).then((r) => setForecast(r.data)),
      api.get(`/command/${current.id}/anomalies`).then((r) => setAnomalies(r.data)),
      api.get(`/command/${current.id}/readiness`).then((r) => setReadiness(r.data)),
    ]).catch((e) => toast.error(formatApiError(e?.response?.data?.detail) || "Could not load Command data"))
      .finally(() => setLoading(false));
  }, [current?.id]);

  if (!current) return null;

  return (
    <div data-testid="command-page">
      <PageHeader
        eyebrow="COMMAND · Executive Command Centre"
        title={`${current.short_name} · Live Strategic View`}
        description="Predictive enrolment, anomaly alerts and a NIRF-style composite readiness score — recomputed on every visit from live tenant data."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 1 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">COMMAND</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {loading && <div className="py-8 text-center text-xs text-muted-foreground">Computing command view…</div>}

        {readiness && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="NIRF readiness" value={readiness.composite} hint="weighted score" icon={Trophy} testid="cmd-kpi-readiness" />
            <Kpi label="Projected grade" value={readiness.grade} icon={Trophy} testid="cmd-kpi-grade" />
            <Kpi label="High-severity alerts" value={anomalies?.high_count || 0} hint={`${anomalies?.medium_count || 0} medium`} icon={AlertTriangle} testid="cmd-kpi-alerts" />
            <Kpi
              label="Enrolment trend"
              value={forecast ? forecast.trend : "—"}
              hint={forecast ? `${forecast.slope_per_year}/yr` : ""}
              icon={LineChart}
              testid="cmd-kpi-trend"
            />
          </section>
        )}

        {forecast && (
          <Panel eyebrow="Predictive enrolment" title="Next 3 admission cycles" testid="cmd-forecast-panel"
                 action={<span className="text-xs text-muted-foreground">Linear regression on 5-year history</span>}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="label-eyebrow mb-3">History</div>
                <ul className="space-y-2" data-testid="cmd-forecast-history">
                  {forecast.history.map((h) => (
                    <li key={h.year} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{h.year}</span>
                      <div className="flex items-center gap-3 flex-1 ml-4">
                        <div className="flex-1"><MiniBar value={h.enrolment} max={Math.max(...forecast.history.map((x) => x.enrolment), 1000) * 1.2} /></div>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground w-16 text-right">{h.enrolment.toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="label-eyebrow mb-3">Projection</div>
                <ul className="space-y-2" data-testid="cmd-forecast-projection">
                  {forecast.forecast.map((f) => (
                    <li key={f.year} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{f.year}</span>
                      <div className="flex items-center gap-3 flex-1 ml-4">
                        <div className="flex-1"><MiniBar value={f.projected} max={Math.max(...forecast.history.map((x) => x.enrolment), 1000) * 1.2} color="hsl(35, 92%, 55%)" /></div>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground w-16 text-right">{f.projected.toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 text-xs text-muted-foreground">{forecast.narrative}</div>
              </div>
            </div>
          </Panel>
        )}

        {anomalies && (
          <Panel eyebrow="Operational signals" title="Active anomaly alerts" testid="cmd-anomalies-panel">
            <ul className="space-y-2 text-sm" data-testid="cmd-anomalies-list">
              {anomalies.alerts.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-md border p-3 ${
                    a.severity === "high" ? "bg-rose-500/10 border-rose-200" :
                    a.severity === "medium" ? "bg-amber-500/10 border-amber-200" :
                    a.severity === "low" ? "bg-blue-500/10 border-blue-200" :
                    "bg-emerald-600/10 border-emerald-200"
                  }`}
                  data-testid={`cmd-alert-${a.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                        a.severity === "high" ? "text-rose-600" :
                        a.severity === "medium" ? "text-amber-600" :
                        a.severity === "low" ? "text-blue-600" :
                        "text-emerald-600"
                      }`} />
                      <div>
                        <div className="font-medium">{a.message}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          KPI: <span className="font-mono">{a.kpi}</span>
                          {a.threshold !== 0 && (
                            <> · current {a.value} · threshold {a.threshold}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      a.severity === "high" ? "bg-rose-500/15 text-rose-700 border-rose-200" :
                      a.severity === "medium" ? "bg-amber-500/15 text-amber-700 border-amber-200" :
                      a.severity === "low" ? "bg-blue-500/15 text-blue-700 border-blue-200" :
                      "bg-emerald-600/15 text-emerald-700 border-emerald-200"
                    }>{a.severity}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {readiness && (
          <Panel eyebrow="Composite readiness" title="NIRF-style 5-dimension breakdown" testid="cmd-readiness-panel"
                 action={<Badge className="bg-primary text-primary-foreground" data-testid="cmd-readiness-grade">{readiness.grade}</Badge>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {readiness.dimensions.map((d) => (
                <div key={d.name} className="space-y-1" data-testid={`cmd-readiness-${d.name.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      <span className="font-mono">{d.value}</span> · weight {d.weight}%
                    </span>
                  </div>
                  <MiniBar
                    value={d.value}
                    color={d.value >= 70 ? "hsl(142, 71%, 45%)" : d.value >= 50 ? "hsl(35, 92%, 55%)" : "hsl(0, 84%, 60%)"}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                Composite = weighted average across all dimensions
              </div>
              <div className="text-2xl font-semibold tabular-nums" data-testid="cmd-readiness-composite">{readiness.composite}/100</div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
