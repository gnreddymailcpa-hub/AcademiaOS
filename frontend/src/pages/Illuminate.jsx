import React, { useEffect, useState } from "react";
import {
  Sparkles, BookOpen, Plus, ClipboardCheck, Users, TrendingUp,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList } from "../components/dashboards/widgets";

/**
 * ILLUMINATE — Intelligent LMS (Phase 2 MVP).
 *
 * Three tabs: Courses · Assignments · Cohort progress (read-only).
 */
export default function Illuminate() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isFaculty = ["super_admin", "institution_admin", "faculty", "instructor"].includes(user?.role);

  if (!current) return null;
  return (
    <div data-testid="illuminate-page">
      <PageHeader
        eyebrow="ILLUMINATE · Intelligent LMS"
        title={`${current.short_name} · Learning Operations`}
        description="Adaptive course catalog, OBE-aligned assignments and live cohort progress — instrumented for NAAC Criterion 2."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 2 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">ILLUMINATE</Badge>
          </>
        }
      />
      <div className="p-6 lg:p-8">
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList data-testid="illuminate-tabs">
            <TabsTrigger value="courses" data-testid="illuminate-tab-courses">Courses</TabsTrigger>
            <TabsTrigger value="assignments" data-testid="illuminate-tab-assignments">Assignments</TabsTrigger>
            <TabsTrigger value="progress" data-testid="illuminate-tab-progress">Cohort Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="courses"><CoursesTab institutionId={current.id} isFaculty={isFaculty} /></TabsContent>
          <TabsContent value="assignments"><AssignmentsTab institutionId={current.id} isFaculty={isFaculty} /></TabsContent>
          <TabsContent value="progress"><ProgressTab institutionId={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CoursesTab({ institutionId, isFaculty }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", code: "", credits: 3, instructor: "", cohort: "", lessons_total: 12 });

  const refresh = async () => {
    try { setRows((await api.get(`/illuminate/${institutionId}/courses`)).data || []); }
    catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/illuminate/${institutionId}/courses`, {
        ...draft, credits: parseInt(draft.credits, 10), lessons_total: parseInt(draft.lessons_total, 10),
      });
      toast.success("Course created");
      setOpen(false);
      setDraft({ title: "", code: "", credits: 3, instructor: "", cohort: "", lessons_total: 12 });
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Catalog"
      title="Active courses"
      testid="illuminate-courses-panel"
      action={isFaculty && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="illuminate-course-new"><Plus className="h-4 w-4" />New course</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="illuminate-course-title" /></div>
                <div><Label className="text-xs">Code</Label><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} data-testid="illuminate-course-code" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Credits</Label><Input type="number" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: e.target.value })} data-testid="illuminate-course-credits" /></div>
                <div><Label className="text-xs">Lessons total</Label><Input type="number" value={draft.lessons_total} onChange={(e) => setDraft({ ...draft, lessons_total: e.target.value })} data-testid="illuminate-course-lessons" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Instructor</Label><Input value={draft.instructor} onChange={(e) => setDraft({ ...draft, instructor: e.target.value })} data-testid="illuminate-course-instructor" /></div>
                <div><Label className="text-xs">Cohort</Label><Input value={draft.cohort} onChange={(e) => setDraft({ ...draft, cohort: e.target.value })} data-testid="illuminate-course-cohort" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="illuminate-course-submit">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No courses yet — create one to get started.</div>
      ) : (
        <ItemList
          testid="illuminate-courses-list"
          items={rows.map((r) => ({
            id: r.id, title: `${r.code} · ${r.title}`,
            meta: `${r.credits} cr · ${r.lessons_total} lessons · ${r.instructor}`,
            right: r.cohort || "all",
          }))}
        />
      )}
    </Panel>
  );
}

function AssignmentsTab({ institutionId, isFaculty }) {
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ course_id: "", title: "", due_date: "", max_marks: 100, description: "" });

  const refresh = async () => {
    try {
      const [c, a] = await Promise.all([
        api.get(`/illuminate/${institutionId}/courses`),
        api.get(`/illuminate/${institutionId}/assignments`),
      ]);
      setCourses(c.data || []);
      setRows(a.data || []);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    if (!draft.course_id) { toast.error("Pick a course"); return; }
    try {
      await api.post(`/illuminate/${institutionId}/assignments`, {
        ...draft, max_marks: parseInt(draft.max_marks, 10),
      });
      toast.success("Assignment published");
      setOpen(false);
      setDraft({ course_id: "", title: "", due_date: "", max_marks: 100, description: "" });
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <Panel
      eyebrow="Workbench"
      title="Assignments due"
      testid="illuminate-asn-panel"
      action={isFaculty && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="illuminate-asn-new"><Plus className="h-4 w-4" />New assignment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create assignment</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs">Course</Label>
                <select
                  value={draft.course_id}
                  onChange={(e) => setDraft({ ...draft, course_id: e.target.value })}
                  className="w-full mt-1 h-9 rounded-md border border-border bg-card px-2 text-sm"
                  data-testid="illuminate-asn-course"
                >
                  <option value="">— select —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="illuminate-asn-title" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Due date</Label><Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} data-testid="illuminate-asn-due" /></div>
                <div><Label className="text-xs">Max marks</Label><Input type="number" value={draft.max_marks} onChange={(e) => setDraft({ ...draft, max_marks: e.target.value })} data-testid="illuminate-asn-max" /></div>
              </div>
              <Button onClick={submit} className="w-full" data-testid="illuminate-asn-submit">Publish</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No assignments yet.</div>
      ) : (
        <ItemList
          testid="illuminate-asn-list"
          items={rows.map((r) => {
            const c = courses.find((x) => x.id === r.course_id);
            return {
              id: r.id, title: r.title,
              meta: `${c ? c.code : r.course_id} · due ${r.due_date} · max ${r.max_marks}`,
              right: `${(r.submissions || []).length} subs`,
            };
          })}
        />
      )}
    </Panel>
  );
}

function ProgressTab({ institutionId }) {
  const [s, setS] = useState({ courses: 0, assignments: 0, active_learners: 0, avg_completion_pct: 0 });
  useEffect(() => {
    api.get(`/illuminate/${institutionId}/summary`)
      .then((r) => setS(r.data))
      .catch((e) => toast.error(formatApiError(e?.response?.data?.detail)));
  }, [institutionId]);
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="illuminate-progress-grid">
      <Kpi label="Courses" value={s.courses} icon={BookOpen} testid="illuminate-kpi-courses" />
      <Kpi label="Assignments" value={s.assignments} icon={ClipboardCheck} testid="illuminate-kpi-asn" />
      <Kpi label="Active learners" value={s.active_learners} icon={Users} testid="illuminate-kpi-learners" />
      <Kpi label="Avg completion" value={`${s.avg_completion_pct}%`} icon={TrendingUp} testid="illuminate-kpi-completion" />
    </section>
  );
}
