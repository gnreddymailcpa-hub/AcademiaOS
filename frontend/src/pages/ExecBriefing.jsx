import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { api, formatApiError } from "../lib/api";

/**
 * Executive Briefing — single-page board / NAAC visit document aggregating
 * live KPIs from all 12 platforms via `/api/exec/briefing/{tenant}`. Print
 * stylesheet hides chrome so window.print() produces a clean PDF.
 */
export default function ExecBriefing() {
  const { current } = useInstitution();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current?.id) return;
    setLoading(true);
    api.get(`/exec/briefing/${current.id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(formatApiError(e?.response?.data?.detail) || "Could not load briefing"))
      .finally(() => setLoading(false));
  }, [current?.id]);

  const onPrint = () => window.print();

  if (!current) return null;
  return (
    <div data-testid="exec-briefing-page" className="bg-background min-h-screen">
      {/* Print styles — hide app chrome (sidebar/topbar) when printing */}
      <style>{`
        @media print {
          aside, header, [data-print-hide] { display: none !important; }
          body { background: white !important; }
          .briefing-root { padding: 24px !important; }
          .briefing-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <div className="p-6 lg:p-8 briefing-root">
        {/* Top bar — hidden in print */}
        <div className="flex items-center justify-between mb-6" data-print-hide>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="exec-briefing-back">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          <Button onClick={onPrint} className="gap-1.5" data-testid="exec-briefing-print">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>

        {loading && (
          <div className="py-12 text-center text-xs text-muted-foreground">Composing briefing…</div>
        )}

        {data && (
          <article className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <header className="text-center pb-6 border-b border-border briefing-card">
              <div className="label-eyebrow mb-2">Executive Briefing</div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {data.institution.full_name}
              </h1>
              <div className="text-sm text-muted-foreground mt-1">
                {data.institution.type} · {data.institution.country}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                Generated {(data.generated_at || "").slice(0, 19)} · by {data.generated_by}
              </div>
            </header>

            {/* Headline KPIs */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 briefing-card" data-testid="exec-briefing-headline">
              <KpiBox label="Composite score" value={data.headline.composite_score} />
              <KpiBox label="Projected grade" value={data.headline.grade} />
              <KpiBox label="Platforms active" value={data.headline.platforms_active} />
              <KpiBox label="Active users" value={data.headline.active_users} />
            </section>

            {/* Per-platform sections */}
            {data.sections.map((s) => (
              <section
                key={s.code}
                className="rounded-lg border border-border bg-card p-5 briefing-card"
                data-testid={`exec-briefing-section-${s.code}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="label-eyebrow">{s.code}</div>
                    <div className="font-semibold tracking-tight text-base">{s.title}</div>
                  </div>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Sparkles className="h-2.5 w-2.5" /> Live
                  </Badge>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  {s.metrics.map((m) => (
                    <li key={m.k} className="flex items-center justify-between border-b border-border/40 pb-1.5">
                      <span className="text-muted-foreground">{m.k}</span>
                      <span className="font-mono tabular-nums font-medium">
                        {typeof m.v === "number" ? m.v.toLocaleString() : m.v}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <footer className="text-center text-[10px] text-muted-foreground pt-4 briefing-card">
              Generated by AcademiaOS.ai · Confidential institutional briefing
            </footer>
          </article>
        )}
      </div>
    </div>
  );
}

function KpiBox({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-center">
      <div className="label-eyebrow">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
