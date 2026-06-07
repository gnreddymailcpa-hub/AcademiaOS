import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useInstitution } from "../context/InstitutionContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { BellRing, Plus, Trash2, Loader2 } from "lucide-react";

const CATEGORIES = ["ALL", "ACADEMIC", "EXAM", "PLACEMENT", "GENERAL", "FEE", "HOSTEL"];
const TARGET_ROLE_OPTIONS = [
  { value: "STUDENT", label: "Students" },
  { value: "FACULTY", label: "Faculty" },
  { value: "ALL", label: "Everyone" },
];

const PUBLISH_ROLES = new Set([
  "super_admin", "institution_admin", "faculty", "instructor",
  "hod", "registrar", "programme_manager",
]);
const DELETE_ADMIN_ROLES = new Set([
  "super_admin", "institution_admin", "registrar", "hod",
]);

function categoryBadge(c) {
  const tone = {
    ACADEMIC: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    EXAM: "bg-red-500/15 text-red-700 border-red-500/30",
    PLACEMENT: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    GENERAL: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    FEE: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    HOSTEL: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  }[c] || "bg-slate-500/15 text-slate-700 border-slate-500/30";
  return <Badge className={`${tone} border text-[10px] font-medium`} variant="outline">{c}</Badge>;
}

export default function ClarosCoreNotices() {
  const { current } = useInstitution();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    title: "", body: "", category: "GENERAL", target_roles: ["STUDENT", "FACULTY"],
  });
  const [posting, setPosting] = useState(false);

  const canPublish = PUBLISH_ROLES.has(user?.role);
  const canDeleteAny = DELETE_ADMIN_ROLES.has(user?.role);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const params = active === "ALL" ? "" : `?category=${active}`;
      const { data } = await api.get(`/v1/core/notices${params}`);
      setItems(data.items || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [current, active]);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setPosting(true);
    try {
      await api.post(`/v1/core/notices`, draft);
      toast.success("Notice published");
      setDraft({ title: "", body: "", category: "GENERAL", target_roles: ["STUDENT", "FACULTY"] });
      setOpenCreate(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not publish");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (n) => {
    const ownIt = n.published_by === user?.id;
    if (!ownIt && !canDeleteAny) {
      toast.error("You can only delete your own notices");
      return;
    }
    if (!window.confirm("Delete this notice?")) return;
    try {
      await api.delete(`/v1/core/notices/${n.id}`);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error("Could not delete");
    }
  };

  const toggleTargetRole = (role) => {
    setDraft((d) => {
      const has = d.target_roles.includes(role);
      return { ...d, target_roles: has ? d.target_roles.filter(r => r !== role) : [...d.target_roles, role] };
    });
  };

  if (!current) return null;

  return (
    <div data-testid="claros-core-notices-page">
      <PageHeader
        eyebrow="Claros Core · Campus ERP"
        title="Notice Board"
        description={`Latest announcements for ${current.short_name || current.name}.`}
        actions={
          canPublish && (
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="core-notice-new-btn">
                  <Plus className="h-3.5 w-3.5 me-1.5" /> New Notice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish a notice</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder="e.g. Mid-Sem schedule released"
                      data-testid="core-notice-title-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                      <SelectTrigger data-testid="core-notice-category-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => c !== "ALL").map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Target audience</label>
                    <div className="flex gap-2 mt-1.5">
                      {TARGET_ROLE_OPTIONS.map(opt => (
                        <Button
                          key={opt.value}
                          type="button"
                          size="sm"
                          variant={draft.target_roles.includes(opt.value) ? "default" : "outline"}
                          onClick={() => toggleTargetRole(opt.value)}
                          data-testid={`core-notice-role-${opt.value.toLowerCase()}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Body</label>
                    <Textarea
                      value={draft.body}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      placeholder="Full notice text…"
                      rows={5}
                      data-testid="core-notice-body-input"
                    />
                  </div>
                  <Button
                    onClick={publish}
                    disabled={posting || !draft.title.trim() || !draft.body.trim()}
                    className="w-full"
                    data-testid="core-notice-publish-btn"
                  >
                    {posting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <BellRing className="h-4 w-4 me-2" />}
                    Publish notice
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* ----- Filter tabs ----- */}
        <div className="flex gap-1.5 flex-wrap" data-testid="core-notice-tabs">
          {CATEGORIES.map(c => (
            <Button
              key={c}
              variant={active === c ? "default" : "outline"}
              size="sm"
              onClick={() => setActive(c)}
              data-testid={`core-notice-tab-${c.toLowerCase()}`}
            >
              {c}
            </Button>
          ))}
        </div>

        {/* ----- Notice cards ----- */}
        <div className="space-y-3" data-testid="core-notice-list">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12" data-testid="core-notice-empty">
              No notices in this category.
            </div>
          ) : (
            items.map(n => {
              const ownIt = n.published_by === user?.id;
              const canDelete = ownIt || canDeleteAny;
              return (
                <div
                  key={n.id}
                  className="rounded-lg border border-border bg-card p-5"
                  data-testid={`core-notice-card-${n.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        {categoryBadge(n.category)}
                        <span className="text-[10px] text-muted-foreground">
                          {n.published_at && new Date(n.published_at).toLocaleDateString(undefined, {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </span>
                        {Array.isArray(n.target_roles) && n.target_roles.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">· {n.target_roles.join(" + ")}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-base tracking-tight mb-1">{n.title}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                      {n.published_by_email && (
                        <div className="text-[10px] text-muted-foreground mt-2 opacity-70">
                          — {n.published_by_email}
                        </div>
                      )}
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(n)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        data-testid={`core-notice-delete-${n.id}`}
                        aria-label="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
