import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  School,
  GraduationCap,
  BookOpen,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  CalendarRange,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";

function Node({ icon: Icon, title, meta, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => hasChildren && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 py-2.5 px-3 hover:bg-muted/40 transition rounded text-start"
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          {meta && <div className="text-[11px] text-muted-foreground truncate">{meta}</div>}
        </div>
        {badge && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {badge}
          </Badge>
        )}
      </button>
      {open && hasChildren && (
        <div className="tree-connector ms-5 my-1 mb-2">{children}</div>
      )}
    </div>
  );
}

export default function AcademicStructure() {
  const { current } = useInstitution();
  const [campuses, setCampuses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "", duration: "12 months", enrolled: 0 });

  const load = async () => {
    if (!current) return;
    const [a, b, c, d, e] = await Promise.all([
      api.get(`/academic/${current.id}/campuses`),
      api.get(`/academic/${current.id}/departments`),
      api.get(`/academic/${current.id}/programmes`),
      api.get(`/academic/${current.id}/courses`),
      api.get(`/academic/${current.id}/cohorts`),
    ]);
    setCampuses(a.data);
    setDepartments(b.data);
    setProgrammes(c.data);
    setCourses(d.data);
    setCohorts(e.data);
  };

  useEffect(() => {
    load();
  }, [current?.id]);

  const coursesByProg = useMemo(() => {
    const m = {};
    courses.forEach((c) => {
      m[c.programme_id] = m[c.programme_id] || [];
      m[c.programme_id].push(c);
    });
    return m;
  }, [courses]);

  const cohortsByProg = useMemo(() => {
    const m = {};
    cohorts.forEach((c) => {
      m[c.programme_id] = m[c.programme_id] || [];
      m[c.programme_id].push(c);
    });
    return m;
  }, [cohorts]);

  const addProgramme = async () => {
    try {
      await api.post(`/academic/${current.id}/programmes`, {
        ...draft,
        institution_id: current.id,
        completion_rate: 0,
      });
      toast.success("Programme added", { description: "Audit log updated" });
      setOpen(false);
      setDraft({ name: "", code: "", duration: "12 months", enrolled: 0 });
      load();
    } catch (e) {
      toast.error("Could not add programme");
    }
  };

  if (!current) return null;

  return (
    <div data-testid="academic-structure-page">
      <PageHeader
        eyebrow="Academic Structure Builder"
        title="Campuses → Programmes → Courses → Cohorts"
        description="Configure the full academic hierarchy for this tenant. Every node is RBAC-scoped and audit-logged."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-programme-trigger">
                <Plus className="h-4 w-4 me-1" />
                New programme
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add programme</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Programme name</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="new-programme-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Code</Label>
                    <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} data-testid="new-programme-code" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Duration</Label>
                    <Input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Initial enrolment</Label>
                  <Input
                    type="number"
                    value={draft.enrolled}
                    onChange={(e) => setDraft({ ...draft, enrolled: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addProgramme} data-testid="new-programme-save">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        {/* Tree */}
        <section className="col-span-12 lg:col-span-8 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="label-eyebrow">Hierarchy</div>
              <div className="text-sm font-semibold mt-0.5">{current.name}</div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {campuses.length} campuses · {departments.length} departments · {programmes.length} programmes · {courses.length} courses
            </div>
          </div>
          <div className="px-2 py-2" data-testid="academic-tree">
            <Node
              icon={Building2}
              title={current.name}
              meta={`${current.type} · ${current.country}`}
              badge={`${campuses.length} campus${campuses.length === 1 ? "" : "es"}`}
              defaultOpen
            >
              {campuses.map((c) => (
                <Node key={c.id} icon={School} title={c.name} meta={`${c.city}, ${c.country}`} defaultOpen>
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <Node
                        key={d.id}
                        icon={Users}
                        title={d.name}
                        meta={d.head ? `Head · ${d.head}` : "—"}
                        badge={`${programmes.filter((p) => p.department_id === d.id).length} prog`}
                        defaultOpen
                      >
                        {programmes
                          .filter((p) => p.department_id === d.id)
                          .map((p) => (
                            <ProgrammeNode
                              key={p.id}
                              p={p}
                              courses={coursesByProg[p.id] || []}
                              cohorts={cohortsByProg[p.id] || []}
                            />
                          ))}
                      </Node>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No departments yet</div>
                  )}
                </Node>
              ))}
            </Node>
          </div>
        </section>

        {/* Sidebar: stats */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          {[
            { label: "Campuses", value: campuses.length },
            { label: "Departments", value: departments.length },
            { label: "Programmes", value: programmes.length },
            { label: "Courses", value: courses.length },
            { label: "Cohorts", value: cohorts.length },
          ].map((s) => (
            <div key={s.label} className="kpi-card flex items-center justify-between">
              <span className="label-eyebrow">{s.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function ProgrammeNode({ p, courses, cohorts }) {
  return (
    <Node
      icon={GraduationCap}
      title={`${p.name}`}
      meta={`${p.code} · ${p.duration} · ${p.enrolled} enrolled · ${p.completion_rate}% completion`}
      badge={`${courses.length} courses`}
    >
      {courses.map((c) => (
        <Node
          key={c.id}
          icon={BookOpen}
          title={c.title}
          meta={`${c.code} · ${c.credits} credits · ${c.faculty || "Faculty TBA"}`}
          badge={`${c.modules} modules`}
        />
      ))}
      {cohorts.length > 0 && (
        <Node
          icon={CalendarRange}
          title="Cohorts"
          meta={cohorts.map((c) => c.name).join(" · ")}
        >
          {cohorts.map((c) => (
            <Node
              key={c.id}
              icon={CalendarRange}
              title={c.name}
              meta={`${c.start_date} → ${c.end_date} · size ${c.size}`}
            />
          ))}
        </Node>
      )}
    </Node>
  );
}
