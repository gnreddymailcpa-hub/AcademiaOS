import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loader2, BarChart3 } from "lucide-react";

function pctBadge(pct) {
  const tone = pct >= 75 ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" :
               pct >= 60 ? "bg-amber-500/15 text-amber-700 border-amber-500/30" :
               "bg-red-500/15 text-red-700 border-red-500/30";
  return <Badge variant="outline" className={`${tone} border tabular-nums`}>{pct}%</Badge>;
}

export default function ClarosCoreAttendanceReport() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ date_from: "", date_to: "" });

  const isStudent = user?.role === "student";

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      if (isStudent) {
        const { data } = await api.get(`/v1/core/attendance/summary/me`);
        setRows(data?.per_course || []);
      } else {
        const params = new URLSearchParams();
        if (filters.date_from) params.set("date_from", filters.date_from);
        if (filters.date_to) params.set("date_to", filters.date_to);
        const { data } = await api.get(`/v1/core/attendance/report?${params.toString()}`);
        setRows(data?.items || []);
      }
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [current, isStudent, filters]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  return (
    <div data-testid="claros-core-attendance-report-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Attendance Report"
        description={isStudent ? "Per-course attendance for the current semester." : "Institution-wide attendance report. Filter by date range."}
        actions={
          <Badge variant="outline" className="gap-1.5">
            <BarChart3 className="h-3 w-3" /> {rows.length} {isStudent ? "courses" : "rows"}
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {!isStudent && (
          <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="core-att-report-filters">
            <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} placeholder="From" data-testid="core-att-report-from" />
            <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} placeholder="To" data-testid="core-att-report-to" />
          </div>
        )}

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground" data-testid="core-att-report-empty">
              No attendance records yet.
            </div>
          ) : (
            <Table data-testid="core-att-report-table">
              <TableHeader>
                <TableRow>
                  {!isStudent && <TableHead>Student</TableHead>}
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} data-testid={`core-att-report-row-${i}`}>
                    {!isStudent && (
                      <TableCell className="font-mono text-xs">{r.student_id?.slice(0, 8)}</TableCell>
                    )}
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.course_code}</div>
                      <div className="text-[11px] text-muted-foreground">{r.course_name}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.total}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-700">{r.present}</TableCell>
                    <TableCell className="text-right text-sm text-red-700">{r.absent}</TableCell>
                    <TableCell className="text-center">{pctBadge(r.pct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
