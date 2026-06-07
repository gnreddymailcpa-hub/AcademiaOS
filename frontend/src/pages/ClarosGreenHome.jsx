import React, { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Zap, Sun, Cloud, ArrowUpRight, ArrowDownRight, Sparkles, Loader2, Copy, Download,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { toast } from "sonner";

function Stat({ icon: Icon, label, value, unit, sub, testid }) {
  return (
    <div className="card p-4 border border-border" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">
        {value}{unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SolarGauge({ pct }) {
  const safe = Math.max(0, Math.min(100, pct || 0));
  return (
    <div data-testid="solar-gauge">
      <div className="text-2xl font-semibold tabular-nums">{safe.toFixed(1)}%</div>
      <div className="h-2 w-full bg-muted rounded overflow-hidden mt-1">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export default function ClarosGreenHome() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, t, m] = await Promise.all([
        api.get("/v1/green/stats").then(r => r.data).catch(() => null),
        api.get("/v1/green/energy/trends").then(r => r.data).catch(() => []),
        api.get("/v1/green/metrics").then(r => r.data).catch(() => []),
      ]);
      setStats(s); setTrends(t || []); setMetrics(m || []);
    } catch { toast.error("Failed to load green data"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const genReport = async () => {
    setGenerating(true); setReport(null);
    try {
      const r = await api.post("/v1/green/report/generate");
      setReport(r.data);
      toast.success("Report generated");
    } catch (e) { toast.error("Generation failed"); }
    finally { setGenerating(false); }
  };

  const copy = async () => {
    if (!report?.content) return;
    await navigator.clipboard.writeText(report.content);
    toast.success("Copied");
  };

  const download = () => {
    if (!report?.content) return;
    const blob = new Blob([report.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claros-green-${(report.period || "report").replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const delta = stats?.vs_last_month_pct ?? 0;
  const deltaPositive = delta > 0;

  return (
    <div className="space-y-6" data-testid="green-page">
      <PageHeader eyebrow="Claros Green" title="Sustainability Dashboard"
        description="Energy consumption, solar share, sustainability metrics and AI-generated reports."
        actions={
          <Button onClick={genReport} disabled={generating} data-testid="green-generate-report-btn">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Monthly Report
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat testid="green-stat-kwh" icon={Zap} label="Total kWh this month"
              value={(stats?.monthly_kwh ?? 0).toLocaleString("en-IN")} unit="kWh" />
        <div className="card p-4 border border-border" data-testid="green-stat-solar">
          <div className="flex items-center justify-between">
            <div className="label-eyebrow">Solar share</div>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </div>
          <SolarGauge pct={stats?.solar_pct} />
        </div>
        <Stat testid="green-stat-carbon" icon={Cloud} label="Carbon estimate"
              value={stats?.carbon_tonnes_est ?? 0} unit="tCO₂e" />
        <div className="card p-4 border border-border" data-testid="green-stat-delta">
          <div className="flex items-center justify-between">
            <div className="label-eyebrow">vs last month</div>
            {deltaPositive ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : <ArrowDownRight className="h-4 w-4 text-emerald-500" />}
          </div>
          <div className={`text-2xl font-semibold tabular-nums mt-1 ${deltaPositive ? "text-red-600" : "text-emerald-600"}`}>
            {deltaPositive ? "+" : ""}{delta.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">{deltaPositive ? "Higher usage" : "Lower usage"}</div>
        </div>
      </div>

      <div className="card p-5 border border-border" data-testid="green-chart">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">30-day energy trend</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 inline-block bg-slate-500 rounded-sm" /> Main</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 inline-block bg-amber-400 rounded-sm" /> Solar</span>
          </div>
        </div>
        <div style={{ width: "100%", height: 260, minHeight: 260 }}>
          <ResponsiveContainer minHeight={260} debounce={1}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 11 }} unit=" kWh" />
              <Tooltip />
              <Area type="monotone" dataKey="main_kwh" stackId="1" stroke="#64748b" fill="#64748b" fillOpacity={0.7} name="Main" />
              <Area type="monotone" dataKey="solar_kwh" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.8} name="Solar" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {metrics.slice(0, 6).map(m => (
          <div key={m.id} className="card p-4 border border-border" data-testid={`green-metric-${m.id}`}>
            <div className="label-eyebrow">{m.metric_name}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{m.value}
              <span className="text-sm font-normal text-muted-foreground ml-1">{m.unit}</span>
            </div>
            <Badge variant="outline" className="text-[10px] mt-1">{m.category}</Badge>
            <div className="text-xs text-muted-foreground mt-1">{m.recorded_date}</div>
          </div>
        ))}
      </div>

      {report && (
        <div className="card p-5 border border-border" data-testid="green-report-output">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              Period: <span className="text-foreground font-medium">{report.period}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={copy} data-testid="green-report-copy">
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={download} data-testid="green-report-download">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Save
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans bg-muted/30 border rounded p-4">{report.content}</pre>
        </div>
      )}
    </div>
  );
}
