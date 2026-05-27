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
  Settings as SettingsIcon,
} from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useInstitution } from "../../context/InstitutionContext";
import { X } from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, key: "nav.dashboard", testid: "sidebar-nav-dashboard", end: true },
  { to: "/institution-setup", icon: Building2, key: "nav.institution_setup", testid: "sidebar-nav-institution-setup" },
  { to: "/academic-structure", icon: Network, key: "nav.academic_structure", testid: "sidebar-nav-academic-structure" },
  { to: "/users-roles", icon: Users, key: "nav.users_roles", testid: "sidebar-nav-users-roles" },
  { to: "/ai-use-cases", icon: Sparkles, key: "nav.ai_use_cases", testid: "sidebar-nav-ai-use-cases" },
  { to: "/content-studio", icon: FileStack, key: "nav.content_studio", testid: "sidebar-nav-content-studio" },
  { to: "/ai-instructor", icon: GraduationCap, key: "nav.ai_instructor", testid: "sidebar-nav-ai-instructor" },
  { to: "/ai-advisor", icon: Compass, key: "nav.ai_advisor", testid: "sidebar-nav-ai-advisor" },
  { to: "/student-assistant", icon: MessageSquareText, key: "nav.student_assistant", testid: "sidebar-nav-student-assistant" },
  { to: "/assessments", icon: ClipboardCheck, key: "nav.assessments", testid: "sidebar-nav-assessments" },
  { to: "/psychometrics", icon: Brain, key: "nav.psychometrics", testid: "sidebar-nav-psychometrics" },
  { to: "/analytics", icon: BarChart3, key: "nav.analytics", testid: "sidebar-nav-analytics" },
  { to: "/workflows", icon: Workflow, key: "nav.workflows", testid: "sidebar-nav-workflows" },
  { to: "/compliance", icon: ShieldCheck, key: "nav.compliance", testid: "sidebar-nav-compliance" },
  { to: "/settings", icon: SettingsIcon, key: "nav.settings", testid: "sidebar-nav-settings" },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { t } = useLang();
  const { current } = useInstitution();

  return (
    <aside
      className={`sidebar-rail flex flex-col ${isOpen ? "is-open" : ""}`}
      data-testid="sidebar"
    >
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md font-semibold"
          style={{
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontFamily: "var(--font-heading)",
          }}
          data-testid="brand-mark"
        >
          A
        </div>
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight text-foreground">AcademiaOS</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {current?.short_name || "Platform"} · Tenant
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

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="label-eyebrow px-3 pb-2">Navigation</div>
        <ul className="space-y-0.5">
          {NAV.map((item) => (
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
                    <span className="truncate">{t(item.key)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="dot-pulse" />
          <span>AI TRiSM · Policy active</span>
        </div>
        <div className="mt-1 font-mono">v0.1.0 · Phase 1+2</div>
      </div>
    </aside>
  );
}
