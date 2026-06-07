import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import {
  Loader2, BarChart3, PieChart, TrendingUp, Filter,
} from "lucide-react";

const STAGE_COLORS = {
  NEW: "bg-slate-500", CONTACTED: "bg-blue-500", COUNSELED: "bg-indigo-500",
  APPLIED: "bg-amber-500", OFFERED: "bg-violet-500",
  ENROLLED: "bg-emerald-500", DROPPED: "bg-red-500",
};
const SOURCE_COLORS = {
  WEBSITE: "bg-blue-500", REFERRAL: "bg-emerald-500", EVENT: "bg-violet-500",
  WALKIN: "bg-amber-500", WHATSAPP: "bg-green-500", SOCIAL: "bg-pink-500",
};

export default function ClarosEnrollAnalytics() {
  const { current } = useInstitution();
  const [funnel, setFunnel] = useState(null);
  const [sources, setSources] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const [f, s, d] = await Promise.all([
        api.get(`/v1/enroll/analytics/funnel`).then(r => r.data),
        api.get(`/v1/enroll/analytics/sources`).then(r => r.data),
        api.get(`/v1/enroll/analytics/daily`).then(r => r.data),
      ]);
      setFunnel(f); setSources(s.items || []); setDaily(d.items || []);
    } catch (e) {
      setFunnel(null); setSources([]); setDaily([]);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  const sourceTotal = sources.reduce((s, x) => s + (x.total || 0), 0) || 1;
  const dailyMax = Math.max(1, ...daily.map(d => d.count || 0));
  const funnelMax = Math.max(1, ...(funnel?.stages || []).map(s => s.count || 0));

  return (
    <div data-testid="claros-enroll-analytics-page">
      <PageHeader
        eyebrow="Claros Enroll · Analytics"
        title="Admissions Analytics"
        description="Funnel performance, source attribution, daily lead velocity — current month."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Filter className="h-3 w-3" /> {current.short_name || current.name}
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading analytics…
          </div>
        ) : (
          <>
            {/* ----- Summary cards ----- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="enroll-analytics-summary">
              <SummaryCard label="Month total" value={funnel?.totals?.month_total || 0} testid="analytics-month-total" />
              <SummaryCard label="Enrolled (month)" value={funnel?.totals?.enrolled || 0} testid="analytics-enrolled" tone="emerald" />
              <SummaryCard label="Conversion %" value={`${funnel?.totals?.conversion_pct || 0}%`} testid="analytics-conversion" tone="violet" />
              <SummaryCard label="Total sources" value={sources.length} testid="analytics-sources" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ----- Funnel chart ----- */}
              <div className="rounded-lg border border-border bg-card p-5" data-testid="enroll-analytics-funnel">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold tracking-tight text-sm">Funnel · this month</h3>
                </div>
                <div className="space-y-2.5">
                  {(funnel?.stages || []).map(s => {
                    const width = (s.count / funnelMax) * 100;
                    return (
                      <div key={s.status} className="flex items-center gap-2" data-testid={`funnel-stage-${s.status}`}>
                        <div className="w-24 text-[11px] font-mono text-muted-foreground">{s.status}</div>
                        <div className="flex-1 h-7 bg-muted/40 rounded">
                          <div className={`h-full ${STAGE_COLORS[s.status] || "bg-slate-500"} rounded transition-all flex items-center px-2`} style={{ width: `${Math.max(width, 4)}%` }}>
                            <span className="text-[10px] font-medium text-white tabular-nums">{s.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ----- Source breakdown ----- */}
              <div className="rounded-lg border border-border bg-card p-5" data-testid="enroll-analytics-sources">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold tracking-tight text-sm">Source breakdown · all-time</h3>
                </div>
                <div className="space-y-3">
                  {sources.map(s => {
                    const pct = ((s.total / sourceTotal) * 100).toFixed(1);
                    return (
                      <div key={s.source} data-testid={`source-row-${s.source}`}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium">{s.source}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {s.total} leads · {s.enrolled} enrolled · {s.conversion_pct}% conv
                          </span>
                        </div>
                        <div className="h-2 bg-muted/40 rounded overflow-hidden">
                          <div className={`h-full ${SOURCE_COLORS[s.source] || "bg-slate-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ----- Daily new leads line/bar ----- */}
            <div className="rounded-lg border border-border bg-card p-5" data-testid="enroll-analytics-daily">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-semibold tracking-tight text-sm">Daily new leads · last 30 days</h3>
              </div>
              <div className="flex items-end gap-0.5 h-32 border-b border-border">
                {daily.map(d => {
                  const h = (d.count / dailyMax) * 100;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col justify-end items-center" title={`${d.day} · ${d.count}`}>
                      <div
                        className="w-full bg-primary/70 hover:bg-primary transition rounded-t"
                        style={{ height: `${Math.max(h, 1)}%` }}
                        data-testid={`daily-bar-${d.day}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1 tabular-nums">
                <span>{daily[0]?.day}</span>
                <span>{daily[Math.floor(daily.length / 2)]?.day}</span>
                <span>{daily[daily.length - 1]?.day}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, testid }) {
  const toneCls = tone === "emerald" ? "text-emerald-700" :
                  tone === "violet" ? "text-violet-700" :
                  tone === "red" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testid}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
