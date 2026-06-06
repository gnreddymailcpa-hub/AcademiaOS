import React, { useEffect, useState } from "react";
import {
  Sparkles, Briefcase, Plus, TrendingUp, Trophy, FileSpreadsheet,
  Building2, Calendar,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { Kpi, Panel, MiniBar } from "../components/dashboards/widgets";

/**
 * PATHFINDER — Placement Intelligence (Phase 1 MVP).
 * 2 tabs: Drives (T&P workflow) + Resume Score (heuristic scoring).
 */
export default function Placements() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const isOfficer = ["super_admin", "institution_admin", "career_services"].includes(user?.role);

  if (!current) return null;

  return (
    <div data-testid="placements-page">
      <PageHeader
        eyebrow="PATHFINDER · Placement Intelligence"
        title={`${current.short_name} · Training & Placement Cockpit`}
        description="Manage drives, screen applications, score resumes with an industry-grade heuristic, track conversion."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3 w-3" /> Phase 1 · Live</Badge>
            <Badge className="bg-primary text-primary-foreground">PATHFINDER</Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="drives" className="space-y-6">
          <TabsList data-testid="placements-tabs">
            <TabsTrigger value="drives" data-testid="placements-tab-drives">Drives</TabsTrigger>
            <TabsTrigger value="resume" data-testid="placements-tab-resume">Resume Scoring</TabsTrigger>
          </TabsList>

          <TabsContent value="drives"><DrivesTab institutionId={current.id} isOfficer={isOfficer} /></TabsContent>
          <TabsContent value="resume"><ResumeTab institutionId={current.id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function DrivesTab({ institutionId, isOfficer }) {
  const [drives, setDrives] = useState([]);
  const [summary, setSummary] = useState({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    company: "", role: "Software Engineer", package_lpa: "",
    eligibility_branches: "CSE,AIML,DS", eligibility_cgpa: 7.0,
    scheduled_date: "", description: "",
  });

  const refresh = async () => {
    try {
      const [d, s] = await Promise.all([
        api.get(`/placements/${institutionId}/drives`),
        api.get(`/placements/${institutionId}/summary`),
      ]);
      setDrives(d.data || []);
      setSummary(s.data || {});
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [institutionId]);

  const submit = async () => {
    try {
      await api.post(`/placements/${institutionId}/drives`, {
        ...draft,
        package_lpa: parseFloat(draft.package_lpa),
        eligibility_branches: draft.eligibility_branches.split(",").map((s) => s.trim()).filter(Boolean),
        eligibility_cgpa: parseFloat(draft.eligibility_cgpa),
      });
      toast.success("Drive scheduled");
      setOpen(false);
      setDraft({ company: "", role: "Software Engineer", package_lpa: "", eligibility_branches: "CSE,AIML,DS", eligibility_cgpa: 7.0, scheduled_date: "", description: "" });
      refresh();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total drives" value={summary.total_drives || 0} icon={Briefcase} testid="path-kpi-drives" />
        <Kpi label="Upcoming" value={summary.upcoming || 0} icon={Calendar} testid="path-kpi-upcoming" />
        <Kpi label="Avg package" value={`₹${(summary.avg_package_lpa || 0).toFixed(1)}L`} icon={TrendingUp} testid="path-kpi-avg" />
        <Kpi label="Highest package" value={`₹${(summary.highest_package_lpa || 0).toFixed(1)}L`} icon={Trophy} testid="path-kpi-high" />
      </section>

      <Panel
        eyebrow="Schedule"
        title="Placement drives"
        testid="path-drives-panel"
        action={isOfficer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="path-drive-new"><Plus className="h-4 w-4" />New drive</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule placement drive</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Company</Label><Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} data-testid="path-drive-company" /></div>
                  <div><Label className="text-xs">Role</Label><Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} data-testid="path-drive-role" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Package (₹ LPA)</Label><Input type="number" value={draft.package_lpa} onChange={(e) => setDraft({ ...draft, package_lpa: e.target.value })} data-testid="path-drive-package" /></div>
                  <div><Label className="text-xs">Min. CGPA</Label><Input type="number" step="0.1" value={draft.eligibility_cgpa} onChange={(e) => setDraft({ ...draft, eligibility_cgpa: e.target.value })} data-testid="path-drive-cgpa" /></div>
                </div>
                <div><Label className="text-xs">Eligible branches (comma-separated)</Label><Input value={draft.eligibility_branches} onChange={(e) => setDraft({ ...draft, eligibility_branches: e.target.value })} data-testid="path-drive-branches" /></div>
                <div><Label className="text-xs">Scheduled date</Label><Input type="date" value={draft.scheduled_date} onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })} data-testid="path-drive-date" /></div>
                <div><Label className="text-xs">Description</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-testid="path-drive-desc" /></div>
                <Button onClick={submit} className="w-full" data-testid="path-drive-submit">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      >
        {drives.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No drives scheduled yet.</div>
        ) : (
          <ul className="space-y-2.5 text-sm" data-testid="path-drives-list">
            {drives.map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-card p-3" data-testid={`path-drive-${d.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> {d.company} · {d.role}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Eligible: {(d.eligibility_branches || []).join(", ") || "all"} · CGPA ≥ {d.eligibility_cgpa} · scheduled {d.scheduled_date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="bg-primary text-primary-foreground">₹{d.package_lpa} LPA</Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {(d.applicants || []).length} applied · {(d.selected || []).length} selected
                    </div>
                  </div>
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
function ResumeTab({ institutionId }) {
  const [draft, setDraft] = useState({
    student_name: "", target_role: "Software Engineer",
    skills: "python, system design, aws, docker, sql",
    projects: 2, internships: 1, certifications: 1,
    cgpa: 7.5, leadership_roles: 0, publications: 0,
  });
  const [result, setResult] = useState(null);

  const score = async () => {
    if (!draft.student_name) {
      toast.error("Student name required");
      return;
    }
    try {
      const r = await api.post(`/placements/${institutionId}/resume-score`, {
        ...draft,
        skills: draft.skills.split(",").map((s) => s.trim()).filter(Boolean),
        projects: parseInt(draft.projects, 10) || 0,
        internships: parseInt(draft.internships, 10) || 0,
        certifications: parseInt(draft.certifications, 10) || 0,
        cgpa: parseFloat(draft.cgpa) || 0,
        leadership_roles: parseInt(draft.leadership_roles, 10) || 0,
        publications: parseInt(draft.publications, 10) || 0,
      });
      setResult(r.data.result);
      toast.success(`Score ${r.data.result.total}/100 · ${r.data.result.band}`);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel eyebrow="Input" title="Resume profile" testid="path-resume-input">
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Student name</Label><Input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} data-testid="path-resume-name" /></div>
            <div><Label className="text-xs">Target role</Label><Input value={draft.target_role} onChange={(e) => setDraft({ ...draft, target_role: e.target.value })} data-testid="path-resume-role" /></div>
          </div>
          <div><Label className="text-xs">Skills (comma-separated)</Label><Input value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} data-testid="path-resume-skills" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Projects</Label><Input type="number" value={draft.projects} onChange={(e) => setDraft({ ...draft, projects: e.target.value })} data-testid="path-resume-projects" /></div>
            <div><Label className="text-xs">Internships</Label><Input type="number" value={draft.internships} onChange={(e) => setDraft({ ...draft, internships: e.target.value })} data-testid="path-resume-internships" /></div>
            <div><Label className="text-xs">Certs</Label><Input type="number" value={draft.certifications} onChange={(e) => setDraft({ ...draft, certifications: e.target.value })} data-testid="path-resume-certs" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">CGPA</Label><Input type="number" step="0.1" value={draft.cgpa} onChange={(e) => setDraft({ ...draft, cgpa: e.target.value })} data-testid="path-resume-cgpa" /></div>
            <div><Label className="text-xs">Leadership</Label><Input type="number" value={draft.leadership_roles} onChange={(e) => setDraft({ ...draft, leadership_roles: e.target.value })} data-testid="path-resume-leadership" /></div>
            <div><Label className="text-xs">Publications</Label><Input type="number" value={draft.publications} onChange={(e) => setDraft({ ...draft, publications: e.target.value })} data-testid="path-resume-pubs" /></div>
          </div>
          <Button onClick={score} className="w-full mt-2 gap-1.5" data-testid="path-resume-submit">
            <FileSpreadsheet className="h-4 w-4" /> Compute resume score
          </Button>
        </div>
      </Panel>

      <Panel eyebrow="Output" title="Score & suggestions" testid="path-resume-result">
        {!result ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Fill in the profile and compute the score. The model breaks down keyword match,
            completeness and CGPA into a transparent 0-100 rating.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="label-eyebrow">Total</div>
                <div className="text-5xl font-semibold tracking-tight tabular-nums" data-testid="path-resume-total">{result.total}</div>
              </div>
              <Badge className={
                result.band === "Strong" ? "bg-emerald-600 text-white" :
                result.band === "Good" ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
              }>{result.band}</Badge>
            </div>
            <div className="space-y-2.5 pt-2 border-t border-border">
              {Object.entries(result.components).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{v}</span>
                  </div>
                  <MiniBar value={v} max={40} />
                </div>
              ))}
            </div>
            {result.matched_keywords?.length > 0 && (
              <div>
                <div className="label-eyebrow mb-2">Matched keywords</div>
                <div className="flex gap-1.5 flex-wrap">
                  {result.matched_keywords.map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="label-eyebrow mb-2">Suggestions</div>
              <ul className="space-y-1.5 text-xs text-foreground/85" data-testid="path-resume-suggestions">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary">•</span>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
