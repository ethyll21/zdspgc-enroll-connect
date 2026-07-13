import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, Download, Trash2 } from "lucide-react";
import { enrollments as enrollmentsApi } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/applications")({
  component: AdminApplications,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending",      tone: "text-warning" },
  under_review: { label: "Under Review", tone: "text-secondary" },
  approved:     { label: "Approved",     tone: "text-success" },
  rejected:     { label: "Rejected",     tone: "text-destructive" },
};

const FILTERS = ["all", "pending", "under_review", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function AdminApplications() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewRemarks, setReviewRemarks] = useState<string>("");

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

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks: string }) =>
      enrollmentsApi.review(id, { status, remarks: remarks || undefined }),
    onSuccess: () => {
      toast.success("Enrollment status updated");
      setReviewing(null);
      setReviewRemarks("");
      queryClient.invalidateQueries({ queryKey: ["admin-enrollments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-enrollment-stats"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update status"),
  });

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
    if (confirm("Are you sure you want to delete this enrollment? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
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
        <p className="text-sm text-muted-foreground">Review and validate student enrollment submissions.</p>
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
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3 hidden md:table-cell">Program</th>
              <th className="px-4 py-3 hidden md:table-cell">Period</th>
              <th className="px-4 py-3 hidden lg:table-cell">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No enrollments match this filter.</td></tr>
            ) : filtered.map((e) => {
              const meta = STATUS_META[e.status] ?? { label: e.status, tone: "" };
              const isReviewing = reviewing === e.id;
              return (
                <>
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-muted-foreground">{e.student_email ?? e.student_no}</p>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (isReviewing) {
                              setReviewing(null);
                            } else {
                              setReviewing(e.id);
                              setReviewStatus(e.status);
                              setReviewRemarks(e.remarks ?? "");
                            }
                          }}
                        >
                          {isReviewing ? "Cancel" : "Quick Action"}
                          <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isReviewing ? "rotate-180" : ""}`} />
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/admin/review/$id" params={{ id: e.id }}>Full Details</Link>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleDelete(e.id)}
                          disabled={deleteMutation.isPending}
                          className="px-2"
                          title="Delete Application"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline review panel */}
                  {isReviewing && (
                    <tr key={`${e.id}-review`}>
                      <td colSpan={6} className="bg-muted/30 px-4 pb-4 pt-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                          <div className="space-y-1 flex-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Update Status
                            </label>
                            <Select value={reviewStatus} onValueChange={setReviewStatus}>
                              <SelectTrigger className="w-full md:w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="under_review">Under Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1 flex-[2]">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Remarks (optional)
                            </label>
                            <Input
                              value={reviewRemarks}
                              onChange={(e) => setReviewRemarks(e.target.value)}
                              placeholder="Add a note for the student…"
                            />
                          </div>
                          <Button
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({ id: e.id, status: reviewStatus, remarks: reviewRemarks })
                            }
                          >
                            {reviewMutation.isPending ? "Saving…" : "Save Decision"}
                          </Button>
                        </div>
                        {e.remarks && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Previous note: <em>{e.remarks}</em>
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
