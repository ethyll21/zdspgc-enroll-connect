import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_META } from "@/lib/enrollment-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/applications")({
  component: AdminApplications,
});

const FILTERS = ["all", "pending", "approved", "correction", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function AdminApplications() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: apps = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-apps-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, submitted_at, year_level, student_type, program:programs(name, code), profile:profiles!applications_student_id_fkey(full_name, email)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return apps.filter((a: any) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (q) {
        const hay = `${a.profile?.full_name ?? ""} ${a.profile?.email ?? ""} ${a.program?.name ?? ""} ${a.program?.code ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [apps, filter, q]);

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <header>
        <h1 className="font-display text-3xl font-semibold text-primary">All Applications</h1>
        <p className="text-sm text-muted-foreground">Review and validate student submissions.</p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-md border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, program" className="pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3 hidden md:table-cell">Program</th>
              <th className="px-4 py-3 hidden lg:table-cell">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No applications match this filter.</td></tr>
            ) : filtered.map((a: any) => {
              const meta = STATUS_META[a.status];
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.profile?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{a.profile?.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p>{a.program?.code}</p>
                    <p className="text-xs text-muted-foreground">{a.year_level} · {a.student_type}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {format(new Date(a.submitted_at), "PPp")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/applications/$appId" params={{ appId: a.id }}>Review</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
