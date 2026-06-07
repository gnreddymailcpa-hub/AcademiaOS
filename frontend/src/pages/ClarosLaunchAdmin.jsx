import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { Loader2, Award, TrendingUp, Users, DollarSign } from "lucide-react";

export default function ClarosLaunchAdmin() {
  const { current } = useInstitution();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try { const { data } = await api.get(`/v1/launch/stats`); setStats(data); }
    catch { setStats(null); } finally { setLoading(false); }
  }, [current]);
  useEffect(() => { load(); }, [load]);

  if (!current) return null;
  const maxRec = Math.max(1, ...(stats?.top_recruiters || []).map(r => r.count));

  return (
    <div data-testid="claros-launch-admin-page">
      <PageHeader eyebrow="Claros Launch · Admin Analytics" title="Placement Analytics"
        description={`Year-over-year placement performance for ${current.short_name || current.name}.`}
      />
      <div className="p-6 lg:p-8 space-y-6">
        {loading ? <div className="text-center py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" />Loading…</div> :
         !stats ? <div className="text-center py-12 text-sm text-muted-foreground">No stats available.</div> :
         <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="launch-admin-kpis">
            <Kpi icon={Users} label="Placed students" value={stats.placed_count} testid="launch-kpi-placed" />
            <Kpi icon={TrendingUp} label="Placement %" value={`${stats.placement_pct}%`} testid="launch-kpi-pct" tone={stats.placement_pct >= 80 ? "emerald" : stats.placement_pct >= 60 ? "amber" : "red"} />
            <Kpi icon={DollarSign} label="Avg package" value={`₹${stats.avg_package}L`} testid="launch-kpi-avg" />
            <Kpi icon={Award} label="Highest package" value={`₹${stats.max_package}L`} testid="launch-kpi-max" tone="emerald" />
          </div>
          <div className="rounded-lg border border-border bg-card p-5" data-testid="launch-admin-top-recruiters">
            <h3 className="font-semibold text-sm mb-4">Top recruiters</h3>
            {stats.top_recruiters?.length === 0 ? <div className="text-center py-6 text-sm text-muted-foreground">No placements recorded yet.</div> :
             <div className="space-y-2.5">
              {stats.top_recruiters.map(r => {
                const w = (r.count / maxRec) * 100;
                return (
                  <div key={r.company} className="flex items-center gap-3" data-testid={`launch-recruiter-${r.company}`}>
                    <div className="w-40 text-sm font-medium">{r.company}</div>
                    <div className="flex-1 h-6 bg-muted/40 rounded">
                      <div className="h-full bg-primary rounded flex items-center justify-end pe-2 text-[10px] text-primary-foreground font-medium tabular-nums" style={{ width: `${Math.max(w, 8)}%` }}>{r.count}</div>
                    </div>
                  </div>
                );
              })}
             </div>
            }
          </div>
         </>
        }
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, testid }) {
  const toneCls = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span></div>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
