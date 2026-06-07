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
  Palette,
  FileText,
  UserPlus,
  Briefcase,
  Command,
  BookOpen,
  Search,
  Leaf,
  Rocket,
  CalendarClock,
  Wallet,
  BellRing,
  ListChecks,
  X,
} from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useInstitution } from "../../context/InstitutionContext";
import { useAuth } from "../../context/AuthContext";
import { useTenantModules } from "../../lib/useTenantModules";
import { useModuleName, useTenantConfig } from "../../context/TenantConfigContext";

// Per-item label resolver — items inside a Claros-module group rely on the
// group header for the module brand, so their labels are intentionally short
// (e.g. "Chat", "Knowledge Base"). Items without a parent module group keep
// their static label.
function SidebarItemLabel({ item, fallbackLabel }) {
  return <span className="truncate flex-1">{fallbackLabel}</span>;
}

// Group header — for Claros-module groups, resolves the tenant-configured
// display name (e.g. "VEDA" for VCE, "Claros AI" by default). For static
// utility groups (Overview, Setup, Help), renders the literal label.
function GroupLabel({ group }) {
  const resolved = useModuleName(group.canonicalId || "");
  if (group.canonicalId) return resolved;
  return group.label;
}

/**
 * Sidebar nav is grouped per **canonical Claros module** so that every
 * destination lives under the same brand its tenant has configured. Group
 * headers re-render automatically when a tenant rebrands (e.g. "Claros AI"
 * → "VEDA" for VCE).
 *
 * Four utility groups (Overview, Setup & Configuration, Phase Closeout,
 * Help & System) sit alongside the 12 module groups for app-wide chrome.
 *
 * Each item is independently role-gated (`roles` whitelist) and module-gated
 * (`module` key resolved via `useTenantModules`). A whole group hides when
 * all its items resolve to hidden.
 */
