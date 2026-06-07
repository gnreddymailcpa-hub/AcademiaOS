import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, RotateCcw, Save, Palette, Lock } from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { useTenantConfig } from "../context/TenantConfigContext";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function TenantConfigAdmin() {
  const { user } = useAuth();
  const { config, loading, refresh, notifyChanged } = useTenantConfig();
  const [branding, setBranding] = useState({});
  const [modules, setModules] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!config) return;
    setBranding({
      platform_display_name: config.platform_display_name || "",
      primary_color: config.primary_color || "#2563EB",
      accent_color: config.accent_color || "#0EA5E9",
      logo_url: config.logo_url || "",
      powered_by_label: config.powered_by_label ?? "Powered by Claros",
    });
    setModules(Object.fromEntries(
      Object.entries(config.modules || {}).map(([id, m]) => [id, {
        display_name: m.display_name, short_name: m.short_name, enabled: m.enabled,
      }])
    ));
  }, [config]);

  if (!user || !["super_admin", "institution_admin"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const saveModule = async (mid) => {
    setSavingId(mid);
    try {
      await api.put(`/v1/tenants/me/config/modules/${mid}`, modules[mid]);
      toast.success(`Saved ${mid}`);
      refresh(); notifyChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSavingId(null); }
  };

  const resetModule = async (mid) => {
    setSavingId(mid);
    try {
      await api.post(`/v1/tenants/me/config/modules/${mid}/reset`);
      toast.success(`Reset ${mid} to canonical`);
      refresh(); notifyChanged();
    } catch { toast.error("Reset failed"); }
    finally { setSavingId(null); }
  };

  const saveBranding = async () => {
    setSavingId("branding");
    try {
      await api.put("/v1/tenants/me/config/branding", branding);
      toast.success("Branding updated");
      refresh(); notifyChanged();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSavingId(null); }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset ALL module display names and branding to canonical defaults?")) return;
    setResetting(true);
    try {
      await api.post("/v1/tenants/me/config/reset");
      toast.success("Reset complete");
      refresh(); notifyChanged();
    } catch { toast.error("Reset failed"); }
    finally { setResetting(false); }
  };

  if (loading || !config) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground" data-testid="tenant-config-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tenant-config-admin">
      <PageHeader
        eyebrow="Tenant Configuration"
        title="Branding & Module Names"
        description="Rename modules and configure branding visible to all users in your tenant. Canonical API IDs never change."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} data-testid="tenant-refresh-btn">
              <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={resetAll} disabled={resetting} data-testid="tenant-reset-all-btn">
              {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Reset all to canonical
            </Button>
          </div>
        }
      />

      {/* BRANDING */}
      <section className="card p-5 border border-border" data-testid="branding-section">
        <h2 className="text-base font-semibold mb-3 inline-flex items-center gap-2">
          <Palette className="h-4 w-4" /> Platform branding
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="label-eyebrow">Platform display name</label>
            <Input data-testid="branding-platform-name" value={branding.platform_display_name || ""}
              onChange={(e) => setBranding(s => ({ ...s, platform_display_name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Primary colour</label>
            <div className="flex items-center gap-2">
              <Input type="color" data-testid="branding-primary-color"
                className="w-16 h-9"
                value={branding.primary_color || "#2563EB"}
                onChange={(e) => setBranding(s => ({ ...s, primary_color: e.target.value }))} />
              <Input value={branding.primary_color || ""}
                onChange={(e) => setBranding(s => ({ ...s, primary_color: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Accent colour</label>
            <div className="flex items-center gap-2">
              <Input type="color" className="w-16 h-9" data-testid="branding-accent-color"
                value={branding.accent_color || "#0EA5E9"}
                onChange={(e) => setBranding(s => ({ ...s, accent_color: e.target.value }))} />
              <Input value={branding.accent_color || ""}
                onChange={(e) => setBranding(s => ({ ...s, accent_color: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Logo URL</label>
            <Input data-testid="branding-logo-url" placeholder="https://…/logo.svg"
              value={branding.logo_url || ""}
              onChange={(e) => setBranding(s => ({ ...s, logo_url: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label-eyebrow">Footer tagline (empty to hide)</label>
            <Input data-testid="branding-powered-by" placeholder="Powered by Claros"
              value={branding.powered_by_label ?? ""}
              onChange={(e) => setBranding(s => ({ ...s, powered_by_label: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveBranding} disabled={savingId === "branding"} data-testid="branding-save-btn">
            {savingId === "branding" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save branding
          </Button>
        </div>
      </section>

      {/* MODULES */}
      <section className="space-y-3" data-testid="modules-section">
        <h2 className="text-base font-semibold">Module display names</h2>
        <div className="text-xs text-muted-foreground">
          End users in this tenant see these names everywhere. Canonical IDs (left column) never change and remain the routing/integration key.
        </div>
        <div className="card border border-border divide-y">
          {Object.entries(config.modules || {}).map(([mid, m]) => {
            const cannotDisable = mid === "claros-ai";
            const mod = modules[mid] || {};
            const overridden = m.is_overridden;
            return (
              <div key={mid} className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-end" data-testid={`tenant-module-row-${mid}`}>
                <div className="md:col-span-3">
                  <div className="text-xs font-mono text-muted-foreground">{mid}</div>
                  <div className="text-xs text-muted-foreground">{m.canonical_name}</div>
                  {overridden && <Badge variant="outline" className="text-[9px] mt-1 bg-violet-50 text-violet-700">Override active</Badge>}
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="label-eyebrow">Display name</label>
                  <Input data-testid={`module-displayname-${mid}`}
                    value={mod.display_name || ""}
                    onChange={(e) => setModules(s => ({ ...s, [mid]: { ...s[mid], display_name: e.target.value } }))} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="label-eyebrow">Short name</label>
                  <Input data-testid={`module-shortname-${mid}`}
                    value={mod.short_name || ""}
                    onChange={(e) => setModules(s => ({ ...s, [mid]: { ...s[mid], short_name: e.target.value } }))} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="label-eyebrow inline-flex items-center gap-1">
                    {cannotDisable && <Lock className="h-3 w-3" />} Enabled
                  </label>
                  <select className="w-full border rounded-md px-2 py-2 text-sm bg-background"
                    data-testid={`module-enabled-${mid}`}
                    value={String(mod.enabled !== false)}
                    disabled={cannotDisable}
                    onChange={(e) => setModules(s => ({ ...s, [mid]: { ...s[mid], enabled: e.target.value === "true" } }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => resetModule(mid)}
                    disabled={savingId === mid} data-testid={`module-reset-${mid}`}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" onClick={() => saveModule(mid)}
                    disabled={savingId === mid} data-testid={`module-save-${mid}`}>
                    {savingId === mid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
