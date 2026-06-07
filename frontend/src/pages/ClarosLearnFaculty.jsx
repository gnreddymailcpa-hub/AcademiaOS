import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Sparkles, Loader2, FileCheck2, Upload, ListTodo,
  CheckCircle2, AlertTriangle, X,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "../components/ui/dialog";
import { api } from "../lib/api";
import { toast } from "sonner";

const CONTENT_TYPES = [
  "LECTURE_NOTES", "ASSIGNMENT", "QUIZ", "VIDEO_LINK", "READING", "ANNOUNCEMENT",
];

function NewContentDialog({ courseId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", content_type: "LECTURE_NOTES", content_body: "",
    file_url: "", due_date: "", max_marks: "", sequence_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.post("/v1/learn/files/upload", fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setForm(s => ({ ...s, file_url: r.data.file_url }));
      toast.success("File uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      const payload = {
        course_id: courseId,
        title: form.title,
        content_type: form.content_type,
        content_body: form.content_body,
        file_url: form.file_url || null,
        due_date: form.due_date || null,
        max_marks: form.max_marks ? parseInt(form.max_marks) : null,
        sequence_order: parseInt(form.sequence_order || 0),
      };
      await api.post("/v1/learn/content", payload);
      toast.success("Content created");
      setOpen(false);
      setForm({ title: "", content_type: "LECTURE_NOTES", content_body: "",
                file_url: "", due_date: "", max_marks: "", sequence_order: 0 });
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="faculty-add-content-btn">
          <Plus className="h-4 w-4 mr-2" /> New content
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="faculty-new-content-dialog">
        <DialogHeader>
          <DialogTitle>New content item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="label-eyebrow">Type</label>
            <select
              data-testid="content-type-select"
              value={form.content_type}
              onChange={(e) => setForm(s => ({ ...s, content_type: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background">
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Title</label>
            <Input data-testid="content-title-input"
              value={form.title}
              onChange={(e) => setForm(s => ({ ...s, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Body / Description</label>
            <Textarea
              data-testid="content-body-input"
              rows={5}
              value={form.content_body}
              onChange={(e) => setForm(s => ({ ...s, content_body: e.target.value }))} />
          </div>
          {form.content_type === "ASSIGNMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label-eyebrow">Due date</label>
                <Input type="datetime-local" data-testid="content-due-input"
                  value={form.due_date}
                  onChange={(e) => setForm(s => ({ ...s, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="label-eyebrow">Max marks</label>
                <Input type="number" min="1" data-testid="content-max-marks-input"
                  value={form.max_marks}
                  onChange={(e) => setForm(s => ({ ...s, max_marks: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="label-eyebrow">Sequence order</label>
            <Input type="number" min="0" data-testid="content-seq-input"
              value={form.sequence_order}
              onChange={(e) => setForm(s => ({ ...s, sequence_order: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm hover:bg-muted/30" data-testid="content-file-label">
              <Upload className="h-4 w-4" />
              {form.file_url ? "Replace file" : "Attach file"}
              <input type="file" className="hidden" onChange={upload} data-testid="content-file-input" />
            </label>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {form.file_url && <Badge variant="outline" className="text-[10px]"><FileCheck2 className="h-3 w-3 mr-1" /> File attached</Badge>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="content-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateQuizDialog({ courseId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState(5);
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [generating, setGenerating] = useState(false);

  const run = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/v1/learn/quizzes/generate", {
        course_id: courseId, num_questions: Number(num), difficulty,
      });
      toast.success(`Quiz created with ${r.data.questions_created} questions`);
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed");
    } finally { setGenerating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="faculty-generate-quiz-btn">
          <Sparkles className="h-4 w-4 mr-2" /> Generate AI Quiz
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="faculty-quiz-dialog">
        <DialogHeader><DialogTitle>Generate AI Quiz</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="label-eyebrow">Number of questions</label>
            <select
              data-testid="quiz-num-select"
              value={num} onChange={(e) => setNum(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Difficulty</label>
            <select
              data-testid="quiz-difficulty-select"
              value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background">
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            Questions are generated from the LECTURE_NOTES content currently in this course.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={run} disabled={generating} data-testid="quiz-generate-confirm-btn">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsPanel({ contentItem, onChanged }) {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/v1/learn/submissions", { params: { content_id: contentItem.id } });
      setSubs(r.data || []);
    } catch { toast.error("Failed to load submissions"); }
    finally { setLoading(false); }
  }, [contentItem.id]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const aiGrade = async (id) => {
    setGrading(g => ({ ...g, [id]: true }));
    try {
      await api.post(`/v1/learn/submissions/${id}/ai-grade`);
      toast.success("AI graded");
      load();
      onChanged?.();
    } catch { toast.error("AI grade failed"); }
    finally { setGrading(g => ({ ...g, [id]: false })); }
  };

  const manualGrade = async (id, value) => {
    try {
      await api.post(`/v1/learn/submissions/${id}/grade`, { marks_obtained: Number(value) });
      toast.success("Marks saved");
      load();
    } catch { toast.error("Save failed"); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`view-submissions-btn-${contentItem.id}`}>
          View submissions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" data-testid="faculty-submissions-dialog">
        <DialogHeader><DialogTitle>{contentItem.title} — Submissions</DialogTitle></DialogHeader>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && subs.length === 0 && (
          <div className="text-sm text-muted-foreground">No submissions yet.</div>
        )}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {subs.map(s => (
            <div key={s.id} className="border rounded-md p-3 text-sm" data-testid={`submission-row-${s.id}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="font-medium">{s.student_name} · {s.roll_number}</div>
                <div className="flex items-center gap-2">
                  {s.is_late && <Badge variant="destructive" className="text-[10px]">Late</Badge>}
                  <span className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleString()}</span>
                </div>
              </div>
              {s.submission_text && (
                <div className="text-xs whitespace-pre-wrap bg-muted/30 border rounded p-2 mb-2">{s.submission_text}</div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => aiGrade(s.id)}
                        disabled={grading[s.id]} data-testid={`ai-grade-btn-${s.id}`}>
                  {grading[s.id] ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AI Grade
                </Button>
                <Input
                  type="number"
                  className="w-24 h-8 text-xs"
                  placeholder={`/${contentItem.max_marks ?? 10}`}
                  defaultValue={s.marks_obtained ?? ""}
                  onBlur={(e) => e.target.value && manualGrade(s.id, e.target.value)}
                  data-testid={`marks-input-${s.id}`}
                />
                {s.ai_marks != null && (
                  <Badge className="bg-violet-600 text-white text-[10px]">AI {s.ai_marks}/{contentItem.max_marks ?? 10}</Badge>
                )}
                {s.marks_obtained != null && (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Final {s.marks_obtained}/{contentItem.max_marks ?? 10}</Badge>
                )}
              </div>
              {s.feedback && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Feedback:</span> {s.feedback}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosLearnFaculty() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [content, setContent] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contentR, quizR, allCourses] = await Promise.all([
        api.get(`/v1/learn/courses/${courseId}/content`).then(r => r.data),
        api.get(`/v1/learn/courses/${courseId}/quizzes`).then(r => r.data),
        api.get("/v1/learn/courses/me").then(r => r.data),
      ]);
      setContent(contentR || []);
      setQuizzes(quizR || []);
      setCourse((allCourses || []).find(c => c.id === courseId) || null);
    } catch { toast.error("Failed to load course"); }
    finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const assignments = useMemo(() => content.filter(c => c.content_type === "ASSIGNMENT"), [content]);
  const other = useMemo(() => content.filter(c => c.content_type !== "ASSIGNMENT"), [content]);

  const deleteContent = async (id) => {
    if (!window.confirm("Delete this content item?")) return;
    try {
      await api.delete(`/v1/learn/content/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="learn-faculty-page">
      <div className="flex items-center gap-2">
        <Link to="/learn" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="faculty-back-link">
          <ArrowLeft className="h-3 w-3" /> Back to teaching
        </Link>
      </div>

      <PageHeader
        eyebrow={course?.code || "Course"}
        title={course?.title || "Manage course"}
        description={`${course?.enrollment_count ?? 0} students enrolled`}
        actions={
          <div className="flex items-center gap-2">
            <GenerateQuizDialog courseId={courseId} onCreated={load} />
            <NewContentDialog courseId={courseId} onCreated={load} />
          </div>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="faculty-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <section className="space-y-3" data-testid="faculty-content-section">
        <h2 className="text-base font-semibold tracking-tight">Lecture notes & resources</h2>
        {other.length === 0 ? (
          <div className="text-sm text-muted-foreground">No content yet — click "New content".</div>
        ) : (
          <div className="space-y-2">
            {other.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 border rounded-md" data-testid={`faculty-content-row-${c.id}`}>
                <div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.content_type.replace("_", " ")} · seq {c.sequence_order ?? 0}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteContent(c.id)} data-testid={`faculty-delete-${c.id}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" data-testid="faculty-assignments-section">
        <h2 className="text-base font-semibold tracking-tight">Assignments</h2>
        {assignments.length === 0 ? (
          <div className="text-sm text-muted-foreground">No assignments yet.</div>
        ) : (
          <div className="space-y-2">
            {assignments.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 border rounded-md" data-testid={`faculty-assignment-row-${c.id}`}>
                <div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Max {c.max_marks ?? 10} marks · {c.due_date ? `Due ${new Date(c.due_date).toLocaleString()}` : "No due date"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SubmissionsPanel contentItem={c} onChanged={load} />
                  <Button size="sm" variant="ghost" onClick={() => deleteContent(c.id)} data-testid={`faculty-delete-assignment-${c.id}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" data-testid="faculty-quizzes-section">
        <h2 className="text-base font-semibold tracking-tight">Quizzes</h2>
        {quizzes.length === 0 ? (
          <div className="text-sm text-muted-foreground">No quizzes yet — click "Generate AI Quiz".</div>
        ) : (
          <div className="space-y-2">
            {quizzes.map(q => (
              <Link
                key={q.id}
                to={`/learn/courses/${courseId}/content/${q.id}?type=quiz`}
                data-testid={`faculty-quiz-row-${q.id}`}
                className="flex items-center justify-between gap-3 p-3 border rounded-md hover:border-primary/40"
              >
                <div>
                  <div className="text-sm font-medium inline-flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    {q.title}
                    {q.is_ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {q.question_count} questions · {q.total_marks} marks · {q.attempt_count ?? 0} attempts
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">Open</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