const NAV_GROUPS = [
  // -------------------------------------------------------------------------
  // Utility groups
  // -------------------------------------------------------------------------
  {
    label: "Overview",
    testid: "sidebar-group-overview",
    items: [
      { to: "/", icon: LayoutDashboard, key: "nav.dashboard", testid: "sidebar-nav-dashboard", end: true },
    ],
  },
  {
    label: "Setup & Configuration",
    testid: "sidebar-group-configuration",
    items: [
      { to: "/admin/tenant-config", icon: Palette, key: "nav.tenant_config",
        testid: "sidebar-nav-tenant-config",
        roles: ["super_admin", "institution_admin"],
        label: "Branding & Module Names" },
      { to: "/institution-setup", icon: Building2, key: "nav.institution_setup", testid: "sidebar-nav-institution-setup" },
      { to: "/academic-structure", icon: Network, key: "nav.academic_structure", testid: "sidebar-nav-academic-structure", module: "NEXUS" },
      { to: "/users-roles", icon: Users, key: "nav.users_roles", testid: "sidebar-nav-users-roles" },
      { to: "/ai-use-cases", icon: Sparkles, key: "nav.ai_use_cases", testid: "sidebar-nav-ai-use-cases" },
      { to: "/onboarding", icon: Rocket, key: "nav.onboarding",
        testid: "sidebar-nav-onboarding",
        roles: ["super_admin", "institution_admin"], label: "Onboarding Wizard" },
    ],
  },

  // -------------------------------------------------------------------------
  // Claros canonical modules (one group each — group label rebrands per tenant)
  // -------------------------------------------------------------------------
  {
    canonicalId: "claros-insights",
    testid: "sidebar-group-claros-insights",
    items: [
      { to: "/insights", icon: Command, testid: "sidebar-nav-insights", module: "COMMAND",
        roles: ["super_admin", "institution_admin"], label: "Executive Center" },
      { to: "/analytics", icon: BarChart3, testid: "sidebar-nav-analytics", module: "COMMAND",
        label: "Analytics" },
      { to: "/command", icon: Command, testid: "sidebar-nav-command", module: "COMMAND",
        label: "Command Centre" },
    ],
  },
  {
    canonicalId: "claros-ai",
    testid: "sidebar-group-claros-ai",
    items: [
      { to: "/ai", icon: Sparkles, testid: "sidebar-nav-claros-ai", module: "VEDA",
        label: "Chat" },
      { to: "/ai/knowledge", icon: BookOpen, testid: "sidebar-nav-claros-knowledge", module: "VEDA",
        roles: ["super_admin", "institution_admin", "faculty", "instructor", "registrar", "programme_manager", "compliance_officer", "ai_governance_admin"],
        label: "Knowledge Base" },
      { to: "/student-assistant", icon: MessageSquareText, testid: "sidebar-nav-student-assistant", module: "PATHFINDER",
        label: "Student Assistant" },
    ],
  },
  {
    canonicalId: "claros-enroll",
    testid: "sidebar-group-claros-enroll",
    items: [
      { to: "/enroll", icon: UserPlus, testid: "sidebar-nav-enroll-pipeline", module: "ARISE",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager", "faculty", "instructor"],
        label: "Pipeline" },
      { to: "/enroll/analytics", icon: BarChart3, testid: "sidebar-nav-enroll-analytics", module: "ARISE",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager"],
        label: "Analytics" },
    ],
  },
  {
    canonicalId: "claros-core",
    testid: "sidebar-group-claros-core",
    items: [
      { to: "/core/dashboard", icon: LayoutDashboard, testid: "sidebar-nav-core-dashboard", module: "NEXUS",
        label: "Dashboard" },
      { to: "/core/students", icon: Users, testid: "sidebar-nav-core-students", module: "NEXUS",
        roles: ["super_admin", "institution_admin", "registrar", "programme_manager", "faculty", "instructor", "hod", "dean"],
        label: "Students" },
      { to: "/core/attendance", icon: ClipboardCheck, testid: "sidebar-nav-core-attendance", module: "NEXUS",
        roles: ["super_admin", "institution_admin", "faculty", "instructor", "hod", "programme_manager", "registrar"],
        label: "Attendance" },
      { to: "/core/attendance/report", icon: BarChart3, testid: "sidebar-nav-core-attendance-report", module: "NEXUS",
        label: "Attendance Report" },
      { to: "/core/timetable", icon: CalendarClock, testid: "sidebar-nav-core-timetable", module: "NEXUS",
        label: "Timetable" },
      { to: "/core/fees", icon: Wallet, testid: "sidebar-nav-core-fees", module: "NEXUS",
        label: "Fees" },
      { to: "/core/notices", icon: BellRing, testid: "sidebar-nav-core-notices", module: "NEXUS",
        label: "Notices" },
    ],
  },
  {
    canonicalId: "claros-learn",
    testid: "sidebar-group-claros-learn",
    items: [
      { to: "/learn", icon: GraduationCap, testid: "sidebar-nav-learn", module: "ILLUMINATE",
        label: "LMS" },
      { to: "/content-studio", icon: FileStack, testid: "sidebar-nav-content-studio", module: "ILLUMINATE",
        label: "Content Studio" },
      { to: "/assessments", icon: ClipboardCheck, testid: "sidebar-nav-assessments", module: "ILLUMINATE",
        label: "Assessments" },
      { to: "/psychometrics", icon: Brain, testid: "sidebar-nav-psychometrics",
        label: "Psychometrics" },
    ],
  },
  {
    canonicalId: "claros-launch",
    testid: "sidebar-group-claros-launch",
    items: [
      { to: "/launch", icon: Rocket, testid: "sidebar-nav-launch-dashboard", module: "ALUMNI360",
        label: "Cockpit" },
      { to: "/launch/drives", icon: Briefcase, testid: "sidebar-nav-launch-drives", module: "ALUMNI360",
        label: "Drives" },
      { to: "/launch/skills", icon: ListChecks, testid: "sidebar-nav-launch-skills", module: "ALUMNI360",
        roles: ["student"], label: "Skills" },
      { to: "/launch/interview", icon: MessageSquareText, testid: "sidebar-nav-launch-interview", module: "ALUMNI360",
        roles: ["student"], label: "Mock Interview" },
      { to: "/launch/admin", icon: BarChart3, testid: "sidebar-nav-launch-admin", module: "ALUMNI360",
        roles: ["super_admin", "institution_admin", "registrar", "career_services", "programme_manager"],
        label: "Admin Analytics" },
    ],
  },
  {
    canonicalId: "claros-research",
    testid: "sidebar-group-claros-research",
    items: [
      { to: "/research", icon: Search, testid: "sidebar-nav-research", module: "PRISM",
        label: "Research" },
    ],
  },
  {
    canonicalId: "claros-people",
    testid: "sidebar-group-claros-people",
    items: [
      { to: "/people", icon: GraduationCap, testid: "sidebar-nav-people", module: "FACULTY",
        label: "Faculty Development" },
    ],
  },
  {
    canonicalId: "claros-alumni",
    testid: "sidebar-group-claros-alumni",
    items: [
      { to: "/alumni-network", icon: Users, testid: "sidebar-nav-alumni-network", module: "ALUMNI360",
        label: "Network" },
    ],
  },
  {
    canonicalId: "claros-safe",
    testid: "sidebar-group-claros-safe",
    items: [
      { to: "/safe", icon: ShieldCheck, testid: "sidebar-nav-safe", module: "GUARDIAN",
        label: "Visitors & Incidents" },
    ],
  },
  {
    canonicalId: "claros-green",
    testid: "sidebar-group-claros-green",
    items: [
      { to: "/green", icon: Leaf, testid: "sidebar-nav-green", module: "GREENIQ",
        label: "Sustainability" },
    ],
  },
  {
    canonicalId: "claros-comply",
    testid: "sidebar-group-claros-comply",
    items: [
      { to: "/comply", icon: ShieldCheck, testid: "sidebar-nav-comply-dashboard", module: "COMPASS",
        label: "NAAC Dashboard" },
      { to: "/comply/obe", icon: GraduationCap, testid: "sidebar-nav-comply-obe", module: "COMPASS",
        roles: ["super_admin", "institution_admin", "compliance_officer", "ai_governance_admin", "faculty", "instructor", "hod", "programme_manager"],
        label: "OBE Framework" },
      { to: "/governance", icon: Scale, testid: "sidebar-nav-governance",
        roles: ["super_admin", "institution_admin", "ai_governance_admin", "compliance_officer"],
        label: "AI Governance" },
      { to: "/workflows", icon: Workflow, key: "nav.workflows", testid: "sidebar-nav-workflows",
        label: "Workflows" },
    ],
  },

  // -------------------------------------------------------------------------
  // Utility footer
  // -------------------------------------------------------------------------
  {
    label: "Help & System",
    testid: "sidebar-group-system",
    items: [
      { to: "/admin-guide", icon: BookOpenCheck, testid: "sidebar-nav-admin-guide",
        roles: ["super_admin", "institution_admin"], label: "Admin Guide" },
      { to: "/product-brief", icon: FileText, testid: "sidebar-nav-product-brief",
        roles: ["super_admin", "institution_admin"], label: "Product Brief" },
      { to: "/settings", icon: SettingsIcon, key: "nav.settings", testid: "sidebar-nav-settings",
        label: "Settings" },
    ],
  },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { t } = useLang();
  const { config: tenantConfig } = useTenantConfig();
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
          <div className="text-sm font-semibold tracking-tight text-foreground truncate" data-testid="sidebar-tenant-name">
            {tenantConfig?.platform_display_name || current?.short_name || "Claros"}
          </div>
          {(tenantConfig?.powered_by_label ?? "Powered by Claros") && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground" data-testid="sidebar-powered-by">
              {tenantConfig?.powered_by_label ?? "Powered by Claros"}
            </div>
          )}
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

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.testid} data-testid={group.testid}>
            <div className="label-eyebrow px-3 pb-2">
              <GroupLabel group={group} />
            </div>
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
                        <SidebarItemLabel item={item} fallbackLabel={item.label || (item.key ? t(item.key) : "")} />
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
