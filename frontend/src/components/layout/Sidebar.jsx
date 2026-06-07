import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Network,
  Users,
  Sparkles,
  FileStack,
  GraduationCap,
  Compass,
  MessageSquareText,
  ClipboardCheck,
  Brain,
  BarChart3,
  Workflow,
  ShieldCheck,
  Scale,
  BookOpenCheck,
  Settings as SettingsIcon,
  FileText,
  UserPlus,
  SlidersHorizontal,
  Database,
  Award,
  Briefcase,
  Command,
  BookOpen,
  Search,
  HeartHandshake,
  Leaf,
  Rocket,
  CalendarClock,
  Wallet,
  BellRing,
  ClipboardList,
  ListChecks,
  BadgeCheck,
  X,
} from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useInstitution } from "../../context/InstitutionContext";
import { useAuth } from "../../context/AuthContext";
import { useTenantModules } from "../../lib/useTenantModules";

/**
 * Sidebar nav is grouped into logical sections to scale to 17+ destinations
 * without becoming a flat wall of links. Each group is independently role-gated
 * (any item with a `roles` whitelist is hidden if the current user isn't in it,
 * and an entire group hides if all its items become invisible).
 */
const NAV_GROUPS = [
  {
    label: "Overview",
    testid: "sidebar-group-overview",
    items: [
      { to: "/", icon: LayoutDashboard, key: "nav.dashboard", testid: "sidebar-nav-dashboard", end: true },
    ],
  },
  {
    label: "Configuration",
    testid: "sidebar-group-configuration",
    items: [
      { to: "/admin/modules", icon: SlidersHorizontal, key: "nav.platform_modules",
        testid: "sidebar-nav-platform-modules",
        roles: ["super_admin", "institution_admin"], label: "Platform Modules" },
      { to: "/institution-setup", icon: Building2, key: "nav.institution_setup", testid: "sidebar-nav-institution-setup" },
      { to: "/academic-structure", icon: Network, key: "nav.academic_structure", testid: "sidebar-nav-academic-structure", module: "NEXUS" },
      { to: "/users-roles", icon: Users, key: "nav.users_roles", testid: "sidebar-nav-users-roles" },
      { to: "/ai-use-cases", icon: Sparkles, key: "nav.ai_use_cases", testid: "sidebar-nav-ai-use-cases" },
      { to: "/onboarding", icon: Rocket, key: "nav.onboarding",
        testid: "sidebar-nav-onboarding",
        roles: ["super_admin", "institution_admin"], label: "Onboarding Wizard" },
    ],
  },
  {
    label: "Recruitment",
    testid: "sidebar-group-recruitment",
    items: [
      { to: "/enroll", icon: UserPlus, key: "nav.enroll_pipeline",
        testid: "sidebar-nav-enroll-pipeline", module: "ARISE",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager", "faculty", "instructor"],
        label: "Claros Enroll · Pipeline" },
      { to: "/enroll/analytics", icon: BarChart3, key: "nav.enroll_analytics",
        testid: "sidebar-nav-enroll-analytics", module: "ARISE",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager"],
        label: "Claros Enroll · Analytics" },
      { to: "/admissions", icon: ClipboardList, key: "nav.admissions", testid: "sidebar-nav-admissions",
        module: "ARISE", label: "Claros Enroll · Legacy Admissions" },
      { to: "/arise-console", icon: Sparkles, key: "nav.arise_console",
        testid: "sidebar-nav-arise-console",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager"],
        label: "Claros Enroll · Advanced Console" },
    ],
  },
  {
    label: "Academics",
    testid: "sidebar-group-academics",
    items: [
      { to: "/learn", icon: GraduationCap, key: "nav.learn", testid: "sidebar-nav-learn",
        module: "ILLUMINATE", label: "Claros Learn · LMS" },
      { to: "/illuminate", icon: BookOpen, key: "nav.illuminate", testid: "sidebar-nav-illuminate",
        module: "ILLUMINATE", label: "ILLUMINATE · Legacy" },
      { to: "/content-studio", icon: FileStack, key: "nav.content_studio", testid: "sidebar-nav-content-studio", module: "ILLUMINATE" },
      { to: "/assessments", icon: ClipboardCheck, key: "nav.assessments", testid: "sidebar-nav-assessments", module: "ILLUMINATE" },
      { to: "/ai-instructor", icon: GraduationCap, key: "nav.ai_instructor", testid: "sidebar-nav-ai-instructor", module: "VEDA" },
      { to: "/ai-advisor", icon: Compass, key: "nav.ai_advisor", testid: "sidebar-nav-ai-advisor", module: "VEDA" },
      { to: "/psychometrics", icon: Brain, key: "nav.psychometrics", testid: "sidebar-nav-psychometrics" },
    ],
  },
  {
    label: "Student Services",
    testid: "sidebar-group-student-services",
    items: [
      { to: "/core/dashboard", icon: LayoutDashboard, key: "nav.core_dashboard",
        testid: "sidebar-nav-core-dashboard", module: "NEXUS",
        label: "Claros Core · Dashboard" },
      { to: "/core/students", icon: Users, key: "nav.core_students",
        testid: "sidebar-nav-core-students", module: "NEXUS",
        roles: ["super_admin", "institution_admin", "registrar", "programme_manager", "faculty", "instructor", "hod", "dean"],
        label: "Claros Core · Students" },
      { to: "/core/attendance", icon: ClipboardCheck, key: "nav.core_attendance",
        testid: "sidebar-nav-core-attendance", module: "NEXUS",
        roles: ["super_admin", "institution_admin", "faculty", "instructor", "hod", "programme_manager", "registrar"],
        label: "Claros Core · Attendance" },
      { to: "/core/attendance/report", icon: BarChart3, key: "nav.core_attendance_report",
        testid: "sidebar-nav-core-attendance-report", module: "NEXUS",
        label: "Claros Core · Attendance Report" },
      { to: "/core/timetable", icon: CalendarClock, key: "nav.core_timetable",
        testid: "sidebar-nav-core-timetable", module: "NEXUS",
        label: "Claros Core · Timetable" },
      { to: "/core/fees", icon: Wallet, key: "nav.core_fees",
        testid: "sidebar-nav-core-fees", module: "NEXUS",
        label: "Claros Core · Fees" },
      { to: "/core/notices", icon: BellRing, key: "nav.core_notices",
        testid: "sidebar-nav-core-notices", module: "NEXUS",
        label: "Claros Core · Notices" },
      { to: "/nexus", icon: Database, key: "nav.nexus", testid: "sidebar-nav-nexus",
        module: "NEXUS",
        roles: ["super_admin", "institution_admin", "registrar", "programme_manager", "hostel_warden", "faculty", "hod"],
        label: "Claros Core · Legacy NEXUS" },
      { to: "/nexus-console", icon: Sparkles, key: "nav.nexus_console",
        testid: "sidebar-nav-nexus-console",
        roles: ["super_admin", "institution_admin", "registrar", "programme_manager", "hostel_warden"],
        label: "Claros Core · Advanced Console" },
      { to: "/student-assistant", icon: MessageSquareText, key: "nav.student_assistant", testid: "sidebar-nav-student-assistant", module: "PATHFINDER" },
      { to: "/ai", icon: Sparkles, key: "nav.claros_ai", testid: "sidebar-nav-claros-ai",
        module: "VEDA", label: "Claros AI · Chat" },
      { to: "/ai/knowledge", icon: BookOpen, key: "nav.claros_knowledge", testid: "sidebar-nav-claros-knowledge",
        module: "VEDA",
        roles: ["super_admin", "institution_admin", "faculty", "instructor", "registrar", "programme_manager", "compliance_officer", "ai_governance_admin"],
        label: "Claros AI · Knowledge Base" },
      { to: "/veda-console", icon: Sparkles, key: "nav.veda_console",
        testid: "sidebar-nav-veda-console",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "compliance_officer", "ai_governance_admin", "faculty", "instructor", "programme_manager"],
        label: "VEDA Console" },
    ],
  },
  {
    label: "Faculty & Research",
    testid: "sidebar-group-faculty-research",
    items: [
      { to: "/research", icon: Search, key: "nav.research", testid: "sidebar-nav-research",
        module: "PRISM", label: "Claros Research" },
      { to: "/people", icon: GraduationCap, key: "nav.people", testid: "sidebar-nav-people",
        module: "FACULTY", label: "Claros People · Faculty Dev" },
      { to: "/faculty-plus", icon: GraduationCap, key: "nav.faculty_plus", testid: "sidebar-nav-faculty-plus",
        module: "FACULTY", label: "FACULTY+ · Legacy" },
      { to: "/prism", icon: Search, key: "nav.prism", testid: "sidebar-nav-prism",
        module: "PRISM", label: "PRISM · Legacy" },
    ],
  },
  {
    label: "Career & Alumni",
    testid: "sidebar-group-career-alumni",
    items: [
      { to: "/launch", icon: Rocket, key: "nav.launch_dashboard",
        testid: "sidebar-nav-launch-dashboard", module: "ALUMNI360",
        label: "Claros Launch · Cockpit" },
      { to: "/launch/drives", icon: Briefcase, key: "nav.launch_drives",
        testid: "sidebar-nav-launch-drives", module: "ALUMNI360",
        label: "Claros Launch · Drives" },
      { to: "/launch/skills", icon: ListChecks, key: "nav.launch_skills",
        testid: "sidebar-nav-launch-skills", module: "ALUMNI360",
        roles: ["student"], label: "Claros Launch · Skills" },
      { to: "/launch/interview", icon: MessageSquareText, key: "nav.launch_interview",
        testid: "sidebar-nav-launch-interview", module: "ALUMNI360",
        roles: ["student"], label: "Claros Launch · Mock Interview" },
      { to: "/launch/admin", icon: BarChart3, key: "nav.launch_admin",
        testid: "sidebar-nav-launch-admin", module: "ALUMNI360",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager"],
        label: "Claros Launch · Admin Analytics" },
      { to: "/placements", icon: Briefcase, key: "nav.placements", testid: "sidebar-nav-placements",
        module: "PATHFINDER", label: "Claros Launch · Legacy Placements" },
      { to: "/alumni", icon: HeartHandshake, key: "nav.alumni", testid: "sidebar-nav-alumni",
        module: "ALUMNI360", label: "Claros Launch · Alumni Network" },
      { to: "/alumni-network", icon: Users, key: "nav.alumni_network", testid: "sidebar-nav-alumni-network",
        module: "ALUMNI360", label: "Claros Alumni · Network" },
    ],
  },
  {
    label: "Safety & Sustainability",
    testid: "sidebar-group-safety-sustainability",
    items: [
      { to: "/safe", icon: ShieldCheck, key: "nav.safe", testid: "sidebar-nav-safe",
        module: "GUARDIAN", label: "Claros Safe · Visitors & Incidents" },
      { to: "/green", icon: Leaf, key: "nav.green", testid: "sidebar-nav-green",
        module: "GREENIQ", label: "Claros Green · Sustainability" },
      { to: "/guardian", icon: ShieldCheck, key: "nav.guardian", testid: "sidebar-nav-guardian",
        module: "GUARDIAN", label: "GUARDIAN · Legacy" },
      { to: "/greeniq", icon: Leaf, key: "nav.greeniq", testid: "sidebar-nav-greeniq",
        module: "GREENIQ", label: "GREENIQ · Legacy" },
    ],
  },
  {
    label: "Strategy & Compliance",
    testid: "sidebar-group-strategy-compliance",
    items: [
      { to: "/insights", icon: Command, key: "nav.insights",
        testid: "sidebar-nav-insights", module: "COMMAND",
        roles: ["super_admin", "institution_admin"],
        label: "Claros Insights · Executive Center" },
      { to: "/analytics", icon: BarChart3, key: "nav.analytics", testid: "sidebar-nav-analytics", module: "COMMAND" },
      { to: "/command", icon: Command, key: "nav.command", testid: "sidebar-nav-command",
        module: "COMMAND", label: "Command · COMMAND" },
      { to: "/comply", icon: ShieldCheck, key: "nav.comply_dashboard",
        testid: "sidebar-nav-comply-dashboard", module: "COMPASS",
        label: "Claros Comply · NAAC Dashboard" },
      { to: "/comply/obe", icon: GraduationCap, key: "nav.comply_obe",
        testid: "sidebar-nav-comply-obe", module: "COMPASS",
        roles: ["super_admin", "institution_admin", "compliance_officer", "ai_governance_admin", "faculty", "instructor", "hod", "programme_manager"],
        label: "Claros Comply · OBE Framework" },
      { to: "/compass-aqar", icon: Award, key: "nav.compass_aqar", testid: "sidebar-nav-compass-aqar",
        module: "COMPASS", label: "Claros Comply · Legacy AQAR",
        roles: ["super_admin", "institution_admin", "compliance_officer", "ai_governance_admin"] },
      { to: "/compliance", icon: BadgeCheck, key: "nav.compliance", testid: "sidebar-nav-compliance",
        module: "COMPASS", label: "Claros Comply · Legacy Compliance" },
      { to: "/governance", icon: Scale, key: "nav.governance", testid: "sidebar-nav-governance",
        roles: ["super_admin", "institution_admin", "ai_governance_admin", "compliance_officer"],
        label: "AI Governance" },
      { to: "/workflows", icon: Workflow, key: "nav.workflows", testid: "sidebar-nav-workflows" },
    ],
  },
  {
    label: "Phase Closeout",
    testid: "sidebar-group-phase-closeout",
    items: [
      { to: "/phase1-complete", icon: Sparkles, key: "nav.phase1_complete",
        testid: "sidebar-nav-phase1-complete",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "compliance_officer", "ai_governance_admin", "faculty", "instructor"],
        label: "Phase 1 Closeout" },
      { to: "/phase2-complete", icon: Sparkles, key: "nav.phase2_complete",
        testid: "sidebar-nav-phase2-complete",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "compliance_officer", "ai_governance_admin", "faculty", "instructor", "programme_manager", "training_manager"],
        label: "Phase 2 Closeout" },
      { to: "/phase3-complete", icon: Sparkles, key: "nav.phase3_complete",
        testid: "sidebar-nav-phase3-complete",
        roles: ["super_admin", "institution_admin", "registrar", "compliance_officer", "ai_governance_admin", "programme_manager"],
        label: "Phase 3 Closeout" },
      { to: "/closeout-console", icon: Sparkles, key: "nav.closeout_console",
        testid: "sidebar-nav-closeout-console",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "compliance_officer", "ai_governance_admin", "programme_manager"],
        label: "Bulk Closeout" },
    ],
  },
  {
    label: "Help & System",
    testid: "sidebar-group-system",
    items: [
      { to: "/admin-guide", icon: BookOpenCheck, key: "nav.admin_guide",
        testid: "sidebar-nav-admin-guide",
        roles: ["super_admin", "institution_admin"], label: "Admin Guide" },
      { to: "/product-brief", icon: FileText, key: "nav.product_brief",
        testid: "sidebar-nav-product-brief",
        roles: ["super_admin", "institution_admin"], label: "Product Brief" },
      { to: "/settings", icon: SettingsIcon, key: "nav.settings", testid: "sidebar-nav-settings" },
    ],
  },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { t } = useLang();
  const { current } = useInstitution();
  const { user } = useAuth();
  const { statusOf } = useTenantModules();

  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.roles && !item.roles.includes(user?.role)) return false;
        // Hide nav entry when its module is `disabled` for this tenant.
        // `coming_soon` modules remain visible so users can discover the roadmap.
        if (item.module && statusOf(item.module) === "disabled") return false;
        return true;
      }).map((item) => ({
        ...item,
        _moduleStatus: item.module ? statusOf(item.module) : "active",
      })),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`sidebar-rail flex flex-col ${isOpen ? "is-open" : ""}`}
      data-testid="sidebar"
    >
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border" data-testid="sidebar-brand">
        {current?.logo_url ? (
          <img
            src={current.logo_url}
            alt={current.short_name || "Tenant logo"}
            className="h-9 w-9 rounded-md object-contain bg-white border border-border"
            data-testid="sidebar-tenant-logo"
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md font-semibold"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontFamily: "var(--font-heading)",
            }}
            data-testid="sidebar-brand-mark"
          >
            {current?.short_name?.[0] || "C"}
          </div>
        )}
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight text-foreground truncate">
            {current?.short_name || "Claros"}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Powered by Claros
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden rounded-md p-1.5 hover:bg-muted"
          aria-label="Close menu"
          data-testid="mobile-menu-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.testid} data-testid={group.testid}>
            <div className="label-eyebrow px-3 pb-2">{group.label}</div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    data-testid={item.testid}
                    className={({ isActive }) =>
                      [
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground",
                      ].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className="h-4 w-4 shrink-0"
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                        <span className="truncate flex-1">{item.label || t(item.key)}</span>
                        {item._moduleStatus === "coming_soon" && (
                          <span
                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-200"
                            data-testid={`sidebar-soon-${item.module}`}
                          >
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="dot-pulse" />
          <span>AI TRiSM · Policy active</span>
        </div>
        <div className="mt-1 tabular-nums">v0.1.0 · Phase 1+2</div>
      </div>
    </aside>
  );
}
