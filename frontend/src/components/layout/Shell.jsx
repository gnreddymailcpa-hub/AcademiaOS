import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";

export default function Shell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  // close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell-grid bg-background grain-bg">
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen && (
        <div
          className="mobile-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-card/60 px-3 py-2 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-border bg-background p-2"
            aria-label="Open menu"
            data-testid="mobile-menu-toggle"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold tracking-tight">AcademiaOS</span>
        </div>
        <TopBar />
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card/40 px-4 py-5 md:px-8 md:py-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export { X as ShellClose };
