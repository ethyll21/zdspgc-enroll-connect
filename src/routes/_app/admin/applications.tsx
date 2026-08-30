import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Trash2 } from "lucide-react";
import { enrollments as enrollmentsApi, profiles } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/admin/applications")({
  component: AdminApplications,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending",      tone: "text-slate-500" },
  under_review: { label: "Under Review", tone: "text-blue-600" },
  approved:     { label: "Approved",     tone: "text-emerald-600" },
  rejected:     { label: "Rejected",     tone: "text-rose-600" },
};

const FILTERS = ["all", "pending", "under_review", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function AdminApplications() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: allEnrollments = [], isLoading, error } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-enrollments-all"],
    queryFn: () => enrollmentsApi.list({ limit: 200 }).then((r) => r.enrollments),
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    return allEnrollments.filter((e) => {
      if (filter !== "all" && e.status !== filter) return false;
      if (q) {
        const hay = `${e.first_name ?? ""} ${e.last_name ?? ""} ${e.student_email ?? ""} ${e.program_name ?? ""} ${e.program_code ?? ""} ${e.student_no ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [allEnrollments, filter, q]);


  const deleteMutation = useMutation({
    mutationFn: (id: string) => enrollmentsApi.delete(id),
    onSuccess: () => {
      toast.success("Enrollment application deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-enrollments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-enrollment-stats"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to delete enrollment"),
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Student Name", "Email", "Program Code", "Program Name", "School Year", "Semester", "Status", "Submitted At", "Remarks"];
    const rows = filtered.map(e => [
      `"${e.first_name} ${e.last_name}"`,
      `"${e.student_email ?? e.student_no}"`,
      `"${e.program_code ?? ""}"`,
      `"${e.program_name ?? ""}"`,
      `"${e.school_year}"`,
      `"${e.semester}"`,
      `"${e.status}"`,
      `"${format(new Date(e.submitted_at), "yyyy-MM-dd HH:mm")}"`,
      `"${e.remarks ?? ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enrollments_export_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported successfully");
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <header>
        <h1 className="font-display text-3xl font-semibold text-primary">All Enrollments</h1>

      </header>

      {/* Filters */}
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
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, program…"
            className="pl-9"
          />
        </div>
        <Button onClick={exportToCSV} variant="outline" className="shrink-0 gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3 hidden md:table-cell">Program</th>
              <th className="px-4 py-3 hidden md:table-cell">Period</th>
              <th className="px-4 py-3 hidden lg:table-cell">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No enrollments match this filter.</td></tr>
            ) : filtered.map((e) => {
              const meta = STATUS_META[e.status] ?? { label: e.status, tone: "" };
              return (
                <>
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {(e as any).avatar_url ? (
                          <img
                            src={profiles.avatarUrl((e as any).avatar_url)}
                            alt={`${e.first_name} ${e.last_name}`}
                            className="h-12 w-12 rounded-full object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-border">
                            <span className="text-sm font-semibold text-primary">
                              {(e.first_name?.[0] ?? "").toUpperCase()}{(e.last_name?.[0] ?? "").toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{e.first_name} {e.last_name}</p>
                          <p className="text-xs text-muted-foreground">{e.student_email ?? e.student_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p>{e.program_code ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{e.program_name}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {e.school_year}<br />{e.semester}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {format(new Date(e.submitted_at), "PP")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/admin/review/$id" params={{ id: e.id }}>Full Details</Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              disabled={deleteMutation.isPending}
                              className="px-2"
                              title="Delete Application"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure you want to delete this enrollment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(e.id)}>Yes</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
