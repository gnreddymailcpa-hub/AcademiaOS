import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  Building2,
  CalendarClock,
  BellRing,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AttendanceDonut({ pct }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.max(0, Math.min(100, pct || 0));
  const offset = circumference - (safePct / 100) * circumference;
  const color =
    safePct >= 75 ? "hsl(142, 71%, 45%)" :
    safePct >= 60 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  return (
    <div className="relative" data-testid="core-attendance-donut">
      <svg width="92" height="92">
        <circle cx="46" cy="46" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="46" cy="46" r={radius} fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 46 46)"
        />
        <text x="46" y="50" textAnchor="middle" className="text-base font-semibold fill-foreground">
          {safePct.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value ?? "—"}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ClarosCoreDashboard() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [data, setData] = useState({ stats: null, notices: [], timetable: [], me: null, attendance: null });
  const [loading, setLoading] = useState(true);

  const isStudent = user?.role === "student";
  const isFaculty = ["faculty", "instructor", "hod"].includes(user?.role);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const requests = [
        api.get(`/v1/core/notices`).then(r => r.data).catch(() => ({ items: [] })),
        api.get(`/v1/core/timetable/me`).then(r => r.data).catch(() => ({ slots: [] })),
      ];
      if (!isStudent) {
        requests.push(api.get(`/v1/core/stats`).then(r => r.data).catch(() => null));
      } else {
        requests.push(Promise.resolve(null));
      }
      if (isStudent) {
        requests.push(api.get(`/v1/core/students/me`).then(r => r.data).catch(() => null));
        requests.push(api.get(`/v1/core/attendance/summary/me`).then(r => r.data).catch(() => null));
      }
      const [notices, timetable, stats, me, attendance] = await Promise.all(requests);
      setData({ notices: notices?.items || [], timetable: timetable?.slots || [], stats, me, attendance });
    } finally {
      setLoading(false);
    }
  }, [current, isStudent]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  const todayDow = (new Date().getDay() + 6) % 7; // Mon=0
  const todaysClasses = data.timetable.filter(s => s.day_of_week === todayDow);

  return (
    <div data-testid="claros-core-dashboard">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Dashboard"
        description={
          isStudent ? "Your attendance, today's classes, fees and notices." :
          isFaculty ? "Today's classes, attendance marking, and notice board." :
          `Operations cockpit for ${current.short_name || current.name}.`
        }
        actions={
          <div className="flex items-center gap-2">
            {isFaculty && (
              <Button asChild size="sm" data-testid="core-mark-attendance-btn">
                <Link to="/core/attendance"><ClipboardList className="h-3.5 w-3.5 me-1.5" />Mark Attendance</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" data-testid="core-students-link">
              <Link to="/core/students"><Users className="h-3.5 w-3.5 me-1.5" />Students</Link>
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* ----- Admin KPI strip ----- */}
        {!isStudent && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="core-kpi-strip">
            <KpiCard icon={Users} label="Active Students" value={data.stats?.total_students} testid="kpi-students" />
            <KpiCard icon={GraduationCap} label="Faculty" value={data.stats?.total_faculty} testid="kpi-faculty" />
            <KpiCard icon={CalendarCheck} label="Avg Attendance"
              value={data.stats ? `${data.stats.avg_attendance_pct}%` : null} testid="kpi-attendance" />
            <KpiCard icon={Wallet} label="Fee Collection"
              value={data.stats?.fee_collection_pct ? `${data.stats.fee_collection_pct}%` : "—"} testid="kpi-fees" />
            <KpiCard icon={Building2} label="Departments" value={data.stats?.departments_count} testid="kpi-depts" />
            <KpiCard icon={CalendarClock} label="Year" value={data.stats?.current_year} testid="kpi-year" />
          </div>
        )}

        {/* ----- Student attendance summary ----- */}
        {isStudent && data.attendance && (
          <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-6" data-testid="core-student-attendance-card">
            <AttendanceDonut pct={data.attendance.overall?.pct} />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Overall attendance · current semester</div>
              <div className="text-3xl font-semibold tracking-tight mt-1">
                {data.attendance.overall?.present} / {data.attendance.overall?.total} classes
              </div>
              <Link to="/core/attendance/report" className="text-xs text-primary hover:underline mt-2 inline-block">
                See per-course breakdown →
              </Link>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1 text-xs">
              <div className="text-muted-foreground">CGPA</div>
              <div className="text-xl font-semibold">{data.me?.cgpa?.toFixed(2) || "—"}</div>
              <div className="text-muted-foreground mt-1">Semester {data.me?.current_semester || "—"}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* ----- Today's classes ----- */}
          <div className="col-span-12 lg:col-span-7">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h3 className="font-semibold tracking-tight text-sm">
                  Today&apos;s Classes · {DAY_LABELS[todayDow] || "Sun"}
                </h3>
                <Badge variant="outline" className="ms-auto text-[10px]">{todaysClasses.length}</Badge>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : todaysClasses.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground" data-testid="core-no-classes-today">
                  No classes scheduled for today. Enjoy the day.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {todaysClasses.map((s) => (
                    <li key={s.id} className="px-5 py-3 flex items-center gap-3" data-testid={`core-class-${s.id}`}>
                      <div className="w-24 text-xs font-mono text-muted-foreground tabular-nums">
                        {s.start_time} – {s.end_time}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{s.course_code} · {s.course_name}</div>
                        <div className="text-[11px] text-muted-foreground">Room {s.room}</div>
                      </div>
                      {isFaculty && (
                        <Button asChild variant="ghost" size="sm" className="text-[11px]">
                          <Link to={`/core/attendance?course=${s.course_id}`}>Mark</Link>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ----- Notices ----- */}
          <div className="col-span-12 lg:col-span-5">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <BellRing className="h-4 w-4 text-primary" />
                <h3 className="font-semibold tracking-tight text-sm">Recent Notices</h3>
                <Button asChild variant="ghost" size="sm" className="ms-auto text-[11px]" data-testid="core-all-notices-link">
                  <Link to="/core/notices">View all →</Link>
                </Button>
              </div>
              {data.notices.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No notices.</div>
              ) : (
                <ul className="divide-y divide-border" data-testid="core-notice-list-summary">
                  {data.notices.slice(0, 4).map((n) => (
                    <li key={n.id} className="px-5 py-3" data-testid={`core-notice-${n.id}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[9px]">{n.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {n.published_at && new Date(n.published_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ----- Student fee alert ----- */}
        {isStudent && data.me?.fees && data.me.fees.balance > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-center gap-3" data-testid="core-fee-alert">
            <Wallet className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-medium text-sm">Outstanding fee balance: ₹{data.me.fees.balance.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Status: {data.me.fees.status}</div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/core/fees">View fees</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
