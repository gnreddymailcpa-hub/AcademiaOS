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
    label: "Setup",
    testid: "sidebar-group-setup",
    items: [
      { to: "/admin/modules", icon: SlidersHorizontal, key: "nav.platform_modules",
        testid: "sidebar-nav-platform-modules",
        roles: ["super_admin", "institution_admin"], label: "Platform Modules" },
      { to: "/onboarding", icon: Rocket, key: "nav.onboarding",
        testid: "sidebar-nav-onboarding",
        roles: ["super_admin", "institution_admin"], label: "Onboarding Wizard" },
      { to: "/phase1-complete", icon: Sparkles, key: "nav.phase1_complete",
        testid: "sidebar-nav-phase1-complete",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "compliance_officer", "ai_governance_admin", "faculty", "instructor"],
        label: "Phase 1 Closeout" },
      { to: "/institution-setup", icon: Building2, key: "nav.institution_setup", testid: "sidebar-nav-institution-setup" },
      { to: "/academic-structure", icon: Network, key: "nav.academic_structure", testid: "sidebar-nav-academic-structure", module: "NEXUS" },
      { to: "/users-roles", icon: Users, key: "nav.users_roles", testid: "sidebar-nav-users-roles" },
      { to: "/ai-use-cases", icon: Sparkles, key: "nav.ai_use_cases", testid: "sidebar-nav-ai-use-cases" },
      { to: "/admissions", icon: UserPlus, key: "nav.admissions", testid: "sidebar-nav-admissions",
        module: "ARISE", label: "Admissions · ARISE" },
    ],
  },
  {
    label: "Campus Operations",
    testid: "sidebar-group-campus-ops",
    items: [
      { to: "/nexus", icon: Database, key: "nav.nexus", testid: "sidebar-nav-nexus",
        module: "NEXUS", label: "NEXUS · Campus ERP" },
      { to: "/placements", icon: Briefcase, key: "nav.placements", testid: "sidebar-nav-placements",
        module: "PATHFINDER", label: "Placements · PATHFINDER" },
      { to: "/guardian", icon: ShieldCheck, key: "nav.guardian", testid: "sidebar-nav-guardian",
        module: "GUARDIAN", label: "GUARDIAN · Safety" },
      { to: "/greeniq", icon: Leaf, key: "nav.greeniq", testid: "sidebar-nav-greeniq",
        module: "GREENIQ", label: "GREENIQ · Sustainability" },
    ],
  },
  {
    label: "AI Modules",
    testid: "sidebar-group-ai-modules",
    items: [
      { to: "/illuminate", icon: BookOpen, key: "nav.illuminate", testid: "sidebar-nav-illuminate",
        module: "ILLUMINATE", label: "ILLUMINATE · LMS" },
      { to: "/content-studio", icon: FileStack, key: "nav.content_studio", testid: "sidebar-nav-content-studio", module: "ILLUMINATE" },
      { to: "/ai-instructor", icon: GraduationCap, key: "nav.ai_instructor", testid: "sidebar-nav-ai-instructor", module: "VEDA" },
      { to: "/ai-advisor", icon: Compass, key: "nav.ai_advisor", testid: "sidebar-nav-ai-advisor", module: "VEDA" },
      { to: "/student-assistant", icon: MessageSquareText, key: "nav.student_assistant", testid: "sidebar-nav-student-assistant", module: "PATHFINDER" },
      { to: "/assessments", icon: ClipboardCheck, key: "nav.assessments", testid: "sidebar-nav-assessments", module: "ILLUMINATE" },
      { to: "/psychometrics", icon: Brain, key: "nav.psychometrics", testid: "sidebar-nav-psychometrics" },
    ],
  },
  {
    label: "People & Engagement",
    testid: "sidebar-group-people",
    items: [
      { to: "/faculty-plus", icon: GraduationCap, key: "nav.faculty_plus", testid: "sidebar-nav-faculty-plus",
        module: "FACULTY", label: "FACULTY+ · Operations" },
      { to: "/alumni", icon: HeartHandshake, key: "nav.alumni", testid: "sidebar-nav-alumni",
        module: "ALUMNI360", label: "ALUMNI360 · Network" },
    ],
  },
  {
    label: "Operations",
    testid: "sidebar-group-operations",
    items: [
      { to: "/analytics", icon: BarChart3, key: "nav.analytics", testid: "sidebar-nav-analytics", module: "COMMAND" },
      { to: "/command", icon: Command, key: "nav.command", testid: "sidebar-nav-command",
        module: "COMMAND", label: "Command · COMMAND" },
      { to: "/workflows", icon: Workflow, key: "nav.workflows", testid: "sidebar-nav-workflows" },
    ],
  },
  {
    label: "Governance",
    testid: "sidebar-group-governance",
    items: [
      {
        to: "/governance",
        icon: Scale,
        key: "nav.governance",
        testid: "sidebar-nav-governance",
        roles: ["super_admin", "institution_admin", "ai_governance_admin", "compliance_officer"],
        label: "AI Governance",
      },
      { to: "/compliance", icon: ShieldCheck, key: "nav.compliance", testid: "sidebar-nav-compliance", module: "COMPASS" },
      { to: "/compass-aqar", icon: Award, key: "nav.compass_aqar", testid: "sidebar-nav-compass-aqar",
        module: "COMPASS", label: "NAAC AQAR · COMPASS",
        roles: ["super_admin", "institution_admin", "compliance_officer", "ai_governance_admin"] },
      { to: "/prism", icon: Search, key: "nav.prism", testid: "sidebar-nav-prism",
        module: "PRISM", label: "PRISM · Research" },
    ],
  },
  {
    label: "Help & System",
    testid: "sidebar-group-system",
    items: [
      {
        to: "/admin-guide",
        icon: BookOpenCheck,
        key: "nav.admin_guide",
        testid: "sidebar-nav-admin-guide",
        roles: ["super_admin", "institution_admin"],
        label: "Admin Guide",
      },
      {
        to: "/product-brief",
        icon: FileText,
        key: "nav.product_brief",
        testid: "sidebar-nav-product-brief",
        roles: ["super_admin", "institution_admin"],
        label: "Product Brief",
      },
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
            {current?.short_name?.[0] || "A"}
          </div>
        )}
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight text-foreground truncate">
            {current?.short_name || "AcademiaOS"}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Powered by AcademiaOS
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
