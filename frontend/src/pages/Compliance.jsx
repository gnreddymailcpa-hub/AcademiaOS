import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  Activity,
  Users2,
  Eye,
} from "lucide-react";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";

function exportCSV(rows) {
  if (!rows.length) return;
  const cols = ["ts", "action", "actor", "target"];
  const lines = [cols.join(",")].concat(
    rows.map((r) =>
      cols
        .map((c) => {
          const v = (r[c] ?? "").toString().replaceAll('"', '""');
          return /[,"\n]/.test(v) ? `"${v}"` : v;
        })
        .join(",")
    )
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Compliance() {
  const { current } = useInstitution();
  const [data, setData] = useState({ items: [], actions: [], actors: [], count: 0 });
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("__all__");
  const [actorFilter, setActorFilter] = useState("__all__");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    if (!current) return;
    const params = { limit: 300 };
    if (actionFilter && actionFilter !== "__all__") params.action = actionFilter;
    if (actorFilter && actorFilter !== "__all__") params.actor = actorFilter;
    if (q.trim()) params.q = q.trim();
    const { data: d } = await api.get(`/audit/${current.id}`, { params });
    setData(d);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, actionFilter, actorFilter]);

  const actionChart = useMemo(() => {
    const counts = {};
    for (const it of data.items) counts[it.action] = (counts[it.action] || 0) + 1;
    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [data]);

  const topActors = useMemo(() => {
    const counts = {};
    for (const it of data.items) counts[it.actor] = (counts[it.actor] || 0) + 1;
    return Object.entries(counts)
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  return (
    <div className="space-y-8 pb-12" data-testid="compliance-page">
      <PageHeader
        eyebrow="Governance"
        title="Compliance & Audit"
        description="Filterable audit log explorer across every AI generation, approval, workflow run and configuration change."
        actions={
          <Button variant="outline" onClick={() => exportCSV(data.items)} data-testid="audit-export-btn">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 px-4 md:px-8 md:grid-cols-4">
        <SummaryCard icon={Activity} label="Events (latest)" value={data.count} />
        <SummaryCard icon={Filter} label="Distinct actions" value={data.actions.length} />
        <SummaryCard icon={Users2} label="Distinct actors" value={data.actors.length} />
        <SummaryCard icon={ShieldCheck} label="Retention" value="13 months" />
      </div>

      <div className="grid gap-4 px-4 md:px-8 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card/40 p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Audit volume by action
          </div>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionChart} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="action" tick={{ fontSize: 11 }} width={140} />
                <RTooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/40 p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Top actors</div>
          <div className="mt-3 space-y-2" data-testid="top-actors">
            {topActors.map((a) => (
              <div key={a.actor} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                <span className="truncate text-foreground">{a.actor}</span>
                <Badge variant="outline">{a.count}</Badge>
              </div>
            ))}
            {!topActors.length && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No actors in the current window.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8">
        <div className="rounded-xl border border-border/70 bg-card/40 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Search action / target / actor
              </Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="e.g. workflow.approve"
                  className="pl-8"
                  data-testid="audit-search-input"
                />
              </div>
            </div>
            <div className="min-w-[180px]">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="audit-action-filter">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All actions</SelectItem>
                  {data.actions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Actor</Label>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger data-testid="audit-actor-filter">
                  <SelectValue placeholder="All actors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All actors</SelectItem>
                  {data.actors.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} data-testid="audit-search-btn">
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="audit-table">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-border/60 hover:bg-card">
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                      {new Date(it.ts).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px]">{it.action}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-foreground">{it.actor}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground truncate max-w-[280px]">
                      {it.target}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(it)}
                        data-testid={`audit-view-${it.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data.items.length && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      No audit events match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent data-testid="audit-event-dialog">
          <DialogHeader>
            <DialogTitle>Audit event</DialogTitle>
            <DialogDescription>
              Full event payload as recorded in the immutable audit log.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
              {JSON.stringify(selected, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div
      className="rounded-xl border border-border/70 bg-card/40 px-5 py-4"
      data-testid={`compliance-summary-${label.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
