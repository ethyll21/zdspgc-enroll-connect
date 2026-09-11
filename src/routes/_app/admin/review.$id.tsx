import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollments as enrollmentsApi, documents as documentsApi, students as studentsApi } from "@/integrations/localdb/client";
import type { SubjectScheduleItem, RotcWatcDetails } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, FileText, Download, CheckCircle, XCircle, Printer, CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";

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
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  // Safe print handler — see applications.$appId.tsx for full explanation.
  const handlePrint = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      const prevOnAfterPrint = window.onafterprint;
      window.onafterprint = () => {
        window.onafterprint = prevOnAfterPrint ?? null;
      };
      window.print();
    }, 0);
  }, []);

  const { data: enrollment, isLoading: isEnrollmentLoading } = useQuery({
    enabled: typeof window !== 'undefined' && isAdmin && !!id,
    queryKey: ["admin-enrollment", id],
    queryFn: () => enrollmentsApi.getById(id).then((r) => {
      setReviewStatus(r.enrollment.status);
      setReviewRemarks(r.enrollment.remarks ?? "");
      return r.enrollment;
    }),
  });

  const { data: studentData } = useQuery({
    enabled: typeof window !== 'undefined' && isAdmin && !!enrollment?.student_id,
    queryKey: ["admin-student", enrollment?.student_id],
    queryFn: () => studentsApi.getById(enrollment!.student_id),
  });

  const { data: rawDocuments = [], isLoading: isDocsLoading } = useQuery({
    enabled: typeof window !== 'undefined' && isAdmin && !!enrollment?.student_id,
    queryKey: ["admin-documents", enrollment?.student_id],
    queryFn: () => documentsApi.list({ student_id: enrollment?.student_id }).then((r) => r.documents),
  });

  const documents = useMemo(() => {
    const map = new Map();
    for (const doc of rawDocuments) {
      if (!map.has(doc.doc_type)) {
        map.set(doc.doc_type, doc);
      }
    }
    return Array.from(map.values());
  }, [rawDocuments]);

  const { data: history = [] } = useQuery({
    enabled: typeof window !== 'undefined' && isAdmin && !!id,
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
  if (isEnrollmentLoading) return <div className="p-8 text-center text-muted-foreground">Loading details...</div>;
  if (!enrollment) return <div className="p-8 text-center text-destructive">Enrollment not found.</div>;

  const meta = STATUS_META[enrollment.status] ?? { label: enrollment.status, tone: "" };
  // The enrollment JOIN now returns all student fields including family_background & educational_background.
  // Only override with separately-fetched studentData if those specific fields have actual content.
  const sd = studentData?.student;
  
  const parseJson = (val: any) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return {}; }
    }
    return val || {};
  };

  const sdFb = parseJson(sd?.family_background);
  const sdEb = parseJson(sd?.educational_background);
  const enFb = parseJson((enrollment as any)?.family_background);
  const enEb = parseJson((enrollment as any)?.educational_background);

  const student: any = {
    ...enrollment,
    ...(sd ? {
      ...sd,
      family_background: Object.keys(sdFb).length > 0 ? sdFb : enFb,
      educational_background: Object.keys(sdEb).length > 0 ? sdEb : enEb,
    } : {
      family_background: enFb,
      educational_background: enEb,
    }),
  };
  const subjects: SubjectScheduleItem[] = enrollment.subjects || [];
  const rotc: RotcWatcDetails = enrollment.rotc_watc || {};
  const isOldStudent = enrollment.student_type === "old" || enrollment.student_type === "returnee" || (!enrollment.student_type && enrollment.subjects && enrollment.subjects.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20 print:pb-0 print:max-w-none print:m-0">

      {/* Top Nav (screen only) */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/admin/applications" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-semibold text-slate-800">Application Details</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${meta.tone}`}>
            {meta.label}
          </span>
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />Print Form
          </Button>
        </div>
      </div>

      {/* Formal Enrollment Form */}
      {isOldStudent ? (
        <>
          {/* PAGE 1 — Two copies */}
          <div className="space-y-6 bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 print:space-y-4">
            <AdminSlipCopy copyTitle="REGISTRAR'S COPY" student={student} enrollment={enrollment} subjects={subjects} rotc={rotc} />
            <div className="relative py-2 text-center print:py-1">
              <div className="border-t-2 border-dashed border-slate-400 w-full absolute top-1/2" />
              <span className="relative bg-white px-3 text-[9px] uppercase font-bold text-slate-400 tracking-widest">✂ Cut along dotted line</span>
            </div>
            <AdminSlipCopy copyTitle="PROGRAM HEAD'S COPY" student={student} enrollment={enrollment} subjects={subjects} rotc={rotc} />
          </div>

          {/* PAGE 2 — Back page */}
          <div className="bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[1056px] flex flex-col mt-4">
            {/* PAGE 2 tab */}
            <div className="flex items-center gap-0 mb-4 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-widest text-white bg-[#0A2540] px-4 py-1.5 rounded-tl rounded-bl border border-[#0A2540]">
                PAGE 2
              </span>
              <div className="flex-1 h-px bg-slate-300 border-t border-slate-300" />
            </div>
            <AdminBackPageDisplay student={student} />
          </div>
        </>

      ) : (
        <div className="space-y-4 bg-white text-black p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0">
          <div className="flex items-start justify-between gap-4 pb-2">
            {/* Left Column: Header, Title, Direction, Course/Major */}
            <div className="flex-1 flex flex-col">
              {/* Logo & Header Text */}
              <div className="flex items-center justify-center gap-4 mb-2">
                <img src="/logo.png" alt="ZDSPGC Logo" className="h-16 w-16 object-contain hidden sm:block print:block" />
                <div className="text-center flex flex-col items-center justify-center">
                  <p className="text-[12px] uppercase">Republic of the Philippines</p>
                  <h1 className="text-lg font-bold uppercase tracking-wide">Zamboanga del Sur Provincial Government College</h1>
                  <p className="text-[10px] uppercase">Dimataling Campus &middot; Dimataling, Zamboanga del Sur</p>
                </div>
              </div>

              {/* Title Bar */}
              <div className="bg-black text-white text-center py-1 font-bold text-[13px] tracking-wider uppercase print:bg-black print:text-white print:color-adjust-exact" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                College Enrollment Form
              </div>

              {/* Direction */}
              <div className="text-left mt-1 leading-tight">
                <p className="text-[11px] italic text-black">Direction: Fill-out required informations. Do not leave an item blank (indicate N/A if item is not applicable)</p>
              </div>

              {/* Course & Major */}
              <div className="flex flex-col gap-2 pt-3 pb-2">
                <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">COURSE:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold leading-tight min-h-[22px] flex items-center">{student?.program_name || enrollment.program_name || "—"}</span></div>
                <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">MAJOR:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold leading-tight min-h-[22px] flex items-center">{(student as any)?.major || "N/A"}</span></div>
              </div>
            </div>

            {/* Right Column: 2x2 Box */}
            <div className="w-[2in] flex justify-end shrink-0 hidden sm:flex print:flex">
              <div className="w-[2in] h-[2in] border border-black flex items-center justify-center text-[12px] text-gray-500">
                2x2
              </div>
            </div>
          </div>
          <div>
            <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Personal Information</div>
            <div className="border border-black p-2 space-y-1">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                <div className="col-span-1"><span className="font-bold text-[10px]">LAST NAME:</span><br/><span className="border-b border-black block font-semibold">{student?.last_name || "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">FIRST NAME:</span><br/><span className="border-b border-black block font-semibold">{student?.first_name || "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">MIDDLE NAME:</span><br/><span className="border-b border-black block font-semibold">{student?.middle_name || "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">SUFFIX:</span><br/><span className="border-b border-black block">{(student as any)?.suffix || "N/A"}</span></div>
                
                <div className="col-span-1"><span className="font-bold text-[10px]">DATE OF BIRTH:</span> <span>{student?.date_of_birth ? String(student.date_of_birth).slice(0, 10) : "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">SEX:</span> <span className="uppercase font-semibold">{student?.gender || "—"}</span></div>
                <div className="col-span-2"><span className="font-bold text-[10px]">CONTACT:</span> <span>{student?.contact_number || "—"}</span></div>
                
                <div className="col-span-1"><span className="font-bold text-[10px]">PLACE OF BIRTH:</span> <span>{(student as any)?.place_of_birth || "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">CITIZENSHIP:</span> <span>{(student as any)?.citizenship || "Filipino"}</span></div>
                <div className="col-span-2"><span className="font-bold text-[10px]">PERMANENT ADDRESS:</span> <span>{student?.address || "—"}</span></div>
                
                <div className="col-span-1"><span className="font-bold text-[10px]">CIVIL STATUS:</span> <span>{(student as any)?.civil_status || "—"}</span></div>
                <div className="col-span-1"><span className="font-bold text-[10px]">RELIGION:</span> <span>{(student as any)?.religion || "—"}</span></div>
                <div className="col-span-2"><span className="font-bold text-[10px]">POSTAL CODE:</span> <span>{(student as any)?.postal_code || "—"}</span></div>
              </div>
            </div>
          </div>
          <div>
            <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Family Background</div>
            <div className="border border-black p-2">
              {(() => { const fb = (student as any)?.family_background || {}; return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <div><span className="font-bold text-[10px]">FATHER'S NAME:</span> {fb.father_name || "—"}</div>
                      <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.father_occupation || "—"}</div>
                      <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.father_address || "—"}</div>
                      <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.father_contact || "—"}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div><span className="font-bold text-[10px]">MOTHER'S NAME:</span> {fb.mother_name || "—"}</div>
                      <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.mother_occupation || "—"}</div>
                      <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.mother_address || "—"}</div>
                      <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.mother_contact || "—"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2 pt-1 border-t border-gray-400">
                    <div className="space-y-0.5">
                      <div><span className="font-bold text-[10px]">GUARDIAN:</span> {fb.guardian_name || "—"}</div>
                      <div><span className="font-bold text-[10px]">RELATIONSHIP:</span> {fb.guardian_relationship || "—"}</div>
                      <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.guardian_address || "—"}</div>
                      <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.guardian_contact || "—"}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div><span className="font-bold text-[10px]">EMERGENCY CONTACT PERSON:</span> {fb.emergency_contact_person || "—"}</div>
                      <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.emergency_contact_address || "—"}</div>
                      <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.emergency_contact_number || "—"}</div>
                    </div>
                  </div>
                </>
              ); })()}
            </div>
          </div>
          <div>
            <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Educational Background</div>
            <div className="border border-black">
              <div className="grid grid-cols-3 divide-x divide-black">
                {(() => { const eb = (student as any)?.educational_background || {}; return (<>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">ELEMENTARY<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.elementary_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.elementary_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.elementary_years || "—"}</div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">JUNIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.junior_high_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.junior_high_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.junior_high_years || "—"}</div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">SENIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                    <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.senior_high_school || "—"}</div>
                    <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.senior_high_address || "—"}</div>
                    <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.senior_high_years || "—"}</div>
                  </div>
                </>); })()}
              </div>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-center font-bold uppercase text-xs mb-1">Student's Pledge</div>
            <p className="text-[10px] text-justify leading-snug px-4">
              In consideration of my admission to the ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE (ZDSPGC) and of the privileges I will henceforth enjoy as a student of this institution, I hereby pledge to abide the rules and regulations laid down by competent authority of the college in which I am enrolled.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-8 text-center pt-6">
            <div><div className="border-b border-black w-56 mx-auto mb-1"></div><p className="text-[10px] uppercase font-bold">Student Signature</p><p className="text-[9px]">over printed name</p></div>
            <div><div className="border-b border-black w-56 mx-auto mb-1"></div><p className="text-[10px] uppercase font-bold">Registrar / Verifying Officer</p><p className="text-[9px]">Signature over printed name</p></div>
          </div>
        </div>
      )}

      {/* Admin Panel (hidden on print) */}
      <div className="print:hidden space-y-6">
        {!isOldStudent && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Uploaded Documents</h2>
            {isDocsLoading ? (
              <p className="text-sm text-slate-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded by this student.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {documents.map((doc: any) => {
                  const fileUrl = documentsApi.fileUrl(doc.id);
                  const isImage = doc.mime_type?.startsWith("image/") || doc.file_name.match(/\.(jpg|jpeg|png|gif)$/i);
                  const isPdf = doc.mime_type === "application/pdf" || doc.file_name.match(/\.pdf$/i);
                  return (
                    <div key={doc.id} className="flex flex-col overflow-hidden border rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b bg-slate-50/50">
                        <div className="flex items-center gap-4 mb-4 sm:mb-0">
                          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 capitalize text-base">{doc.doc_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                              <span className="truncate max-w-[200px] sm:max-w-[300px]">{doc.file_name}</span>
                              <span className="text-slate-300">•</span>
                              <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 self-end sm:self-auto">

                          
                          <div className="flex items-center bg-white shadow-sm border border-slate-200 rounded-lg p-1 gap-1">
                            {doc.status !== "rejected" && (
                              <Button 
                                variant={doc.status === "approved" ? "default" : "ghost"} 
                                size="sm" 
                                className={`h-9 px-3 gap-2 ${doc.status === "approved" ? "bg-emerald-600 text-white hover:bg-emerald-600 cursor-default" : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"}`} 
                                onClick={() => doc.status !== "approved" && docReviewMutation.mutate({ docId: doc.id, status: "approved" })}
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="hidden xl:inline">Approve</span>
                              </Button>
                            )}
                            {doc.status === "pending" && <div className="w-px h-5 bg-slate-200 mx-1"></div>}
                            {doc.status !== "approved" && (
                              <Button 
                                variant={doc.status === "rejected" ? "destructive" : "ghost"} 
                                size="sm" 
                                className={`h-9 px-3 gap-2 ${doc.status === "rejected" ? "bg-rose-600 text-white hover:bg-rose-600 cursor-default" : "text-slate-600 hover:text-rose-600 hover:bg-rose-50"}`} 
                                onClick={() => { if (doc.status !== "rejected") { setRejectingDocId(doc.id); setRejectReason(doc.remarks || ""); } }}
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden xl:inline">Reject</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {doc.status === "rejected" && doc.remarks && (
                        <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex gap-3 items-start">
                          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-rose-800">Rejection Reason</h4>
                            <p className="text-sm text-rose-700 mt-1">{doc.remarks}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="w-full bg-slate-100/50 flex items-center justify-center p-6 min-h-[300px] max-h-[800px] overflow-hidden relative group">
                        {isImage ? (
                          <img src={fileUrl} alt={doc.file_name} className="object-contain w-full h-full max-h-[700px] rounded shadow-sm border border-slate-200 bg-white" />
                        ) : isPdf ? (
                          <iframe src={fileUrl} className="w-full h-[700px] border border-slate-200 rounded shadow-sm bg-white" title={doc.file_name} />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-12 bg-white border border-slate-200 rounded shadow-sm">
                            <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
                              <FileText className="h-8 w-8" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-700 mb-1">Preview not available</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-sm">This file type cannot be previewed in the browser. Please download it to view.</p>
                            <Button onClick={() => window.open(fileUrl, "_blank")} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                              <Download className="h-4 w-4" /> 
                              Download File
                            </Button>
                          </div>
                        )}
                        
                        {(isImage || isPdf) && (
                          <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="secondary" className="shadow-md h-10 w-10 bg-white hover:bg-slate-50 text-slate-700" onClick={() => window.open(fileUrl, "_blank")} title="Open in new tab">
                              <ExternalLink className="h-4 w-4" />
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
        )}

        {history.length > 0 && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Validation History</h2>
            <ul className="space-y-4">
              {history.map((record: any) => (
                <li key={record.id} className="text-sm relative pl-4 border-l-2 border-slate-200">
                  <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-slate-300 border-2 border-white"></div>
                  <p className="font-medium capitalize">{record.result.replace("_", " ")}</p>
                  <p className="text-xs text-slate-500">by {record.validated_by_name ?? "Admin"} on {format(new Date(record.created_at), "MMM d, h:mm a")}</p>
                  {record.notes && <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded">"{record.notes}"</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border bg-white p-5 shadow-sm border-blue-100">
          <h2 className="font-semibold text-slate-800 border-b pb-3 mb-4">Final Decision</h2>
          {(enrollment?.status === "approved" || enrollment?.status === "rejected") ? (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${enrollment.status === "approved" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
              {enrollment.status === "approved" ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" /> : <XCircle className="w-5 h-5 mt-0.5 text-rose-600" />}
              <div>
                <h3 className="font-semibold">{enrollment.status === "approved" ? "Application Approved" : "Application Rejected"}</h3>
                {enrollment.remarks && <p className="text-sm mt-1 opacity-90">{enrollment.remarks}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Update Enrollment Status</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus} disabled={enrollment?.status === "approved" || enrollment?.status === "rejected"}>
                  <SelectTrigger className="w-full md:w-64 bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {enrollment?.status !== "approved" && enrollment?.status !== "rejected" && (
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                      </>
                    )}
                    {enrollment?.status !== "rejected" && <SelectItem value="approved">Approved</SelectItem>}
                    {enrollment?.status !== "approved" && <SelectItem value="rejected">Rejected</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Remarks</label>
                <Input value={reviewRemarks} onChange={(e) => setReviewRemarks(e.target.value)} placeholder="e.g., Your documents have been verified and you are now officially enrolled." className="bg-slate-50" />
              </div>
              <div className="pt-2 flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={reviewMutation.isPending}>
                      {reviewMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will update the student's enrollment status and send them a notification with your remarks.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => reviewMutation.mutate()}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={() => navigate({ to: "/admin/applications" })}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <AlertDialog open={!!rejectingDocId} onOpenChange={(open) => {
        if (!open) {
          setRejectingDocId(null);
          setRejectReason("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Document</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this document. The student will be able to see this reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input 
              value={rejectReason} 
              onChange={(e) => setRejectReason(e.target.value)} 
              placeholder="e.g. Document is blurry, please re-upload a clear copy."
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (rejectingDocId) {
                  docReviewMutation.mutate({ docId: rejectingDocId, status: "rejected", remarks: rejectReason });
                  setRejectingDocId(null);
                  setRejectReason("");
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminSlipCopy({
  copyTitle, student, enrollment, subjects, rotc,
}: {
  copyTitle: string; student: any; enrollment: any; subjects: SubjectScheduleItem[]; rotc: RotcWatcDetails;
}) {
  const paddedSubjects = [...subjects];
  while (paddedSubjects.length < 8) {
    paddedSubjects.push({ course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" });
  }
  const totalUnits = subjects.reduce((sum, s) => { const u = Number(s.units); return sum + (isNaN(u) ? 0 : u); }, 0);
  const isOldSt = enrollment.student_type === "old" || !enrollment.student_type || enrollment.student_type === "returnee";

  return (
    <div className="border border-black p-3.5 relative text-[10px] leading-tight font-sans">
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180 text-black border-l border-black pl-1 h-36 flex items-center justify-center">{copyTitle}</div>
      <div className="text-center relative pb-2 border-b border-black pr-6">
        <div className="flex items-center justify-center gap-6">
          <img src="/province-logo-white.png" alt="Province Logo" className="h-14 w-14 object-contain hidden sm:block print:block" />
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-wide">Republic of the Philippines</p>
            <p className="text-[8px] uppercase font-semibold">Zamboanga Peninsula, Region-IX</p>
            <p className="text-[8.5px] uppercase font-bold">PROVINCE OF ZAMBOANGA DEL SUR</p>
            <h1 className="text-xs font-black uppercase tracking-wider">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
            <p className="text-[8px] uppercase">DIMATALING, ZAMBOANGA DEL SUR</p>
          </div>
          <img src="/logo.png" alt="ZDSPGC Logo" className="h-14 w-14 object-contain hidden sm:block print:block" />
        </div>
        <p className="text-left text-[7.5px] italic mt-1 font-bold uppercase tracking-wide border-t border-black pt-0.5">WRITE IN CAPITAL LETTERS: Fill-out this Form Correctly &amp; Legibly.</p>
      </div>
      <div className="border-b border-black py-1.5 pr-6 grid grid-cols-12 gap-1 text-[9px]">
        <div className="col-span-6 flex flex-col justify-end border-r border-black pr-2">
          <div className="flex items-baseline gap-1 mb-0.5">
            <div className="flex justify-between flex-1 uppercase font-bold text-[10px] px-1">
              <span className="text-left w-1/3 truncate">{student?.last_name || enrollment.last_name || ""}</span>
              <span className="text-center w-1/3 truncate">{student?.first_name || enrollment.first_name || ""}</span>
              <span className="text-right w-1/3 truncate">{student?.middle_name || enrollment.middle_name || ""}</span>
            </div>
          </div>
          <div className="flex justify-between text-[7px] text-slate-500 pt-0.5 px-1 border-t border-slate-300">
            <span className="text-left w-1/3">Last Name</span>
            <span className="text-center w-1/3">First Name</span>
            <span className="text-right w-1/3">Middle Name</span>
          </div>
        </div>
        <div className="col-span-6 grid grid-cols-3 gap-1 pl-1">
          <div><span className="font-bold text-[8px] block">COURSE:</span><span className="font-bold text-[9px] uppercase">{student?.program_code || enrollment.program_code || "—"}</span></div>
          <div><span className="font-bold text-[8px] block">MAJOR:</span><span className="font-bold text-[9px] uppercase">{student?.major || "N/A"}</span></div>
          <div><span className="font-bold text-[8px] block">STUDENT NUMBER:</span><span className="font-mono font-bold text-[9.5px] uppercase">{student?.student_no || "—"}</span></div>
        </div>
      </div>
      <div className="border-b border-black py-1.5 pr-6 grid grid-cols-12 gap-2 text-[8.5px]">
        <div className="col-span-5 space-y-0.5 border-r border-black pr-2">
          <div className="flex justify-between">
            <span><strong>Semester:</strong> {enrollment.semester?.includes("1st") ? "[✔] 1st" : enrollment.semester?.includes("2nd") ? "[✔] 2nd" : enrollment.semester}</span>
            <span><strong>Summer:</strong> {enrollment.semester === "Summer" ? "[✔]" : "____"}</span>
          </div>
          <div className="flex justify-between">
            <span><strong>SY:</strong> {enrollment.school_year}</span>
            <span><strong>Year Level:</strong> {student?.year_level ? `${student.year_level} Year` : "—"}</span>
          </div>
          <div><strong>Date Enrolled:</strong> {enrollment.date_enrolled ? format(new Date(enrollment.date_enrolled), "PP") : format(new Date(), "PP")}</div>
        </div>
        <div className="col-span-5 space-y-0.5 border-r border-black pr-2">
          <span className="font-bold uppercase text-[8px] block">STATUS OF REGISTRATION</span>
          <div className="grid grid-cols-2 gap-0.5 text-[8px]">
            <span>{enrollment.student_type === "new" ? "[✔]" : "[ ]"} New Student</span>
            <span>{enrollment.student_type === "transferee" ? "[✔]" : "[ ]"} Transferee</span>
            <span>{isOldSt ? "[✔]" : "[ ]"} Old Student</span>
            <span>{enrollment.student_type === "returnee" ? "[✔]" : "[ ]"} Returning</span>
          </div>
        </div>
        <div className="col-span-2 flex flex-col justify-center">
          <span className="font-bold uppercase text-[8px] block">SEX</span>
          <div className="text-[8px] space-y-0.5">
            <span>{student?.gender === "male" ? "[✔]" : "[ ]"} Male</span><br/>
            <span>{student?.gender === "female" ? "[✔]" : "[ ]"} Female</span>
          </div>
        </div>
      </div>
      <div className="pr-6 pt-1">
        <table className="w-full text-left border-collapse border border-black text-[8px]">
          <thead>
            <tr className="bg-slate-100 divide-x divide-black border-b border-black font-bold text-center">
              <th className="p-1 w-20">Course No.</th><th className="p-1">Descriptive Title</th><th className="p-1 w-10">Units</th>
              <th className="p-1 w-24">Time</th><th className="p-1 w-14">Days</th><th className="p-1 w-14">Room</th>
              <th className="p-1 w-16">Final Grade</th><th className="p-1 w-20">Posted by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paddedSubjects.map((sub, idx) => (
              <tr key={idx} className="divide-x divide-black h-5">
                <td className="p-0.5 px-1 font-mono uppercase font-bold">{sub.course_no || ""}</td>
                <td className="p-0.5 px-1 truncate max-w-[200px]">{sub.descriptive_title || ""}</td>
                <td className="p-0.5 text-center font-semibold">{sub.units || ""}</td>
                <td className="p-0.5 px-1">{sub.time || ""}</td>
                <td className="p-0.5 px-1 uppercase">{sub.days || ""}</td>
                <td className="p-0.5 px-1">{sub.room || ""}</td>
                <td className="p-0.5 text-center">{sub.final_grade || ""}</td>
                <td className="p-0.5 px-1">{sub.posted_by || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pr-6 pt-1.5 space-y-1 text-[8px]">
        <div className="grid grid-cols-12 gap-2 border-b border-black pb-1">
          <div className="col-span-4 flex items-center gap-1"><strong>Total Units:</strong> <span className="font-bold underline text-[9px]">{totalUnits || enrollment.total_units || "—"}</span></div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">ADVISED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">{enrollment.advised_by || "JOANNAH LEA S. LAMBAN"}</p>
              <span className="text-[7px] block">DSA</span>
            </div>
          </div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">APPROVED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">{enrollment.approved_by || "JEFFRYL DAVE S. ALBELLAR"}</p>
              <span className="text-[7px] block">Registrar</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2 pt-0.5">
          <div className="col-span-8 text-[7.5px] leading-tight space-y-0.5">
            <div><strong>ROTC/WATC:</strong> {rotc?.status === "deferred" ? "[✔]" : "[ ]"} Deferred by: {rotc?.deferred_by || "_____"} &middot; Assessed by: {rotc?.assessed_by || "_____"} &middot; OR No.: {rotc?.or_no || "_____"}</div>
            <div>{rotc?.status === "exempted" ? "[✔]" : "[ ]"} Exempted &middot; {rotc?.status === "enrolled" ? "[✔]" : "[ ]"} Enrolled &middot; Commandant: {rotc?.commandant || "________________"}</div>
          </div>
          <div className="col-span-4 text-center">
            <div className="border-b border-black w-36 mx-auto mb-0.5 mt-5"></div>
            <p className="text-[7.5px] uppercase font-bold">Student's Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Page 2 (back page) for old student — admin review.
 * Reads from the merged student object already computed in AdminReviewApplication.
 */
function AdminBackPageDisplay({ student }: { student: any }) {
  const s = student || {};
  const fb = (() => {
    const raw = s.family_background || {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
  })();
  const eb = (() => {
    const raw = s.educational_background || {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
  })();

  const dob = s.date_of_birth || "";
  const age = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : "—";

  const citizenship = s.citizenship || "";
  const religion = s.religion || "";
  const isFilipinoOrBlank = !citizenship || citizenship.trim().toLowerCase() === "filipino";
  const isIslam = religion.toLowerCase() === "islam";
  const isProtestant = religion.toLowerCase() === "protestant";
  const isCatholic = religion.toLowerCase() === "catholic";
  const isOtherReligion = religion && !isIslam && !isProtestant && !isCatholic;

  // Helper: renders a value inside a bordered box (mimics a paper form input)
  const Box = ({ value, wide }: { value?: string | number | null; wide?: boolean }) => (
    <span
      style={{
        display: "inline-block",
        minWidth: wide ? "160px" : "90px",
        borderBottom: "1.5px solid #000",
        padding: "0 4px",
        marginLeft: "4px",
        verticalAlign: "bottom",
        lineHeight: "1.4",
      }}
    >
      {value ?? ""}
    </span>
  );

  const F = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "4px", minWidth: 0, overflow: "hidden" }}>{children}</div>
  );
  return (
    <div className="border border-black p-6 text-xs leading-relaxed font-sans flex-1 flex flex-col">
      <div className="grid grid-cols-12 gap-6 flex-1">

        {/* ── Left Column ── */}
        <div className="col-span-8 space-y-3 text-[11px]">

          {/* Age / Sex / Civil Status */}
          <div className="grid grid-cols-3 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Age:</span><Box value={age} /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Sex:</span><Box value={s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : ""} /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Civil Status:</span><Box value={s.civil_status} wide /></F>
          </div>

          {/* Place of Birth / Zip */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Place of Birth:</span><Box value={s.place_of_birth} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Zip Code:</span><Box value={s.postal_code} /></F>
          </div>

          {/* Birthdate */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Birthdate:</span><Box value={dob} wide /></F>

          {/* Home Address */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Home Address:</span><Box value={s.address} wide /></F>

          {/* Present Address */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Present Address:</span><Box value={s.address} wide /></F>

          {/* Contact / Email */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={s.contact_number} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Email Address:</span><Box value={s.email} wide /></F>
          </div>

          {/* Citizenship */}
          <div>
            <span className="font-bold uppercase">CITIZENSHIP:</span>{" "}
            <span className="mr-2">{isFilipinoOrBlank ? "[✔]" : "[ ]"} Filipino</span>
            <span style={{display:"inline-flex",alignItems:"baseline",gap:"4px",flexWrap:"wrap"}}>
              {!isFilipinoOrBlank ? "[✔]" : "[ ]"} If Alien, ACR No.:
              <Box value={!isFilipinoOrBlank ? citizenship : ""} wide />
            </span>
          </div>

          {/* Religious Affiliation */}
          <div>
            <span className="font-bold">Religious Affiliation:</span>{" "}
            <span className="mr-2">{isIslam ? "[✔]" : "[ ]"} Islam</span>
            <span className="mr-2">{isProtestant ? "[✔]" : "[ ]"} Protestant</span>
            <span className="mr-2">{isCatholic ? "[✔]" : "[ ]"} Catholic</span>
            <span style={{display:"inline-flex",alignItems:"baseline",gap:"4px"}}>
              {isOtherReligion ? "[✔]" : "[ ]"} Other:
              <Box value={isOtherReligion ? religion : ""} wide />
            </span>
          </div>

          <div className="border-t border-slate-400 my-1" />

          {/* Employer */}
          <div className="flex flex-wrap gap-x-2 items-baseline">
            <span className="font-bold">Name &amp; Address of Employer (If Employed):</span>
            <Box value="" wide />
          </div>

          {/* Father */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Father's Complete Name:</span><Box value={fb.father_name} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Occupation:</span><Box value={fb.father_occupation} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value={fb.father_company} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={fb.father_contact} wide /></F>
          </div>

          {/* Mother */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Mother's Complete Maiden Name:</span><Box value={fb.mother_name} wide /></F>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact No.:</span><Box value={fb.mother_contact} wide /></F>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Occupation:</span><Box value={fb.mother_occupation} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value={fb.mother_company} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Parents' Address:</span><Box value={fb.father_address || fb.mother_address} wide /></F>

          {/* Guardian */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Guardian's Name:</span><Box value={fb.guardian_name} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={fb.guardian_contact} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value="" wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Relationship:</span><Box value={fb.guardian_relationship} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={fb.guardian_address} wide /></F>
        </div>

        {/* ── Right Column — Student's Pledge Box ── */}
        <div className="col-span-4 flex flex-col justify-end pb-36">
          <div className="border border-black p-4 text-[10px] leading-relaxed flex flex-col">
            <p className="font-bold text-center text-[11px] uppercase mb-3">STUDENT'S PLEDGE</p>
            <p className="text-justify">
              In consideration of my admission to the{" "}
              <strong>ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</strong>{" "}
              and of the privileges I will henceforth enjoy as student of this institution,
              I hereby pledge to abide by the rules and regulations laid down by the competent
              authority of the state college and of the college in which I am enrolled.
            </p>
            <div className="mt-8">
              <div className="border-b border-black w-full mb-1" />
              <p className="text-center text-[9px]">Student's Signature</p>
            </div>
            <p className="text-[9px] italic mt-4">
              * Refusal to take this pledge or any violation of its term shall be sufficient
              cause of denial of admission.
            </p>
          </div>
        </div>

        {/* ── Full-width divider ── */}
        <div className="col-span-12 border-t border-slate-400" />

        {/* ── Educational Background — full width ── */}
        <div className="col-span-12 space-y-3 text-[11px]">
          <div className="font-bold uppercase text-[12px]">Educational Background:</div>

          {/* Elementary */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Elementary:</span><Box value={eb.elementary_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Year Graduated:</span><Box value={eb.elementary_years} /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={eb.elementary_address} wide /></F>

          {/* Secondary (Junior HS) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Secondary (Senior HS):</span><Box value={eb.junior_high_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Year Graduated:</span><Box value={eb.junior_high_years} /></F>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={eb.junior_high_address} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Track:</span><Box value={eb.senior_high_track} wide /></F>
          </div>

          {/* School Last Attended (College) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>School Last Attended (COLLEGE):</span><Box value={eb.senior_high_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Course &amp; Year:</span><Box value={eb.senior_high_years} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={eb.senior_high_address} wide /></F>
        </div>
      </div>

      {/* Bottom — Full Student's Pledge block */}
      <div className="mt-auto pt-4"><div className="border-t border-black pr-6 pt-3">
        <p className="font-bold text-center text-[13px] uppercase mb-2">STUDENT'S PLEDGE</p>
        <p className="text-[11px] text-justify leading-relaxed">
          In consideration of my admission to the ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE
          and of the privileges I will henceforth enjoy as a student of this institution, I hereby
          pledge to abide by the rules and regulations laid down by competent authority of the state
          college and of the college in which I am enrolled.
        </p>
        <div className="mt-8 flex justify-end">
          <div className="text-center">
            <div className="border-b border-black w-56 mb-1" />
            <p className="text-[10px]">Student's Signature</p>
          </div>
        </div>
        <p className="text-[9px] text-center mt-3 italic mb-2">
          *Refusal to take this pledge or any violation of its terms shall be sufficient cause for denial of the admission.
        </p>
      </div>
      </div>
    </div>
  );
}
