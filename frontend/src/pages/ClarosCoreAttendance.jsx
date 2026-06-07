import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Loader2, ClipboardCheck, Check, X, Clock, FileText } from "lucide-react";

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const FACULTY_ROLES = new Set([
  "super_admin", "institution_admin", "faculty", "instructor", "hod",
  "programme_manager", "registrar",
]);

export default function ClarosCoreAttendance() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const presetCourse = searchParams.get("course") || "";

  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(presetCourse);
  const [classDate, setClassDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});  // student_id -> status
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canMark = FACULTY_ROLES.has(user?.role);

  const loadCourses = useCallback(async () => {
    if (!current) return;
    try {
      const { data } = await api.get(`/v1/core/courses`);
      setCourses(data || []);
      if (!courseId && data && data.length) setCourseId(data[0].id);
    } catch (e) {
      setCourses([]);
    }
  }, [current, courseId]);

  const loadRoster = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/v1/core/courses/${courseId}/roster`);
      setRoster(data?.students || []);
      // Initialise all to PRESENT
      const init = {};
      (data?.students || []).forEach(s => { init[s.id] = "PRESENT"; });
      setMarks(init);
    } catch (e) {
      setRoster([]);
      setMarks({});
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  const markAll = (status) => {
    const next = {};
    roster.forEach(s => { next[s.id] = status; });
    setMarks(next);
  };

  const submit = async () => {
    if (!courseId || roster.length === 0) {
      toast.error("Pick a course with enrolled students first");
      return;
    }
    setSubmitting(true);
    try {
      const records = roster.map(s => ({ student_id: s.id, status: marks[s.id] || "PRESENT" }));
      const { data } = await api.post(`/v1/core/attendance/mark`, {
        course_id: courseId, class_date: classDate, records,
      });
      toast.success(`Saved · ${data.created} new, ${data.updated} updated`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  if (!current) return null;
  if (!canMark) {
    return (
      <div data-testid="claros-core-attendance-page">
        <PageHeader
          eyebrow="Claros Core · Campus ERP"
          title="Attendance Marking"
          description="Faculty-only screen. Switch to /core/attendance/report to view your own attendance."
        />
        <div className="p-6 lg:p-8">
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            You don&apos;t have permission to mark attendance.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="claros-core-attendance-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Mark Attendance"
        description="Pick a course, choose the class date, and mark each student's status."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/core/attendance/report"><FileText className="h-3.5 w-3.5 me-1.5" />View Report</a>
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* ----- Controls ----- */}
        <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger data-testid="core-att-course-select">
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Class date</label>
            <Input
              type="date"
              value={classDate}
              onChange={(e) => setClassDate(e.target.value)}
              data-testid="core-att-date-input"
            />
          </div>
          <div className="md:col-span-3 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => markAll("PRESENT")} data-testid="core-att-mark-all-present">
              <Check className="h-3.5 w-3.5 me-1.5" /> All Present
            </Button>
            <Button variant="outline" size="sm" onClick={() => markAll("ABSENT")} data-testid="core-att-mark-all-absent">
              <X className="h-3.5 w-3.5 me-1.5" /> All Absent
            </Button>
          </div>
        </div>

        {/* ----- Roster ----- */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading roster…
            </div>
          ) : roster.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground" data-testid="core-att-empty-roster">
              No students enrolled for this course.
            </div>
          ) : (
            <>
              <Table data-testid="core-att-roster-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Roll No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map(s => (
                    <TableRow key={s.id} data-testid={`core-att-row-${s.roll_number}`}>
                      <TableCell className="font-mono text-xs">{s.roll_number}</TableCell>
                      <TableCell className="text-sm">{s.display_name}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {STATUS_OPTIONS.map(opt => (
                            <Button
                              key={opt}
                              type="button"
                              size="sm"
                              variant={marks[s.id] === opt ? "default" : "outline"}
                              onClick={() => setMarks({ ...marks, [s.id]: opt })}
                              className="text-[10px] h-7 px-2"
                              data-testid={`core-att-${s.roll_number}-${opt}`}
                            >
                              {opt[0]}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border p-4 flex items-center justify-between">
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="h-3 w-3" /> {roster.length} students
                </Badge>
                <Button
                  onClick={submit}
                  disabled={submitting}
                  data-testid="core-att-submit"
                >
                  {submitting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 me-2" />}
                  Save Attendance
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
