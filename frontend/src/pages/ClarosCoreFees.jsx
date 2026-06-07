import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Wallet, Loader2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

function statusBadge(s) {
  const map = {
    PAID: { className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
    PENDING: { className: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: Clock },
    OVERDUE: { className: "bg-red-500/15 text-red-700 border-red-500/30", Icon: AlertTriangle },
  };
  const m = map[s] || map.PENDING;
  return (
    <Badge variant="outline" className={`${m.className} border gap-1 text-[10px]`}>
      <m.Icon className="h-3 w-3" /> {s}
    </Badge>
  );
}

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ClarosCoreFees() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const isStudent = user?.role === "student";

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      if (isStudent) {
        const { data } = await api.get(`/v1/core/fees/me`);
        setData({ kind: "me", payload: data });
      } else {
        const { data } = await api.get(`/v1/core/fees/report`);
        setData({ kind: "report", payload: data });
      }
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [current, isStudent]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  return (
    <div data-testid="claros-core-fees-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Fees"
        description={
          isStudent ? "Your fee components, payments and balance for 2025-26." :
          "Institution-wide fee collection report for current academic year."
        }
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Wallet className="h-3 w-3" /> 2025-26
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading…
          </div>
        ) : !data ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No fee data available.
          </div>
        ) : data.kind === "me" ? (
          <StudentFees payload={data.payload} />
        ) : (
          <ReportFees payload={data.payload} />
        )}
      </div>
    </div>
  );
}

function StudentFees({ payload }) {
  const s = payload.summary || {};
  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="core-fees-summary">
        <SummaryCard label="Total due" value={inr(s.total_due)} testid="core-fees-due" />
        <SummaryCard label="Paid" value={inr(s.total_paid)} testid="core-fees-paid" tone="emerald" />
        <SummaryCard
          label={s.balance > 0 ? "Outstanding balance" : "Cleared"}
          value={s.balance > 0 ? inr(s.balance) : "✓"}
          testid="core-fees-balance"
          tone={s.balance > 0 ? "red" : "emerald"}
        />
      </div>

      {/* Components */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Fee components</h3>
        </div>
        <Table data-testid="core-fees-components-table">
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payload.components?.map(c => (
              <TableRow key={c.component_id} data-testid={`core-fees-comp-${c.component_id}`}>
                <TableCell className="text-sm">{c.component_name}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{inr(c.amount)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{inr(c.paid)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">{inr(c.balance)}</TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment history */}
      {payload.payments?.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Payment history</h3>
          </div>
          <Table data-testid="core-fees-payments-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.payments.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.payment_date}</TableCell>
                  <TableCell className="text-xs font-mono">{p.transaction_ref}</TableCell>
                  <TableCell className="text-xs">{p.payment_mode}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-medium">{inr(p.amount_paid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function ReportFees({ payload }) {
  const pct = payload.collection_pct || 0;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="core-fees-report-cards">
        <SummaryCard label="Expected" value={inr(payload.total_expected)} testid="report-expected" />
        <SummaryCard label="Collected" value={inr(payload.total_collected)} testid="report-collected" tone="emerald" />
        <SummaryCard label="Collection %" value={`${pct}%`} testid="report-pct"
          tone={pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "red"} />
        <SummaryCard label="Defaulters" value={payload.defaulters} sub={`of ${payload.active_students} students`}
          testid="report-defaulters" tone="red" />
      </div>
    </>
  );
}

function SummaryCard({ label, value, sub, tone, testid }) {
  const toneCls = tone === "emerald" ? "text-emerald-700" :
                  tone === "red" ? "text-red-700" :
                  tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testid}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
