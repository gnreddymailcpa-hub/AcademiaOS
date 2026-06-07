import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "../ui/command";
import { Search } from "lucide-react";

/**
 * Cmd-K (Ctrl-K) command palette — fuzzy search over every sidebar
 * destination + recently-visited paths. Keyboard-first navigation for power
 * users (deans, registrars, principal).
 */

// All registered destinations — kept in sync with App.js routes.
const DESTINATIONS = [
  { label: "Dashboard",                path: "/",                    group: "Overview" },
  { label: "Platform Modules",         path: "/admin/modules",       group: "Configuration" },
  { label: "Institution Setup",        path: "/institution-setup",   group: "Configuration" },
  { label: "Academic Structure",       path: "/academic-structure",  group: "Configuration" },
  { label: "Users & Roles",            path: "/users-roles",         group: "Configuration" },
  { label: "AI Use Cases",             path: "/ai-use-cases",        group: "Configuration" },
  { label: "Onboarding Wizard",        path: "/onboarding",          group: "Configuration" },

  { label: "Admissions · ARISE",       path: "/admissions",          group: "Recruitment" },
  { label: "ARISE Console",            path: "/arise-console",       group: "Recruitment" },

  { label: "ILLUMINATE · LMS",         path: "/illuminate",          group: "Academics" },
  { label: "Content Studio",           path: "/content-studio",      group: "Academics" },
  { label: "Assessments",              path: "/assessments",         group: "Academics" },
  { label: "AI Instructor",            path: "/ai-instructor",       group: "Academics" },
  { label: "AI Advisor",               path: "/ai-advisor",          group: "Academics" },
  { label: "Psychometrics",            path: "/psychometrics",       group: "Academics" },

  { label: "NEXUS · Campus ERP",       path: "/nexus",               group: "Student Services" },
  { label: "NEXUS Console",            path: "/nexus-console",       group: "Student Services" },
  { label: "Student Assistant",        path: "/student-assistant",   group: "Student Services" },
  { label: "VEDA Console",             path: "/veda-console",        group: "Student Services" },

  { label: "FACULTY+ · Operations",    path: "/faculty-plus",        group: "Faculty & Research" },
  { label: "PRISM · Research",         path: "/prism",               group: "Faculty & Research" },

  { label: "Placements · PATHFINDER",  path: "/placements",          group: "Career & Alumni" },
  { label: "ALUMNI360 · Network",      path: "/alumni",              group: "Career & Alumni" },

  { label: "GUARDIAN · Safety",        path: "/guardian",            group: "Safety & Sustainability" },
  { label: "GREENIQ · Sustainability", path: "/greeniq",             group: "Safety & Sustainability" },

  { label: "Analytics",                path: "/analytics",           group: "Strategy & Compliance" },
  { label: "Command · COMMAND",        path: "/command",             group: "Strategy & Compliance" },
  { label: "NAAC AQAR · COMPASS",      path: "/compass-aqar",        group: "Strategy & Compliance" },
  { label: "Compliance",               path: "/compliance",          group: "Strategy & Compliance" },
  { label: "AI Governance",            path: "/governance",          group: "Strategy & Compliance" },
  { label: "Workflows",                path: "/workflows",           group: "Strategy & Compliance" },
  { label: "Executive Briefing",       path: "/exec-briefing",       group: "Strategy & Compliance" },

  { label: "Phase 1 Closeout",         path: "/phase1-complete",     group: "Phase Closeout" },
  { label: "Phase 2 Closeout",         path: "/phase2-complete",     group: "Phase Closeout" },
  { label: "Phase 3 Closeout",         path: "/phase3-complete",     group: "Phase Closeout" },
  { label: "Bulk Closeout",            path: "/closeout-console",    group: "Phase Closeout" },

  { label: "Admin Guide",              path: "/admin-guide",         group: "Help & System" },
  { label: "Product Brief",            path: "/product-brief",       group: "Help & System" },
  { label: "Settings",                 path: "/settings",            group: "Help & System" },
];

const RECENT_KEY = "academiaos.cmdk.recent";

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(path) {
  const cur = loadRecent().filter((p) => p !== path);
  cur.unshift(path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 6)));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  const go = (path) => {
    pushRecent(path);
    setOpen(false);
    navigate(path);
  };

  // Group destinations
  const grouped = DESTINATIONS.reduce((acc, d) => {
    (acc[d.group] = acc[d.group] || []).push(d);
    return acc;
  }, {});

  const recentDests = recent
    .map((p) => DESTINATIONS.find((d) => d.path === p))
    .filter(Boolean);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-lg hover:bg-accent hover:text-foreground transition-colors"
        data-testid="cmdk-trigger"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] tabular-nums">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} data-testid="cmdk-dialog">
        <CommandInput
          placeholder="Search anywhere — pages, modules, consoles…"
          data-testid="cmdk-input"
        />
        <CommandList data-testid="cmdk-list">
          <CommandEmpty>No matches.</CommandEmpty>

          {recentDests.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recentDests.map((d) => (
                  <CommandItem
                    key={`r-${d.path}`}
                    value={`recent ${d.label}`}
                    onSelect={() => go(d.path)}
                    data-testid={`cmdk-recent-${d.path.replace(/\//g, "-")}`}
                  >
                    {d.label}
                    <span className="ml-auto text-[10px] text-muted-foreground">{d.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((d) => (
                <CommandItem
                  key={d.path}
                  value={`${d.label} ${d.group}`}
                  onSelect={() => go(d.path)}
                  data-testid={`cmdk-item${d.path.replace(/\//g, "-")}`}
                >
                  {d.label}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {d.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
