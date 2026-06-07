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

/**
 * Verb-first ACTIONS — each fires a real API call against the current
 * tenant and shows toast feedback. Some actions also navigate to the
 * relevant page after success so the user lands in context.
 */
const ACTIONS = [
  {
    id: "scan-defaulters",
    label: "Scan defaulters (14d)",
    keywords: "fees overdue payment risk",
    run: async ({ iid }) => {
      const r = await api.get(`/nexus2/${iid}/fees/predict-defaulters`, { params: { horizon_days: 14 } });
      return { msg: `${r.data.n_at_risk} at-risk students`, path: "/nexus-console" };
    },
  },
  {
    id: "kpi-stream",
    label: "Show all-platform KPI stream",
    keywords: "command dashboard metrics",
    run: async ({ iid }) => {
      const r = await api.get(`/closeout/${iid}/command/kpi-stream`);
      return { msg: `${r.data.students} students · ${r.data.publications} pubs · ${r.data.grievances_open} open grv`, path: "/closeout-console" };
    },
  },
  {
    id: "generate-aqar",
    label: "Compose NAAC SSR section",
    keywords: "naac aqar compass accreditation",
    run: async ({ iid }) => {
      const r = await api.post(`/closeout/${iid}/compass/ssr-compose`, { cycle: "A++", section: "curricular_aspects" });
      return { msg: `Drafted: ${r.data.section_title || "section"}`, path: "/closeout-console" };
    },
  },
  {
    id: "esg-composite",
    label: "Compute ESG composite",
    keywords: "greeniq sustainability score",
    run: async ({ iid }) => {
      const r = await api.get(`/closeout/${iid}/greeniq/esg-composite`);
      return { msg: `ESG ${r.data.composite} · ${r.data.band}`, path: "/closeout-console" };
    },
  },
  {
    id: "carbon-footprint",
    label: "Show carbon footprint",
    keywords: "greeniq emissions co2",
    run: async ({ iid }) => {
      const r = await api.get(`/closeout/${iid}/greeniq/carbon-footprint`);
      return { msg: `Net ${r.data.tons_co2e}t CO₂e · solar ${r.data.solar_kwh} kWh`, path: "/closeout-console" };
    },
  },
  {
    id: "attendance-sweep",
    label: "Run attendance alert sweep",
    keywords: "nexus parent alerts",
    run: async ({ iid }) => {
      const r = await api.post(`/nexus2/${iid}/attendance/auto-alert`, null, { params: { threshold_pct: 75 } });
      return { msg: `${r.data.alerts_emitted} alerts emitted`, path: "/nexus-console" };
    },
  },
  {
    id: "veda-kb-ingest",
    label: "Run VEDA KB ingestion",
    keywords: "knowledge base content sources",
    run: async ({ iid }) => {
      const r = await api.post(`/veda/${iid}/kb/ingest-run`, { only_pending: true });
      return { msg: `${r.data.sources_processed} sources · ${r.data.chunks_created} chunks`, path: "/veda-console" };
    },
  },
  {
    id: "kb-status",
    label: "Show VEDA KB status",
    keywords: "knowledge base coverage chunks",
    run: async ({ iid }) => {
      const r = await api.get(`/veda/${iid}/kb/status`);
      return { msg: `${r.data.sources_ingested}/${r.data.sources_total} ingested · ${r.data.chunks_total} chunks`, path: "/veda-console" };
    },
  },
  {
    id: "incident-dashboard",
    label: "Show GUARDIAN incidents",
    keywords: "safety alerts open",
    run: async ({ iid }) => {
      const r = await api.get(`/closeout/${iid}/guardian/incident-dashboard`);
      return { msg: `${r.data.open} open of ${r.data.total} total`, path: "/closeout-console" };
    },
  },
  {
    id: "accreditation-timeline",
    label: "Show accreditation deadlines",
    keywords: "naac nba nirf compass timeline due",
    run: async ({ iid }) => {
      const r = await api.get(`/closeout/${iid}/compass/accreditation-timeline`);
      const urgent = (r.data.items || []).filter((x) => x.band === "urgent" || x.band === "overdue").length;
      return { msg: `${urgent} urgent/overdue out of ${(r.data.items || []).length}`, path: "/closeout-console" };
    },
  },
];

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
