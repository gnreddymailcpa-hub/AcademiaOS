import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Badge } from "../components/ui/badge";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { Loader2, CalendarClock } from "lucide-react";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const COLOR_PALETTE = [
  "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "bg-rose-500/15 text-rose-700 border-rose-500/30",
  "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
];

function colourFor(code) {
  let h = 0;
  for (let i = 0; i < (code || "").length; i++) h = (h * 31 + code.charCodeAt(i)) % COLOR_PALETTE.length;
  return COLOR_PALETTE[h];
}

export default function ClarosCoreTimetable() {
  const { current } = useInstitution();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/v1/core/timetable/me`);
      setSlots(data.slots || []);
    } catch (e) {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { load(); }, [load]);

  if (!current) return null;

  // Group by day & hour
  const grid = {};  // day -> hourKey -> slot
  for (const s of slots) {
    grid[s.day_of_week] = grid[s.day_of_week] || {};
    grid[s.day_of_week][s.start_time] = s;
  }

  return (
    <div data-testid="claros-core-timetable-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="My Timetable"
        description="Weekly schedule · current semester · 2025-26."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <CalendarClock className="h-3 w-3" /> {slots.length} slots
          </Badge>
        }
      />

      <div className="p-6 lg:p-8">
        {loading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading timetable…
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground" data-testid="core-timetable-empty">
            No timetable slots are scheduled for you yet.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto" data-testid="core-timetable-grid">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground w-20">Time</th>
                  {DAY_LABELS.map((d, i) => (
                    <th key={i} className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[140px]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-xs font-mono text-muted-foreground tabular-nums align-top">{h}</td>
                    {DAY_LABELS.map((_, di) => {
                      const slot = grid[di]?.[h];
                      return (
                        <td key={di} className="p-2 align-top">
                          {slot ? (
                            <div
                              className={`rounded-md border px-2.5 py-2 ${colourFor(slot.course_code)}`}
                              data-testid={`core-slot-${slot.id}`}
                            >
                              <div className="text-[11px] font-semibold leading-tight">{slot.course_code}</div>
                              <div className="text-[10px] opacity-80 leading-tight truncate mt-0.5">
                                {slot.course_name}
                              </div>
                              <div className="text-[9px] opacity-70 mt-1">Room {slot.room}</div>
                              <div className="text-[9px] opacity-60">{slot.start_time}–{slot.end_time}</div>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
