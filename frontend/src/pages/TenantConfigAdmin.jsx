import React, { useState } from "react";
import { Loader2, RefreshCcw, RotateCcw, Save, Palette, Lock, Eye } from "lucide-react";
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
  const { config, loading, refresh, notifyChanged,
          isSuperAdmin, isPreviewing, previewTenantId } = useTenantConfig();
  // Edits are stored separately from the live config; inputs read
  // `edits[key] ?? config[key]` so a fresh config from refresh() shows
  // through unless the user has actively edited that field. No setState
  // in useEffect needed.
  const [brandingEdits, setBrandingEdits] = useState({});
  const [moduleEdits, setModuleEdits] = useState({}); // {mid: {display_name?, short_name?, enabled?}}
  const [savingId, setSavingId] = useState(null);
  const [resetting, setResetting] = useState(false);

  // When super_admin is previewing a tenant, route all writes through the
  // tenant-scoped endpoints. Institution admins always use /me/config/...
  const writeBase = isSuperAdmin && isPreviewing && previewTenantId
    ? `/v1/tenants/${previewTenantId}/config`
    : "/v1/tenants/me/config";

  if (!user || !["super_admin", "institution_admin"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Helpers — current effective values (edit overrides config).
  const brandingVal = (key, fallback = "") =>
    brandingEdits[key] !== undefined ? brandingEdits[key]
      : (config?.[key] ?? fallback);
  const moduleVal = (mid, key) => {
    const e = moduleEdits[mid] || {};
    if (e[key] !== undefined) return e[key];
    return config?.modules?.[mid]?.[key];
  };

  const setBrandingField = (key, value) =>
    setBrandingEdits((s) => ({ ...s, [key]: value }));
  const setModuleField = (mid, key, value) =>
    setModuleEdits((s) => ({ ...s, [mid]: { ...(s[mid] || {}), [key]: value } }));

  const saveModule = async (mid) => {
    setSavingId(mid);
    try {
      const payload = moduleEdits[mid] || {};
      // Always send the three editable fields so backend has a complete snapshot.
      const body = {
        display_name: payload.display_name ?? config.modules[mid].display_name,
        short_name: payload.short_name ?? config.modules[mid].short_name,
        enabled: payload.enabled ?? config.modules[mid].enabled,
      };
      await api.put(`${writeBase}/modules/${mid}`, body);
      toast.success(`Saved ${mid}`);
      setModuleEdits((s) => { const n = { ...s }; delete n[mid]; return n; });
      refresh(); notifyChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSavingId(null); }
  };

  const resetModule = async (mid) => {
    setSavingId(mid);
    try {
      await api.post(`${writeBase}/modules/${mid}/reset`);
      toast.success(`Reset ${mid} to canonical`);
      setModuleEdits((s) => { const n = { ...s }; delete n[mid]; return n; });
      refresh(); notifyChanged();
    } catch { toast.error("Reset failed"); }
    finally { setSavingId(null); }
  };

  const saveBranding = async () => {
    setSavingId("branding");
    try {
      // Only send fields the user actually edited.
      await api.put(`${writeBase}/branding`, brandingEdits);
      toast.success("Branding updated");
      setBrandingEdits({});
      refresh(); notifyChanged();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSavingId(null); }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset ALL module display names and branding to canonical defaults?")) return;
    setResetting(true);
    try {
      await api.post(`${writeBase}/reset`);
      toast.success("Reset complete");
      setBrandingEdits({}); setModuleEdits({});
      refresh(); notifyChanged();
    } catch { toast.error("Reset failed"); }
    finally { setResetting(false); }
  };

  // -----------------------------------------------------------------------
  // Loading + empty states
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground" data-testid="tenant-config-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
      </div>
    );
  }

  // Super admin without an active preview has no own tenant config → guide
  // them to enable preview mode for the tenant they want to edit.
  if (isSuperAdmin && !isPreviewing) {
    return (
      <div className="p-6 lg:p-8" data-testid="tenant-config-needs-preview">
        <PageHeader
          eyebrow="Tenant Configuration"
          title="Branding & Module Names"
          description="Pick a tenant to manage its branding and module names."
        />
        <div className="max-w-2xl mx-auto mt-6 rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Eye className="h-8 w-8 mx-auto text-violet-600" />
          <h3 className="mt-3 text-base font-semibold tracking-tight">No tenant selected</h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            As a super admin, you don&apos;t belong to a single tenant. To edit a
            tenant&apos;s branding or module names, use the <strong>Preview as…</strong>
            switcher in the top bar to enter that tenant&apos;s view first. All
            changes you save while previewing will write directly to that tenant.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: pick a tenant from the dropdown next to your profile avatar.
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground" data-testid="tenant-config-empty">
        Could not load tenant configuration. Try refreshing.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tenant-config-admin">
      <PageHeader
        eyebrow="Tenant Configuration"
        title="Branding & Module Names"
        description={isSuperAdmin && isPreviewing
          ? `Editing ${config.tenant_name || "previewed tenant"}. Changes apply to that tenant only.`
          : "Rename modules and configure branding visible to all users in your tenant. Canonical API IDs never change."}
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin && isPreviewing && (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200" data-testid="tenant-config-preview-badge">
                <Eye className="h-3 w-3 mr-1" /> Editing: {config.tenant_name}
              </Badge>
            )}
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
            <Input data-testid="branding-platform-name" value={brandingVal("platform_display_name")}
              onChange={(e) => setBrandingField("platform_display_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Primary colour</label>
            <div className="flex items-center gap-2">
              <Input type="color" data-testid="branding-primary-color"
                className="w-16 h-9"
                value={brandingVal("primary_color", "#2563EB")}
                onChange={(e) => setBrandingField("primary_color", e.target.value)} />
              <Input value={brandingVal("primary_color")}
                onChange={(e) => setBrandingField("primary_color", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Accent colour</label>
            <div className="flex items-center gap-2">
              <Input type="color" className="w-16 h-9" data-testid="branding-accent-color"
                value={brandingVal("accent_color", "#0EA5E9")}
                onChange={(e) => setBrandingField("accent_color", e.target.value)} />
              <Input value={brandingVal("accent_color")}
                onChange={(e) => setBrandingField("accent_color", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-eyebrow">Logo URL</label>
            <Input data-testid="branding-logo-url" placeholder="https://…/logo.svg"
              value={brandingVal("logo_url")}
              onChange={(e) => setBrandingField("logo_url", e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label-eyebrow">Footer tagline (empty to hide)</label>
            <Input data-testid="branding-powered-by" placeholder="Powered by Claros"
              value={brandingVal("powered_by_label", "Powered by Claros")}
              onChange={(e) => setBrandingField("powered_by_label", e.target.value)} />
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
                    value={moduleVal(mid, "display_name") || ""}
                    onChange={(e) => setModuleField(mid, "display_name", e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="label-eyebrow">Short name</label>
                  <Input data-testid={`module-shortname-${mid}`}
                    value={moduleVal(mid, "short_name") || ""}
                    onChange={(e) => setModuleField(mid, "short_name", e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="label-eyebrow inline-flex items-center gap-1">
                    {cannotDisable && <Lock className="h-3 w-3" />} Enabled
                  </label>
                  <select className="w-full border rounded-md px-2 py-2 text-sm bg-background"
                    data-testid={`module-enabled-${mid}`}
                    value={String(moduleVal(mid, "enabled") !== false)}
                    disabled={cannotDisable}
                    onChange={(e) => setModuleField(mid, "enabled", e.target.value === "true")}>
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
