import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { GripVertical, Plus, Trash2, Cog, Bot, Hand, Save } from "lucide-react";

// Tool catalogue exposed to the UI — must mirror backend `_exec_tool` in routes_workflows.py
export const TOOL_OPTIONS = {
  auto: [
    { value: "validate_input", label: "Validate input" },
    { value: "aggregate_data", label: "Aggregate tenant data" },
    { value: "generate_pdf", label: "Generate PDF artefact" },
    { value: "send_notification", label: "Send notification" },
    { value: "enrol_learner", label: "Enrol learner" },
    { value: "escalate_to_faculty", label: "Escalate to faculty" },
    { value: "publish_report", label: "Publish report" },
    { value: "noop", label: "No-op (placeholder)" },
  ],
  llm: [
    { value: "llm_summarise", label: "LLM summary / narrative" },
  ],
  hitl: [
    { value: "noop", label: "Manual approval gate" },
  ],
};

const KIND_ICON = { auto: Cog, llm: Bot, hitl: Hand };
const KIND_LABEL = { auto: "Auto", llm: "LLM", hitl: "Human approval" };

const CATEGORY_OPTIONS = [
  { value: "operations", label: "Operations" },
  { value: "governance", label: "Governance" },
  { value: "learner_success", label: "Learner Success" },
];

const HITL_ROLES = ["Programme Office", "Dean", "Commandant", "Compliance Officer", "Advisor", "Approver"];

function StepItem({ step, idx, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step._uid });
  const Icon = KIND_ICON[step.kind] || Cog;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const tools = TOOL_OPTIONS[step.kind] || TOOL_OPTIONS.auto;
  const handleKindChange = (k) => {
    const defaultTool = TOOL_OPTIONS[k][0]?.value || "noop";
    onChange({
      ...step,
      kind: k,
      tool: defaultTool,
      role: k === "hitl" ? step.role || "Approver" : "Auto",
    });
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border/70 bg-card/40 p-3"
      data-testid={`tpl-step-${idx}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing pt-1"
          data-testid={`tpl-step-handle-${idx}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold mt-0.5">
          {idx + 1}
        </div>
        <div className="grid flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Step name</Label>
            <Input
              value={step.name}
              onChange={(e) => onChange({ ...step, name: e.target.value })}
              placeholder="e.g. Programme office review"
              className="h-8"
              data-testid={`tpl-step-name-${idx}`}
            />
          </div>
          <div className="col-span-6 md:col-span-3">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Kind</Label>
            <Select value={step.kind} onValueChange={handleKindChange}>
              <SelectTrigger className="h-8" data-testid={`tpl-step-kind-${idx}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(KIND_LABEL).map((k) => {
                  const KI = KIND_ICON[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <KI className="h-3.5 w-3.5" /> {KIND_LABEL[k]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6 md:col-span-4">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {step.kind === "hitl" ? "Approver role" : "Tool"}
            </Label>
            {step.kind === "hitl" ? (
              <Select value={step.role} onValueChange={(v) => onChange({ ...step, role: v })}>
                <SelectTrigger className="h-8" data-testid={`tpl-step-role-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HITL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={step.tool} onValueChange={(v) => onChange({ ...step, tool: v })}>
                <SelectTrigger className="h-8" data-testid={`tpl-step-tool-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="col-span-12 flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={!!step.undoable}
                onChange={(e) => onChange({ ...step, undoable: e.target.checked })}
                data-testid={`tpl-step-undoable-${idx}`}
              />
              Undoable (eligible for rollback)
            </label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                <Icon className="me-1 h-3 w-3" /> {KIND_LABEL[step.kind]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                onClick={onRemove}
                data-testid={`tpl-step-remove-${idx}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyStep() {
  return {
    _uid: `s_${Math.random().toString(36).slice(2, 9)}`,
    key: "",
    name: "New step",
    kind: "auto",
    tool: "aggregate_data",
    role: "Auto",
    undoable: false,
  };
}

function fromTemplate(t) {
  return {
    id: t?.id || null,
    key: t?.key || "",
    name: t?.name || "",
    description: t?.description || "",
    category: t?.category || "operations",
    steps: (t?.steps || []).map((s, i) => ({
      _uid: `s_${i}_${Math.random().toString(36).slice(2, 6)}`,
      ...s,
    })),
  };
}

export default function TemplateEditor({ open, onClose, template, onSave }) {
  const [draft, setDraft] = useState(fromTemplate(template));
  useEffect(() => {
    if (open) setDraft(fromTemplate(template));
  }, [open, template]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = draft.steps.findIndex((s) => s._uid === active.id);
    const newIdx = draft.steps.findIndex((s) => s._uid === over.id);
    setDraft({ ...draft, steps: arrayMove(draft.steps, oldIdx, newIdx) });
  };

  const setStep = (idx, next) => {
    const steps = [...draft.steps];
    steps[idx] = next;
    setDraft({ ...draft, steps });
  };
  const removeStep = (idx) => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== idx) });
  const addStep = () => setDraft({ ...draft, steps: [...draft.steps, emptyStep()] });

  const submit = () => {
    if (!draft.name?.trim()) return;
    if (!draft.key?.trim()) {
      draft.key = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32);
    }
    if (!draft.steps.length) return;
    const cleanedSteps = draft.steps.map((s, i) => ({
      key: s.key || `step_${i + 1}`,
      name: s.name || `Step ${i + 1}`,
      kind: s.kind,
      tool: s.tool,
      role: s.kind === "hitl" ? s.role || "Approver" : "Auto",
      undoable: !!s.undoable,
    }));
    onSave({
      id: draft.id,
      key: draft.key,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      steps: cleanedSteps,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" data-testid="template-editor-dialog">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit workflow template" : "New workflow template"}</DialogTitle>
          <DialogDescription>
            Drag steps to reorder. Steps marked “Undoable” are eligible for rollback.
            Human-approval gates pause the run and route to the assigned role.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-7">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Workflow name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. PGP Learner Enrolment"
              data-testid="tpl-name"
            />
          </div>
          <div className="col-span-12 md:col-span-5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft({ ...draft, category: v })}
            >
              <SelectTrigger data-testid="tpl-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Why this workflow exists, who uses it, and what success looks like."
              className="min-h-[60px]"
              data-testid="tpl-description"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Steps · {draft.steps.length}
          </div>
          <Button variant="outline" size="sm" onClick={addStep} data-testid="tpl-add-step">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add step
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70 bg-background/40 p-2" data-testid="tpl-steps-list">
          {draft.steps.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No steps yet. Click <strong>Add step</strong> to get started.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={draft.steps.map((s) => s._uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {draft.steps.map((s, idx) => (
                    <StepItem
                      key={s._uid}
                      step={s}
                      idx={idx}
                      onChange={(next) => setStep(idx, next)}
                      onRemove={() => removeStep(idx)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="tpl-cancel">Cancel</Button>
          <Button onClick={submit} data-testid="tpl-save">
            <Save className="mr-2 h-4 w-4" /> {draft.id ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
