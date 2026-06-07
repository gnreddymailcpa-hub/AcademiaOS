import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Briefcase, Calendar, MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";

const TABS = ["UPCOMING", "ONGOING", "COMPLETED", "ALL"];

export default function ClarosLaunchDrives() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [tab, setTab] = useState("UPCOMING");
  const [drives, setDrives] = useState([]);
  const [eligibility, setEligibility] = useState({});  // driveId -> {eligible, reasons}
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const isStudent = user?.role === "student";

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const params = tab === "ALL" ? "" : `?status=${tab}`;
      const { data } = await api.get(`/v1/launch/drives${params}`);
      setDrives(data.items || []);
      if (isStudent) {
        const elig = {};
        await Promise.all((data.items || []).map(async d => {
          try { const { data: e } = await api.get(`/v1/launch/drives/${d.id}/eligible`); elig[d.id] = e; } catch {}
        }));
        setEligibility(elig);
      }
    } catch {} finally { setLoading(false); }
  }, [current, tab, isStudent]);

  useEffect(() => { load(); }, [load]);

  const apply = async (d) => {
    setApplyingId(d.id);
    try {
      await api.post(`/v1/launch/drives/${d.id}/apply`);
      toast.success(`Applied to ${d.company_name}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not apply");
    } finally { setApplyingId(null); }
  };

  if (!current) return null;
  return (
    <div data-testid="claros-launch-drives-page">
      <PageHeader eyebrow="Claros Launch · Placement Drives" moduleId="claros-launch" title="Placement Drives" description="Upcoming and historical on-campus drives." />
      <div className="p-6 lg:p-8 space-y-4">
        <div className="flex gap-1.5" data-testid="launch-drives-tabs">
          {TABS.map(t => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} data-testid={`launch-drives-tab-${t}`}>{t}</Button>
          ))}
        </div>
        {loading ? <div className="text-center py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" />Loading…</div> :
         drives.length === 0 ? <div className="text-center py-12 text-sm text-muted-foreground" data-testid="launch-drives-empty">No drives in this tab.</div> :
         (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="launch-drives-grid">
            {drives.map(d => {
              const e = eligibility[d.id];
              return (
                <div key={d.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2" data-testid={`launch-drive-${d.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold">{d.company_name?.[0]}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{d.company_name}</div>
                      <div className="text-[11px] text-muted-foreground">{d.industry}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                  </div>
                  <div className="text-sm">{d.job_role}</div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{d.drive_date}</div>
                    <div className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" />₹{d.package_offered}L · CGPA ≥ {d.min_cgpa}</div>
                  </div>
                  {isStudent && d.status === "UPCOMING" && (
                    <div className="mt-1">
                      {e?.eligible ? (
                        <Button size="sm" className="w-full" onClick={() => apply(d)} disabled={applyingId === d.id} data-testid={`launch-apply-${d.id}`}>
                          {applyingId === d.id ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />}Apply
                        </Button>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] w-full justify-start gap-1" data-testid={`launch-ineligible-${d.id}`}>
                          <XCircle className="h-3 w-3" /> {e?.reasons?.[0] || "Not eligible"}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
