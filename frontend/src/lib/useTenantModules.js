import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useInstitution } from "../context/InstitutionContext";

/**
 * useTenantModules
 * ----------------
 * Fetches `/api/modules/{tenant_id}` whenever the active tenant changes and
 * returns helpers for the Sidebar and route-level ModuleGate.
 *
 * Status legend (server-side):
 *   - active       → fully usable
 *   - coming_soon  → visible in nav, blocked at page (informational shell)
 *   - disabled     → hidden from nav, route renders ModuleGate block
 *
 * Modules without a row default to the catalog default_status (server fills it).
 *
 * Cross-page live propagation: any page that mutates module status MUST
 * dispatch `window.dispatchEvent(new Event("claros:modules-changed"))` so
 * the sidebar + any other module-gated UI refetches without a full reload.
 * Onboarding wizard + Platform Modules admin both fire this signal.
 */
export function useTenantModules() {
  const { current } = useInstitution();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!current?.id) {
      setModules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Cache-bust the GET so stale CDN/browser caches never mask a save.
      const r = await api.get(`/modules/${current.id}`, { params: { _: Date.now() } });
      setModules(r.data || []);
    } catch {
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [current?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live propagation: refetch when any page in the app announces a change.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("claros:modules-changed", handler);
    let bc;
    try {
      bc = new BroadcastChannel("claros-modules");
      bc.onmessage = handler;
    } catch { /* BroadcastChannel unsupported, window event is enough */ }
    return () => {
      window.removeEventListener("claros:modules-changed", handler);
      try { bc && bc.close(); } catch { /* noop */ }
    };
  }, [refresh]);

  const statusOf = (code) => {
    if (!code) return "active";
    const m = modules.find((x) => x.code === code);
    return m?.status || "active";
  };

  return { modules, loading, statusOf, refresh };
}

/**
 * Anyone mutating module status should call this helper so all consumers
 * (sidebar, current page, other open tabs) refresh in lockstep.
 */
export function notifyModulesChanged() {
  try { window.dispatchEvent(new Event("claros:modules-changed")); } catch { /* noop */ }
  try {
    const bc = new BroadcastChannel("claros-modules");
    bc.postMessage({ ts: Date.now() });
    bc.close();
  } catch { /* noop */ }
}

