import React from "react";
import { Search, Bell, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import InstitutionSwitcher from "./InstitutionSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";

function initials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const { t } = useLang();

  return (
    <header
      className="sticky top-0 z-40 h-16 border-b border-border bg-card/80 backdrop-blur-xl"
      data-testid="top-bar"
    >
      <div className="flex h-full items-center gap-4 px-6">
        <InstitutionSwitcher />

        <div className="relative max-w-md flex-1 hidden md:block">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="global-search"
            type="search"
            placeholder={t("topbar.search")}
            className="h-9 w-full rounded-md border border-border bg-background ps-9 pe-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        <div className="ms-auto flex items-center gap-3">
          <Badge
            variant="outline"
            className="hidden sm:flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700"
            data-testid="ai-status-indicator"
          >
            <span className="dot-pulse" />
            <ShieldCheck className="h-3 w-3" />
            <span className="text-[11px] font-medium">{t("topbar.ai_status")}</span>
          </Badge>

          <LanguageSwitcher />

          <button
            data-testid="notifications-button"
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted/60 transition"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 text-foreground/70" />
            <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
              3
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="user-menu-trigger"
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 hover:bg-muted/60 transition"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px] font-semibold bg-primary text-primary-foreground">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-start leading-tight pe-1">
                <div className="text-xs font-medium truncate max-w-[140px]">{user?.name}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {user?.role?.replace(/_/g, " ")}
                </div>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">
                <div className="font-medium">{user?.name}</div>
                <div className="text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="logout-button"
                onSelect={logout}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {t("topbar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
