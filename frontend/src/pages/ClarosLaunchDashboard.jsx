import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Rocket, Briefcase, Zap, ListChecks, MessageCircle, BarChart3 } from "lucide-react";

function ReadinessRing({ score }) {
  const r = 60, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, score || 0));
  const off = c - (p / 100) * c;
  const color = p >= 70 ? "hsl(142,71%,45%)" : p >= 50 ? "hsl(38,92%,50%)" : "hsl(0,84%,60%)";
  return (
    <svg width="160" height="160" data-testid="launch-readiness-ring">
      <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
      <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 80 80)" />
      <text x="80" y="84" textAnchor="middle" style={{ fontSize: "30px", fontWeight: 600, fill: "currentColor" }}>{p.toFixed(0)}</text>
      <text x="80" y="104" textAnchor="middle" style={{ fontSize: "9px", letterSpacing: "1.5px", textTransform: "uppercase", fill: "currentColor", opacity: 0.6 }}>readiness</text>
    </svg>
  );
}

export default function ClarosLaunchDashboard() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [data, setData] = useState({ readiness: null, drives: [], apps: [], gaps: [] });
  const isStudent = user?.role === "student";

  const load = useCallback(async () => {
    if (!current) return;
    if (!isStudent) {
      // admin/faculty land on stats panel
      try {
        const { data: s } = await api.get(`/v1/launch/stats`);
        setData(d => ({ ...d, stats: s }));
      } catch {}
      return;
    }
    try {
      const [r, dr, ap] = await Promise.all([
        api.get(`/v1/launch/readiness-score`).then(r => r.data).catch(() => null),
        api.get(`/v1/launch/drives?status=UPCOMING`).then(r => r.data).catch(() => ({items:[]})),
        api.get(`/v1/launch/applications/me`).then(r => r.data).catch(() => ({items:[]})),
      ]);
      setData(d => ({ ...d, readiness: r, drives: dr.items || [], apps: ap.items || [] }));
      // Skill gaps via Claude — defer (slow, can be 5-15s)
      api.get(`/v1/launch/skills/gaps`).then(r => r.data).catch(() => ({items:[]}))
        .then(gp => setData(d => ({ ...d, gaps: gp.items || [] })));
    } catch {}
  }, [current, isStudent]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;
  return (
    <div data-testid="claros-launch-dashboard-page">
      <PageHeader
        eyebrow="Claros Launch · Career & Placement"
        title="Placement Cockpit"
        description={isStudent ? "Your readiness, upcoming drives, applications, and AI-identified skill gaps." : "Institution-wide placement analytics."}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/launch/drives" data-testid="launch-drives-link"><Briefcase className="h-3.5 w-3.5 me-1.5" />Drives</Link></Button>
            {isStudent && <Button asChild variant="outline" size="sm"><Link to="/launch/skills" data-testid="launch-skills-link"><ListChecks className="h-3.5 w-3.5 me-1.5" />Skills</Link></Button>}
            {isStudent && <Button asChild size="sm"><Link to="/launch/interview" data-testid="launch-interview-link"><MessageCircle className="h-3.5 w-3.5 me-1.5" />Mock Interview</Link></Button>}
            {!isStudent && <Button asChild variant="outline" size="sm"><Link to="/launch/admin" data-testid="launch-admin-link"><BarChart3 className="h-3.5 w-3.5 me-1.5" />Admin Analytics</Link></Button>}
          </div>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        {isStudent ? (
          <>
            <div className="rounded-lg border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="flex justify-center"><ReadinessRing score={data.readiness?.score} /></div>
              <div className="md:col-span-2 grid grid-cols-2 gap-3" data-testid="launch-readiness-breakdown">
                {data.readiness?.breakdown && Object.entries(data.readiness.breakdown).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border p-3" data-testid={`launch-breakdown-${k}`}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace('_', ' ')}</div>
                    <div className="text-xl font-semibold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card title="Upcoming drives" count={data.drives.length} icon={Briefcase} link="/launch/drives" testid="launch-card-drives">
                {data.drives.slice(0, 3).map(d => (
                  <div key={d.id} className="text-sm" data-testid={`launch-summary-drive-${d.id}`}>
                    <div className="font-medium">{d.company_name}</div>
                    <div className="text-[11px] text-muted-foreground">{d.job_role} · ₹{d.package_offered}L · {d.drive_date}</div>
                  </div>
                ))}
              </Card>
              <Card title="My applications" count={data.apps.length} icon={Zap} link="/launch/drives" testid="launch-card-apps">
                {data.apps.length === 0 ? <div className="text-xs text-muted-foreground">No applications yet.</div> :
                 data.apps.slice(0, 3).map(a => (
                  <div key={a.id} className="text-sm" data-testid={`launch-summary-app-${a.id}`}>
                    <div className="font-medium">{a.company_name}</div>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{a.status}</Badge>
                  </div>
                ))}
              </Card>
              <Card title="Top skill gaps" count={data.gaps.length} icon={ListChecks} link="/launch/skills" testid="launch-card-gaps">
                {data.gaps.length === 0 ? <div className="text-xs text-muted-foreground">Click Analyse Gaps in Skills.</div> :
                 data.gaps.slice(0, 3).map((g, i) => (
                  <div key={i} className="text-sm" data-testid={`launch-summary-gap-${i}`}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={g.urgency === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">{g.urgency}</Badge>
                      <span className="font-medium">{g.skill}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Rocket className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Admin Cockpit</h3>
            <p className="text-sm text-muted-foreground mb-4">View placement statistics, top recruiters and trends.</p>
            <Button asChild><Link to="/launch/admin">Open Analytics</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, count, icon: Icon, link, testid, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-3.5 w-3.5 text-primary" />{title}</div>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-2.5">{children}</div>
      <Link to={link} className="text-[11px] text-primary mt-3 inline-block">View all →</Link>
    </div>
  );
}
