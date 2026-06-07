import React, { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { useTenantConfig } from "../../context/TenantConfigContext";
import { api } from "../../lib/api";
import { toast } from "sonner";

/**
 * "Preview as Tenant" switcher — visible to super_admin only. Renders
 * nothing for any other role.
 */
export default function TenantPreviewSwitcher() {
  const { isSuperAdmin, isPreviewing, previewTenantId, setPreviewTenantId,
          config, refresh } = useTenantConfig();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState([]);

  const loadInstitutions = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const r = await api.get("/institutions");
      setInstitutions(r.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { if (open) loadInstitutions(); }, [open, loadInstitutions]);

  if (!isSuperAdmin) return null;

  const choose = (id) => {
    setPreviewTenantId(id);
    setOpen(false);
    refresh();
    const inst = institutions.find(i => i.id === id);
    toast.success(`Now previewing as ${inst?.name || id.slice(0, 8)}`);
  };
  const exit = () => {
    setPreviewTenantId(null);
    setOpen(false);
    refresh();
    toast.success("Exited preview mode");
  };

  const previewingName = isPreviewing
    ? (config?.tenant_name || previewTenantId?.slice(0, 8))
    : null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isPreviewing ? "default" : "outline"}
          size="sm"
          className={isPreviewing ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
          data-testid="tenant-preview-switcher-btn"
        >
          {isPreviewing
            ? <><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview: {previewingName}</>
            : <><EyeOff className="h-3.5 w-3.5 mr-1.5" /> Preview as…</>}
          <ChevronDown className="h-3 w-3 ml-1.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end" data-testid="tenant-preview-menu">
        <DropdownMenuLabel className="text-xs">Switch UI to demo a tenant's branding</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="px-2 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading tenants…
          </div>
        )}
        {!loading && institutions.map(inst => {
          const active = isPreviewing && previewTenantId === inst.id;
          return (
            <DropdownMenuItem
              key={inst.id}
              onClick={() => choose(inst.id)}
              data-testid={`tenant-preview-option-${inst.id}`}
              className={active ? "bg-violet-50 text-violet-900" : ""}
            >
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="text-sm font-medium">{inst.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{inst.id.slice(0, 8)}…</div>
                </div>
                {active && <Badge className="bg-violet-600 text-white text-[10px]">Active</Badge>}
              </div>
            </DropdownMenuItem>
          );
        })}
        {isPreviewing && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exit} data-testid="tenant-preview-exit-btn">
              <EyeOff className="h-3.5 w-3.5 mr-2" /> Exit preview mode
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Persistent banner shown across the top of the app while in preview mode.
 * Keeps the super_admin from forgetting they're seeing someone else's view.
 */
export function TenantPreviewBanner() {
  const { isPreviewing, config, setPreviewTenantId, refresh } = useTenantConfig();
  if (!isPreviewing) return null;
  return (
    <div
      className="bg-violet-600 text-white text-xs px-4 py-2 flex items-center justify-between gap-3 sticky top-0 z-50"
      data-testid="tenant-preview-banner"
    >
      <div className="inline-flex items-center gap-2">
        <Eye className="h-3.5 w-3.5" />
        <span>Previewing as <strong>{config?.tenant_name || config?.platform_display_name}</strong>. All read-only; mutations still target your account's tenant.</span>
      </div>
      <button
        onClick={() => { setPreviewTenantId(null); refresh(); }}
        className="underline underline-offset-2 hover:no-underline"
        data-testid="tenant-preview-banner-exit"
      >
        Exit preview
      </button>
    </div>
  );
}
