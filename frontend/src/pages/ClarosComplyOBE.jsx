import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Loader2, GraduationCap, BookOpen, Grid3x3 } from "lucide-react";

const LEVEL_TONES = {
  0: "bg-muted/40 text-muted-foreground",
  1: "bg-amber-500/20 text-amber-700",
  2: "bg-blue-500/20 text-blue-700",
  3: "bg-emerald-500/20 text-emerald-700",
};
const LEVEL_LABELS = { 0: "—", 1: "L", 2: "M", 3: "H" };

export default function ClarosComplyOBE() {
  const { current } = useInstitution();
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState("");
  const [outcomes, setOutcomes] = useState(null);
  const [tab, setTab] = useState("PO");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPrograms = useCallback(async () => {
    if (!current) return;
    try {
      const { data } = await api.get(`/v1/comply/obe/programs`);
      setPrograms(data.items || []);
      if (!programId && data.items?.length) setProgramId(data.items[0].id);
    } catch (e) {
      setPrograms([]);
    }
  }, [current, programId]);

  const loadOutcomes = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/v1/comply/obe/${programId}/outcomes`);
      setOutcomes(data);
    } catch (e) {
      setOutcomes(null);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);
  useEffect(() => { loadOutcomes(); }, [loadOutcomes]);

  const setMapping = async (co_id, po_id, level) => {
    setSaving(true);
    // optimistic
    setOutcomes(prev => {
      if (!prev) return prev;
      const others = (prev.mappings || []).filter(m => !(m.course_outcome_id === co_id && m.program_outcome_id === po_id));
      return { ...prev, mappings: [...others, {
        id: "tmp-" + co_id + po_id,
        course_outcome_id: co_id, program_outcome_id: po_id, mapping_level: level,
      }] };
    });
    try {
      await api.post(`/v1/comply/obe/mapping`, {
        course_outcome_id: co_id, program_outcome_id: po_id, level,
      });
    } catch (e) {
      toast.error("Could not save mapping");
      loadOutcomes();
    } finally {
      setSaving(false);
    }
  };

  if (!current) return null;
  const tabs = [
    { key: "PO", label: "Program Outcomes", icon: GraduationCap },
    { key: "CO", label: "Course Outcomes", icon: BookOpen },
    { key: "MAT", label: "CO-PO Mapping", icon: Grid3x3 },
  ];

  return (
    <div data-testid="claros-comply-obe-page">
      <PageHeader
        eyebrow="Claros Comply · OBE Framework"
        title="Outcomes-Based Education"
        description="Program Outcomes (POs), Course Outcomes (COs), and the CO-PO mapping matrix."
        actions={
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger className="w-64" data-testid="comply-obe-program-select"><SelectValue placeholder="Pick a program" /></SelectTrigger>
            <SelectContent>
              {programs.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* ----- Tabs ----- */}
        <div className="flex gap-1.5" data-testid="comply-obe-tabs">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
              data-testid={`comply-obe-tab-${t.key.toLowerCase()}`}
            >
              <t.icon className="h-3.5 w-3.5 me-1.5" /> {t.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading outcomes…
          </div>
        ) : !outcomes ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            Pick a program to view its outcomes.
          </div>
        ) : tab === "PO" ? (
          <div className="rounded-lg border border-border bg-card" data-testid="comply-obe-pos-list">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Program Outcomes · {outcomes.program?.code}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">AICTE-standard PO1 to PO12 for engineering programmes.</p>
            </div>
            {outcomes.program_outcomes.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No POs defined for this program.</div>
            ) : (
              <ol className="divide-y divide-border">
                {outcomes.program_outcomes.map(po => (
                  <li key={po.id} className="px-5 py-3 flex items-start gap-3" data-testid={`comply-obe-po-${po.po_code}`}>
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">{po.po_code}</Badge>
                    <span className="text-sm leading-relaxed">{po.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : tab === "CO" ? (
          <div className="rounded-lg border border-border bg-card" data-testid="comply-obe-cos-list">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Course Outcomes · {outcomes.course_outcomes.length} total</h3>
            </div>
            {outcomes.course_outcomes.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No COs defined yet.</div>
            ) : (
              <ol className="divide-y divide-border">
                {outcomes.course_outcomes.map(co => {
                  const course = outcomes.courses.find(c => c.id === co.course_id);
                  return (
                    <li key={co.id} className="px-5 py-3" data-testid={`comply-obe-co-${co.co_code}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="font-mono text-[10px]">{co.co_code}</Badge>
                        {course && <span className="text-[10px] text-muted-foreground">{course.code} · {course.name}</span>}
                      </div>
                      <p className="text-sm leading-relaxed">{co.description}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : (
          /* ----- CO-PO Matrix ----- */
          <div className="rounded-lg border border-border bg-card overflow-auto" data-testid="comply-obe-matrix">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <h3 className="font-semibold text-sm">CO-PO Mapping Matrix</h3>
              <span className="text-[10px] text-muted-foreground">— click a cell to cycle 0 → 1 → 2 → 3</span>
              {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {outcomes.course_outcomes.length === 0 || outcomes.program_outcomes.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Need at least 1 CO and 1 PO to render the matrix.
              </div>
            ) : (
              <table className="text-xs">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-card z-10 min-w-[140px]">CO ↓ / PO →</th>
                    {outcomes.program_outcomes.map(po => (
                      <th key={po.id} className="p-2 text-center min-w-[44px] font-mono font-medium">{po.po_code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outcomes.course_outcomes.map(co => (
                    <tr key={co.id} className="border-b border-border/50 last:border-0">
                      <td className="p-2 sticky left-0 bg-card font-mono text-[10px]">{co.co_code}</td>
                      {outcomes.program_outcomes.map(po => {
                        const m = (outcomes.mappings || []).find(x => x.course_outcome_id === co.id && x.program_outcome_id === po.id);
                        const level = m?.mapping_level ?? 0;
                        return (
                          <td key={po.id} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => setMapping(co.id, po.id, (level + 1) % 4)}
                              className={`w-9 h-9 rounded font-semibold text-[11px] tabular-nums ${LEVEL_TONES[level]}`}
                              data-testid={`comply-obe-cell-${co.co_code}-${po.po_code}`}
                              title={`${co.co_code} → ${po.po_code} · level ${level}`}
                            >
                              {LEVEL_LABELS[level]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
