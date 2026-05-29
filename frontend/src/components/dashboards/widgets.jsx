import React from "react";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";

export function Kpi({ label, value, hint, icon: Icon, trend, trendDir = "up", testid }) {
  const trendColor = trendDir === "down" ? "text-rose-600" : "text-emerald-600";
  const TrendIcon = trendDir === "down" ? TrendingDown : TrendingUp;
  return (
    <div className="kpi-card" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ eyebrow, title, action, children, testid, className = "" }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 ${className}`} data-testid={testid}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          {eyebrow && <div className="label-eyebrow">{eyebrow}</div>}
          {title && <h3 className="text-base font-semibold mt-1">{title}</h3>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ItemList({ items, empty = "Nothing here yet.", testid }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground" data-testid={testid && `${testid}-empty`}>
        {empty}
      </div>
    );
  }
  return (
    <ul className="space-y-2.5 text-sm" data-testid={testid}>
      {items.map((it, idx) => (
        <li
          key={it.id || idx}
          className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0"
        >
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{it.title}</div>
            {it.meta && <div className="text-xs text-muted-foreground">{it.meta}</div>}
          </div>
          {it.right && (
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{it.right}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function MiniBar({ value, max = 100, color = "hsl(var(--primary))" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function PageLink({ to, label }) {
  return (
    <a
      href={to}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
