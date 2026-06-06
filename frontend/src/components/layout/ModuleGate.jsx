import React from "react";
import { Link } from "react-router-dom";
import { Lock, SlidersHorizontal, Clock } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useTenantModules } from "../../lib/useTenantModules";
import { useAuth } from "../../context/AuthContext";
import { useInstitution } from "../../context/InstitutionContext";

/**
 * ModuleGate
 * ----------
 * Wraps a route's element. If the named platform module is `disabled` (or
 * `coming_soon`) for the active tenant, we render a graceful blocker
 * instead of the page itself. Admins get a direct link to Platform Modules.
 *
 * When `module` is undefined (or the page predates the registry), the gate
 * is transparent and just renders children.
 */
export default function ModuleGate({ module: code, children }) {
  const { statusOf, loading } = useTenantModules();
  const { user } = useAuth();
  const { current } = useInstitution();

  if (!code) return children;
  if (loading) return null;

  const status = statusOf(code);
  if (status === "active") return children;

  const isAdmin = user?.role === "super_admin" || user?.role === "institution_admin";
  const isComing = status === "coming_soon";
  const Icon = isComing ? Clock : Lock;

  return (
    <div className="p-6 lg:p-10" data-testid="module-gate">
      <div className="max-w-2xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-4 label-eyebrow">{code} · Module</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {isComing ? "Coming soon" : "Module not enabled"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isComing
            ? `${code} is part of the platform roadmap for ${current?.short_name || "this tenant"} but has not been activated yet.`
            : `Your Institution Admin has disabled the ${code} module for ${current?.short_name || "this tenant"}.`}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Badge variant="outline" className="text-[10px]">{status}</Badge>
          <Badge className="bg-primary text-primary-foreground text-[10px]">{code}</Badge>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          {isAdmin ? (
            <Link to="/admin/modules">
              <Button className="gap-1.5" data-testid="module-gate-open-admin">
                <SlidersHorizontal className="h-4 w-4" /> Open Platform Modules
              </Button>
            </Link>
          ) : (
            <Link to="/">
              <Button variant="outline" data-testid="module-gate-back">Back to Dashboard</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
