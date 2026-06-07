import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { ShieldCheck, ArrowUpRight, Sparkles, Loader2, BookOpen } from "lucide-react";

const TONES = {
  high: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  mid: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  low: "bg-red-500/10 border-red-500/30 text-red-700",
};
function pctTone(pct) {
  if (pct >= 75) return TONES.high;
  if (pct >= 50) return TONES.mid;
  return TONES.low;
}
function gradeColor(g) {
  return g?.startsWith("A") ? "text-emerald-700" :
         g?.startsWith("B") ? "text-amber-700" : "text-red-700";
}

function ReadinessGauge({ pct, grade }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  const off = c - (p / 100) * c;
  const color = p >= 75 ? "hsl(142, 71%, 45%)" :
                p >= 50 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  return (
    <div className="relative" data-testid="comply-readiness-gauge">
      <svg width="160" height="160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 80 80)" />
        <text x="80" y="84" textAnchor="middle" style={{ fontSize: "30px", fontWeight: 600, fill: "currentColor" }}>
          {p.toFixed(0)}%
        </text>
        <text x="80" y="104" textAnchor="middle" style={{ fontSize: "9px", letterSpacing: "1.5px", textTransform: "uppercase", fill: "currentColor", opacity: 0.6 }}>
          NAAC readiness
        </text>
      </svg>
      <div className={`text-center mt-1 text-2xl font-semibold tracking-tight ${gradeColor(grade)}`} data-testid="comply-grade-projection">
        Grade · {grade || "—"}
      </div>
    </div>
  );
}

export default function ClarosComplyDashboard() {
  const { current } = useInstitution();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.get(`/v1/comply/dashboard`).then(r => r.data),
        api.get(`/v1/comply/readiness`).then(r => r.data),
      ]);
      setItems(d.items || []);
      setReadiness(r);
    } catch (e) {
      setItems([]); setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  return (
    <div data-testid="claros-comply-dashboard-page">
      <PageHeader
        eyebrow="Claros Comply · NAAC Accreditation"
        title="NAAC Dashboard"
        description={`Live readiness across all 7 NAAC criteria for ${current.short_name || current.name}.`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/comply/obe")} data-testid="comply-obe-link">
            <BookOpen className="h-3.5 w-3.5 me-1.5" /> OBE Framework
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* ----- Top: readiness gauge + summary ----- */}
        <div className="rounded-lg border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex justify-center">
            {loading ? <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /> : <ReadinessGauge pct={readiness?.overall_pct} grade={readiness?.grade_projection} />}
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3" data-testid="comply-summary-kpis">
            <KpiCard label="Overall score" value={readiness ? `${readiness.overall_score.toFixed(0)} / ${readiness.max_score.toFixed(0)}` : "—"} testid="comply-kpi-score" />
            <KpiCard label="Readiness %" value={readiness ? `${readiness.overall_pct}%` : "—"} testid="comply-kpi-pct" />
            <KpiCard label="Grade projection" value={readiness?.grade_projection || "—"} testid="comply-kpi-grade" tone={gradeColor(readiness?.grade_projection)} />
            <KpiCard label="Criteria tracked" value={items.length || 0} testid="comply-kpi-criteria-count" />
          </div>
        </div>

        {/* ----- 7 criterion cards ----- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="comply-criteria-grid">
          {loading ? Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg border border-border bg-card animate-pulse" />
          )) : items.map(c => (
            <div
              key={c.criterion_id}
              onClick={() => navigate(`/comply/criteria/${c.criterion_id}`)}
              className={`rounded-lg border-2 p-4 cursor-pointer transition hover:shadow-md ${pctTone(c.readiness_pct)}`}
              data-testid={`comply-criterion-${c.code}`}
            >
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline" className="text-[10px] font-mono">C{c.code}</Badge>
                <ArrowUpRight className="h-3 w-3 opacity-50" />
              </div>
              <div className="text-sm font-semibold leading-tight mb-2">{c.name}</div>
              <div className="text-[11px] opacity-80 mb-2 tabular-nums">
                {c.current_score.toFixed(0)} / {c.max_score.toFixed(0)} · {c.readiness_pct}%
              </div>
              <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                <div className="h-full bg-current opacity-80" style={{ width: `${c.readiness_pct}%` }} />
              </div>
              <div className="mt-2 text-[10px] opacity-70 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> {c.evidence_count} evidence · {c.metric_count} metrics
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone, testid }) {
  return (
    <div className="rounded-md border border-border p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone || ""}`}>{value}</div>
    </div>
  );
}
