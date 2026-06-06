import React, { useEffect, useState } from "react";
import {
  Sparkles, CalendarCheck, BadgeIndianRupee, Award, FileCheck,
  Plus, Search,
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
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, ItemList, MiniBar } from "../components/dashboards/widgets";

/**
 * NEXUS — Campus ERP console (Phase-1 MVP).
 * 3 tabs:
 *   1. Attendance — record daily marking + see per-course aggregate
 *   2. Fees — create term fee, record payments, see collection %
 *   3. Certificates — issue bonafide/TC/conduct certificates with verify code
 */
export default function Nexus() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "institution_admin", "registrar"].includes(user?.role);

  if (!current) return null;

  return (
    <div data-testid="nexus-page">
      <PageHeader
        eyebrow="NEXUS · Campus ERP"
        title={`${current.short_name} · Operations Console`}
        description="Attendance · Fees · Certificates — tenant-isolated, audit-logged, accreditation-ready."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 1 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">NEXUS</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList data-testid="nexus-tabs">
            <TabsTrigger value="attendance" data-testid="nexus-tab-attendance">Attendance</TabsTrigger>
            <TabsTrigger value="fees" data-testid="nexus-tab-fees">Fees</TabsTrigger>
            <TabsTrigger value="certificates" data-testid="nexus-tab-certificates">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance"><AttendanceTab institutionId={current.id} isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="fees"><FeesTab institutionId={current.id} isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="certificates"><CertificatesTab institutionId={current.id} isAdmin={isAdmin} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function AttendanceTab({ institutionId, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total_marks: 0, present: 0, pct: 0 });
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({
    cohort_id: "cohort-vce-cse-25", course_id: "course-cse-ml", date: today,
    entries: "s1:present, s2:present, s3:absent, s4:present, s5:leave",
  });

  const refresh = async () => {
    try {
      const r = await api.get(`/nexus/${institutionId}/attendance`);
      setRows(r.data.rows || []);
      setSummary(r.data.summary || {});
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not load attendance");
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      const entries = draft.entries.split(",").map((s) => {
        const [sid, st] = s.split(":").map((x) => x.trim());
        return { student_id: sid, status: (st || "present").toLowerCase() };
      }).filter((e) => e.student_id);
      await api.post(`/nexus/${institutionId}/attendance`, {
        cohort_id: draft.cohort_id, course_id: draft.course_id, date: draft.date, entries,
      });
      toast.success(`Attendance marked · ${entries.length} students`);
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not mark attendance");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Sessions recorded" value={rows.length} icon={CalendarCheck} testid="nexus-att-kpi-sessions" />
        <Kpi label="Marks captured" value={summary.total_marks} icon={CalendarCheck} testid="nexus-att-kpi-marks" />
        <Kpi label="Avg attendance" value={`${summary.pct}%`} hint={`${summary.present} present`} icon={CalendarCheck} testid="nexus-att-kpi-pct" />
      </section>

      <Panel
        eyebrow="Daily marking"
        title="Attendance sessions"
        testid="nexus-att-panel"
        action={isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="nexus-att-new"><Plus className="h-4 w-4" />Mark session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Mark attendance session</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Cohort ID</Label><Input value={draft.cohort_id} onChange={(e) => setDraft({ ...draft, cohort_id: e.target.value })} data-testid="nexus-att-cohort" /></div>
                  <div><Label className="text-xs">Course ID</Label><Input value={draft.course_id} onChange={(e) => setDraft({ ...draft, course_id: e.target.value })} data-testid="nexus-att-course" /></div>
                </div>
                <div><Label className="text-xs">Date</Label><Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} data-testid="nexus-att-date" /></div>
                <div>
                  <Label className="text-xs">Entries (student_id:status, …)</Label>
                  <textarea
                    rows={3}
                    value={draft.entries}
                    onChange={(e) => setDraft({ ...draft, entries: e.target.value })}
                    className="w-full mt-1 rounded-md border border-border bg-card p-2 text-xs font-mono"
                    data-testid="nexus-att-entries"
                  />
                </div>
                <Button onClick={submit} className="w-full" data-testid="nexus-att-submit">Save session</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No attendance recorded yet.</div>
        ) : (
          <ul className="space-y-2 text-sm" data-testid="nexus-att-list">
            {rows.slice(0, 12).map((r) => {
              const present = r.entries?.filter((e) => e.status === "present").length || 0;
              const total = r.entries?.length || 0;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{r.course_id} · {r.cohort_id}</div>
                    <div className="text-xs text-muted-foreground">{r.date} · marked by {r.marked_by}</div>
                  </div>
                  <Badge variant="outline" className="font-mono">{present}/{total}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// -----------------------------------------------------------------------------
function FeesTab({ institutionId, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total_billed: 0, total_collected: 0, outstanding: 0, overdue: 0, collection_pct: 0 });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ student_id: "", student_name: "", term: "AY 2025-26 · Sem 1", amount: "", due_date: "" });

  const refresh = async () => {
    try {
      const r = await api.get(`/nexus/${institutionId}/fees`);
      setRows(r.data.rows || []);
      setSummary(r.data.summary || {});
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/nexus/${institutionId}/fees`, {
        ...draft, amount: parseFloat(draft.amount),
      });
      toast.success("Fee record created");
      setOpen(false);
      setDraft({ student_id: "", student_name: "", term: "AY 2025-26 · Sem 1", amount: "", due_date: "" });
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const pay = async (id, amount) => {
    try {
      await api.post(`/nexus/${institutionId}/fees/${id}/pay`, { amount, method: "online" });
      toast.success(`₹${amount.toLocaleString()} recorded`);
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total billed" value={`₹${summary.total_billed.toLocaleString()}`} icon={BadgeIndianRupee} testid="nexus-fee-kpi-billed" />
        <Kpi label="Collected" value={`₹${summary.total_collected.toLocaleString()}`} hint={`${summary.collection_pct}%`} icon={BadgeIndianRupee} testid="nexus-fee-kpi-collected" />
        <Kpi label="Outstanding" value={`₹${summary.outstanding.toLocaleString()}`} icon={BadgeIndianRupee} testid="nexus-fee-kpi-outstanding" />
        <Kpi label="Overdue" value={summary.overdue} icon={BadgeIndianRupee} testid="nexus-fee-kpi-overdue" />
      </section>

      <Panel
        eyebrow="Ledger"
        title="Fee records"
        testid="nexus-fee-panel"
        action={isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="nexus-fee-new"><Plus className="h-4 w-4" />New fee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create fee record</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Student ID</Label><Input value={draft.student_id} onChange={(e) => setDraft({ ...draft, student_id: e.target.value })} data-testid="nexus-fee-sid" /></div>
                  <div><Label className="text-xs">Student name</Label><Input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} data-testid="nexus-fee-sname" /></div>
                </div>
                <div><Label className="text-xs">Term</Label><Input value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} data-testid="nexus-fee-term" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Amount (₹)</Label><Input type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} data-testid="nexus-fee-amount" /></div>
                  <div><Label className="text-xs">Due date</Label><Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} data-testid="nexus-fee-due" /></div>
                </div>
                <Button onClick={submit} className="w-full" data-testid="nexus-fee-submit">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No fee records yet.</div>
        ) : (
          <ul className="space-y-2 text-sm" data-testid="nexus-fee-list">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center border-b border-border pb-2 last:border-0">
                <div>
                  <div className="font-medium">{r.student_name} <span className="text-xs text-muted-foreground">({r.student_id})</span></div>
                  <div className="text-xs text-muted-foreground">{r.term} · due {r.due_date}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">₹{r.amount.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">paid ₹{(r.paid || 0).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    r.status === "paid" ? "bg-emerald-600/15 text-emerald-700 border-emerald-200" :
                    r.status === "overdue" ? "bg-rose-500/15 text-rose-700 border-rose-200" :
                    r.status === "partial" ? "bg-amber-500/15 text-amber-700 border-amber-200" : ""
                  }>{r.status}</Badge>
                  {isAdmin && r.status !== "paid" && (
                    <Button size="sm" variant="outline" onClick={() => pay(r.id, r.amount - (r.paid || 0))} data-testid={`nexus-fee-pay-${r.id}`}>
                      Record payment
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// -----------------------------------------------------------------------------
function CertificatesTab({ institutionId, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [draft, setDraft] = useState({ student_id: "", student_name: "", cert_type: "bonafide", purpose: "Higher studies" });

  const refresh = async () => {
    try {
      const r = await api.get(`/nexus/${institutionId}/certificates`);
      setRows(r.data || []);
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      const r = await api.post(`/nexus/${institutionId}/certificates`, draft);
      toast.success(`Certificate issued · verify code ${r.data.verify_code}`);
      setOpen(false);
      setDraft({ student_id: "", student_name: "", cert_type: "bonafide", purpose: "Higher studies" });
      refresh();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  const verify = async () => {
    try {
      const r = await api.get(`/nexus/verify/${verifyCode}`);
      setVerifyResult({ ok: true, ...r.data });
    } catch (e) {
      setVerifyResult({ ok: false, error: "Not found" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Certificates issued" value={rows.length} icon={Award} testid="nexus-crt-kpi-issued" />
        <Kpi label="This month" value={rows.filter((r) => (r.issued_at || "").startsWith(new Date().toISOString().slice(0, 7))).length} icon={Award} testid="nexus-crt-kpi-month" />
        <Kpi label="Verifications open to public" value="✓" hint="GET /api/nexus/verify/{code}" icon={FileCheck} testid="nexus-crt-kpi-verify" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          eyebrow="Issued"
          title="Recent certificates"
          testid="nexus-crt-panel"
          action={isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" data-testid="nexus-crt-new"><Plus className="h-4 w-4" />Issue</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Issue certificate</DialogTitle></DialogHeader>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Student ID</Label><Input value={draft.student_id} onChange={(e) => setDraft({ ...draft, student_id: e.target.value })} data-testid="nexus-crt-sid" /></div>
                    <div><Label className="text-xs">Student name</Label><Input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} data-testid="nexus-crt-sname" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={draft.cert_type} onValueChange={(v) => setDraft({ ...draft, cert_type: v })}>
                      <SelectTrigger className="h-9 text-xs" data-testid="nexus-crt-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["bonafide", "transfer", "conduct", "study"].map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Purpose</Label><Input value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} data-testid="nexus-crt-purpose" /></div>
                  <Button onClick={submit} className="w-full" data-testid="nexus-crt-submit">Issue & generate verify code</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        >
          {rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No certificates issued.</div>
          ) : (
            <ItemList
              testid="nexus-crt-list"
              items={rows.slice(0, 10).map((r) => ({
                id: r.id,
                title: `${r.student_name} · ${r.cert_type}`,
                meta: `${r.purpose} · issued ${(r.issued_at || "").slice(0, 10)}`,
                right: r.verify_code,
              }))}
            />
          )}
        </Panel>

        <Panel eyebrow="Public verification" title="Verify a certificate code" testid="nexus-crt-verify-panel">
          <div className="flex gap-2 mb-3">
            <Input placeholder="Enter verify code" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} data-testid="nexus-crt-verify-input" />
            <Button onClick={verify} className="gap-1.5" data-testid="nexus-crt-verify-btn"><Search className="h-4 w-4" />Verify</Button>
          </div>
          {verifyResult && (
            <div className={`rounded-md p-3 border text-xs ${verifyResult.ok ? "bg-emerald-600/10 border-emerald-200" : "bg-rose-500/10 border-rose-200"}`} data-testid="nexus-crt-verify-result">
              {verifyResult.ok ? (
                <>
                  <div className="font-semibold">✓ Authentic</div>
                  <div className="text-muted-foreground mt-1">
                    {verifyResult.student_name} · {verifyResult.cert_type} · issued {(verifyResult.issued_at || "").slice(0, 10)}
                  </div>
                </>
              ) : (<div className="font-semibold">✗ {verifyResult.error}</div>)}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
