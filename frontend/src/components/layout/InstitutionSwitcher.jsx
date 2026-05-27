import React from "react";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useInstitution } from "../../context/InstitutionContext";

export default function InstitutionSwitcher() {
  const { institutions, current, switchInstitution } = useInstitution();
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="institution-switcher"
        className="flex items-center gap-2 rounded-md border border-border bg-card px-2 md:px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors md:min-w-[200px] max-w-[200px]"
      >
        {current.logo_url ? (
          <img
            src={current.logo_url}
            alt={current.short_name}
            className="h-6 w-6 rounded object-contain bg-white"
          />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-start">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground leading-none">
            Tenant
          </span>
          <span className="block font-medium leading-tight">{current.short_name}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="label-eyebrow">Switch institution</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {institutions.map((inst) => (
          <DropdownMenuItem
            key={inst.id}
            data-testid={`institution-option-${inst.short_name.toLowerCase()}`}
            onSelect={() => switchInstitution(inst.id)}
            className="flex items-center gap-3 py-2"
          >
            {inst.logo_url ? (
              <img
                src={inst.logo_url}
                alt={inst.short_name}
                className="h-8 w-8 rounded object-contain bg-white border border-border"
              />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium leading-tight">{inst.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {inst.type} · {inst.country}
              </div>
            </div>
            {inst.id === current.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
