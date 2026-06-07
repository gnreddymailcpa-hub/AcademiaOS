import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Send, Upload, FileCheck2, Sparkles, Clock,
  CheckCircle2, XCircle, BookOpen,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

function MarkdownLite({ text }) {
  // Minimal markdown-ish rendering: headings, bullets, paragraphs
  const lines = (text || "").split(/\r?\n/);
  return (
    <div className="prose prose-sm max-w-none space-y-2">
      {lines.map((ln, i) => {
        if (/^###\s/.test(ln)) return <h3 key={i} className="text-base font-semibold">{ln.replace(/^###\s/, "")}</h3>;
        if (/^##\s/.test(ln)) return <h2 key={i} className="text-lg font-semibold">{ln.replace(/^##\s/, "")}</h2>;
        if (/^#\s/.test(ln)) return <h1 key={i} className="text-xl font-semibold">{ln.replace(/^#\s/, "")}</h1>;
        if (/^\s*[-*]\s/.test(ln)) return <li key={i} className="ml-5 list-disc text-sm">{ln.replace(/^\s*[-*]\s/, "")}</li>;
        if (!ln.trim()) return <br key={i} />;
        // Bold support **x**
        const parts = ln.split(/(\*\*[^*]+\*\*)/g).map((p, idx) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={idx}>{p.slice(2, -2)}</strong>
            : <span key={idx}>{p}</span>
        );
        return <p key={i} className="text-sm leading-relaxed">{parts}</p>;
      })}
    </div>
  );
}

// -------- Assignment view ---------
function AssignmentView({ content, courseId, navigate, reload }) {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const [text, setText] = useState("");
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mySub, setMySub] = useState(null);

  useEffect(() => {
    if (!isStudent) return;
    api.get("/v1/learn/submissions/me")
      .then(r => setMySub((r.data || []).find(s => s.content_id === content.id)))
      .catch(() => {});
  }, [content.id, isStudent]);

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.post("/v1/learn/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFileUrl(r.data.file_url);
      toast.success("File uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && !fileUrl) {
      toast.error("Add text or upload a file");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/v1/learn/submissions", {
        content_id: content.id,
        submission_text: text,
        file_url: fileUrl,
      });
      toast.success("Submission saved");
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="learn-assignment-view">
      <div className="card p-5 border border-border">
        <div className="label-eyebrow">Assignment brief</div>
        <h2 className="text-lg font-semibold mb-3">{content.title}</h2>
        <MarkdownLite text={content.content_body} />
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {content.due_date && <Badge variant="outline">Due {new Date(content.due_date).toLocaleString()}</Badge>}
          <Badge variant="outline">Max {content.max_marks ?? 10} marks</Badge>
        </div>
      </div>

      {isStudent && (
        mySub ? (
          <div className="card p-5 border border-emerald-300 bg-emerald-50/40" data-testid="assignment-already-submitted">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <div className="text-sm font-medium">You have already submitted this assignment.</div>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Submitted: {new Date(mySub.submitted_at).toLocaleString()}{mySub.is_late ? " (late)" : ""}
            </div>
            {mySub.submission_text && (
              <div className="text-sm whitespace-pre-wrap bg-white border rounded p-3">{mySub.submission_text}</div>
            )}
            {(mySub.marks_obtained != null || mySub.ai_marks != null) && (
              <div className="mt-3 text-sm">
                Score: <span className="font-semibold">
                  {mySub.marks_obtained ?? mySub.ai_marks} / {content.max_marks ?? 10}
                </span>
                {mySub.ai_marks != null && mySub.marks_obtained == null && (
                  <Badge className="ml-2 text-[10px] bg-violet-600 text-white">AI graded</Badge>
                )}
              </div>
            )}
            {mySub.feedback && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Feedback:</span> {mySub.feedback}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-5 border border-border space-y-3" data-testid="assignment-submit-form">
            <div className="label-eyebrow">Your submission</div>
            <Textarea
              data-testid="assignment-text-input"
              rows={8}
              placeholder="Type your response here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm hover:bg-muted/30" data-testid="assignment-file-label">
                <Upload className="h-4 w-4" />
                {fileUrl ? "Replace file" : "Attach file"}
                <input type="file" className="hidden" onChange={handleUpload} data-testid="assignment-file-input" />
              </label>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {fileUrl && <Badge variant="outline" className="text-[10px]"><FileCheck2 className="h-3 w-3 mr-1" /> File attached</Badge>}
              <div className="ml-auto" />
              <Button onClick={handleSubmit} disabled={submitting} data-testid="assignment-submit-btn">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// -------- Quiz view ---------
function QuizView({ quizId, courseId, navigate }) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  useEffect(() => {
    setLoading(true);
    api.get(`/v1/learn/quizzes/${quizId}`).then(r => {
      setQuiz(r.data.quiz);
      setQuestions(r.data.questions || []);
      if (r.data.quiz?.time_limit_minutes) {
        setTimeLeft(r.data.quiz.time_limit_minutes * 60);
      }
    }).catch(() => toast.error("Failed to load quiz")).finally(() => setLoading(false));
  }, [quizId]);

  // Timer
  useEffect(() => {
    if (!timeLeft || result || !isStudent) return;
    const t = setInterval(() => setTimeLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [timeLeft, result, isStudent]);

  const submit = useCallback(async () => {
    if (!isStudent) return;
    setSubmitting(true);
    try {
      const r = await api.post(`/v1/learn/quizzes/${quizId}/attempt`, { answers });
      setResult(r.data);
      // Fetch full results with correct answers
      const full = await api.get(`/v1/learn/quizzes/${quizId}/results/${r.data.attempt_id}`);
      setQuestions(full.data.questions || questions);
      toast.success(`Score ${r.data.score}/${r.data.total_marks}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [answers, isStudent, questions, quizId]);

  // Auto-submit on timeout
  useEffect(() => {
    if (timeLeft === 0 && !result && isStudent) {
      submit();
    }
  }, [timeLeft, result, isStudent, submit]);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="quiz-loading">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading quiz…
    </div>;
  }
  if (!quiz) return <div className="text-sm text-muted-foreground">Quiz not found.</div>;

  if (result) {
    const correctMap = Object.fromEntries(questions.map(q => [q.id, q.correct_option]));
    return (
      <div className="space-y-4" data-testid="quiz-results">
        <div className="card p-5 border border-emerald-300 bg-emerald-50/40">
          <div className="label-eyebrow">Quiz complete</div>
          <div className="text-3xl font-semibold tracking-tight">
            {result.score} / {result.total_marks}
          </div>
        </div>
        {questions.map((q, i) => {
          const picked = answers[q.id];
          const correct = correctMap[q.id];
          const isRight = picked === correct;
          return (
            <div key={q.id} className="card p-4 border border-border" data-testid={`quiz-result-q-${q.id}`}>
              <div className="text-sm font-medium mb-2">
                {i + 1}. {q.question_text}
              </div>
              {["a","b","c","d"].map(o => (
                <div key={o} className={`text-sm py-1 px-2 rounded ${o === correct ? "bg-emerald-50 text-emerald-800" : o === picked ? "bg-red-50 text-red-700" : ""}`}>
                  <span className="font-mono mr-2">{o.toUpperCase()}.</span>
                  {q[`option_${o}`]}
                  {o === correct && <CheckCircle2 className="h-3 w-3 inline ml-2 text-emerald-600" />}
                  {o === picked && o !== correct && <XCircle className="h-3 w-3 inline ml-2 text-red-600" />}
                </div>
              ))}
              {q.explanation && (
                <div className="mt-2 text-xs text-muted-foreground italic">Explanation: {q.explanation}</div>
              )}
              <div className="mt-1 text-xs">
                {isRight ? <span className="text-emerald-700 font-medium">Correct</span> : <span className="text-red-700 font-medium">Incorrect</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!isStudent) {
    // Faculty view — just show questions w/ correct answers
    return (
      <div className="space-y-4" data-testid="quiz-faculty-view">
        <div className="card p-5 border border-border">
          <h2 className="text-lg font-semibold">{quiz.title}</h2>
          <div className="text-xs text-muted-foreground">{questions.length} questions · {quiz.total_marks} marks</div>
        </div>
        {questions.map((q, i) => (
          <div key={q.id} className="card p-4 border border-border">
            <div className="text-sm font-medium mb-2">{i + 1}. {q.question_text}</div>
            {["a","b","c","d"].map(o => (
              <div key={o} className={`text-sm py-1 px-2 rounded ${o === q.correct_option ? "bg-emerald-50 text-emerald-800" : ""}`}>
                <span className="font-mono mr-2">{o.toUpperCase()}.</span> {q[`option_${o}`]}
                {o === q.correct_option && <CheckCircle2 className="h-3 w-3 inline ml-2 text-emerald-600" />}
              </div>
            ))}
            {q.explanation && <div className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</div>}
          </div>
        ))}
      </div>
    );
  }

  const q = questions[idx];
  const allAnswered = questions.every(qq => answers[qq.id]);

  return (
    <div className="space-y-4" data-testid="quiz-attempt-view">
      <div className="card p-4 border border-border flex items-center justify-between">
        <div>
          <div className="text-xs label-eyebrow">{quiz.title}</div>
          <div className="text-sm text-muted-foreground">
            Question {idx + 1} of {questions.length}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm tabular-nums" data-testid="quiz-timer">
          <Clock className="h-4 w-4" />
          {timeLeft != null
            ? `${String(Math.floor(timeLeft/60)).padStart(2,"0")}:${String(timeLeft%60).padStart(2,"0")}`
            : "—"}
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${((idx+1)/questions.length)*100}%` }} />
      </div>
      {q && (
        <div className="card p-5 border border-border" data-testid={`quiz-question-${q.id}`}>
          <div className="text-base font-medium mb-3">{q.question_text}</div>
          <div className="space-y-2">
            {["a","b","c","d"].map(o => {
              const picked = answers[q.id] === o;
              return (
                <label key={o}
                  data-testid={`quiz-option-${q.id}-${o}`}
                  className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${picked ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
                  <input type="radio" name={q.id} checked={picked} onChange={() => setAnswers({...answers, [q.id]: o})} />
                  <div className="text-sm"><span className="font-mono mr-2">{o.toUpperCase()}.</span>{q[`option_${o}`]}</div>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} data-testid="quiz-prev-btn">
          Previous
        </Button>
        {idx < questions.length - 1 ? (
          <Button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))} disabled={!answers[q?.id]} data-testid="quiz-next-btn">
            Next
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting || !allAnswered} data-testid="quiz-submit-btn">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Submit all
          </Button>
        )}
      </div>
    </div>
  );
}

// -------- Main ---------
export default function ClarosLearnContent() {
  const { courseId, contentId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isQuiz = params.get("type") === "quiz";

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (isQuiz) { setLoading(false); return; }
    setLoading(true);
    try {
      const items = await api.get(`/v1/learn/courses/${courseId}/content`).then(r => r.data);
      setContent((items || []).find(c => c.id === contentId) || null);
    } catch {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [courseId, contentId, isQuiz]);

  useEffect(() => { load(); }, [load, tick]);

  return (
    <div className="space-y-6" data-testid="learn-content-page">
      <div className="flex items-center gap-2">
        <Link to={`/learn/courses/${courseId}`}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              data-testid="learn-content-back">
          <ArrowLeft className="h-3 w-3" /> Back to course
        </Link>
      </div>

      {loading && !isQuiz && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="learn-content-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {isQuiz && <QuizView quizId={contentId} courseId={courseId} navigate={navigate} />}

      {!isQuiz && content && content.content_type === "ASSIGNMENT" && (
        <AssignmentView content={content} courseId={courseId} navigate={navigate} reload={() => setTick(t => t + 1)} />
      )}

      {!isQuiz && content && content.content_type === "LECTURE_NOTES" && (
        <div className="space-y-4">
          <PageHeader eyebrow="Lecture notes" title={content.title} />
          <div className="card p-6 border border-border">
            <MarkdownLite text={content.content_body} />
          </div>
        </div>
      )}

      {!isQuiz && content && !["ASSIGNMENT", "LECTURE_NOTES"].includes(content.content_type) && (
        <div className="space-y-4">
          <PageHeader eyebrow={content.content_type} title={content.title} />
          <div className="card p-6 border border-border space-y-3">
            <MarkdownLite text={content.content_body} />
            {content.file_url && (
              <a href={content.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline inline-flex items-center gap-1">
                <BookOpen className="h-4 w-4" /> Open resource
              </a>
            )}
          </div>
        </div>
      )}

      {!isQuiz && !loading && !content && (
        <div className="card p-8 border border-dashed border-border text-center text-sm text-muted-foreground">
          Content not found.
        </div>
      )}
    </div>
  );
}
