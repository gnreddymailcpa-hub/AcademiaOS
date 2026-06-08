import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useInstitution } from "./InstitutionContext";

const TenantConfigContext = createContext({
  config: null, loading: true, refresh: () => {}, isOverridden: () => false,
});

const CANONICAL_FALLBACKS = {
  "claros-ai": { display_name: "Claros AI", short_name: "AI" },
  "claros-enroll": { display_name: "Claros Enroll", short_name: "Enroll" },
  "claros-core": { display_name: "Claros Core", short_name: "Core" },
  "claros-learn": { display_name: "Claros Learn", short_name: "Learn" },
  "claros-launch": { display_name: "Claros Launch", short_name: "Launch" },
  "claros-research": { display_name: "Claros Research", short_name: "Research" },
  "claros-comply": { display_name: "Claros Comply", short_name: "Comply" },
  "claros-safe": { display_name: "Claros Safe", short_name: "Safe" },
  "claros-alumni": { display_name: "Claros Alumni", short_name: "Alumni" },
  "claros-green": { display_name: "Claros Green", short_name: "Green" },
  "claros-people": { display_name: "Claros People", short_name: "People" },
  "claros-insights": { display_name: "Claros Insights", short_name: "Insights" },
};

const PREVIEW_KEY = "claros-preview-tenant";

export function TenantConfigProvider({ children }) {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewTenantId, setPreviewTenantIdState] = useState(() => {
    try { return localStorage.getItem(PREVIEW_KEY) || null; }
    catch { return null; }
  });

  const isSuperAdmin = user?.role === "super_admin";
  const effectivePreview = isSuperAdmin ? previewTenantId : null;
  const isPreviewing = !!effectivePreview;

  const setPreviewTenantId = useCallback((id) => {
    try {
      if (id) localStorage.setItem(PREVIEW_KEY, id);
      else localStorage.removeItem(PREVIEW_KEY);
    } catch { /* ignored */ }
    setPreviewTenantIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) { setConfig(null); setLoading(false); return; }
    setLoading(true);
    try {
      const url = effectivePreview
        ? `/v1/tenants/${effectivePreview}/config`
        : "/v1/tenants/me/config";
      const r = await api.get(url);
      setConfig(r.data);
    } catch {
      // If preview fails (deleted tenant etc.), drop the preview and retry
      if (effectivePreview) setPreviewTenantId(null);
      setConfig(null);
    } finally { setLoading(false); }
  }, [user, effectivePreview, setPreviewTenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  // ---- Cross-context sync: keep InstitutionContext.current in lockstep
  // with the active preview tenant. When a super_admin enters preview, the
  // topbar TENANT dropdown, sidebar logo + theme all need to follow the
  // previewed tenant — not stay on whatever the super_admin was browsing
  // when they hit "Preview as…". On exit, restore the institution they
  // had selected pre-preview.
  const institutionCtx = useInstitution();
  const prePreviewInstitutionIdRef = useRef(null);
  const lastSyncedPreviewRef = useRef(null);
  useEffect(() => {
    if (!institutionCtx) return;
    const { current, switchInstitution, institutions } = institutionCtx;
    const last = lastSyncedPreviewRef.current;
    // Wait for institutions to load before attempting any switch.
    if (!institutions || institutions.length === 0) return;
    // Entering preview (or hopping between previews): swap institution.
    if (effectivePreview && effectivePreview !== last) {
      if (!last) {
        // First entry — stash where we came from so exit can restore.
        prePreviewInstitutionIdRef.current = current?.id || null;
      }
      if (current?.id !== effectivePreview) {
        const exists = institutions.some((i) => i.id === effectivePreview);
        if (exists) switchInstitution(effectivePreview);
      }
      lastSyncedPreviewRef.current = effectivePreview;
      return;
    }
    // Exiting preview: restore the pre-preview institution.
    if (!effectivePreview && last) {
      const restoreTo = prePreviewInstitutionIdRef.current;
      if (restoreTo && restoreTo !== current?.id) {
        const exists = institutions.some((i) => i.id === restoreTo);
        if (exists) switchInstitution(restoreTo);
      }
      prePreviewInstitutionIdRef.current = null;
      lastSyncedPreviewRef.current = null;
    }
  }, [effectivePreview, institutionCtx]);

  // Cross-tab live propagation via BroadcastChannel + localStorage fallback.
  // Any tab/page that mutates tenant config calls
  // `window.dispatchEvent(new Event("claros:tenant-config-changed"))`
  // OR localStorage.setItem("claros-tenant-config-changed", String(Date.now()))
  // OR posts to the broadcast channel.
  useEffect(() => {
    let bc;
    const onLocal = () => refresh();
    try {
      bc = new BroadcastChannel("claros-tenant-config");
      bc.onmessage = onLocal;
    } catch (_e) { /* old browsers */ }
    const onStorage = (e) => {
      if (e.key === "claros-tenant-config-changed") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("claros:tenant-config-changed", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("claros:tenant-config-changed", onLocal);
      if (bc) bc.close();
    };
  }, [refresh]);

  // Apply CSS variable for primary brand colour so the whole UI rebrands instantly.
  useEffect(() => {
    if (config?.primary_color && typeof document !== "undefined") {
      document.documentElement.style.setProperty("--tenant-primary", config.primary_color);
    }
  }, [config?.primary_color]);

  const isOverridden = useCallback((moduleId) => {
    return !!config?.modules?.[moduleId]?.is_overridden;
  }, [config]);

  // Helper: broadcast a config-change signal so OTHER tabs refetch too.
  const notifyChanged = useCallback(() => {
    try {
      const bc = new BroadcastChannel("claros-tenant-config");
      bc.postMessage({ at: Date.now() });
      bc.close();
    } catch (_e) { /* ignored */ }
    try {
      localStorage.setItem("claros-tenant-config-changed", String(Date.now()));
    } catch (_e) { /* ignored */ }
    window.dispatchEvent(new Event("claros:tenant-config-changed"));
  }, []);

  const value = useMemo(() => ({
    config, loading, refresh, isOverridden, notifyChanged,
    isPreviewing, previewTenantId: effectivePreview, setPreviewTenantId, isSuperAdmin,
  }), [config, loading, refresh, isOverridden, notifyChanged,
       isPreviewing, effectivePreview, setPreviewTenantId, isSuperAdmin]);

  return (
    <TenantConfigContext.Provider value={value}>
      {children}
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig() {
  return useContext(TenantConfigContext);
}

/**
 * Resolve a Claros canonical module ID to the tenant's display label.
 * mode = "full" (default) | "short"
 * Falls back to canonical English label if tenant config is loading or absent.
 */
export function useModuleName(canonicalId, mode = "full") {
  const { config } = useTenantConfig();
  const mod = config?.modules?.[canonicalId];
  const fb = CANONICAL_FALLBACKS[canonicalId] || { display_name: canonicalId, short_name: canonicalId };
  if (!mod) return mode === "short" ? fb.short_name : fb.display_name;
  return mode === "short" ? (mod.short_name || fb.short_name) : (mod.display_name || fb.display_name);
}

export function usePlatformName() {
  const { config } = useTenantConfig();
  return config?.platform_display_name || "Claros Platform";
}
