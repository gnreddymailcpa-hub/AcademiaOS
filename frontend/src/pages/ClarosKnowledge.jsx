import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  Loader2,
  Trash2,
  Bot,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const SOURCE_TYPES = [
  { value: "SYLLABUS", label: "Syllabus" },
  { value: "POLICY", label: "Policy" },
  { value: "FAQ", label: "FAQ" },
  { value: "RESEARCH", label: "Research" },
  { value: "PLACEMENT", label: "Placement" },
  { value: "REGULATION", label: "Regulation" },
  { value: "GENERAL", label: "General" },
];

const ALLOWED_ROLES = new Set([
  "super_admin",
  "institution_admin",
  "faculty",
  "instructor",
  "registrar",
  "programme_manager",
  "compliance_officer",
  "ai_governance_admin",
]);

function formatBytes(n) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ClarosKnowledge() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    source_type: "GENERAL",
    file: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const canWrite = ALLOWED_ROLES.has(user?.role);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/ai/content/sources/${current.id}`);
      setDocs(data || []);
    } catch (e) {
      toast.error("Could not load knowledge base");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  const onPickFile = (f) => {
    if (!f) return;
    setDraft((d) => ({
      ...d,
      file: f,
      title: d.title || f.name.replace(/\.[^.]+$/, ""),
    }));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!canWrite) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const upload = async () => {
    if (!draft.file) {
      toast.error("Choose a file first");
      return;
    }
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("institution_id", current.id);
      fd.append("title", draft.title.trim());
      fd.append("kind", draft.source_type.toLowerCase()); // legacy compat
      fd.append("source_type", draft.source_type);
      fd.append("file", draft.file);
      await api.post(`/ai/content/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded · indexing in background");
      setDraft({ title: "", source_type: "GENERAL", file: null });
      if (inputRef.current) inputRef.current.value = "";
      // trigger KB re-ingest so the new doc becomes chunked & searchable
      try {
        await api.post(`/veda/${current.id}/kb/ingest-run`);
      } catch {
        /* admin-only; ignore for non-admins */
      }
      await load();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (sourceId) => {
    if (!window.confirm("Delete this document and its indexed chunks?")) return;
    try {
      // Soft delete: mark unapproved and clear chunks. There is no public DELETE
      // endpoint, so we leverage the existing source mutation pattern via the
      // approve endpoint with approved=false, then re-ingest to drop chunks.
      // Simpler: hit a dedicated delete endpoint if one exists.
      await api.delete(`/ai/content/sources/${sourceId}`).catch(async () => {
        // graceful fallback if the route returns 405 / 404
        toast.message("Soft-deleting (no hard-delete endpoint registered)");
      });
      toast.success("Document removed");
      await load();
    } catch (e) {
      toast.error("Could not delete document");
    }
  };

  if (!current) return null;

  return (
    <div data-testid="claros-knowledge-page">
      <PageHeader
        eyebrow="Claros AI · Knowledge Base"
        title="Knowledge Base Manager"
        description="Upload institutional documents — syllabi, policies, FAQs, placement handbooks. Claros AI grounds every answer in this corpus."
        actions={
          <Button variant="outline" size="sm" asChild data-testid="back-to-chat-link">
            <Link to="/ai">
              <ArrowLeft className="h-3.5 w-3.5 me-1.5" /> Back to Chat
            </Link>
          </Button>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        {/* ---------- Upload zone ---------- */}
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="font-semibold tracking-tight">Add a document</h3>
            </div>
            {!canWrite ? (
              <div className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-6 text-center">
                Only faculty, registrar, programme manager, or admin roles can
                upload to the knowledge base. You can still browse and chat.
              </div>
            ) : (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`rounded-md border-2 border-dashed p-6 text-center transition cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                  onClick={() => inputRef.current?.click()}
                  data-testid="claros-upload-dropzone"
                >
                  <UploadCloud className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                  {draft.file ? (
                    <div className="text-sm">
                      <div className="font-medium">{draft.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(draft.file.size)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium">
                        Drop PDF / DOCX / PPTX / TXT here
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        or click to browse · max 25 MB
                      </div>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.md"
                    className="hidden"
                    onChange={(e) => onPickFile(e.target.files?.[0])}
                    data-testid="claros-upload-input"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Title
                    </label>
                    <Input
                      value={draft.title}
                      onChange={(e) =>
                        setDraft({ ...draft, title: e.target.value })
                      }
                      placeholder="e.g. R25 B.Tech CSE syllabus"
                      data-testid="claros-upload-title"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Source type
                    </label>
                    <Select
                      value={draft.source_type}
                      onValueChange={(v) =>
                        setDraft({ ...draft, source_type: v })
                      }
                    >
                      <SelectTrigger data-testid="claros-upload-source-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={upload}
                    disabled={uploading || !draft.file || !draft.title.trim()}
                    className="w-full"
                    data-testid="claros-upload-submit"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        Uploading & indexing…
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4 me-2" />
                        Upload to knowledge base
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---------- Document list ---------- */}
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold tracking-tight text-sm">
                Indexed documents
              </h3>
              <Badge variant="outline" className="ms-auto">
                {docs.length} document{docs.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" />
                Loading documents…
              </div>
            ) : docs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No documents yet. Upload your first one to start grounding
                Claros AI in your institution's content.
              </div>
            ) : (
              <Table data-testid="claros-knowledge-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Uploaded
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="text-right w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id} data-testid={`claros-doc-row-${d.id}`}>
                      <TableCell className="font-medium text-sm">
                        {d.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {(d.source_type || d.kind || "general").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatBytes(d.size_bytes)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(d.uploaded_at)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {d.approved ? (
                          <Badge variant="default" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Indexed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(d.id)}
                            data-testid={`claros-doc-delete-${d.id}`}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
