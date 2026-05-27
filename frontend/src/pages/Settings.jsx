import React from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { Globe2, Palette, ShieldCheck, Bell, DatabaseZap } from "lucide-react";

function Row({ icon: Icon, title, hint, control }) {
  return (
    <div className="flex items-center gap-4 border-b border-border last:border-b-0 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div>{control}</div>
    </div>
  );
}

export default function Settings() {
  const { current } = useInstitution();
  const { lang, setLanguage } = useLang();
  if (!current) return null;
  return (
    <div data-testid="settings-page">
      <PageHeader
        eyebrow="Workspace settings"
        title="Preferences & platform"
        description="Workspace-level toggles. Tenant configuration lives in Institution Setup."
        actions={<Badge variant="outline">{current.short_name}</Badge>}
      />
      <div className="p-6 lg:p-8 max-w-3xl space-y-6">
        <div className="rounded-lg border border-border bg-card px-5">
          <Row
            icon={Globe2}
            title="Interface language"
            hint="EN ↔ AR · automatic RTL"
            control={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-2.5 py-1 rounded-md text-xs ${lang === "en" ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage("ar")}
                  className={`px-2.5 py-1 rounded-md text-xs ${lang === "ar" ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  AR
                </button>
              </div>
            }
          />
          <Row
            icon={Palette}
            title="Tenant theme"
            hint={`Active palette · ${current.theme_key}`}
            control={
              <div className="flex items-center gap-1">
                {Object.entries(current.theme || {}).slice(0, 4).map(([k, v]) => (
                  <span
                    key={k}
                    title={k}
                    className="h-5 w-5 rounded-sm border border-border"
                    style={{ background: v }}
                  />
                ))}
              </div>
            }
          />
          <Row
            icon={ShieldCheck}
            title="AI TRiSM policy"
            hint="Human-in-the-loop on irreversible actions"
            control={<Switch defaultChecked />}
          />
          <Row
            icon={DatabaseZap}
            title="Data residency"
            hint={current.data_residency || "—"}
            control={<Badge variant="secondary">{current.data_residency || "Default"}</Badge>}
          />
          <Row
            icon={Bell}
            title="Email notifications"
            hint="Audit digest and approval pings"
            control={<Switch defaultChecked />}
          />
        </div>
      </div>
    </div>
  );
}
