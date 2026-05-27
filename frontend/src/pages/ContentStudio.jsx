import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Sparkles,
  Check,
  X,
  Clock,
  ScrollText,
  LayoutList,
  Lightbulb,
  Loader2,
  Plus,
} from "lucide-react";

const KIND_META = {
  lesson_plan: { label: "Lesson plan", icon: LayoutList },
  flashcards: { label: "Flashcards", icon: ScrollText },
  mcqs: { label: "MCQs", icon: Lightbulb },
  case_guide: { label: "Case guide", icon: FileText },
};

export default function ContentStudio() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [sources, setSources] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  // Upload form state
  const [up, setUp] = useState({ title: "", course_id: "", kind: "lecture_notes", text: "" });
  const fileRef = useRef(null);

  // Generate form state
  const [gen, setGen] = useState({
    kind: "lesson_plan",
    difficulty: "intermediate",
    bloom: "Apply",
    language: "en",
    count: 5,
  });

  const load = async () => {
    if (!current) return;
    const [s, o, c] = await Promise.all([
      api.get(`/ai/content/sources/${current.id}`),
      api.get(`/ai/content/outputs/${current.id}`),
      api.get(`/academic/${current.id}/courses`),
    ]);
    setSources(s.data);
    setOutputs(o.data);
    setCourses(c.data);
  };

  useEffect(() => {
    load();
  }, [current?.id]);

  const submitUpload = async () => {
    if (!up.title) return toast.error("Title required");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("institution_id", current.id);
      fd.append("title", up.title);
      fd.append("course_id", up.course_id);
      fd.append("kind", up.kind);
      fd.append("text", up.text);
      const file = fileRef.current?.files?.[0];
      if (file) fd.append("file", file);
      await api.post(`/ai/content/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Source uploaded", { description: "Approve to make it citable in AI Instructor" });
      setUploadOpen(false);
      setUp({ title: "", course_id: "", kind: "lecture_notes", text: "" });
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const approveSource = async (id) => {
    await api.post(`/ai/content/${id}/approve`);
    toast.success("Source approved · indexed for RAG");
    load();
  };

  const generate = async () => {
    if (!genOpen) return;
    setBusy(true);
    try {
      const r = await api.post(`/ai/content/generate`, {
        institution_id: current.id,
        source_id: genOpen.id,
        ...gen,
      });
      toast.success("Generated", { description: `${KIND_META[r.data.kind]?.label} pending faculty review` });
      setGenOpen(null);
      load();
      setSelected(r.data);
    } catch (e) {
      toast.error("Generation failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  const approveOutput = async (id) => {
    await api.post(`/ai/content/outputs/${id}/approve`);
    toast.success("Approved · published to course");
    load();
  };
  const rejectOutput = async (id) => {
    await api.post(`/ai/content/outputs/${id}/reject`);
    toast("Rejected");
    load();
  };

  if (!current) return null;
  const pending = outputs.filter((o) => o.status === "pending_review");
  const approved = outputs.filter((o) => o.status === "approved");

  return (
    <div data-testid="content-studio-page">
      <PageHeader
        eyebrow="Module 4.4 · AI Content Generation Engine"
        title="Content Studio"
        description="Upload source material → generate Bloom's-aligned content → SME approval → publish to courses."
        actions={
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="upload-source-trigger">
                <Upload className="h-4 w-4 me-1.5" />
                Upload source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload source material</DialogTitle>
                <DialogDescription className="text-xs">
                  Source becomes citable in AI Instructor after approval and chunking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={up.title}
                    onChange={(e) => setUp({ ...up, title: e.target.value })}
                    data-testid="upload-title"
                    placeholder="e.g. Lecture 1 — Foundations of AI"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Course (optional)</Label>
                    <Select value={up.course_id || "none"} onValueChange={(v) => setUp({ ...up, course_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kind</Label>
                    <Select value={up.kind} onValueChange={(v) => setUp({ ...up, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lecture_notes">Lecture notes</SelectItem>
                        <SelectItem value="case_guide">Case guide</SelectItem>
                        <SelectItem value="handbook">Handbook</SelectItem>
                        <SelectItem value="transcript">Transcript</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paste text or attach file</Label>
                  <Textarea
                    rows={5}
                    value={up.text}
                    onChange={(e) => setUp({ ...up, text: e.target.value })}
                    placeholder="Paste plain text content here, or attach a file below."
                    data-testid="upload-text"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    className="block text-xs text-muted-foreground file:me-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-foreground"
                    data-testid="upload-file"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                <Button onClick={submitUpload} disabled={busy} data-testid="upload-submit">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="sources">
          <TabsList>
            <TabsTrigger value="sources" data-testid="tab-sources">
              <FileText className="h-3.5 w-3.5 me-1.5" />
              Sources ({sources.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              <Clock className="h-3.5 w-3.5 me-1.5" />
              Pending review ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published">
              <Check className="h-3.5 w-3.5 me-1.5" />
              Published ({approved.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sources.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4" data-testid={`source-${s.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-sm font-medium truncate">{s.title}</div>
                    </div>
                    <Badge variant={s.approved ? "secondary" : "outline"} className="text-[10px]">
                      {s.approved ? "Indexed" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {s.kind.replace("_", " ")} · {s.uploaded_by || "—"}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {s.text?.slice(0, 200) || "No text extracted"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {!s.approved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveSource(s.id)}
                        data-testid={`approve-source-${s.id}`}
                      >
                        <Check className="h-3.5 w-3.5 me-1" /> Approve & index
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setGenOpen(s);
                        setGen({ kind: "lesson_plan", difficulty: "intermediate", bloom: "Apply", language: "en", count: 5 });
                      }}
                      data-testid={`generate-from-${s.id}`}
                    >
                      <Sparkles className="h-3.5 w-3.5 me-1" /> Generate
                    </Button>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                  No sources yet. Upload PDF / DOCX / transcript or paste text.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <OutputList items={pending} onApprove={approveOutput} onReject={rejectOutput} onOpen={setSelected} />
          </TabsContent>
          <TabsContent value="published" className="mt-6">
            <OutputList items={approved} readOnly onOpen={setSelected} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate dialog */}
      <Dialog open={!!genOpen} onOpenChange={(o) => !o && setGenOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Sparkles className="h-4 w-4 inline me-1.5 text-primary" />
              Generate from "{genOpen?.title}"
            </DialogTitle>
            <DialogDescription className="text-xs">
              The output will land in the Pending review queue for SME approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Content kind</Label>
                <Select value={gen.kind} onValueChange={(v) => setGen({ ...gen, kind: v })}>
                  <SelectTrigger data-testid="gen-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lesson_plan">Lesson plan</SelectItem>
                    <SelectItem value="flashcards">Flashcards</SelectItem>
                    <SelectItem value="mcqs">MCQs</SelectItem>
                    <SelectItem value="case_guide">Case guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Language</Label>
                <Select value={gen.language} onValueChange={(v) => setGen({ ...gen, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select value={gen.difficulty} onValueChange={(v) => setGen({ ...gen, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="introductory">Introductory</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bloom's level</Label>
                <Select value={gen.bloom} onValueChange={(v) => setGen({ ...gen, bloom: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"].map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(gen.kind === "flashcards" || gen.kind === "mcqs") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Item count</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={gen.count}
                  onChange={(e) => setGen({ ...gen, count: parseInt(e.target.value) || 5 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(null)}>Cancel</Button>
            <Button onClick={generate} disabled={busy} data-testid="gen-submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output preview dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {KIND_META[selected.kind]?.label} · {selected.source_title}
                  <Badge variant="secondary" className="text-[10px] font-mono">{selected.model}</Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  AI-generated payload — approve to publish to the course module.
                </DialogDescription>
              </DialogHeader>
              <PayloadView kind={selected.kind} payload={selected.payload} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutputList({ items, onApprove, onReject, onOpen, readOnly }) {
  if (items.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((o) => {
        const Icon = KIND_META[o.kind]?.icon || FileText;
        return (
          <div key={o.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{KIND_META[o.kind]?.label} · {o.source_title}</div>
                  <div className="text-[11px] text-muted-foreground">{o.bloom} · {o.language?.toUpperCase()} · {o.model}</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{o.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpen(o)} data-testid={`open-output-${o.id}`}>
                Preview
              </Button>
              {!readOnly && (
                <>
                  <Button size="sm" onClick={() => onApprove(o.id)} data-testid={`approve-output-${o.id}`}>
                    <Check className="h-3.5 w-3.5 me-1" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onReject(o.id)}>
                    <X className="h-3.5 w-3.5 me-1" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PayloadView({ kind, payload }) {
  if (!payload) return <div className="text-sm text-muted-foreground">Empty payload.</div>;
  if (payload.raw) return <pre className="text-xs whitespace-pre-wrap font-mono">{payload.raw}</pre>;
  if (kind === "lesson_plan") {
    return (
      <div className="space-y-4 text-sm">
        <h3 className="text-lg font-semibold">{payload.title}</h3>
        <p className="text-muted-foreground">{payload.overview}</p>
        {payload.learning_outcomes && (
          <div>
            <div className="label-eyebrow mb-2">Learning outcomes</div>
            <ul className="list-disc ps-5 space-y-1">{payload.learning_outcomes.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
        {payload.session_plan && (
          <div>
            <div className="label-eyebrow mb-2">Session plan</div>
            <table className="w-full text-xs border border-border rounded overflow-hidden">
              <thead className="bg-muted/40"><tr><th className="p-2 text-start">Min</th><th className="p-2 text-start">Activity</th><th className="p-2 text-start">Note</th></tr></thead>
              <tbody>
                {payload.session_plan.map((row, i) => (
                  <tr key={i} className="border-t border-border"><td className="p-2 font-mono">{row.minute}</td><td className="p-2">{row.activity}</td><td className="p-2 text-muted-foreground">{row.instructor_note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payload.key_concepts && (
          <div>
            <div className="label-eyebrow mb-2">Key concepts</div>
            <dl className="grid grid-cols-1 gap-1 text-xs">
              {payload.key_concepts.map((k, i) => (
                <div key={i} className="flex gap-3 border-b border-border pb-1.5">
                  <dt className="font-medium min-w-[140px]">{k.term}</dt>
                  <dd className="text-muted-foreground">{k.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <Citations list={payload.source_citations} />
      </div>
    );
  }
  if (kind === "flashcards") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(payload.cards || []).map((c, i) => (
          <div key={i} className="rounded-md border border-border p-3 text-sm">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Q {i + 1}</div>
            <div className="font-medium">{c.q}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-emerald-700">A</div>
            <div className="text-emerald-800">{c.a}</div>
            {c.hint && <div className="mt-1 text-[11px] text-muted-foreground italic">Hint: {c.hint}</div>}
            {c.source_citation && <div className="mt-2 text-[11px] text-muted-foreground border-t border-border pt-1.5">"{c.source_citation}"</div>}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "mcqs") {
    return (
      <div className="space-y-3">
        {(payload.questions || []).map((q, i) => (
          <div key={i} className="rounded-md border border-border p-3 text-sm">
            <div className="font-medium">{i + 1}. {q.stem}</div>
            <ul className="mt-2 space-y-1">
              {(q.options || []).map((o, j) => (
                <li key={j} className={`text-xs flex gap-2 ${j === q.correct_index ? "text-emerald-700 font-medium" : "text-foreground/80"}`}>
                  <span className="font-mono">{String.fromCharCode(65 + j)}.</span> {o}
                  {j === q.correct_index && <Check className="h-3 w-3 ms-1" />}
                </li>
              ))}
            </ul>
            {q.explanation && <div className="mt-2 text-[11px] text-muted-foreground italic">{q.explanation}</div>}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "case_guide") {
    return (
      <div className="space-y-3 text-sm">
        <h3 className="text-lg font-semibold">{payload.case_title}</h3>
        <p className="text-muted-foreground">{payload.scenario}</p>
        {payload.discussion_questions && (
          <div>
            <div className="label-eyebrow mb-2">Discussion questions</div>
            <ol className="list-decimal ps-5 space-y-1">{payload.discussion_questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          </div>
        )}
        {payload.teaching_note && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs italic">{payload.teaching_note}</div>
        )}
        <Citations list={payload.source_citations} />
      </div>
    );
  }
  return <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(payload, null, 2)}</pre>;
}

function Citations({ list }) {
  if (!list?.length) return null;
  return (
    <div className="border-t border-border pt-3">
      <div className="label-eyebrow mb-2">Source citations</div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {list.map((s, i) => <li key={i} className="border-s-2 border-primary/40 ps-2 italic">"{s}"</li>)}
      </ul>
    </div>
  );
}
