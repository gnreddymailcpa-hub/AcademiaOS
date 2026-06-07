import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, ShieldCheck, ChevronDown, Inbox } from "lucide-react";
import InstitutionSwitcher from "./InstitutionSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";
import TenantPreviewSwitcher from "./TenantPreviewSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../ui/popover";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { useInstitution } from "../../context/InstitutionContext";
import { api } from "../../lib/api";

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
  const { current } = useInstitution();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState({ items: [], unread: 0 });

  const refresh = async () => {
    try {
      const { data } = await api.get("/notifications", { params: { limit: 8 } });
      setNotifs(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, current?.id]);

  const onItemClick = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`);
    } catch {
      /* ignore */
    }
    if (n.link) navigate(n.link);
    refresh();
  };

  const markAll = async () => {
    await api.post("/notifications/read-all");
    refresh();
  };

  return (
    <header
      className="sticky top-0 z-40 h-16 border-b border-border bg-card/80 backdrop-blur-xl"
      data-testid="top-bar"
    >
      <div className="flex h-full items-center gap-2 md:gap-4 px-3 md:px-6 min-w-0">
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

        <div className="ms-auto flex items-center gap-2 md:gap-3 min-w-0">
          <TenantPreviewSwitcher />
          <Badge
            variant="outline"
            className="hidden lg:flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700"
            data-testid="ai-status-indicator"
          >
            <span className="dot-pulse" />
            <ShieldCheck className="h-3 w-3" />
            <span className="text-[11px] font-medium">{t("topbar.ai_status")}</span>
          </Badge>

          <LanguageSwitcher />

          <Popover>
            <PopoverTrigger asChild>
              <button
                data-testid="notifications-button"
                className="relative hidden sm:flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted/60 transition"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-foreground/70" />
                {notifs.unread > 0 && (
                  <span
                    className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"
                    data-testid="notifications-badge"
                  >
                    {notifs.unread > 9 ? "9+" : notifs.unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 p-0"
              data-testid="notifications-popover"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Notifications · {notifs.unread} unread
                </div>
                {notifs.unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={markAll}
                    data-testid="notifications-mark-all"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifs.items.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    <Inbox className="mx-auto mb-2 h-5 w-5 opacity-50" />
                    You&rsquo;re all caught up.
                  </div>
                ) : (
                  notifs.items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onItemClick(n)}
                      data-testid={`notification-item-${n.id}`}
                      className={`w-full border-b border-border/60 px-3 py-2.5 text-start hover:bg-muted/50 transition ${
                        n.read ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                          {n.body && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                          )}
                          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {n.kind?.replace(".", " · ")} · {new Date(n.ts).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="user-menu-trigger"
              className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-1 hover:bg-muted/60 transition"
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
