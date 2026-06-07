import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Sparkles, Zap } from "lucide-react";

const CATS = ["TECHNICAL", "PROGRAMMING", "TOOL", "SOFT", "DOMAIN", "LANGUAGE"];

export default function ClarosLaunchSkills() {
  const { current } = useInstitution();
  const [skills, setSkills] = useState([]);
  const [draft, setDraft] = useState({ skill_name: "", category: "TECHNICAL", proficiency_level: 3 });
  const [saving, setSaving] = useState(false);
  const [gaps, setGaps] = useState([]);
  const [gapsLoading, setGapsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      const { data } = await api.get(`/v1/launch/skills/me`);
      setSkills(data.items || []);
    } catch {}
  }, [current]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft.skill_name.trim()) return toast.error("Skill name required");
    setSaving(true);
    try {
      await api.post(`/v1/launch/skills`, draft);
      setDraft({ skill_name: "", category: "TECHNICAL", proficiency_level: 3 });
      toast.success("Skill saved");
      await load();
    } catch (e) { toast.error("Could not save"); } finally { setSaving(false); }
  };
  const del = async (id) => {
    if (!window.confirm("Remove this skill?")) return;
    try { await api.delete(`/v1/launch/skills/${id}`); await load(); toast.success("Removed"); }
    catch { toast.error("Could not remove"); }
  };
  const analyse = async () => {
    setGapsLoading(true);
    try {
      const { data } = await api.get(`/v1/launch/skills/gaps`);
      setGaps(data.items || []);
      toast.success(`${data.items?.length || 0} gaps identified`);
    } catch { toast.error("Could not analyse"); } finally { setGapsLoading(false); }
  };

  if (!current) return null;
  const byCat = {};
  for (const s of skills) (byCat[s.category] = byCat[s.category] || []).push(s);

  return (
    <div data-testid="claros-launch-skills-page">
      <PageHeader eyebrow="Claros Launch · Skills" title="My Skills" description="Manage your skill matrix and run AI gap analysis."
        actions={<Button onClick={analyse} disabled={gapsLoading} data-testid="launch-skills-analyse-btn">
          {gapsLoading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Sparkles className="h-4 w-4 me-2" />}Analyse Gaps
        </Button>}
      />
      <div className="p-6 lg:p-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4" data-testid="launch-skill-add-form">
            <h3 className="font-semibold text-sm mb-3">Add / Update skill</h3>
            <div className="space-y-2.5">
              <Input value={draft.skill_name} onChange={(e) => setDraft({ ...draft, skill_name: e.target.value })} placeholder="e.g. React" data-testid="launch-skill-name-input" />
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger data-testid="launch-skill-cat-select"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <div>
                <label className="text-xs text-muted-foreground">Proficiency: <strong>{draft.proficiency_level}</strong> / 5</label>
                <input type="range" min="1" max="5" value={draft.proficiency_level} onChange={(e) => setDraft({ ...draft, proficiency_level: parseInt(e.target.value) })} className="w-full mt-1" data-testid="launch-skill-prof-slider" />
              </div>
              <Button onClick={save} disabled={saving || !draft.skill_name.trim()} className="w-full" data-testid="launch-skill-save-btn">
                {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}Save Skill
              </Button>
            </div>
          </div>
          {gaps.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="launch-gaps-panel">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" />AI-identified skill gaps</h3>
              <ul className="space-y-2.5">
                {gaps.map((g, i) => (
                  <li key={i} className="text-sm" data-testid={`launch-gap-${i}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant={g.urgency === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">{g.urgency}</Badge>
                      <span className="font-medium">{g.skill}</span>
                      <span className="text-[10px] text-muted-foreground ms-auto">~{g.learn_in_weeks}w</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{g.gap_description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-lg border border-border bg-card p-5" data-testid="launch-skills-by-cat">
            <h3 className="font-semibold text-sm mb-4">Your skills · {skills.length} total</h3>
            {Object.keys(byCat).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground" data-testid="launch-skills-empty">No skills added yet.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(byCat).map(([cat, list]) => (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{cat}</div>
                    <ul className="space-y-1.5">
                      {list.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-3 py-2 rounded border border-border" data-testid={`launch-skill-${s.skill_name}`}>
                          <span className="font-medium text-sm flex-1">{s.skill_name}</span>
                          <div className="flex gap-0.5">{Array.from({length: 5}).map((_, i) => (<div key={i} className={`h-2 w-4 rounded-sm ${i < s.proficiency_level ? "bg-primary" : "bg-muted"}`} />))}</div>
                          <Button size="icon" variant="ghost" onClick={() => del(s.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive" data-testid={`launch-skill-delete-${s.skill_name}`}><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
