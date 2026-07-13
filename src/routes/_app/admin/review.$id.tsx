import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollments as enrollmentsApi, documents as documentsApi } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, FileText, Download, CheckCircle, XCircle, Clock, History, Printer } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_app/admin/review/$id")({
  component: AdminReviewApplication,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending",      tone: "text-warning" },
  under_review: { label: "Under Review", tone: "text-secondary" },
  approved:     { label: "Approved",     tone: "text-success" },
  rejected:     { label: "Rejected",     tone: "text-destructive" },
};

function AdminReviewApplication() {
  const { id } = Route.useParams();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewRemarks, setReviewRemarks] = useState<string>("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: enrollment, isLoading: isEnrollmentLoading } = useQuery({
    enabled: isAdmin && !!id,
    queryKey: ["admin-enrollment", id],
    queryFn: () => enrollmentsApi.getById(id).then((r) => {
      setReviewStatus(r.enrollment.status);
      setReviewRemarks(r.enrollment.remarks ?? "");
      return r.enrollment;
    }),
  });

  const { data: documents = [], isLoading: isDocsLoading } = useQuery({
    enabled: isAdmin && !!enrollment?.student_id,
    queryKey: ["admin-documents", enrollment?.student_id],
    queryFn: () => documentsApi.list({ student_id: enrollment?.student_id }).then((r) => r.documents),
  });

  const { data: history = [] } = useQuery({
    enabled: isAdmin && !!id,
    queryKey: ["admin-history", id],
    queryFn: () => enrollmentsApi.history(id).then((r) => r.history),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      enrollmentsApi.review(id, { status: reviewStatus, remarks: reviewRemarks || undefined }),
    onSuccess: () => {
      toast.success("Enrollment status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-enrollment", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-history", id] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update status"),
  });

  const docReviewMutation = useMutation({
    mutationFn: ({ docId, status, remarks }: { docId: string, status: string, remarks?: string }) => 
      documentsApi.review(docId, { status, remarks }),
    onSuccess: () => {
      toast.success("Document status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-documents", enrollment?.student_id] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to review document"),
  });

  if (!isAdmin) return null;

  if (isEnrollmentLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading details...</div>;
  }

  if (!enrollment) {
    return <div className="p-8 text-center text-destructive">Enrollment not found.</div>;
  }

  const meta = STATUS_META[enrollment.status] ?? { label: enrollment.status, tone: "" };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20 print:pb-0">
      {/* Print-only Header */}
      <div className="hidden print:block text-center mb-8 pb-4 border-b">
        <h1 className="text-2xl font-bold uppercase">ZDSPGC-Dimataling</h1>
        <h2 className="text-xl font-semibold">Enrollment Status Report</h2>
        <p className="text-slate-500">Date Generated: {format(new Date(), "PPp")}</p>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="print:hidden" onClick={() => navigate({ to: "/admin/applications" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-800 print:text-2xl">
            Application Details
          </h1>
          <p className="text-sm text-slate-500">
            Reviewing enrollment for {enrollment.first_name} {enrollment.last_name}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="hidden md:flex">
            <Printer className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border bg-white shadow-sm ${meta.tone}`}>
            Current Status: {meta.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-1 print:gap-8">
        {/* Left Column: Student Info & History */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Student Information</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Full Name</p>
                <p className="font-medium">{enrollment.first_name} {enrollment.last_name}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Student No / Email</p>
                <p className="font-medium">{enrollment.student_no ?? "—"} <br/><span className="text-slate-400">{enrollment.student_email}</span></p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Program</p>
                <p className="font-medium">{enrollment.program_name}</p>
                <p className="text-slate-400 text-xs">{enrollment.program_code}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Term</p>
                <p className="font-medium">{enrollment.school_year} - {enrollment.semester}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Submitted On</p>
                <p className="font-medium">{format(new Date(enrollment.submitted_at), "PPP p")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4 flex items-center gap-2">
              <History className="h-4 w-4" /> Validation History
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No previous validations.</p>
            ) : (
              <ul className="space-y-4">
                {history.map((record) => (
                  <li key={record.id} className="text-sm relative pl-4 border-l-2 border-slate-200">
                    <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-slate-300 border-2 border-white"></div>
                    <p className="font-medium capitalize">{record.result.replace("_", " ")}</p>
                    <p className="text-xs text-slate-500">by {record.validated_by_name ?? "Admin"} on {format(new Date(record.created_at), "MMM d, h:mm a")}</p>
                    {record.notes && (
                      <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded">"{record.notes}"</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column: Documents and Actions */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Required Documents</h2>
            {isDocsLoading ? (
              <p className="text-sm text-slate-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded by this student.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {documents.map((doc) => {
                  const fileUrl = documentsApi.fileUrl(doc.id);
                  const isImage = doc.mime_type?.startsWith("image/") || doc.file_name.match(/\\.(jpg|jpeg|png|gif)$/i);
                  const isPdf = doc.mime_type === "application/pdf" || doc.file_name.match(/\\.pdf$/i);

                  return (
                    <div key={doc.id} className="flex flex-col gap-4 p-4 border rounded-lg bg-slate-50 shadow-sm print:shadow-none print:bg-white">
                      <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div className="flex items-center gap-3 mb-3 md:mb-0">
                          <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{doc.doc_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-slate-500">{doc.file_name} • {(doc.size_bytes! / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700 print:border-emerald-500' : 
                            doc.status === 'rejected' ? 'bg-rose-100 text-rose-700 print:border-rose-500' : 'bg-amber-100 text-amber-700 print:border-amber-500'
                          } print:border print:bg-transparent`}>
                            {doc.status}
                          </span>
                          
                          <div className="flex bg-white shadow-sm border rounded-md p-1 gap-1 print:hidden">
                            <Button 
                              variant={doc.status === 'approved' ? 'default' : 'ghost'} 
                              size="icon" 
                              className={`h-8 w-8 ${doc.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              onClick={() => docReviewMutation.mutate({ docId: doc.id, status: 'approved' })}
                            >
                              <CheckCircle className="h-5 w-5" />
                            </Button>
                            <Button 
                              variant={doc.status === 'rejected' ? 'destructive' : 'ghost'} 
                              size="icon" 
                              className={`h-8 w-8 ${doc.status === 'rejected' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'text-rose-600 hover:bg-rose-50'}`}
                              onClick={() => {
                                const reason = window.prompt("Reason for rejection:");
                                if (reason !== null) {
                                  docReviewMutation.mutate({ docId: doc.id, status: 'rejected', remarks: reason });
                                }
                              }}
                            >
                              <XCircle className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {doc.status === "rejected" && doc.remarks && (
                        <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-100">
                          <span className="font-semibold">Rejection Reason:</span> {doc.remarks}
                        </div>
                      )}

                      <div className="w-full overflow-hidden rounded-md border bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[800px] relative print:hidden">
                        {isImage ? (
                          <img src={fileUrl} alt={doc.file_name} className="object-contain w-full h-full max-h-[800px]" />
                        ) : isPdf ? (
                          <iframe src={fileUrl} className="w-full h-[800px] border-0" title={doc.file_name} />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 text-center">
                            <FileText className="h-10 w-10 text-slate-400 mb-2" />
                            <p className="text-sm text-slate-500 mb-4">Preview not available for this file type.</p>
                            <Button
                              variant="outline"
                              onClick={() => window.open(fileUrl, "_blank")}
                            >
                              <Download className="mr-2 h-4 w-4" /> Download File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm border-blue-100 print:border-none print:shadow-none print:p-0">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Final Decision</h2>
            
            <div className="space-y-4 print:hidden">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Update Enrollment Status</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger className="w-full md:w-64 bg-slate-50">
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

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Feedback / Remarks (Sent to student)</label>
                <Input 
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="e.g., Your documents have been verified and you are now officially enrolled."
                  className="bg-slate-50"
                />
              </div>

              <div className="pt-2">
                <Button 
                  onClick={() => reviewMutation.mutate()} 
                  disabled={reviewMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {reviewMutation.isPending ? "Saving..." : "Save Application Decision"}
                </Button>
              </div>
            </div>

            {/* Print-only display */}
            <div className="hidden print:block space-y-2 mt-4 text-sm">
              <p><strong className="text-slate-600">Decision Status:</strong> <span className="uppercase font-semibold">{enrollment.status.replace("_", " ")}</span></p>
              <p><strong className="text-slate-600">Registrar Remarks:</strong> <br/> {enrollment.remarks || <em className="text-slate-400">No remarks provided.</em>}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
