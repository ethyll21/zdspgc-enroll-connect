import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Trash2, ClipboardList, Filter, Users2 } from "lucide-react";
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

const STATUS_META: Record<string, { label: string; tone: string; bg: string; dot: string }> = {
  pending:      { label: "Pending",      tone: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-400" },
  under_review: { label: "Under Review", tone: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     dot: "bg-blue-500" },
  approved:     { label: "Approved",     tone: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  rejected:     { label: "Rejected",     tone: "text-rose-700",    bg: "bg-rose-50 border-rose-200",     dot: "bg-rose-500" },
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

  // Count per status for badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allEnrollments.length, pending: 0, under_review: 0, approved: 0, rejected: 0 };
    allEnrollments.forEach(e => { if (c[e.status] !== undefined) c[e.status]++; });
    return c;
  }, [allEnrollments]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">

      {/* ═══ Hero Header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A2540] via-[#0d3060] to-[#1a4a8a] p-6 md:p-8 shadow-xl">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white">All Enrollments</h1>
            </div>
          </div>

        </div>
      </div>

      {/* ═══ Filters + Search + Export ═══ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter pills — styled to match hero stats strip */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white border border-slate-100 px-3 py-2 shadow-sm">
          {/* All pill */}
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "all"
                ? "bg-blue-50 border-blue-200 text-slate-800 shadow-sm ring-1 ring-blue-300"
                : "bg-blue-50/50 border-blue-100 text-slate-600 hover:bg-blue-50"
            }`}
          >
            All
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === "all" ? "bg-blue-200/60 text-blue-800" : "bg-blue-100 text-blue-600"
            }`}>
              {counts.all}
            </span>
          </button>

          <span className="h-4 w-px bg-slate-200" />

          {/* Pending */}
          <button
            onClick={() => setFilter("pending")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "pending"
                ? "bg-orange-50 border-orange-200 text-orange-700 shadow-sm ring-1 ring-orange-300"
                : "bg-orange-50/50 border-orange-100 text-orange-600 hover:bg-orange-50"
            }`}
          >
            Pending
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === "pending" ? "bg-orange-200/60 text-orange-800" : "bg-orange-100 text-orange-600"
            }`}>
              {counts.pending}
            </span>
          </button>

          {/* Under Review */}
          <button
            onClick={() => setFilter("under_review")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "under_review"
                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-300"
                : "bg-blue-50/50 border-blue-100 text-blue-600 hover:bg-blue-50"
            }`}
          >
            Under Review
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === "under_review" ? "bg-blue-200/60 text-blue-800" : "bg-blue-100 text-blue-600"
            }`}>
              {counts.under_review}
            </span>
          </button>

          {/* Approved */}
          <button
            onClick={() => setFilter("approved")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "approved"
                ? "bg-green-50 border-green-200 text-green-700 shadow-sm ring-1 ring-green-300"
                : "bg-green-50/50 border-green-100 text-green-600 hover:bg-green-50"
            }`}
          >
            Approved
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === "approved" ? "bg-green-200/60 text-green-800" : "bg-green-100 text-green-600"
            }`}>
              {counts.approved}
            </span>
          </button>

          {/* Rejected */}
          <button
            onClick={() => setFilter("rejected")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "rejected"
                ? "bg-red-50 border-red-200 text-red-700 shadow-sm ring-1 ring-red-300"
                : "bg-red-50/50 border-red-100 text-red-600 hover:bg-red-50"
            }`}
          >
            Rejected
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === "rejected" ? "bg-red-200/60 text-red-800" : "bg-red-100 text-red-600"
            }`}>
              {counts.rejected}
            </span>
          </button>
        </div>

        {/* Search + Export */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, program…"
              className="pl-9 h-10 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="shrink-0 h-10 gap-2 rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-[#0A2540] hover:text-white hover:border-[#0A2540] transition-all"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
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
