import React, { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Compass, Loader2, Target, Route, Briefcase, Bell, Sparkles } from "lucide-react";

const LEARNER_IDS = {
  "11111111-1111-1111-1111-111111111111": "u-isb-student",
  "22222222-2222-2222-2222-222222222222": "u-eaic-cadet",
};

function initials(n) {
  if (!n) return "U";
  return n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AIAdvisor() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const { lang } = useLang();
  const [profile, setProfile] = useState(null);
  const [framework, setFramework] = useState(null);
  const [learner, setLearner] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    setProfile(null);
    setReport(null);
    const learnerId = LEARNER_IDS[current.id];
    if (!learnerId) {
      // No demo profile for this tenant
      setLearner(null);
      return;
    }
    Promise.all([
      api.get(`/ai/advisor/framework/${current.id}`),
      api.get(`/ai/advisor/profile/${current.id}/${learnerId}`).catch(() => null),
      api.get(`/users/${current.id}`),
    ]).then(([fwr, pr, ur]) => {
      setFramework(fwr.data);
      setProfile(pr?.data || null);
      const u = ur.data.find((x) => x.id === learnerId);
      setLearner(u);
    });
  }, [current?.id]);

  const analyse = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/ai/advisor/analyse`, {
        institution_id: current.id,
        user_id: profile.user_id,
        language: lang,
      });
      setReport(data);
      toast.success("Advisor report ready", { description: "Approval-gated before learner sees it" });
    } catch (e) {
      toast.error("Could not generate report", { description: e?.response?.data?.detail });
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;

  if (!learner || !profile) {
    return (
      <div>
        <PageHeader
          eyebrow="Module 4.2 · AI Educational Advisor"
          title="AI Advisor"
          description="Skill-gap analysis, personalised learning paths and career pathway mapping."
        />
        <div className="p-6 lg:p-8">
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No seeded learner profile for this tenant. Switch to ISB India or EAIC UAE to run the demo flow.
          </div>
        </div>
      </div>
    );
  }

  const role = framework?.target_roles?.find((r) => r.key === profile.target_role);
  const radarData = role
    ? role.skills.map((s) => {
        const cur = profile.skills.find((x) => x.name === s.name)?.level || 0;
        return { skill: s.name, current: cur, target: s.level };
      })
    : [];

  return (
    <div data-testid="ai-advisor-page">
      <PageHeader
        eyebrow="Module 4.2 · AI Educational Advisor"
        title="AI Advisor"
        description="Skill-gap analysis, personalised learning paths and career pathway mapping."
        actions={
          <Button onClick={analyse} disabled={busy} data-testid="advisor-analyse">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 me-1.5" />}
            Generate advisor report
          </Button>
        }
      />

      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        {/* Learner profile + radar */}
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials(learner.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold">{learner.name}</div>
                <div className="text-xs text-muted-foreground">{learner.title}</div>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <Target className="h-3 w-3" /> Target · {role?.name || "—"}
              </Badge>
            </div>
            <div className="mt-5 h-64 min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar name="Target" dataKey="target" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.18} />
                  <Radar name="Current" dataKey="current" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="label-eyebrow mb-3">Skill gap detail</div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-start font-medium pb-2">Skill</th>
                  <th className="text-end font-medium pb-2">Current</th>
                  <th className="text-end font-medium pb-2">Target</th>
                  <th className="text-end font-medium pb-2">Gap</th>
                </tr>
              </thead>
              <tbody>
                {radarData.map((r) => (
                  <tr key={r.skill} className="border-t border-border">
                    <td className="py-2">{r.skill}</td>
                    <td className="py-2 text-end tabular-nums">{r.current}</td>
                    <td className="py-2 text-end tabular-nums">{r.target}</td>
                    <td className="py-2 text-end tabular-nums font-medium">
                      <span className={r.target - r.current > 1 ? "text-amber-700" : "text-emerald-700"}>
                        {Math.max(0, r.target - r.current)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Report */}
        <section className="col-span-12 lg:col-span-5 space-y-4">
          {!report && !busy && (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Compass className="h-6 w-6 mx-auto text-primary" />
              <div className="mt-2 text-sm font-medium">Run an advisor report</div>
              <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                AI Educational Advisor will propose a learning path, career pathway and proactive alerts grounded in your tenant's course catalog.
              </div>
            </div>
          )}
          {busy && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" />
              <div className="mt-2 text-xs text-muted-foreground">Analysing profile and generating recommendations…</div>
            </div>
          )}
          {report && <ReportView report={report} />}
        </section>
      </div>
    </div>
  );
}

function ReportView({ report }) {
  const p = report.payload || {};
  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="label-eyebrow">Summary</div>
        <p className="mt-2 text-sm leading-relaxed">{p.summary}</p>
        <div className="mt-3 text-[10px] text-muted-foreground font-mono">{report.model}</div>
      </div>
      {p.top_priorities?.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3">Top priorities</div>
          <ul className="space-y-2">
            {p.top_priorities.map((t, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{t.skill}</span>
                <div className="text-xs text-muted-foreground">{t.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.recommended_path?.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3 flex items-center gap-2">
            <Route className="h-3.5 w-3.5" /> Recommended learning path
          </div>
          <ol className="space-y-3 text-sm">
            {p.recommended_path.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
                  {s.order ?? i + 1}
                </span>
                <div>
                  <div className="font-medium">{s.course_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.duration_weeks ? `${s.duration_weeks} weeks · ` : ""}{s.why}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {p.career_pathway?.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="label-eyebrow mb-3 flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5" /> Career pathway
          </div>
          <ul className="space-y-2 text-sm">
            {p.career_pathway.map((c, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border last:border-0 pb-2">
                <div>
                  <div className="font-medium">{c.role || c.stage}</div>
                  <div className="text-xs text-muted-foreground">{c.stage}</div>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">{c.horizon}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.proactive_alerts?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="label-eyebrow text-amber-700 mb-3 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" /> Proactive alerts
          </div>
          <ul className="space-y-1 text-xs text-amber-900">
            {p.proactive_alerts.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}
      {p.raw && <pre className="rounded-md border border-border p-3 text-xs whitespace-pre-wrap font-mono">{p.raw}</pre>}
    </>
  );
}
