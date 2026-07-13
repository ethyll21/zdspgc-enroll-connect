import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, Eye, CheckCircle2, XCircle, AlertCircle, ExternalLink, Printer } from "lucide-react";
import { enrollments as enrollmentsApi, documents as docsApi, students as studentsApi } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/applications/$appId")({
  component: ApplicationDetail,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending",      tone: "text-warning" },
  under_review: { label: "Under Review", tone: "text-secondary" },
  approved:     { label: "Approved",     tone: "text-success" },
  rejected:     { label: "Rejected",     tone: "text-destructive" },
};

const DOC_LABELS: Record<string, string> = {
  psa_birth_certificate: "PSA Birth Certificate",
  form_138:              "Form 138 (Report Card)",
  good_moral:            "Good Moral Certificate",
  transfer_certificate:  "Transfer Credentials",
  other:                 "Other Supporting Documents",
};

function ApplicationDetail() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("other");
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRejectRemarks, setDocRejectRemarks] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["enrollment-detail", appId],
    queryFn: () => enrollmentsApi.getById(appId),
  });

  const { data: studentData } = useQuery({
    queryKey: ["student-detail", data?.enrollment.student_id],
    queryFn: () => studentsApi.getById(data!.enrollment.student_id),
    enabled: !!data?.enrollment.student_id,
  });

  const { data: myDocs } = useQuery({
    queryKey: ["enrollment-docs", appId],
    queryFn: () => docsApi.list({ student_id: data?.enrollment.student_id }),
    enabled: !!data?.enrollment.student_id,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { status: string; remarks?: string }) =>
      enrollmentsApi.review(appId, payload),
    onSuccess: () => {
      toast.success("Decision saved successfully");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-enrollments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-enrollment-stats"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to save decision"),
  });

  const docReviewMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks?: string }) =>
      docsApi.review(id, { status, remarks }),
    onSuccess: () => {
      toast.success("Document status updated");
      queryClient.invalidateQueries({ queryKey: ["enrollment-docs", appId] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update document"),
  });

  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or less");
      return;
    }
    setUploading(true);
    try {
      await docsApi.upload(file, selectedDocType);
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["enrollment-docs", appId] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to upload document");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!isAdmin || !myDocs || !data) return;
    const docs = myDocs.documents;
    if (docs.length === 0) return;
    
    // We only auto-update if all documents are processed (no 'pending')
    const hasPending = docs.some(d => d.status === "pending");
    if (hasPending) return;

    const allApproved = docs.every(d => d.status === "approved");
    const anyRejected = docs.some(d => d.status === "rejected");
    
    if (allApproved && data.enrollment.status !== "approved") {
      reviewMutation.mutate({ status: "approved", remarks: "All documents automatically verified." });
    } else if (anyRejected && data.enrollment.status !== "under_review" && data.enrollment.status !== "rejected") {
      reviewMutation.mutate({ status: "under_review", remarks: "Some documents were rejected. Please review them." });
    }
  }, [myDocs, data, isAdmin]);

  if (isLoading || !data) {
    return <p className="p-6 text-muted-foreground">Loading enrollment details…</p>;
  }

  const { enrollment } = data;
  const meta = STATUS_META[enrollment.status] ?? { label: enrollment.status, tone: "" };
  const docs = myDocs?.documents ?? [];
  const isOwner = !isAdmin;

  const decide = (status: "approved" | "rejected" | "under_review") => {
    if (status !== "approved" && !remarks.trim()) {
      toast.error("Please add remarks before rejecting or setting under review");
      return;
    }
    reviewMutation.mutate({ status, remarks: remarks || undefined });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 print:pb-0 print:max-w-none print:m-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={isAdmin ? "/admin/applications" : "/dashboard"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => window.print()} variant="outline" className="hidden md:flex">
          <Printer className="mr-2 h-4 w-4" /> Print Pre-Enrollment Form
        </Button>
      </div>

      {/* Print-only layout — matches ZDSPGC College Enrollment Form */}
      <div className="hidden print:block space-y-4 bg-white text-black p-6 text-[11px] leading-tight">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3">
          <p className="text-[10px] uppercase">Republic of the Philippines</p>
          <h1 className="text-lg font-bold uppercase tracking-wide">Zamboanga del Sur Provincial Government College</h1>
          <p className="text-[10px] uppercase">Dimataling Campus · Dimataling, Zamboanga del Sur</p>
          <h2 className="text-base font-bold mt-2 uppercase border-t border-b border-black py-1">College Enrollment Form</h2>
          <p className="text-[9px] italic mt-1">Direction: Fill-out required information. Do not leave an item blank (indicate N/A if item is not applicable).</p>
        </div>

        {/* Course & Major */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="flex gap-1"><span className="font-bold">COURSE:</span> <span className="border-b border-black flex-1 px-1">{studentData?.student.program_name || "—"}</span></div>
          <div className="flex gap-1"><span className="font-bold">MAJOR:</span> <span className="border-b border-black flex-1 px-1">{(studentData?.student as any)?.major || "N/A"}</span></div>
        </div>

        {/* Personal Information */}
        <div>
          <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Personal Information</div>
          <div className="border border-black p-2 space-y-1">
            <div className="grid grid-cols-4 gap-2">
              <div><span className="font-bold text-[10px]">LAST NAME:</span><br/><span className="border-b border-black block">{studentData?.student.last_name || "—"}</span></div>
              <div><span className="font-bold text-[10px]">FIRST NAME:</span><br/><span className="border-b border-black block">{studentData?.student.first_name || "—"}</span></div>
              <div><span className="font-bold text-[10px]">MIDDLE NAME:</span><br/><span className="border-b border-black block">{studentData?.student.middle_name || "—"}</span></div>
              <div><span className="font-bold text-[10px]">SUFFIX:</span><br/><span className="border-b border-black block">{(studentData?.student as any)?.suffix || "N/A"}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="font-bold text-[10px]">DATE OF BIRTH:</span> <span>{studentData?.student.date_of_birth ? studentData.student.date_of_birth.slice(0, 10) : "—"}</span></div>
              <div><span className="font-bold text-[10px]">SEX:</span> <span className="uppercase">{studentData?.student.gender || "—"}</span></div>
              <div><span className="font-bold text-[10px]">PLACE OF BIRTH:</span> <span>{(studentData?.student as any)?.place_of_birth || "—"}</span></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div><span className="font-bold text-[10px]">CIVIL STATUS:</span> <span>{(studentData?.student as any)?.civil_status || "—"}</span></div>
              <div><span className="font-bold text-[10px]">RELIGION:</span> <span>{(studentData?.student as any)?.religion || "—"}</span></div>
              <div><span className="font-bold text-[10px]">CITIZENSHIP:</span> <span>{(studentData?.student as any)?.citizenship || "Filipino"}</span></div>
              <div><span className="font-bold text-[10px]">CONTACT:</span> <span>{studentData?.student.contact_number || "—"}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-bold text-[10px]">PERMANENT ADDRESS:</span> <span>{studentData?.student.address || "—"}</span></div>
              <div><span className="font-bold text-[10px]">POSTAL CODE:</span> <span>{(studentData?.student as any)?.postal_code || "—"}</span></div>
            </div>
          </div>
        </div>

        {/* Family Background */}
        <div>
          <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Family Background</div>
          <div className="border border-black p-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                {(() => { const fb = (studentData?.student as any)?.family_background || {}; return (<>
                  <div><span className="font-bold text-[10px]">FATHER'S NAME:</span> {fb.father_name || "—"}</div>
                  <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.father_occupation || "—"}</div>
                  <div><span className="font-bold text-[10px]">COMPANY:</span> {fb.father_company || "—"}</div>
                  <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.father_address || "—"}</div>
                  <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.father_contact || "—"}</div>
                </>); })()}
              </div>
              <div className="space-y-0.5">
                {(() => { const fb = (studentData?.student as any)?.family_background || {}; return (<>
                  <div><span className="font-bold text-[10px]">MOTHER'S NAME:</span> {fb.mother_name || "—"}</div>
                  <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.mother_occupation || "—"}</div>
                  <div><span className="font-bold text-[10px]">COMPANY:</span> {fb.mother_company || "—"}</div>
                  <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.mother_address || "—"}</div>
                  <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.mother_contact || "—"}</div>
                </>); })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 pt-1 border-t border-gray-400">
              <div className="space-y-0.5">
                {(() => { const fb = (studentData?.student as any)?.family_background || {}; return (<>
                  <div><span className="font-bold text-[10px]">GUARDIAN:</span> {fb.guardian_name || "—"}</div>
                  <div><span className="font-bold text-[10px]">RELATIONSHIP:</span> {fb.guardian_relationship || "—"}</div>
                  <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.guardian_address || "—"}</div>
                  <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.guardian_contact || "—"}</div>
                </>); })()}
              </div>
              <div className="space-y-0.5">
                {(() => { const fb = (studentData?.student as any)?.family_background || {}; return (<>
                  <div><span className="font-bold text-[10px]">INCASE OF EMERGENCY:</span></div>
                  <div><span className="font-bold text-[10px]">CONTACT PERSON:</span> {fb.emergency_contact_person || "—"}</div>
                  <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.emergency_contact_address || "—"}</div>
                  <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.emergency_contact_number || "—"}</div>
                </>); })()}
              </div>
            </div>
          </div>
        </div>

        {/* Educational Background */}
        <div>
          <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Educational Background</div>
          <div className="border border-black">
            <div className="grid grid-cols-3 divide-x divide-black">
              {(() => {
                const eb = (studentData?.student as any)?.educational_background || {};
                return (<>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">ELEMENTARY<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div>{eb.elementary_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.elementary_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.elementary_years || "—"}</div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">JUNIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div>{eb.junior_high_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.junior_high_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.junior_high_years || "—"}</div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">SENIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div>{eb.senior_high_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.senior_high_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.senior_high_years || "—"}</div>
                  </div>
                </>);
              })()}
            </div>
          </div>
        </div>

        {/* Student Pledge */}
        <div className="pt-2">
          <div className="text-center font-bold uppercase text-xs mb-1">Student's Pledge</div>
          <p className="text-[10px] text-justify leading-snug px-4">
            In consideration of my admission to the ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE (ZDSPGC) and of the privileges I will henceforth enjoy as a student of this institution, I hereby pledge to abide the rules and regulations laid down by competent authority of the college in which I am enrolled.
          </p>
        </div>

        {/* Application & Term Info */}
        <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
          <div>
            <div className="font-bold">Application No: <span className="font-normal">{data?.enrollment.id.split('-')[0].toUpperCase()}</span></div>
            <div className="font-bold">Status: <span className="font-normal">{data?.enrollment.status.toUpperCase().replace('_', ' ')}</span></div>
            <div className="font-bold">Submitted: <span className="font-normal">{data?.enrollment.submitted_at ? format(new Date(data.enrollment.submitted_at), "PP") : "—"}</span></div>
          </div>
          <div>
            <div className="font-bold">School Year: <span className="font-normal">{data?.enrollment.school_year}</span></div>
            <div className="font-bold">Semester: <span className="font-normal">{data?.enrollment.semester}</span></div>
            <div className="font-bold">Date Generated: <span className="font-normal">{format(new Date(), "PPp")}</span></div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-center pt-6">
          <div>
            <div className="border-b border-black w-56 mx-auto mb-1"></div>
            <p className="text-[10px] uppercase font-bold">Student Signature</p>
            <p className="text-[9px]">over printed name</p>
          </div>
          <div>
            <div className="border-b border-black w-56 mx-auto mb-1"></div>
            <p className="text-[10px] uppercase font-bold">Registrar / Verifying Officer</p>
            <p className="text-[9px]">Signature over printed name</p>
          </div>
        </div>
      </div>

      {/* Main Web Content wrapper */}
      <div className="print:hidden space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Enrollment Application</p>
            <h1 className="font-display text-2xl font-semibold text-primary">
              {enrollment.program_name ?? "—"}{" "}
              {enrollment.program_code && (
                <span className="text-muted-foreground">({enrollment.program_code})</span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {enrollment.school_year} · {enrollment.semester}
            </p>
          </div>
          <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
        </div>
        {enrollment.remarks && (
          <div className="mt-4 rounded-md border-l-4 border-secondary bg-muted p-3 text-sm">
            <span className="font-medium">Registrar note: </span>{enrollment.remarks}
          </div>
        )}
      </div>

      {/* Student info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Student Details">
          <InfoRow label="Student No."  value={enrollment.student_no} />
          <InfoRow label="Full Name"    value={`${enrollment.first_name ?? ""} ${enrollment.last_name ?? ""}`.trim()} />
          <InfoRow label="Email"        value={enrollment.student_email} />
          <InfoRow label="Submitted"    value={format(new Date(enrollment.submitted_at), "PPp")} />
          {enrollment.reviewed_at && (
            <InfoRow label="Reviewed"   value={format(new Date(enrollment.reviewed_at), "PPp")} />
          )}
        </Card>
        <Card title="Enrollment Period">
          <InfoRow label="School Year"  value={enrollment.school_year} />
          <InfoRow label="Semester"     value={enrollment.semester} />
          <InfoRow label="Status"       value={meta.label} />
        </Card>
      </div>

      {/* Documents */}
      <Card title="Uploaded Documents">
        {isOwner && (
          <div className="mb-6 rounded-lg border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold mb-3">Upload Additional Document</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger className="w-full sm:w-64 bg-background">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <input
                  type="file"
                  id="doc-upload"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={uploadDoc}
                  disabled={uploading}
                />
                <Button asChild variant="secondary" disabled={uploading} className="w-full sm:w-auto cursor-pointer">
                  <label htmlFor="doc-upload">
                    {uploading ? "Uploading..." : "Choose File & Upload"}
                  </label>
                </Button>
              </div>
            </div>
          </div>
        )}

        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {docs.map((d) => {
              const docMeta = STATUS_META[d.status] ?? STATUS_META.pending;
              const fileUrl = docsApi.fileUrl(d.id);
              const isImage = d.mime_type?.startsWith("image/") || d.file_name.match(/\\.(jpg|jpeg|png|gif)$/i);
              const isPdf = d.mime_type === "application/pdf" || d.file_name.match(/\\.pdf$/i);
              const isRejecting = rejectingDocId === d.id;

              return (
                <div key={d.id} className="flex flex-col gap-4 rounded-lg border p-4 shadow-sm bg-muted/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-primary">{DOC_LABELS[d.doc_type] ?? d.doc_type}</p>
                      <p className="text-sm text-muted-foreground truncate">{d.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`status-pill ${docMeta.tone}`}>{d.status}</span>
                      
                      {isAdmin && d.status === "pending" && !isRejecting && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-success text-success hover:bg-success hover:text-success-foreground"
                            onClick={() => docReviewMutation.mutate({ id: d.id, status: "approved" })}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => {
                               setRejectingDocId(d.id);
                               setDocRejectRemarks("");
                            }}
                          >
                            <XCircle className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {isRejecting && (
                     <div className="mt-2 flex flex-col gap-2 rounded-md bg-destructive/10 p-3 border border-destructive/20">
                       <p className="text-sm font-medium text-destructive">Reason for Rejection</p>
                       <Textarea 
                         placeholder="Explain why this document is being rejected..."
                         value={docRejectRemarks}
                         onChange={(e) => setDocRejectRemarks(e.target.value)}
                         rows={2}
                       />
                       <div className="flex justify-end gap-2 mt-1">
                          <Button size="sm" variant="ghost" onClick={() => setRejectingDocId(null)}>Cancel</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                             if (!docRejectRemarks.trim()) {
                                toast.error("Please provide a reason.");
                                return;
                             }
                             docReviewMutation.mutate({ id: d.id, status: "rejected", remarks: docRejectRemarks });
                             setRejectingDocId(null);
                          }}>Confirm Rejection</Button>
                       </div>
                     </div>
                  )}

                  {d.status === "rejected" && d.remarks && (
                     <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                       <span className="font-semibold">Rejection Reason:</span> {d.remarks}
                     </div>
                  )}

                  <div className="mt-2 w-full overflow-hidden rounded-md border bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[600px] relative">
                    {isImage ? (
                      <img src={fileUrl} alt={d.file_name} className="object-contain w-full h-full max-h-[600px]" />
                    ) : isPdf ? (
                      <iframe src={fileUrl} className="w-full h-[600px] border-0" title={d.file_name} />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
                        <Button
                          variant="outline"
                          onClick={() => window.open(fileUrl, "_blank")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> Open File
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Admin decision panel */}
      {isAdmin && (
        <Card title="Registrar Decision">
          <Textarea
            placeholder="Add remarks for the student (required for Reject / Under Review)…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={500}
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => decide("approved")}
              disabled={reviewMutation.isPending}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button
              onClick={() => decide("under_review")}
              disabled={reviewMutation.isPending}
              variant="outline"
            >
              <AlertCircle className="mr-2 h-4 w-4" /> Set Under Review
            </Button>
            <Button
              onClick={() => decide("rejected")}
              disabled={reviewMutation.isPending}
              variant="destructive"
            >
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
