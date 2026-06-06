import React, { useEffect, useState } from "react";
import {
  Users2,
  GraduationCap,
  Briefcase,
  Award,
  Trophy,
  Building2,
  TrendingUp,
  ShieldCheck,
  ClipboardCheck,
  BookOpenCheck,
  Network,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "../layout/Shell";
import { Badge } from "../ui/badge";
import { Kpi, Panel, ItemList, MiniBar, PageLink } from "./widgets";
import { api } from "../../lib/api";

/**
 * Engineering College dashboard variant.
 * Optimised for the campus-placement-driven Indian engineering college persona:
 * placement-cell metrics are first-class citizens, branches replace
 * "programmes", and the Training & Placement Cell gets a dedicated panel.
 *
 * Triggered by `inst.type === "Engineering College"`.
 */
export function EngineeringCollegeDashboard({ inst, m, user }) {
  const [counts, setCounts] = useState({});
  const [departments, setDepartments] = useState([]);
  useEffect(() => {
    if (!inst) return;
    Promise.all([
      api.get(`/dashboard/${inst.id}`).then((r) => r.data?.counts || {}),
      api.get(`/academic/${inst.id}/departments`).then((r) => r.data || []),
    ])
      .then(([c, d]) => {
        setCounts(c);
        setDepartments(d);
      })
      .catch(() => {});
  }, [inst?.id]);

  const currency = inst.country === "India" ? "₹" : "US$";
  const highest = m.highest_package_lpa
    ? `${currency}${m.highest_package_lpa} LPA`
    : "—";
  const avg = m.average_package_lpa ? `${currency}${m.average_package_lpa} LPA` : "—";
  const employers = m.companies_recruiting ?? 0;
  const alumni = m.alumni_network ?? 0;
  const placement = m.placement_rate ?? null;

  // Real placement story straight from VCE site — usable as a generic
  // demo template for any Indian engineering college.
  const recruiters = [
    "Amazon", "RealPage", "Infosys", "HCL", "TCS", "FactSet",
    "Tech Mahindra", "Wipro", "Cognizant", "Celonis",
  ];

  const highlightOffers = [
    { name: "Manikanta T.", branch: "B.Tech CSE", company: "Amazon", pkg: "₹20 LPA" },
    { name: "Sriram", branch: "B.Tech CSE", company: "RealPage", pkg: "₹10.08 LPA" },
    { name: "Arjun K.", branch: "B.Tech CSE", company: "TCS", pkg: "₹7 LPA" },
    { name: "Priya R.", branch: "B.Tech ECE", company: "Infosys", pkg: "₹6.5 LPA" },
  ];

  return (
    <div data-testid="dashboard-engineering-college">
      <PageHeader
        eyebrow={`${inst.type} · Placement-first Cockpit`}
        title={`${inst.short_name} · Principal's View`}
        description={
          inst.description ||
          `Affiliated to ${inst.compliance_framework || "your university"}.`
        }
        actions={
          <>
            {placement != null && (
              <Badge variant="outline" className="gap-1.5">
                <Trophy className="h-3 w-3" />
                {placement}% placed
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> {(m.ai_sessions || 0).toLocaleString()} AI sessions
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {user?.role === "institution_admin" ? "Principal" : "Engineering College"}
            </Badge>
          </>
        }
      />

      <div className="p-6 lg:p-8 space-y-8">
        {/* Hero KPI strip — placement is the headline */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Placement rate"
            value={placement != null ? `${placement}%` : "—"}
            hint={alumni ? `${alumni.toLocaleString()}+ alumni network` : undefined}
            icon={Briefcase}
            trend="+4.6%"
            testid="eng-kpi-placement"
          />
          <Kpi
            label="Highest package"
            value={highest}
            hint={`Average ${avg}`}
            icon={Trophy}
            trend="+₹3.2 LPA YoY"
            testid="eng-kpi-highest"
          />
          <Kpi
            label="Recruiting companies"
            value={employers ? `${employers}+` : "—"}
            hint="Live cycle"
            icon={Building2}
            trend="+12"
            testid="eng-kpi-employers"
          />
          <Kpi
            label="Active students"
            value={(m.students || 0).toLocaleString()}
            hint={`${m.faculty || 0} faculty · ${m.completion_rate || 0}% completion`}
            icon={Users2}
            testid="eng-kpi-students"
          />
        </section>

        {/* Branches + Placement highlights */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Panel
            eyebrow="Branches"
            title="Department snapshot"
            testid="eng-departments"
            className="lg:col-span-3"
            action={<PageLink to="/academic-structure" label="Open structure" />}
          >
            {departments.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No departments seeded yet.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {departments.slice(0, 10).map((d) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0"
                  data-testid={`eng-dept-${d.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {d.head || "Head TBD"}
                    </div>
                  </div>
                  <Network className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow="Headline offers"
            title="Top placements · live cycle"
            testid="eng-offers"
            className="lg:col-span-2"
            action={<PageLink to="/" label="Career Services" />}
          >
            <ItemList
              testid="eng-offers-list"
              items={highlightOffers.map((o) => ({
                title: `${o.name} · ${o.branch}`,
                meta: o.company,
                right: o.pkg,
              }))}
            />
          </Panel>
        </section>

        {/* Recruiters logo wall (text-only for compliance with sourced data) */}
        <Panel
          eyebrow="Recruiter relationships"
          title="Companies recruiting this cycle"
          testid="eng-recruiters"
          action={
            <span className="text-xs text-muted-foreground">
              {employers}+ partners
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {recruiters.map((r) => (
              <span
                key={r}
                className="px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground/80"
              >
                {r}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground">
              + {Math.max(employers - recruiters.length, 0)} more
            </span>
          </div>
        </Panel>

        {/* Compliance / accreditation + cohort flow */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            eyebrow="Accreditation & compliance"
            title={inst.compliance_framework || "Compliance posture"}
            testid="eng-accreditation"
            action={<PageLink to="/compliance" label="Open audit" />}
          >
            {(inst.accreditation && inst.accreditation.length > 0
              ? inst.accreditation
              : [
                  "AICTE approved",
                  "Affiliated to JNTUH",
                  "NAAC 'A' Grade",
                  "NBA Accredited",
                  "UGC Recognised Autonomous",
                ]
            ).map((a) => (
              <div
                key={a}
                className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 text-sm"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{a}</span>
              </div>
            ))}
          </Panel>

          <Panel
            eyebrow="Programmes"
            title="Enrolment by branch (top 5)"
            testid="eng-enrolment"
          >
            {[
              ["B.Tech CSE", 720, 720],
              ["B.Tech CSE (AI & ML)", 480, 720],
              ["B.Tech ECE", 480, 720],
              ["B.Tech CSE (Data Science)", 360, 720],
              ["B.Tech Mechanical", 240, 720],
            ].map(([b, v, max]) => (
              <div key={b} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{b}</span>
                  <span className="text-muted-foreground tabular-nums">{v} learners</span>
                </div>
                <MiniBar value={v} max={max} />
              </div>
            ))}
          </Panel>
        </section>

        {/* Vision / Mission (institutional positioning) */}
        {inst.vision && (
          <Panel
            eyebrow="Institutional positioning"
            title="Vision & Mission"
            testid="eng-vision-mission"
          >
            <div className="space-y-4 text-sm">
              <div>
                <div className="label-eyebrow mb-1">Vision</div>
                <p className="text-foreground/85 leading-relaxed italic">
                  &ldquo;{inst.vision}&rdquo;
                </p>
              </div>
              {inst.mission && inst.mission.length > 0 && (
                <div>
                  <div className="label-eyebrow mb-1">Mission</div>
                  <ul className="space-y-1.5">
                    {inst.mission.map((m2, i) => (
                      <li key={i} className="flex gap-2 text-foreground/85 leading-relaxed">
                        <ClipboardCheck className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />
                        <span>{m2}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
