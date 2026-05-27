import React from "react";
import { PageHeader } from "../components/layout/Shell";
import { Sparkles, Construction, ArrowRight } from "lucide-react";
import { Badge } from "../components/ui/badge";

export default function ComingSoon({ eyebrow, title, description, phase, features = [] }) {
  return (
    <div data-testid={`coming-soon-${title.toLowerCase().replace(/[^a-z]/g, "-")}`}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-700">
            <Construction className="h-3 w-3" />
            Ships in {phase}
          </Badge>
        }
      />
      <div className="p-6 lg:p-8">
        <div className="rounded-lg border border-dashed border-border bg-card p-10 max-w-3xl">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Scoped, governed and ready to wire in.</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                Phase 1 + 2 delivered the foundation: multi-tenant config, academic structure and
                roles. This module activates once Phase 3+ ships. Every action will be gated by
                AI TRiSM, audit logs and human-in-the-loop approvals.
              </p>
              {features.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
