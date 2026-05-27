import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
//
// This page is rendered at /dashboard when the URL fragment contains
// `session_id=...` (the Emergent OAuth redirect). It exchanges the
// session_id for our app JWT and then bounces to the real dashboard.
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
        }
        await refresh();
        // strip fragment + go to dashboard
        window.history.replaceState({}, "", "/");
        navigate("/", { replace: true });
        toast.success(`Welcome, ${data.user?.name || "AcademiaOS"}`);
      } catch (e) {
        const msg =
          e?.response?.data?.detail || "Google sign-in failed. Please try again.";
        toast.error(msg);
        navigate("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Signing you in with Google…</p>
      </div>
    </div>
  );
}
