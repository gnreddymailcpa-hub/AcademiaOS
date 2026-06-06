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
      const r = await api.get(`/modules/${current.id}`);
      setModules(r.data || []);
    } catch {
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [current?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const statusOf = (code) => {
    if (!code) return "active";
    const m = modules.find((x) => x.code === code);
    return m?.status || "active";
  };

  return { modules, loading, statusOf, refresh };
}
