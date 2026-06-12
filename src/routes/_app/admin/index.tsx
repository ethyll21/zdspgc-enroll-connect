import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, AlertCircle, Users, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_META } from "@/lib/enrollment-constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: apps = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-apps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, submitted_at, year_level, program:programs(name, code), profile:profiles!applications_student_id_fkey(full_name, email)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isAdmin) return null;

  const counts = {
    total: apps.length,
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    correction: apps.filter((a) => a.status === "correction").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  const stats = [
    { label: "Total Applicants", value: counts.total, icon: Users, tone: "text-primary" },
    { label: "Pending", value: counts.pending, icon: Clock, tone: "text-warning" },
    { label: "Approved", value: counts.approved, icon: CheckCircle2, tone: "text-success" },
    { label: "Correction", value: counts.correction, icon: AlertCircle, tone: "text-secondary" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "text-destructive" },
  ];

  const recent = apps.slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Registrar Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of all pre-enrollment activity.</p>
        </div>
        <Button asChild>
          <Link to="/admin/applications"><FileSearch className="mr-2 h-4 w-4" /> All applications</Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Recent submissions</h2>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((a: any) => {
              const meta = STATUS_META[a.status];
              return (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.profile?.full_name || a.profile?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.program?.code} · {a.year_level}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/applications/$appId" params={{ appId: a.id }}>Review</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
