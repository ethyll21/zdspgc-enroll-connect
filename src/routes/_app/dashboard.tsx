import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_META } from "@/lib/enrollment-constants";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user } = useAuth();

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, year_level, academic_year, semester, submitted_at, admin_remarks, program:programs(name, code)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
    correction: apps.filter((a) => a.status === "correction").length,
  };

  const stats = [
    { label: "Pending", value: counts.pending, icon: Clock, tone: "text-warning" },
    { label: "Approved", value: counts.approved, icon: CheckCircle2, tone: "text-success" },
    { label: "Correction", value: counts.correction, icon: AlertCircle, tone: "text-secondary" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "text-destructive" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Welcome back</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button asChild>
          <Link to="/apply">
            <FilePlus2 className="mr-2 h-4 w-4" /> Start new application
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">My applications</h2>
          </div>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : apps.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">No applications yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Submit your first pre-enrollment application to get started.</p>
            <Button asChild className="mt-4">
              <Link to="/apply">
                <FilePlus2 className="mr-2 h-4 w-4" /> Start application
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {apps.map((a: any) => {
              const meta = STATUS_META[a.status];
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">
                      {a.program?.name} <span className="text-muted-foreground">({a.program?.code})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.year_level} · {a.semester} · A.Y. {a.academic_year} · Submitted{" "}
                      {formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true })}
                    </p>
                    {a.admin_remarks && (
                      <p className="mt-1 text-xs text-secondary">Registrar note: {a.admin_remarks}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/applications/$appId" params={{ appId: a.id }}>View</Link>
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
