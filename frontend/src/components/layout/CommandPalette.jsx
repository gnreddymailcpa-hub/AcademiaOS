import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "../ui/command";
import { Search, Zap } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogTitle, DialogDescription } from "../ui/dialog";
import { toast } from "sonner";
import { useInstitution } from "../../context/InstitutionContext";
import { api, formatApiError } from "../../lib/api";

/**
 * Cmd-K (Ctrl-K) command palette — fuzzy search over every sidebar
 * destination + recently-visited paths. Keyboard-first navigation for power
 * users (deans, registrars, principal).
 */

// All registered destinations — kept in sync with App.js routes (canonical Claros).
const DESTINATIONS = [
  { label: "Dashboard",                path: "/",                    group: "Overview" },
  { label: "Branding & Module Names",  path: "/admin/tenant-config", group: "Configuration" },
  { label: "Institution Setup",        path: "/institution-setup",   group: "Configuration" },
  { label: "Academic Structure",       path: "/academic-structure",  group: "Configuration" },
  { label: "Users & Roles",            path: "/users-roles",         group: "Configuration" },
  { label: "AI Use Cases",             path: "/ai-use-cases",        group: "Configuration" },
  { label: "Onboarding Wizard",        path: "/onboarding",          group: "Configuration" },

  { label: "Claros Insights · Executive Center", path: "/insights",    group: "Claros Insights" },
  { label: "Analytics",                          path: "/analytics",   group: "Claros Insights" },
  { label: "Command Centre",                     path: "/command",     group: "Claros Insights" },
  { label: "Executive Briefing",                 path: "/exec-briefing", group: "Claros Insights" },

  { label: "Claros AI · Chat",         path: "/ai",                  group: "Claros AI" },
  { label: "Claros AI · Knowledge Base", path: "/ai/knowledge",      group: "Claros AI" },
  { label: "Student Assistant",        path: "/student-assistant",   group: "Claros AI" },

  { label: "Claros Enroll · Pipeline", path: "/enroll",              group: "Claros Enroll" },
  { label: "Claros Enroll · Analytics", path: "/enroll/analytics",   group: "Claros Enroll" },

  { label: "Claros Core · Dashboard",  path: "/core/dashboard",      group: "Claros Core" },
  { label: "Claros Core · Students",   path: "/core/students",       group: "Claros Core" },
  { label: "Claros Core · Attendance", path: "/core/attendance",     group: "Claros Core" },
  { label: "Claros Core · Timetable",  path: "/core/timetable",      group: "Claros Core" },
  { label: "Claros Core · Fees",       path: "/core/fees",           group: "Claros Core" },
  { label: "Claros Core · Notices",    path: "/core/notices",        group: "Claros Core" },

  { label: "Claros Learn · LMS",       path: "/learn",               group: "Claros Learn" },
  { label: "Content Studio",           path: "/content-studio",      group: "Claros Learn" },
  { label: "Assessments",              path: "/assessments",         group: "Claros Learn" },
  { label: "Psychometrics",            path: "/psychometrics",       group: "Claros Learn" },

  { label: "Claros Launch · Cockpit",  path: "/launch",              group: "Claros Launch" },
  { label: "Claros Launch · Drives",   path: "/launch/drives",       group: "Claros Launch" },
  { label: "Claros Launch · Admin",    path: "/launch/admin",        group: "Claros Launch" },

  { label: "Claros Research",          path: "/research",            group: "Claros Research" },
  { label: "Claros People · Faculty Dev", path: "/people",           group: "Claros People" },
  { label: "Claros Alumni · Network",  path: "/alumni-network",      group: "Claros Alumni" },
  { label: "Claros Safe · Incidents",  path: "/safe",                group: "Claros Safe" },
  { label: "Claros Green · Sustainability", path: "/green",          group: "Claros Green" },

  { label: "Claros Comply · NAAC Dashboard", path: "/comply",        group: "Claros Comply" },
  { label: "Claros Comply · OBE Framework",  path: "/comply/obe",    group: "Claros Comply" },
  { label: "AI Governance",            path: "/governance",          group: "Claros Comply" },
  { label: "Workflows",                path: "/workflows",           group: "Claros Comply" },

  { label: "Admin Guide",              path: "/admin-guide",         group: "Help & System" },
  { label: "Product Brief",            path: "/product-brief",       group: "Help & System" },
  { label: "Settings",                 path: "/settings",            group: "Help & System" },
];

const RECENT_KEY = "academiaos.cmdk.recent";

// Verb-first ACTIONS were tied to legacy closeout/nexus2/veda/arise backends
// that have been retired. Reintroduce them once equivalents land on the
// canonical Claros API surface.
const ACTIONS = [];

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
  const [recentTick, setRecentTick] = useState(0);  // bump to re-read localStorage
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();
  const { current } = useInstitution();
  const iid = current?.id;

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

  const recent = open ? loadRecent() : [];
  // recentTick is referenced to force re-read after pushRecent (no-op marker)
  void recentTick;

  const go = (path) => {
    pushRecent(path);
    setRecentTick((n) => n + 1);
    setOpen(false);
    navigate(path);
  };

  const runAction = async (a) => {
    if (!iid) {
      toast.error("Select an institution first");
      return;
    }
    setBusy(a.id);
    try {
      const out = await a.run({ iid });
      toast.success(`${a.label} · ${out?.msg || "done"}`);
      setOpen(false);
      if (out?.path) {
        pushRecent(out.path);
        setRecentTick((n) => n + 1);
        navigate(out.path);
      }
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || `${a.label} failed`);
    } finally {
      setBusy(null);
    }
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
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Fuzzy-search pages, modules and consoles. Navigate with arrow keys; press Enter to go.
          </DialogDescription>
        </VisuallyHidden>
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

          <CommandGroup heading="Actions">
            {ACTIONS.map((a) => (
              <CommandItem
                key={a.id}
                value={`action ${a.label} ${a.keywords}`}
                onSelect={() => runAction(a)}
                disabled={busy === a.id}
                data-testid={`cmdk-action-${a.id}`}
              >
                <Zap className="h-3.5 w-3.5 mr-2 text-primary" />
                {busy === a.id ? `${a.label} · running…` : a.label}
                <span className="ml-auto text-[10px] text-muted-foreground">action</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

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
