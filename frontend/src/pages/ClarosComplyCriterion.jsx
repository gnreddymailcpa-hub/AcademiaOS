import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Pencil, Check, X, FileUp, FileText,
  Sparkles, Copy, Trash2,
} from "lucide-react";

export default function ClarosComplyCriterion() {
  const { id } = useParams();
  const { current } = useInstitution();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [aqarOpen, setAqarOpen] = useState(false);
  const [aqarLoading, setAqarLoading] = useState(false);
  const [aqar, setAqar] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: d } = await api.get(`/v1/comply/criteria/${id}`);
      setData(d);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m) => {
    setEditId(m.id);
    setEditValue(String(m.current_value ?? ""));
  };
  const cancelEdit = () => { setEditId(null); setEditValue(""); };
  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/v1/comply/metrics/${editId}`, { current_value: parseFloat(editValue) });
      toast.success("Metric updated");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const uploadEvidence = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      toast.error("Add a title and a file");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("criterion_id", id);
      fd.append("title", uploadTitle);
      fd.append("academic_year", "2025-26");
      fd.append("description", "");
      fd.append("file", uploadFile);
      await api.post(`/v1/comply/evidence/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Evidence uploaded");
      setUploadFile(null); setUploadTitle("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteEv = async (ev) => {
    if (!window.confirm("Delete this evidence?")) return;
    try {
      await api.delete(`/v1/comply/evidence/${ev.id}`);
      toast.success("Evidence removed");
      await load();
    } catch (e) {
      toast.error("Could not delete");
    }
  };

  const generateAqar = async () => {
    setAqarLoading(true); setAqar(null);
    try {
      const { data: d } = await api.post(`/v1/comply/aqar/generate`, {
        criterion_id: id, academic_year: "2025-26",
      });
      setAqar(d);
      setAqarOpen(true);
    } catch (e) {
      toast.error("AQAR generation failed");
    } finally {
      setAqarLoading(false);
    }
  };

  if (!current) return null;
  if (loading || !data) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading criterion…
      </div>
    );
  }
  const c = data.criterion;
  const s = data.score;
  return (
    <div data-testid="claros-comply-criterion-page">
      <PageHeader
        eyebrow={`Claros Comply · NAAC Criterion ${c.code}`}
        title={c.name}
        description={c.description}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/comply" data-testid="comply-criterion-back"><ArrowLeft className="h-3.5 w-3.5 me-1.5" />Dashboard</Link>
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* ----- Score card ----- */}
        <div className="rounded-lg border border-border bg-card p-5 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="comply-criterion-score">
          <KpiTile label="Current" value={s.current_score.toFixed(0)} />
          <KpiTile label="Max" value={s.max_score.toFixed(0)} />
          <KpiTile label="Readiness" value={`${s.readiness_pct}%`} />
          <KpiTile label="Evidence" value={s.evidence_count} sub={`${s.metric_count} metrics`} />
        </div>

        {/* ----- Metrics table ----- */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <h3 className="font-semibold text-sm">Metrics</h3>
            <Badge variant="outline" className="ms-auto text-[10px]">{data.metrics.length}</Badge>
          </div>
          {data.metrics.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground" data-testid="comply-metrics-empty">
              No metrics defined for this criterion yet.
            </div>
          ) : (
            <Table data-testid="comply-metrics-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  <TableHead className="text-right w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.metrics.map(m => (
                  <TableRow key={m.id} data-testid={`comply-metric-row-${m.metric_code}`}>
                    <TableCell className="font-mono text-[11px]">{m.metric_code}</TableCell>
                    <TableCell className="text-sm">{m.metric_name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.target_value}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {editId === m.id ? (
                        <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} type="number" className="h-7 text-right w-24 ms-auto" data-testid="comply-metric-edit-input" />
                      ) : m.current_value}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.unit}</TableCell>
                    <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground">
                      {m.last_updated ? new Date(m.last_updated).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {editId === m.id ? (
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" onClick={saveEdit} disabled={saving} className="h-7 w-7" data-testid={`comply-metric-save-${m.metric_code}`}>
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7"><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => startEdit(m)} className="h-7 w-7" data-testid={`comply-metric-edit-${m.metric_code}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ----- Evidence ----- */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-semibold text-sm">Evidence documents</h3>
            <Badge variant="outline" className="ms-auto text-[10px]">{data.evidence.length}</Badge>
          </div>
          {/* Upload row */}
          <div className="border-b border-border p-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Evidence title" className="md:col-span-6" data-testid="comply-evidence-title-input" />
            <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0])} className="md:col-span-4" data-testid="comply-evidence-file-input" />
            <Button onClick={uploadEvidence} disabled={uploading || !uploadFile || !uploadTitle.trim()} className="md:col-span-2" data-testid="comply-evidence-upload-btn">
              {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <FileUp className="h-4 w-4 me-2" />}
              Upload
            </Button>
          </div>
          {data.evidence.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground" data-testid="comply-evidence-empty">
              No evidence uploaded yet.
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="comply-evidence-list">
              {data.evidence.map(ev => (
                <li key={ev.id} className="px-5 py-3 flex items-center gap-3" data-testid={`comply-evidence-row-${ev.id}`}>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{ev.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      AY {ev.academic_year} · {ev.uploaded_by_email || ev.uploaded_by} · {ev.created_at && new Date(ev.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {ev.is_verified && <Badge variant="default" className="text-[10px]">Verified</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => deleteEv(ev)} className="text-muted-foreground hover:text-destructive" data-testid={`comply-evidence-delete-${ev.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ----- AQAR generator ----- */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
          <Sparkles className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Generate AQAR Draft for this criterion</div>
            <div className="text-xs text-muted-foreground">
              Claude composes a 500-word AQAR section using your metrics + evidence for AY 2025-26.
            </div>
          </div>
          <Button onClick={generateAqar} disabled={aqarLoading} data-testid="comply-aqar-generate-btn">
            {aqarLoading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Sparkles className="h-4 w-4 me-2" />}
            Generate AQAR Draft
          </Button>
        </div>
      </div>

      {/* AQAR result modal */}
      <Dialog open={aqarOpen} onOpenChange={setAqarOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              AQAR · Criterion {c.code} · {aqar?.academic_year}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed border border-border rounded-md bg-background p-4" data-testid="comply-aqar-text">
            {aqar?.generated_text}
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-[10px]">{aqar?.word_count} words · {aqar?.model}</Badge>
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(aqar?.generated_text || "");
              toast.success("Copied to clipboard");
            }} data-testid="comply-aqar-copy-btn">
              <Copy className="h-3.5 w-3.5 me-1.5" /> Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiTile({ label, value, sub }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
