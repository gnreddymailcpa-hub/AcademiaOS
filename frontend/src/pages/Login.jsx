import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";

const DEMO = [
  { label: "Super Admin", email: "admin@academiaos.ai", password: "Admin@2026" },
  { label: "ISB · Dean", email: "shankar.dean@isb.edu", password: "Demo@2026" },
  { label: "EAIC · Executive", email: "khalid.exec@eaic.gov.ae", password: "Demo@2026" },
  { label: "UoB · Admin", email: "emma.admin@bradford.ac.uk", password: "Demo@2026" },
];

const BG =
  "https://static.prod-images.emergentagent.com/jobs/3df0a28a-599b-41d8-ba79-c6c0851c9972/images/98907276cec4c68a2a3b20264a553bb8a85d020955b70f60875664c47420cdbc.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@academiaos.ai");
  const [password, setPassword] = useState("Admin@2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(formatApiError(err?.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5">
      {/* Visual / brand side */}
      <div className="relative hidden lg:flex lg:col-span-3 flex-col justify-between p-12 text-white overflow-hidden">
        <img
          src={BG}
          alt="enterprise academic intelligence"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[hsl(222.2,47.4%,11.2%)]/75" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[hsl(222.2,47.4%,11.2%)] text-xl font-bold">
              A
            </div>
            <div>
              <div className="font-semibold tracking-tight text-lg">AcademiaOS</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
                Unified Academic Intelligence
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="label-eyebrow text-white/80 mb-3">Gartner-grade · AI TRiSM ready</div>
          <h1
            className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            One operating system for every academy, university and government training authority.
          </h1>
          <p className="mt-5 text-white/75 text-sm leading-relaxed">
            Configure institutions, deploy 8 AI modules with human-in-the-loop governance, and
            switch tenants — ISB, EAIC, or Bradford — in a single click.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-xs">
          {[
            { v: "15", l: "User roles" },
            { v: "8", l: "AI modules" },
            { v: "7", l: "Build phases" },
          ].map((s) => (
            <div key={s.l} className="rounded-md border border-white/15 bg-white/5 p-3 backdrop-blur">
              <div className="text-3xl font-semibold tabular-nums">{s.v}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/70 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form side */}
      <div className="lg:col-span-2 flex items-center justify-center p-8 bg-card">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium mb-6">
            <ShieldCheck className="h-3.5 w-3.5" />
            Enterprise SSO ready · JWT for demo
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to AcademiaOS</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gartner-grade Academic AI Operating System
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Work email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div
                data-testid="login-error"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </div>
            )}
            <Button
              type="submit"
              data-testid="login-submit-button"
              className="w-full"
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            data-testid="login-google-button"
            onClick={() => {
              // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
              const redirectUrl = window.location.origin + "/dashboard";
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
          >
            <svg className="me-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 7.2 29.3 5 24 5 16.3 5 9.7 9.2 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43c5.3 0 10-2 13.6-5.3l-6.3-5.2C29.2 33.9 26.7 35 24 35c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 38.6 16.3 43 24 43z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.3 5.2C40.9 35 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="mt-8">
            <div className="label-eyebrow mb-2">Demo accounts</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  data-testid={`demo-${d.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="rounded-md border border-border bg-background p-2 text-start text-xs hover:bg-muted/60 transition"
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{d.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
