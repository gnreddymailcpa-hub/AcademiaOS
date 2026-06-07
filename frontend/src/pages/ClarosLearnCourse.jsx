import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, BookOpen, ClipboardList, FileText, Loader2, ListTodo, BarChart3,
  Clock, Megaphone, ExternalLink, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const TYPE_ICON = {
  LECTURE_NOTES: BookOpen, ASSIGNMENT: ClipboardList, QUIZ: ListTodo,
  VIDEO_LINK: ExternalLink, READING: FileText, ANNOUNCEMENT: Megaphone,
};

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

function dueBadge(item) {
  if (!item.due_date) return null;
  const due = new Date(item.due_date);
  const overdue = due.getTime() < Date.now();
  return (
    <Badge variant={overdue ? "destructive" : "outline"} className="text-[10px]">
      {overdue ? "Overdue · " : "Due · "}{fmtDate(item.due_date)}
    </Badge>
  );
}

function ContentRow({ item, courseId }) {
  const Icon = TYPE_ICON[item.content_type] || FileText;
  return (
    <Link
      to={`/learn/courses/${courseId}/content/${item.id}`}
      data-testid={`learn-content-row-${item.id}`}
      className="flex items-start justify-between gap-3 p-3 border rounded-md hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-1" />
        <div>
          <div className="text-sm font-medium">{item.title}</div>
          <div className="text-xs text-muted-foreground">
            {item.content_type.replace("_", " ")}{item.max_marks ? ` · ${item.max_marks} marks` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">{dueBadge(item)}</div>
    </Link>
  );
}

export default function ClarosLearnCourse() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [content, setContent] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [tab, setTab] = useState("CONTENT");
  const [progress, setProgress] = useState(null);

  const isFaculty = useMemo(
    () => user && ["faculty", "instructor", "hod", "dean", "institution_admin", "super_admin"].includes(user.role),
    [user]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contentR, quizR] = await Promise.all([
        api.get(`/v1/learn/courses/${courseId}/content`).then(r => r.data),
        api.get(`/v1/learn/courses/${courseId}/quizzes`).then(r => r.data),
      ]);
      setContent(contentR || []);
      setQuizzes(quizR || []);

      // Course meta — derived from /courses/me
      const courses = await api.get("/v1/learn/courses/me").then(r => r.data);
      setCourse((courses || []).find(c => c.id === courseId) || null);

      if (user?.role === "student") {
        const [subs, prog] = await Promise.all([
          api.get("/v1/learn/submissions/me").then(r => r.data),
          api.get("/v1/learn/progress/me").then(r => r.data),
        ]);
        setSubmissions(subs || []);
        setProgress((prog || []).find(p => p.course_id === courseId));
      }
    } catch (e) {
      toast.error("Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId, user]);

  useEffect(() => { load(); }, [load]);

  const assignments = content.filter(c => c.content_type === "ASSIGNMENT");
  const nonAssignmentContent = content.filter(c => c.content_type !== "ASSIGNMENT");
  const subByContent = useMemo(
    () => Object.fromEntries(submissions.map(s => [s.content_id, s])),
    [submissions]
  );

  const tabs = [
    { id: "CONTENT", label: "Content", icon: BookOpen, count: nonAssignmentContent.length },
    { id: "ASSIGNMENTS", label: "Assignments", icon: ClipboardList, count: assignments.length },
    { id: "QUIZZES", label: "Quizzes", icon: ListTodo, count: quizzes.length },
    { id: "PROGRESS", label: "Progress", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6" data-testid="learn-course-detail">
      <div className="flex items-center gap-2">
        <Link to="/learn" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="learn-course-back">
          <ArrowLeft className="h-3 w-3" /> Back to my courses
        </Link>
      </div>
      <PageHeader
        eyebrow={course?.code || "Course"}
        title={course?.title || "Course"}
        description={`Faculty: ${course?.faculty || "—"} · ${course?.credits ?? 0} credits${isFaculty ? "" : (progress ? ` · ${progress.completion_pct}% complete` : "")}`}
        actions={isFaculty ? (
          <Link to={`/learn/faculty/${courseId}`}>
            <Button size="sm" variant="outline" data-testid="learn-course-manage-btn">Manage course</Button>
          </Link>
        ) : null}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="learn-course-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`learn-tab-${t.id.toLowerCase()}`}
              className={`px-3 py-2 -mb-px border-b-2 text-sm inline-flex items-center gap-2 ${active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
              {t.count != null && (
                <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "CONTENT" && (
        <div className="space-y-2" data-testid="learn-tab-content-pane">
          {nonAssignmentContent.length === 0
            ? <div className="text-sm text-muted-foreground">No content items yet.</div>
            : nonAssignmentContent.map(c => <ContentRow key={c.id} item={c} courseId={courseId} />)}
        </div>
      )}

      {tab === "ASSIGNMENTS" && (
        <div className="space-y-2" data-testid="learn-tab-assignments-pane">
          {assignments.length === 0
            ? <div className="text-sm text-muted-foreground">No assignments yet.</div>
            : assignments.map(c => {
                const sub = subByContent[c.id];
                return (
                  <Link
                    key={c.id}
                    to={`/learn/courses/${courseId}/content/${c.id}`}
                    data-testid={`learn-assignment-row-${c.id}`}
                    className="flex items-start justify-between gap-3 p-3 border rounded-md hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <ClipboardList className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <div className="text-sm font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.max_marks ?? 10} marks
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dueBadge(c)}
                      {sub
                        ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Submitted{sub.marks_obtained != null ? ` · ${sub.marks_obtained}/${c.max_marks || 10}` : (sub.ai_marks != null ? ` · AI ${sub.ai_marks}/${c.max_marks || 10}` : "")}
                          </Badge>
                        )
                        : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"><AlertTriangle className="h-3 w-3 mr-1" />Not submitted</Badge>}
                    </div>
                  </Link>
                );
              })}
        </div>
      )}

      {tab === "QUIZZES" && (
        <div className="space-y-2" data-testid="learn-tab-quizzes-pane">
          {quizzes.length === 0
            ? <div className="text-sm text-muted-foreground">No quizzes yet.</div>
            : quizzes.map(q => {
                const attempted = !!q.my_attempt;
                return (
                  <Link
                    key={q.id}
                    to={`/learn/courses/${courseId}/content/${q.id}?type=quiz`}
                    data-testid={`learn-quiz-row-${q.id}`}
                    className="flex items-start justify-between gap-3 p-3 border rounded-md hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <ListTodo className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <div className="text-sm font-medium">{q.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {q.question_count} questions · {q.total_marks} marks
                          {q.is_ai_generated && " · AI-generated"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" /> {q.time_limit_minutes}m
                      {attempted
                        ? <Badge className="bg-emerald-600 text-white text-[10px]">Score {q.my_attempt.score}/{q.my_attempt.total_marks}</Badge>
                        : <Badge variant="outline" className="text-[10px]">Open</Badge>}
                    </div>
                  </Link>
                );
              })}
        </div>
      )}

      {tab === "PROGRESS" && (
        <div className="card p-5 border border-border" data-testid="learn-tab-progress-pane">
          {!progress && user?.role === "student" && (
            <div className="text-sm text-muted-foreground">No progress recorded yet.</div>
          )}
          {progress && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-semibold tracking-tight tabular-nums">
                  {progress.completion_pct}%
                </div>
                <div className="text-sm text-muted-foreground">
                  {progress.completed_items} / {progress.total_items} items completed
                </div>
              </div>
              <div className="h-2 w-full bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress.completion_pct))}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">
                Last activity: {fmtDate(progress.last_activity) || "—"}
              </div>
            </div>
          )}
          {!progress && user?.role !== "student" && (
            <div className="text-sm text-muted-foreground">
              Faculty/Admin view — see student-level analytics in the manage course page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
