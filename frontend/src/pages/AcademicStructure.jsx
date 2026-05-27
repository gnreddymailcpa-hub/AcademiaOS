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
  Pencil,
  Trash2,
  MoreHorizontal,
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
  DialogDescription,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Tree node renderer with hover actions
// ---------------------------------------------------------------------------
function Node({
  icon: Icon,
  title,
  meta,
  badge,
  children,
  defaultOpen = false,
  actions,
  testId,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  return (
    <div className="border-b border-border last:border-b-0" data-testid={testId}>
      <div className="group flex items-center gap-2 hover:bg-muted/40 rounded">
        <button
          onClick={() => hasChildren && setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 py-2.5 px-3 text-start min-w-0"
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
        {actions && (
          <div className="opacity-0 group-hover:opacity-100 transition pr-2">
            {actions}
          </div>
        )}
      </div>
      {open && hasChildren && (
        <div className="tree-connector ms-5 my-1 mb-2">{children}</div>
      )}
    </div>
  );
}

// Per-row action menu
function RowActions({ onEdit, onDelete, testIdPrefix }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          data-testid={`${testIdPrefix}-actions`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={onEdit} data-testid={`${testIdPrefix}-edit`}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-rose-600 focus:text-rose-700"
          data-testid={`${testIdPrefix}-delete`}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Generic add/edit dialog
// ---------------------------------------------------------------------------
const FIELD_SPECS = {
  campus: [
    { key: "name", label: "Name", required: true },
    { key: "city", label: "City", required: true },
    { key: "country", label: "Country", required: true },
  ],
  department: [
    { key: "name", label: "Name", required: true },
    { key: "head", label: "Head (optional)" },
  ],
  programme: [
    { key: "name", label: "Programme name", required: true },
    { key: "code", label: "Code", required: true },
    { key: "duration", label: "Duration" },
    { key: "enrolled", label: "Enrolled", type: "number" },
    { key: "completion_rate", label: "Completion %", type: "number" },
    { key: "department_id", label: "Department", type: "select", options: "departments" },
  ],
  course: [
    { key: "title", label: "Course title", required: true },
    { key: "code", label: "Code", required: true },
    { key: "credits", label: "Credits", type: "number" },
    { key: "faculty", label: "Faculty (optional)" },
    { key: "modules", label: "Modules", type: "number" },
    { key: "programme_id", label: "Programme", type: "select", options: "programmes", required: true },
  ],
  cohort: [
    { key: "name", label: "Cohort name", required: true },
    { key: "start_date", label: "Start date (YYYY-MM-DD)", required: true },
    { key: "end_date", label: "End date (YYYY-MM-DD)", required: true },
    { key: "size", label: "Size", type: "number" },
    { key: "programme_id", label: "Programme", type: "select", options: "programmes", required: true },
  ],
};

function EntityDialog({ open, onClose, entity, mode, draft, setDraft, onSubmit, opts }) {
  if (!entity) return null;
  const fields = FIELD_SPECS[entity];
  const optionLookup = (key) => (opts[key] || []);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid={`entity-dialog-${entity}`}>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit" : "Add"} {entity}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Audit log captures the change. Tenant-scoped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">
                {f.label} {f.required && <span className="text-rose-500">*</span>}
              </Label>
              {f.type === "select" ? (
                <Select
                  value={draft[f.key] || ""}
                  onValueChange={(v) => setDraft({ ...draft, [f.key]: v })}
                >
                  <SelectTrigger data-testid={`field-${f.key}`}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionLookup(f.options).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name || o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={draft[f.key] ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                    })
                  }
                  data-testid={`field-${f.key}`}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid={`entity-cancel-${entity}`}>
            Cancel
          </Button>
          <Button onClick={onSubmit} data-testid={`entity-submit-${entity}`}>
            {mode === "edit" ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AcademicStructure() {
  const { current } = useInstitution();
  const [campuses, setCampuses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [cohorts, setCohorts] = useState([]);

  const [dialog, setDialog] = useState(null); // { entity, mode, item? }
  const [draft, setDraft] = useState({});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ----- CRUD wiring -----
  const ENTITY_PATH = {
    campus: "campuses",
    department: "departments",
    programme: "programmes",
    course: "courses",
    cohort: "cohorts",
  };

  const openAdd = (entity) => {
    setDraft({});
    setDialog({ entity, mode: "add" });
  };
  const openEdit = (entity, item) => {
    setDraft({ ...item });
    setDialog({ entity, mode: "edit", item });
  };

  const submit = async () => {
    const { entity, mode, item } = dialog;
    const path = ENTITY_PATH[entity];
    try {
      if (mode === "add") {
        await api.post(`/academic/${current.id}/${path}`, {
          ...draft,
          institution_id: current.id,
        });
        toast.success(`${entity} added`, { description: "Audit log updated" });
      } else {
        await api.patch(`/academic/${current.id}/${path}/${item.id}`, draft);
        toast.success(`${entity} updated`);
      }
      setDialog(null);
      setDraft({});
      load();
    } catch (e) {
      toast.error(`Could not ${mode} ${entity}`, {
        description: e?.response?.data?.detail || e.message,
      });
    }
  };

  const remove = async (entity, item) => {
    const path = ENTITY_PATH[entity];
    if (!window.confirm(`Delete ${entity}: ${item.name || item.title}?`)) return;
    try {
      await api.delete(`/academic/${current.id}/${path}/${item.id}`);
      toast.success(`${entity} deleted`);
      load();
    } catch (e) {
      toast.error(`Could not delete ${entity}`);
    }
  };

  if (!current) return null;

  const opts = { departments, programmes };

  return (
    <div data-testid="academic-structure-page">
      <PageHeader
        eyebrow="Academic Structure Builder"
        title="Campuses → Departments → Programmes → Courses → Cohorts"
        description="Configure the full academic hierarchy for this tenant. Every node is RBAC-scoped and audit-logged."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="add-node-trigger">
                <Plus className="h-4 w-4 me-1" /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openAdd("campus")} data-testid="add-campus">
                <School className="mr-2 h-4 w-4" /> Campus
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("department")} data-testid="add-department">
                <Users className="mr-2 h-4 w-4" /> Department
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("programme")} data-testid="add-programme">
                <GraduationCap className="mr-2 h-4 w-4" /> Programme
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("course")} data-testid="add-course">
                <BookOpen className="mr-2 h-4 w-4" /> Course
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("cohort")} data-testid="add-cohort">
                <CalendarRange className="mr-2 h-4 w-4" /> Cohort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              {campuses.length} campuses · {departments.length} departments ·{" "}
              {programmes.length} programmes · {courses.length} courses ·{" "}
              {cohorts.length} cohorts
            </div>
          </div>
          <div className="px-2 py-2" data-testid="academic-tree">
            <Node
              icon={Building2}
              title={current.name}
              meta={`${current.type} · ${current.country}`}
              badge={`${campuses.length} campus${campuses.length === 1 ? "" : "es"}`}
              defaultOpen
              testId="node-root"
            >
              {campuses.map((c) => (
                <Node
                  key={c.id}
                  icon={School}
                  title={c.name}
                  meta={`${c.city}, ${c.country}`}
                  defaultOpen
                  testId={`node-campus-${c.id}`}
                  actions={
                    <RowActions
                      testIdPrefix={`campus-${c.id}`}
                      onEdit={() => openEdit("campus", c)}
                      onDelete={() => remove("campus", c)}
                    />
                  }
                >
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <Node
                        key={d.id}
                        icon={Users}
                        title={d.name}
                        meta={d.head ? `Head · ${d.head}` : "—"}
                        badge={`${programmes.filter((p) => p.department_id === d.id).length} prog`}
                        defaultOpen
                        testId={`node-department-${d.id}`}
                        actions={
                          <RowActions
                            testIdPrefix={`department-${d.id}`}
                            onEdit={() => openEdit("department", d)}
                            onDelete={() => remove("department", d)}
                          />
                        }
                      >
                        {programmes
                          .filter((p) => p.department_id === d.id)
                          .map((p) => (
                            <ProgrammeNode
                              key={p.id}
                              p={p}
                              courses={coursesByProg[p.id] || []}
                              cohorts={cohortsByProg[p.id] || []}
                              onEdit={openEdit}
                              onDelete={remove}
                            />
                          ))}
                      </Node>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No departments yet
                    </div>
                  )}
                </Node>
              ))}
              {/* Orphan programmes (no department) */}
              {programmes
                .filter((p) => !p.department_id)
                .map((p) => (
                  <ProgrammeNode
                    key={p.id}
                    p={p}
                    courses={coursesByProg[p.id] || []}
                    cohorts={cohortsByProg[p.id] || []}
                    onEdit={openEdit}
                    onDelete={remove}
                  />
                ))}
            </Node>
          </div>
        </section>

        {/* Stats sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          {[
            { label: "Campuses", value: campuses.length },
            { label: "Departments", value: departments.length },
            { label: "Programmes", value: programmes.length },
            { label: "Courses", value: courses.length },
            { label: "Cohorts", value: cohorts.length },
          ].map((s) => (
            <div key={s.label} className="kpi-card flex items-center justify-between" data-testid={`stat-${s.label.toLowerCase()}`}>
              <span className="label-eyebrow">{s.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
            </div>
          ))}
        </aside>
      </div>

      <EntityDialog
        open={!!dialog}
        onClose={() => {
          setDialog(null);
          setDraft({});
        }}
        entity={dialog?.entity}
        mode={dialog?.mode}
        draft={draft}
        setDraft={setDraft}
        onSubmit={submit}
        opts={opts}
      />
    </div>
  );
}

function ProgrammeNode({ p, courses, cohorts, onEdit, onDelete }) {
  return (
    <Node
      icon={GraduationCap}
      title={p.name}
      meta={`${p.code} · ${p.duration} · ${p.enrolled} enrolled · ${p.completion_rate}% completion`}
      badge={`${courses.length} courses`}
      testId={`node-programme-${p.id}`}
      actions={
        <RowActions
          testIdPrefix={`programme-${p.id}`}
          onEdit={() => onEdit("programme", p)}
          onDelete={() => onDelete("programme", p)}
        />
      }
    >
      {courses.map((c) => (
        <Node
          key={c.id}
          icon={BookOpen}
          title={c.title}
          meta={`${c.code} · ${c.credits} credits · ${c.faculty || "Faculty TBA"}`}
          badge={`${c.modules} modules`}
          testId={`node-course-${c.id}`}
          actions={
            <RowActions
              testIdPrefix={`course-${c.id}`}
              onEdit={() => onEdit("course", c)}
              onDelete={() => onDelete("course", c)}
            />
          }
        />
      ))}
      {cohorts.length > 0 && (
        <Node
          icon={CalendarRange}
          title="Cohorts"
          meta={cohorts.map((c) => c.name).join(" · ")}
          testId={`node-cohort-group-${p.id}`}
        >
          {cohorts.map((c) => (
            <Node
              key={c.id}
              icon={CalendarRange}
              title={c.name}
              meta={`${c.start_date} → ${c.end_date} · size ${c.size}`}
              testId={`node-cohort-${c.id}`}
              actions={
                <RowActions
                  testIdPrefix={`cohort-${c.id}`}
                  onEdit={() => onEdit("cohort", c)}
                  onDelete={() => onDelete("cohort", c)}
                />
              }
            />
          ))}
        </Node>
      )}
    </Node>
  );
}
