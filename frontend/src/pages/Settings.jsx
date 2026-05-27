import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Globe2,
  Palette,
  ShieldCheck,
  Bell,
  DatabaseZap,
  Mail,
  PlugZap,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";

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

function IntegrationsPanel() {
  const { current } = useInstitution();
  const [email, setEmail] = useState({
    provider: "resend",
    api_key: "",
    from_email: "",
    from_name: "",
    enabled: false,
  });
  const [masked, setMasked] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");

  const load = async () => {
    if (!current) return;
    const { data } = await api.get(`/integrations/${current.id}`);
    setEmail((prev) => ({
      ...prev,
      ...(data.email || {}),
      api_key: "", // never prefill, but show the masked hint
    }));
    setMasked(data.email?.api_key_masked || null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/integrations/${current.id}/email`, {
        provider: email.provider,
        api_key: email.api_key || null,
        from_email: email.from_email || null,
        from_name: email.from_name || null,
        enabled: !!email.enabled,
      });
      toast.success("Email integration saved");
      setEmail((e) => ({ ...e, api_key: "" }));
      load();
    } catch (e) {
      toast.error("Save failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) {
      toast.error("Enter a recipient address");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/integrations/${current.id}/email/test`, { to: testTo });
      if (data.ok) toast.success("Test email sent");
      else toast.error("Test failed", { description: data.error || "not configured" });
    } catch (e) {
      toast.error("Test failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5" data-testid="integration-email-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Email — Resend</h3>
              {email.enabled ? (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Each tenant brings its own Resend API key. Approval pings, audit digests and
              workflow notifications go through this provider. Get a key at{" "}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                resend.com/api-keys
              </a>
              .
            </p>
          </div>
          <Switch
            checked={email.enabled}
            onCheckedChange={(v) => setEmail({ ...email, enabled: v })}
            data-testid="integration-email-enabled"
          />
        </div>

        <div className="mt-4 grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Provider</Label>
            <Select
              value={email.provider}
              onValueChange={(v) => setEmail({ ...email, provider: v })}
            >
              <SelectTrigger data-testid="integration-email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="none">None (disabled)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              API key {masked ? <span className="text-foreground/70">· stored: {masked}</span> : null}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={email.api_key}
                onChange={(e) => setEmail({ ...email, api_key: e.target.value })}
                placeholder={masked ? "•••••••••• (leave blank to keep)" : "re_…"}
                className="pr-10"
                data-testid="integration-email-api-key"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey((s) => !s)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">From email</Label>
            <Input
              value={email.from_email || ""}
              onChange={(e) => setEmail({ ...email, from_email: e.target.value })}
              placeholder="notifications@yourdomain.com"
              data-testid="integration-email-from-email"
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">From name</Label>
            <Input
              value={email.from_name || ""}
              onChange={(e) => setEmail({ ...email, from_name: e.target.value })}
              placeholder="AcademiaOS"
              data-testid="integration-email-from-name"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Send test email to…"
              className="w-64"
              data-testid="integration-email-test-to"
            />
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={busy}
              data-testid="integration-email-send-test"
            >
              <Send className="mr-2 h-4 w-4" /> Send test
            </Button>
          </div>
          <Button onClick={save} disabled={busy} data-testid="integration-email-save">
            Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-5">
        <div className="flex items-center gap-3">
          <PlugZap className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">More integrations · coming soon</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Webhooks (Slack / Teams), SSO providers beyond Google, and SCIM provisioning will appear here.
        </p>
      </div>
    </div>
  );
}

export default function Settings() {
  const { current } = useInstitution();
  const { lang, setLanguage } = useLang();
  const [tab, setTab] = useState("workspace");
  if (!current) return null;
  return (
    <div data-testid="settings-page">
      <PageHeader
        eyebrow="Workspace settings"
        title="Preferences & platform"
        description="Workspace-level toggles. Tenant configuration lives in Institution Setup."
        actions={<Badge variant="outline">{current.short_name}</Badge>}
      />
      <div className="p-6 lg:p-8 max-w-3xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList data-testid="settings-tabs">
            <TabsTrigger value="workspace" data-testid="settings-tab-workspace">Workspace</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="settings-tab-integrations">Integrations</TabsTrigger>
          </TabsList>
          <TabsContent value="workspace" className="mt-4">
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
                hint="Configure provider under Integrations →"
                control={<Switch defaultChecked />}
              />
            </div>
          </TabsContent>
          <TabsContent value="integrations" className="mt-4">
            <IntegrationsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
