import React, { useCallback, useEffect, useState } from "react";
import {
  Users2, Briefcase, Calendar, GraduationCap, Loader2, Plus, Sparkles, Copy,
  Building2, MapPin, Search, Linkedin, Check, X,
} from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

function MentorRequestDialog({ alumni, onSent }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [domain, setDomain] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const aiDraft = async () => {
    setAiLoading(true);
    try {
      const r = await api.post("/v1/alumni/outreach/generate", {
        alumni_id: alumni.id, purpose: "MENTORSHIP",
      });
      setMsg(r.data.message || "");
      toast.success("Draft generated");
    } catch (e) { toast.error("AI draft failed"); }
    finally { setAiLoading(false); }
  };

  const submit = async () => {
    if (!msg.trim()) return toast.error("Message required");
    setSaving(true);
    try {
      await api.post("/v1/alumni/mentorship/request", {
        alumni_id: alumni.id, message: msg, domain_sought: domain,
      });
      toast.success("Request sent");
      setOpen(false); setMsg(""); setDomain("");
      onSent && onSent();
    } catch (e) { toast.error(e?.response?.data?.detail || "Send failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`alumni-request-btn-${alumni.id}`}>
          Request Mentorship
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="alumni-request-dialog">
        <DialogHeader>
          <DialogTitle>Request mentorship from {alumni.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input data-testid="request-domain-input" placeholder="Domain sought (e.g. Career Growth)"
            value={domain} onChange={(e) => setDomain(e.target.value)} />
          <Textarea data-testid="request-msg-input" rows={6} placeholder="Your message…"
            value={msg} onChange={(e) => setMsg(e.target.value)} />
          <Button variant="outline" size="sm" onClick={aiDraft} disabled={aiLoading} data-testid="request-ai-draft-btn">
            {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            AI draft
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid="request-send-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostJobDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", company_name: "", location: "", description: "",
    package_lpa: "", application_url: "", deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      await api.post("/v1/alumni/jobs", {
        ...form, skills_required: [],
        package_lpa: form.package_lpa ? Number(form.package_lpa) : null,
        deadline: form.deadline || null,
      });
      toast.success("Job posted");
      setOpen(false); onCreated();
    } catch (e) { toast.error(e?.response?.data?.detail || "Post failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="alumni-post-job-btn"><Plus className="h-4 w-4 mr-2" /> Post a Job</Button>
      </DialogTrigger>
      <DialogContent data-testid="alumni-job-dialog">
        <DialogHeader><DialogTitle>Post a job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input data-testid="job-title" placeholder="Title" value={form.title}
            onChange={(e) => setForm(s => ({ ...s, title: e.target.value }))} />
          <Input data-testid="job-company" placeholder="Company" value={form.company_name}
            onChange={(e) => setForm(s => ({ ...s, company_name: e.target.value }))} />
          <Input data-testid="job-location" placeholder="Location" value={form.location}
            onChange={(e) => setForm(s => ({ ...s, location: e.target.value }))} />
          <Textarea data-testid="job-desc" rows={4} placeholder="Description" value={form.description}
            onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="job-pkg" type="number" placeholder="Package (LPA)" value={form.package_lpa}
              onChange={(e) => setForm(s => ({ ...s, package_lpa: e.target.value }))} />
            <Input data-testid="job-deadline" type="date" value={form.deadline}
              onChange={(e) => setForm(s => ({ ...s, deadline: e.target.value }))} />
          </div>
          <Input data-testid="job-url" placeholder="Application URL" value={form.application_url}
            onChange={(e) => setForm(s => ({ ...s, application_url: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="job-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClarosAlumniHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState("HOME");
  const [stats, setStats] = useState(null);
  const [alumni, setAlumni] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [filter, setFilter] = useState("");

  const isStudent = user?.role === "student";

  const load = useCallback(async () => {
    try {
      const [s, a, m, j, e, r] = await Promise.all([
        api.get("/v1/alumni/stats").then(r => r.data).catch(() => null),
        api.get("/v1/alumni/profiles").then(r => r.data).catch(() => []),
        api.get("/v1/alumni/mentors").then(r => r.data).catch(() => []),
        api.get("/v1/alumni/jobs").then(r => r.data).catch(() => []),
        api.get("/v1/alumni/events").then(r => r.data).catch(() => []),
        api.get("/v1/alumni/mentorship/requests").then(r => r.data).catch(() => []),
      ]);
      setStats(s); setAlumni(a || []); setMentors(m || []);
      setJobs(j || []); setEvents(e || []); setReqs(r || []);
    } catch (err) { toast.error("Failed to load alumni data"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateRequest = async (mid, status) => {
    try {
      await api.put(`/v1/alumni/mentorship/${mid}`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch { toast.error("Update failed"); }
  };

  const filteredAlumni = filter
    ? alumni.filter(a => (a.name || "").toLowerCase().includes(filter.toLowerCase())
        || (a.current_company || "").toLowerCase().includes(filter.toLowerCase())
        || String(a.batch_year || "").includes(filter))
    : alumni;

  const tabs = [
    { id: "HOME", label: "Home" }, { id: "DIR", label: "Directory" },
    { id: "JOBS", label: "Jobs" }, { id: "MENT", label: "Mentorship" },
  ];

  return (
    <div className="space-y-6" data-testid="alumni-page">
      <PageHeader eyebrow="Claros Alumni" moduleId="claros-alumni" title="Alumni Network"
        description="Directory, mentorship, jobs and events." />
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            data-testid={`alumni-tab-${t.id.toLowerCase()}`}
            className={`px-3 py-2 -mb-px border-b-2 text-sm ${tab === t.id
              ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "HOME" && (
        <div className="space-y-4" data-testid="alumni-home-pane">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["Total Alumni", stats.total_alumni, Users2, "stat-total"],
                ["Verified", stats.verified_count, Check, "stat-verified"],
                ["Active Mentors", stats.active_mentors, GraduationCap, "stat-mentors"],
                ["Jobs Posted", stats.jobs_posted, Briefcase, "stat-jobs"],
                ["Batches", stats.batches_represented, Calendar, "stat-batches"],
              ].map(([l, v, I, tid]) => (
                <div className="card p-4 border border-border" key={tid} data-testid={tid}>
                  <div className="flex items-center justify-between">
                    <div className="label-eyebrow">{l}</div>
                    <I className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">{v}</div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 border border-border">
              <h3 className="text-base font-semibold mb-3">Recent jobs</h3>
              {jobs.slice(0, 3).map(j => (
                <div key={j.id} className="py-2 border-b last:border-0 text-sm" data-testid={`home-job-${j.id}`}>
                  <div className="font-medium">{j.title}</div>
                  <div className="text-xs text-muted-foreground">{j.company_name} · {j.location}</div>
                </div>
              ))}
            </div>
            <div className="card p-5 border border-border">
              <h3 className="text-base font-semibold mb-3">Upcoming events</h3>
              {events.slice(0, 3).map(e => (
                <div key={e.id} className="py-2 border-b last:border-0 text-sm" data-testid={`home-event-${e.id}`}>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.event_date} · {e.event_time}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5 border border-border">
            <h3 className="text-base font-semibold mb-3">Featured mentors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {mentors.slice(0, 3).map(m => (
                <div key={m.id} className="border rounded p-3" data-testid={`home-mentor-${m.id}`}>
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.current_role} · {m.current_company}</div>
                  <div className="text-xs mt-1">{(m.mentor_domains || []).slice(0, 2).map(d => (
                    <Badge key={d} variant="outline" className="text-[10px] mr-1">{d}</Badge>
                  ))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "DIR" && (
        <div className="space-y-3" data-testid="alumni-dir-pane">
          <div className="relative max-w-md">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by name, company, batch year"
              value={filter} onChange={(e) => setFilter(e.target.value)}
              data-testid="alumni-search-input" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAlumni.map(a => (
              <div key={a.id} className="card p-4 border border-border space-y-2" data-testid={`alumni-card-${a.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">Batch {a.batch_year} · {a.program_name}</div>
                  </div>
                  {a.is_mentor && <Badge className="bg-violet-600 text-white text-[10px]">Mentor</Badge>}
                </div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {a.current_role || "—"} · {a.current_company || "—"}
                </div>
                {a.current_location && (
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {a.current_location}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {a.linkedin_url && (
                    <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                  {isStudent && a.is_mentor && (
                    <MentorRequestDialog alumni={a} onSent={load} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "JOBS" && (
        <div className="space-y-3" data-testid="alumni-jobs-pane">
          <div className="flex items-center justify-end">
            {!isStudent && <PostJobDialog onCreated={load} />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {jobs.map(j => (
              <div key={j.id} className="card p-4 border border-border space-y-2" data-testid={`job-card-${j.id}`}>
                <div className="text-sm font-medium">{j.title}</div>
                <div className="text-xs text-muted-foreground">{j.company_name} · {j.location}</div>
                <p className="text-xs line-clamp-3">{j.description}</p>
                <div className="flex items-center justify-between text-xs">
                  {j.package_lpa && <span>₹{j.package_lpa} LPA</span>}
                  {j.deadline && <span className="text-muted-foreground">Due {j.deadline}</span>}
                </div>
                <div className="text-xs text-muted-foreground">Posted by {j.posted_by_name || "alumni"}</div>
                {j.application_url && (
                  <a href={j.application_url} target="_blank" rel="noreferrer" className="text-xs text-primary">Apply →</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "MENT" && (
        <div className="space-y-4" data-testid="alumni-ment-pane">
          {isStudent ? (
            <>
              <h3 className="text-base font-semibold">Available mentors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mentors.map(m => (
                  <div key={m.id} className="card p-4 border border-border space-y-2" data-testid={`mentor-card-${m.id}`}>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.current_role} · {m.current_company}</div>
                    <p className="text-xs line-clamp-2">{m.bio}</p>
                    <div className="flex flex-wrap gap-1">
                      {(m.mentor_domains || []).map(d => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>)}
                    </div>
                    <MentorRequestDialog alumni={m} onSent={load} />
                  </div>
                ))}
              </div>
              <h3 className="text-base font-semibold mt-4">My requests</h3>
              <div className="card border border-border divide-y">
                {reqs.length === 0 && <div className="p-3 text-sm text-muted-foreground">No requests yet.</div>}
                {reqs.map(rq => (
                  <div key={rq.id} className="p-3 text-sm flex items-center justify-between" data-testid={`my-request-${rq.id}`}>
                    <div>
                      <div className="font-medium">{rq.alumni_name}</div>
                      <div className="text-xs text-muted-foreground">{rq.domain_sought} · {new Date(rq.created_at).toLocaleDateString()}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{rq.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold">Incoming requests</h3>
              <div className="card border border-border divide-y">
                {reqs.length === 0 && <div className="p-3 text-sm text-muted-foreground">No requests yet.</div>}
                {reqs.map(rq => (
                  <div key={rq.id} className="p-3 text-sm" data-testid={`incoming-request-${rq.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{rq.student_name}</div>
                        <div className="text-xs text-muted-foreground">{rq.domain_sought} · {new Date(rq.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{rq.status}</Badge>
                        {rq.status === "PENDING" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateRequest(rq.id, "ACCEPTED")} data-testid={`accept-${rq.id}`}>
                              <Check className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateRequest(rq.id, "DECLINED")} data-testid={`decline-${rq.id}`}>
                              <X className="h-3 w-3 mr-1" /> Decline
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {rq.message && <div className="text-xs mt-2 bg-muted/30 rounded p-2">{rq.message}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
