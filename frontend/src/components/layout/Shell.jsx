import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Shell({ children }) {
  return (
    <div className="shell-grid bg-background grain-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card/40 px-8 py-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
