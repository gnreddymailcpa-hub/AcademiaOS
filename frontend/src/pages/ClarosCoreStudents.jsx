import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { Users, Loader2, Filter } from "lucide-react";

const STATUSES = ["ALL", "ACTIVE", "GRADUATED", "DROPPED", "SUSPENDED"];

function attBadge(pct) {
  if (pct == null) return <Badge variant="outline">—</Badge>;
  if (pct >= 75) return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border border-emerald-500/30">{pct}%</Badge>;
  if (pct >= 60) return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border border-amber-500/30">{pct}%</Badge>;
  return <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/15 border border-red-500/30">{pct}%</Badge>;
}

function statusBadge(s) {
  const tone = s === "ACTIVE" ? "default" : s === "GRADUATED" ? "secondary" : "destructive";
  return <Badge variant={tone} className="text-[10px]">{s}</Badge>;
}

export default function ClarosCoreStudents() {
  const { current } = useInstitution();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [filters, setFilters] = useState({
    q: "", department_id: "ALL", program_id: "ALL", status: "ALL",
  });
  const [loading, setLoading] = useState(false);

  const loadLookups = useCallback(async () => {
    if (!current) return;
    const [d, p] = await Promise.all([
      api.get(`/v1/core/departments`).then(r => r.data).catch(() => []),
      api.get(`/v1/core/programs`).then(r => r.data).catch(() => []),
    ]);
    setDepartments(d);
    setPrograms(p);
  }, [current]);

  const loadStudents = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page_size: "200" });
      if (filters.q) params.set("q", filters.q);
      if (filters.department_id !== "ALL") params.set("department_id", filters.department_id);
      if (filters.program_id !== "ALL") params.set("program_id", filters.program_id);
      if (filters.status !== "ALL") params.set("status", filters.status);
      const { data } = await api.get(`/v1/core/students?${params.toString()}`);
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [current, filters]);

  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  if (!current) return null;
  const filteredPrograms = filters.department_id === "ALL"
    ? programs
    : programs.filter(p => p.department_id === filters.department_id);

  return (
    <div data-testid="claros-core-students-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Students"
        description={`Search and triage learners across departments. ${total} students.`}
        actions={
          <Badge variant="outline" className="gap-1.5" data-testid="core-students-count">
            <Users className="h-3 w-3" /> {total} total
          </Badge>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* ----- Filters ----- */}
        <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3" data-testid="core-students-filters">
          <Input
            value={filters.q}
            placeholder="Search by roll number or name…"
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="md:col-span-2"
            data-testid="core-students-search-input"
          />
          <Select
            value={filters.department_id}
            onValueChange={(v) => setFilters({ ...filters, department_id: v, program_id: "ALL" })}
          >
            <SelectTrigger data-testid="core-students-dept-filter">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.program_id}
            onValueChange={(v) => setFilters({ ...filters, program_id: v })}
          >
            <SelectTrigger data-testid="core-students-prog-filter">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All programs</SelectItem>
              {filteredPrograms.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger data-testid="core-students-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* ----- Table ----- */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading students…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground" data-testid="core-students-empty">
              <Filter className="h-4 w-4 mx-auto mb-2 opacity-60" />
              No students match the current filters.
            </div>
          ) : (
            <Table data-testid="core-students-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Program</TableHead>
                  <TableHead className="text-center">Sem</TableHead>
                  <TableHead className="text-center">CGPA</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const dept = departments.find(d => d.id === s.department_id);
                  const prog = programs.find(p => p.id === s.program_id);
                  return (
                    <TableRow key={s.id} data-testid={`core-student-row-${s.roll_number}`}>
                      <TableCell className="font-mono text-xs">{s.roll_number}</TableCell>
                      <TableCell className="font-medium text-sm">{s.display_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{dept?.code || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{prog?.code || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{s.current_semester}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{s.cgpa?.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{attBadge(s.attendance_pct)}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
