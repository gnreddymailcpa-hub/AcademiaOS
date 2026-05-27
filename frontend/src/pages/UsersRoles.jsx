import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/layout/Shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Search, Shield, UserCog, Sparkles } from "lucide-react";
import { useInstitution } from "../context/InstitutionContext";
import { api } from "../lib/api";

const CATEGORY_LABEL = {
  platform: "Platform",
  academic: "Academic",
  government: "Government / Corporate",
};

function ScopeBadge({ scope }) {
  const map = {
    global: "border-rose-300 bg-rose-50 text-rose-700",
    institution: "border-blue-300 bg-blue-50 text-blue-700",
    programme: "border-amber-300 bg-amber-50 text-amber-700",
    course: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-mono ${map[scope] || ""}`}>
      {scope}
    </Badge>
  );
}

export default function UsersRoles() {
  const { current } = useInstitution();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!current) return;
    api.get(`/users/${current.id}`).then((r) => setUsers(r.data)).catch(() => setUsers([]));
    api.get(`/roles`).then((r) => setRoles(r.data)).catch(() => setRoles([]));
  }, [current?.id]);

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase()) ||
      u.role?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div data-testid="users-roles-page">
      <PageHeader
        eyebrow="Identity & access"
        title="Users & Roles"
        description="15 roles · Row-level security · Permissions enforced at UI and data layer."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Shield className="h-3 w-3" /> RLS enforced
          </Badge>
        }
      />

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="roles" className="w-full">
          <TabsList>
            <TabsTrigger value="roles" data-testid="tab-roles">
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              Roles ({roles.length})
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <UserCog className="h-3.5 w-3.5 me-1.5" />
              Users ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-6">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="label-eyebrow">Role</TableHead>
                    <TableHead className="label-eyebrow">Category</TableHead>
                    <TableHead className="label-eyebrow">Scope</TableHead>
                    <TableHead className="label-eyebrow">Permissions</TableHead>
                    <TableHead className="label-eyebrow">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.key} data-testid={`role-row-${r.key}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {CATEGORY_LABEL[r.category] || r.category}
                        </Badge>
                      </TableCell>
                      <TableCell><ScopeBadge scope={r.scope} /></TableCell>
                      <TableCell>
                        <code className="text-[11px] font-mono text-muted-foreground">
                          {r.permissions.slice(0, 3).join(" · ")}
                          {r.permissions.length > 3 && ` +${r.permissions.length - 3}`}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">{r.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="ps-9"
                data-testid="users-search-input"
              />
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="label-eyebrow">Name</TableHead>
                    <TableHead className="label-eyebrow">Email</TableHead>
                    <TableHead className="label-eyebrow">Title</TableHead>
                    <TableHead className="label-eyebrow">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No users match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.title || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{u.role?.replace(/_/g, " ")}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
