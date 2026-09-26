import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Eye, CheckCircle2, XCircle, AlertCircle, ExternalLink, Printer, GraduationCap, School, Download, Upload, RefreshCw } from "lucide-react";
import { enrollments as enrollmentsApi, documents as docsApi, students as studentsApi } from "@/integrations/localdb/client";
import type { SubjectScheduleItem, RotcWatcDetails } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { REQUIRED_DOCUMENTS } from "@/lib/enrollment-constants";

export const Route = createFileRoute("/_app/applications/$appId")({
  component: ApplicationDetail,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "text-yellow-600" },
  under_review: { label: "Under Review", tone: "text-blue-600" },
  approved: { label: "Approved", tone: "text-emerald-600" },
  rejected: { label: "Rejected", tone: "text-rose-600" },
};

const DOC_LABELS: Record<string, string> = {
  registration_form: "Registration Form / Evaluation Slip",
  psa_birth_certificate: "PSA Birth Certificate",
  form_138: "Form 138 (Report Card)",
  good_moral: "Good Moral Certificate",
  transfer_certificate: "Transfer Credentials",
  other: "Other Supporting Documents",
};

function ApplicationDetail() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRejectRemarks, setDocRejectRemarks] = useState("");
  const [statusSelection, setStatusSelection] = useState("pending");
  const [resubmittingDocId, setResubmittingDocId] = useState<string | null>(null);

  const [formScale, setFormScale] = useState(1);
  const [formHeight, setFormHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    const formElement = document.getElementById('printable-form-inner');

    const calculateScale = () => {
      const availableWidth = window.innerWidth - 32;
      const scale = availableWidth < 800 ? availableWidth / 800 : 1;
      setFormScale(scale);

      if (formElement && scale < 1) {
        setFormHeight(formElement.offsetHeight * scale);
      } else {
        setFormHeight('auto');
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);

    let observer: ResizeObserver | null = null;
    if (formElement) {
      observer = new ResizeObserver(() => calculateScale());
      observer.observe(formElement);
    }

    return () => {
      window.removeEventListener('resize', calculateScale);
      if (observer) observer.disconnect();
    };
  }, []);

  const handlePrint = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAdmin) {
      setTimeout(() => {
        const prevOnAfterPrint = window.onafterprint;
        window.onafterprint = () => {
          window.onafterprint = prevOnAfterPrint ?? null;
        };
        window.print();
      }, 0);
    } else {
      const toastId = toast.loading("Generating PDF, please wait...");
      try {
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Collect printable sections
        const page1El = document.getElementById("printable-application-form-page1");
        const page2El = document.getElementById("printable-application-form-page2");
        const newFormEl = document.getElementById("printable-application-form-new");

        const elements: HTMLElement[] = [];
        if (page1El && page2El) {
          elements.push(page1El, page2El);
        } else if (newFormEl) {
          elements.push(newFormEl);
        }

        if (elements.length === 0) {
          toast.error("Could not find the enrollment form. Please refresh and try again.", { id: toastId });
          return;
        }

        // We no longer mutate the live DOM here to avoid visual glitches.
        // The unscaling transform is applied securely inside the onclone handler.
        try {

          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];

            const canvas = await html2canvas(el, {
              scale: 2,                  // 2× DPI → crisp PDF output
              useCORS: true,             // allow same-origin images (/logo.png, etc.)
              allowTaint: true,          // don't abort on images that can't be loaded
              backgroundColor: "#ffffff",
              logging: false,
              windowWidth: 900,          // tell html2canvas the effective viewport width
              width: el.scrollWidth,     // capture full element width
              height: el.scrollHeight,   // capture full element height (no clipping)
              onclone: (clonedDoc) => {
                // 1. Remove mobile scaling transforms on the clone so it renders at full resolution
                const clonedInner = clonedDoc.getElementById("printable-form-inner");
                const clonedHeightWrapper = clonedInner?.parentElement;
                if (clonedInner) clonedInner.style.transform = "none";
                if (clonedHeightWrapper) clonedHeightWrapper.style.height = "auto";

                // 2. html2canvas fails on modern CSS colors like oklch(). 
                // We render them to a temp canvas to extract the computed RGBA values.
                const tempCanvas = clonedDoc.createElement('canvas');
                tempCanvas.width = 1;
                tempCanvas.height = 1;
                const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;

                const colorProps = [
                  'color', 'backgroundColor', 'borderColor', 'borderTopColor', 
                  'borderRightColor', 'borderBottomColor', 'borderLeftColor', 
                  'textDecorationColor', 'outlineColor'
                ];

                const elements = clonedDoc.querySelectorAll('*');
                for (let i = 0; i < elements.length; i++) {
                  const node = elements[i] as HTMLElement;
                  const computedStyle = clonedDoc.defaultView?.getComputedStyle(node);
                  if (!computedStyle) continue;

                  for (const prop of colorProps) {
                    const val = computedStyle[prop as any];
                    if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
                      // Use canvas to convert the color
                      ctx.clearRect(0, 0, 1, 1);
                      ctx.fillStyle = val;
                      ctx.fillRect(0, 0, 1, 1);
                      const data = ctx.getImageData(0, 0, 1, 1).data;
                      const rgba = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
                      node.style[prop as any] = rgba;
                    }
                  }
                }
              }
            });

            const imgData = canvas.toDataURL("image/jpeg", 0.92);

            // Map canvas pixels to A4 mm dimensions
            const canvasAspect = canvas.height / canvas.width;
            const imgWidthMm = pdfWidth;
            const imgHeightMm = imgWidthMm * canvasAspect;

            if (i > 0) pdf.addPage();

            if (imgHeightMm <= pdfHeight) {
              // Section fits entirely on one page
              pdf.addImage(imgData, "JPEG", 0, 0, imgWidthMm, imgHeightMm);
            } else {
              // Section is taller than one page — tile across multiple pages
              let yOffsetMm = 0;
              let remainingMm = imgHeightMm;

              while (remainingMm > 0) {
                if (yOffsetMm > 0) pdf.addPage();

                const sliceHeightMm = Math.min(pdfHeight, remainingMm);
                const sliceYPx = Math.round((yOffsetMm / imgHeightMm) * canvas.height);
                const sliceHeightPx = Math.round((sliceHeightMm / imgHeightMm) * canvas.height);

                // Blit just this slice of the source canvas to a temporary canvas
                const sliceCanvas = document.createElement("canvas");
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHeightPx;
                const ctx = sliceCanvas.getContext("2d")!;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                ctx.drawImage(canvas, 0, sliceYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

                pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfWidth, sliceHeightMm);
                yOffsetMm += sliceHeightMm;
                remainingMm -= sliceHeightMm;
              }
            }
          }
        const blob = pdf.output("blob");

        // Try Web Share API first (best for mobile devices, iOS Safari, etc.)
        const fileName = `Enrollment_Form_${appId}.pdf`;
        let shared = false;

        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "application/pdf" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: "Enrollment Form",
              });
              shared = true;
            } catch (shareErr: any) {
              // Ignore AbortError (user cancelled share sheet)
              if (shareErr.name !== "AbortError") {
                console.warn("Share API failed, falling back to standard download", shareErr);
              } else {
                // User cancelled, we don't need to show success or error
                toast.dismiss(toastId);
                return;
              }
            }
          }
        }

        // Fallback to standard jsPDF download (handles browser quirks automatically)
        if (!shared) {
          pdf.save(fileName);
        }

        toast.success("PDF downloaded successfully!", { id: toastId });
      } catch (err: any) {
        console.error("PDF generation error:", err);
        toast.error(`Failed to generate PDF: ${err?.message ?? "Unknown error"}`, { id: toastId });
      }
    }
  }, [isAdmin, appId]);

  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["enrollment-detail", appId],
    // Wait for auth to finish initialising before firing — prevents 401 on mobile
    enabled: typeof window !== 'undefined' && !authLoading && !!user,
    retry: 1,
    queryFn: () => enrollmentsApi.getById(appId),
  });

  const { data: studentData } = useQuery({
    queryKey: ["student-detail", data?.enrollment.student_id],
    queryFn: () => studentsApi.getById(data!.enrollment.student_id),
    enabled: typeof window !== 'undefined' && !!data?.enrollment.student_id,
  });

  const { data: myDocs } = useQuery({
    queryKey: ["enrollment-docs", appId],
    queryFn: () => isAdmin
      ? docsApi.list({ enrollment_id: appId })
      : docsApi.my(appId),
    enabled: typeof window !== 'undefined' && !!data?.enrollment.student_id,
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

  const resubmitDocMutation = useMutation({
    mutationFn: async ({ oldDocId, docType, file }: { oldDocId: string; docType: string; file: File }) => {
      await docsApi.delete(oldDocId);
      await docsApi.upload(file, docType, appId);
      return enrollmentsApi.notifyResubmit(appId);
    },
    onSuccess: () => {
      toast.success("Document resubmitted successfully");
      queryClient.invalidateQueries({ queryKey: ["enrollment-docs", appId] });
      setResubmittingDocId(null);
    },
    onError: (err: any) => {
      toast.error(err.message ?? "Failed to resubmit document");
      setResubmittingDocId(null);
    }
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ docType, file }: { docType: string; file: File }) => {
      await docsApi.upload(file, docType, appId);
      return enrollmentsApi.notifyResubmit(appId);
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["enrollment-docs", appId] });
      setResubmittingDocId(null);
    },
    onError: (err: any) => {
      toast.error(err.message ?? "Failed to upload document");
      setResubmittingDocId(null);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, oldDocId: string, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }

    setResubmittingDocId(oldDocId);
    resubmitDocMutation.mutate({ oldDocId, docType, file });

    // Clear the input value so the same file can be selected again if needed
    e.target.value = "";
  };

  const handleUploadMissing = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }

    setResubmittingDocId(`new-${docType}`);
    uploadDocMutation.mutate({ docType, file });

    e.target.value = "";
  };

  const activeDocs = useMemo(() => {
    return myDocs?.documents ?? [];
  }, [myDocs]);

  useEffect(() => {
    if (!isAdmin || !myDocs || !data) return;
    if (activeDocs.length === 0) return;

    const hasPending = activeDocs.some(d => d.status === "pending");
    if (hasPending) return;

    const allApproved = activeDocs.every(d => d.status === "approved");
    const anyRejected = activeDocs.some(d => d.status === "rejected");

    if (allApproved && data.enrollment.status !== "approved") {
      reviewMutation.mutate({ status: "approved", remarks: "All documents automatically verified." });
    } else if (anyRejected && data.enrollment.status !== "under_review" && data.enrollment.status !== "rejected") {
      reviewMutation.mutate({ status: "under_review", remarks: "Some documents were rejected. Please review them." });
    }
  }, [myDocs, data, isAdmin]);

  useEffect(() => {
    if (data?.enrollment.status) {
      setStatusSelection(data.enrollment.status);
    }
  }, [data?.enrollment.status]);

  // Still waiting for auth to initialise or the query to fire
  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading enrollment details…</p>
      </div>
    );
  }

  // Query finished but returned nothing (error or not found)
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-100">
          <AlertCircle className="h-7 w-7 text-rose-500" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Could not load enrollment details</p>
          <p className="text-sm text-slate-500 mt-1">
            {(error as any)?.message ?? "The application could not be found or you don't have permission to view it."}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md bg-[#0A2540] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C2D50] transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  const { enrollment } = data;
  const docs = activeDocs;

  // Find which documents are required based on student type
  // If enrollment.student_type is not fully reliable, we default to "new" if no subjects
  const studentTypeCategory = (enrollment.student_type === "old" || enrollment.student_type === "returnee") ? "old" : "new";
  const expectedDocs = REQUIRED_DOCUMENTS.filter(d => d.for.includes(studentTypeCategory as any));
  const missingDocs = expectedDocs.filter(ed => !docs.some(d => d.doc_type === ed.key));

  const isOldStudent = enrollment.student_type === "old" || enrollment.student_type === "returnee" || (!enrollment.student_type && enrollment.subjects && enrollment.subjects.length > 0);
  const subjectsList: SubjectScheduleItem[] = enrollment.subjects || [];
  const rotcData: RotcWatcDetails = enrollment.rotc_watc || {};

  const decide = (status: "approved" | "rejected" | "under_review" | "pending") => {
    if (status !== "approved" && status !== "pending" && !remarks.trim()) {
      toast.error("Please add remarks before rejecting or setting under review");
      return;
    }
    reviewMutation.mutate({ status, remarks: remarks || undefined });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 print:pb-0 print:max-w-none print:m-0">
      {/* Action Header */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={isAdmin ? "/admin/applications" : "/dashboard"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button type="button" onClick={handlePrint} variant="outline" className="shadow-sm font-semibold">
          {isAdmin ? (
            <>
              <Printer className="mr-2 h-4 w-4" /> Print Pre-Enrollment Form
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" /> Download Form
            </>
          )}
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          PRINTABLE / FORMAL APPLICATION VIEW
      ══════════════════════════════════════════════════════════════════════════ */}
      <div id="printable-application-form" className="pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          className="overflow-hidden origin-top-left transition-[height] duration-200"
          style={{ height: formHeight }}
        >
          <div
            id="printable-form-inner"
            className="w-[800px] origin-top-left transition-transform duration-200"
            style={{ transform: formScale < 1 ? `scale(${formScale})` : 'none' }}
          >
            {isOldStudent ? (
              /* ─── OLD STUDENT FORM: TWO-COPY OFFICIAL SLIP (REGISTRAR + PROGRAM HEAD) + PAGE 2 ─── */
              <div className="flex flex-col gap-4">
                {/* PAGE 1 — Two copies */}
                <div id="printable-application-form-page1" className="space-y-6 bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 print:space-y-4">
                  {/* TOP COPY: REGISTRAR'S COPY */}
                  <OldStudentSlipCopy
                    copyTitle="REGISTRAR'S COPY"
                    student={studentData?.student}
                    enrollment={enrollment}
                    subjects={subjectsList}
                    rotc={rotcData}
                  />

                  {/* Cut Line */}
                  <div className="relative py-2 text-center print:py-1">
                    <div className="border-t-2 border-dashed border-slate-400 w-full absolute top-1/2" />
                    <span className="relative bg-white px-3 text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      ✂ Cut along dotted line
                    </span>
                  </div>

                  {/* BOTTOM COPY: PROGRAM HEAD'S COPY */}
                  <OldStudentSlipCopy
                    copyTitle="PROGRAM HEAD'S COPY"
                    student={studentData?.student}
                    enrollment={enrollment}
                    subjects={subjectsList}
                    rotc={rotcData}
                  />
                </div>

                {/* PAGE 2 — Back page (personal info, family background, educational background) */}
                <div id="printable-application-form-page2" className="bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[1056px] flex flex-col mt-4">
                  {/* PAGE 2 tab */}
                  <div className="flex items-center gap-0 mb-4 shrink-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white bg-[#0A2540] px-4 py-1.5 rounded-tl rounded-bl border border-[#0A2540]">
                      PAGE 2
                    </span>
                    <div className="flex-1 h-px bg-slate-300 border-t border-slate-300" />
                  </div>
                  <OldStudentBackPageDisplay student={studentData?.student} enrollment={enrollment} />
                </div>
              </div>
            ) : (
              /* ─── NEW STUDENT FORM: FULL DETAILED COLLEGE ENROLLMENT FORM ─── */
              <div id="printable-application-form-new" className="space-y-4 bg-white text-black p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0">
                <div className="flex items-start justify-between gap-4 pb-2">
                  {/* Left Column: Header, Title, Direction, Course/Major */}
                  <div className="flex-1 flex flex-col">
                    {/* Logo & Header Text */}
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <img src="/logo.png" alt="ZDSPGC Logo" className="h-16 w-16 object-contain print:block" />
                      <div className="text-center flex flex-col items-center justify-center">
                        <p className="text-[11px] leading-tight">Republic of the Philippines</p>
                        <p className="text-[14px] font-bold uppercase tracking-wide leading-tight mt-0.5">Zamboanga del Sur Provincial Government College</p>
                        <p className="text-[10px] uppercase leading-tight mt-0.5">Dimataling Campus &middot; Dimataling, Zamboanga del Sur</p>
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
                      <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">COURSE:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold uppercase leading-tight min-h-[22px] flex items-center">{studentData?.student.program_name || "—"}</span></div>
                      <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">MAJOR:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold uppercase leading-tight min-h-[22px] flex items-center">{(studentData?.student as any)?.major || "N/A"}</span></div>
                    </div>
                  </div>

                  {/* Right Column: 2x2 Box */}
                  <div className="w-[2in] flex justify-end shrink-0 print:flex">
                    <div className="w-[2in] h-[2in] border border-black flex items-center justify-center text-[12px] text-gray-500">
                      2x2
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div>
                  <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Personal Information</div>
                  <div className="border border-black p-2 space-y-1">
                    <div className="grid grid-cols-4 gap-2">
                      <div><span className="font-bold text-[10px]">LAST NAME:</span><br /><span className="border-b border-black block font-semibold">{studentData?.student.last_name || "—"}</span></div>
                      <div><span className="font-bold text-[10px]">FIRST NAME:</span><br /><span className="border-b border-black block font-semibold">{studentData?.student.first_name || "—"}</span></div>
                      <div><span className="font-bold text-[10px]">MIDDLE NAME:</span><br /><span className="border-b border-black block font-semibold">{studentData?.student.middle_name || "—"}</span></div>
                      <div><span className="font-bold text-[10px]">SUFFIX:</span><br /><span className="border-b border-black block">{(studentData?.student as any)?.suffix || "N/A"}</span></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><span className="font-bold text-[10px]">DATE OF BIRTH:</span> <span>{studentData?.student.date_of_birth ? studentData.student.date_of_birth.slice(0, 10) : "—"}</span></div>
                      <div><span className="font-bold text-[10px]">SEX:</span> <span className="uppercase font-semibold">{studentData?.student.gender || "—"}</span></div>
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
                        {(() => {
                          const fb = (studentData?.student as any)?.family_background || {}; return (<>
                            <div><span className="font-bold text-[10px]">FATHER'S NAME:</span> {fb.father_name || "—"}</div>
                            <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.father_occupation || "—"}</div>
                            <div><span className="font-bold text-[10px]">COMPANY:</span> {fb.father_company || "—"}</div>
                            <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.father_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.father_contact || "—"}</div>
                          </>);
                        })()}
                      </div>
                      <div className="space-y-0.5">
                        {(() => {
                          const fb = (studentData?.student as any)?.family_background || {}; return (<>
                            <div><span className="font-bold text-[10px]">MOTHER'S NAME:</span> {fb.mother_name || "—"}</div>
                            <div><span className="font-bold text-[10px]">OCCUPATION:</span> {fb.mother_occupation || "—"}</div>
                            <div><span className="font-bold text-[10px]">COMPANY:</span> {fb.mother_company || "—"}</div>
                            <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.mother_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.mother_contact || "—"}</div>
                          </>);
                        })()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2 pt-1 border-t border-gray-400">
                      <div className="space-y-0.5">
                        {(() => {
                          const fb = (studentData?.student as any)?.family_background || {}; return (<>
                            <div><span className="font-bold text-[10px]">GUARDIAN:</span> {fb.guardian_name || "—"}</div>
                            <div><span className="font-bold text-[10px]">RELATIONSHIP:</span> {fb.guardian_relationship || "—"}</div>
                            <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.guardian_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.guardian_contact || "—"}</div>
                          </>);
                        })()}
                      </div>
                      <div className="space-y-0.5">
                        {(() => {
                          const fb = (studentData?.student as any)?.family_background || {}; return (<>
                            <div><span className="font-bold text-[10px]">INCASE OF EMERGENCY:</span></div>
                            <div><span className="font-bold text-[10px]">CONTACT PERSON:</span> {fb.emergency_contact_person || "—"}</div>
                            <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {fb.emergency_contact_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {fb.emergency_contact_number || "—"}</div>
                          </>);
                        })()}
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
                            <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">ELEMENTARY<br /><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                            <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.elementary_school || "—"}</div>
                            <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.elementary_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.elementary_years || "—"}</div>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">JUNIOR HIGH SCHOOL<br /><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                            <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.junior_high_school || "—"}</div>
                            <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {eb.junior_high_address || "—"}</div>
                            <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {eb.junior_high_years || "—"}</div>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">SENIOR HIGH SCHOOL<br /><span className="font-normal italic text-[9px]">(do not abbreviate)</span></div>
                            <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {eb.senior_high_school || "—"}</div>
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
            )}{/* end isOldStudent ternary */}
          </div>{/* end printable-form-inner */}
        </div>{/* end height/overflow wrapper */}
      </div>{/* end printable-application-form */}

      {/* ══════════════════════════════════════════════════════════════════════════
          FUNCTIONAL / UPLOADED DOCUMENTS & ADMIN PANEL (Hidden on Print)
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="print:hidden space-y-6 mt-8">
        {/* Uploaded Documents — hidden for old/returnee students on the student side */}
        {(!isOldStudent || isAdmin) && (
          <Card title="Uploaded Verification Documents">
            {docs.length === 0 && missingDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {docs.map((d) => {
                  const docMeta = STATUS_META[d.status] ?? STATUS_META.pending;
                  const fileUrl = docsApi.fileUrl(d.id);
                  const isImage = d.mime_type?.startsWith("image/") || d.file_name.match(/\.(jpg|jpeg|png|gif)$/i);
                  const isPdf = d.mime_type === "application/pdf" || d.file_name.match(/\.pdf$/i);
                  const isRejecting = rejectingDocId === d.id;

                  return (
                    <div key={d.id} className="flex flex-col gap-4 rounded-xl border p-4 shadow-sm bg-muted/10">
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

                      {d.status === "rejected" && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex flex-col gap-3">
                          {d.remarks && (
                            <div>
                              <span className="font-semibold">Rejection Reason:</span> {d.remarks}
                            </div>
                          )}
                          {!isAdmin && (
                            <div>
                              <input
                                type="file"
                                id={`resubmit-${d.id}`}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileChange(e, d.id, d.doc_type)}
                              />
                              <Button
                                size="sm"
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium"
                                onClick={() => document.getElementById(`resubmit-${d.id}`)?.click()}
                                disabled={resubmittingDocId === d.id}
                              >
                                {resubmittingDocId === d.id ? "Uploading..." : "Resubmit Document"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2 w-full overflow-hidden rounded-lg border bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[600px] relative">
                        {isImage ? (
                          <img src={fileUrl} alt={d.file_name} className="object-contain w-full h-full max-h-[600px]" />
                        ) : isPdf ? (
                          <iframe src={fileUrl} className="w-full h-[600px] border-0" title={d.file_name} />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 text-center">
                            <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
                            <Button variant="outline" onClick={() => window.open(fileUrl, "_blank")}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Open File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {missingDocs.map((md) => (
                  <div key={md.key} className="flex flex-col gap-4 rounded-xl border border-dashed border-muted-foreground/30 p-4 shadow-sm bg-muted/5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{md.label}</p>
                        <p className="text-sm text-destructive font-medium">{md.required ? "Missing Required Document" : "Missing Optional Document"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="status-pill bg-destructive/10 text-destructive border border-destructive/20">Missing</span>
                      </div>
                    </div>

                    {!isAdmin && (
                      <div className="mt-2 rounded-md bg-muted/20 p-4 flex flex-col items-center justify-center border border-muted">
                        <p className="text-sm text-muted-foreground mb-3 text-center">
                          This document is missing. Please upload it to complete your requirements.
                        </p>
                        <input
                          type="file"
                          id={`upload-${md.key}`}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleUploadMissing(e, md.key)}
                        />
                        <Button
                          size="sm"
                          className="font-medium"
                          onClick={() => document.getElementById(`upload-${md.key}`)?.click()}
                          disabled={resubmittingDocId === `new-${md.key}`}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {resubmittingDocId === `new-${md.key}` ? "Uploading..." : "Upload Document"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Admin decision panel */}
        {isAdmin && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#0A2540] mb-6 border-b border-slate-200 pb-4">
              Final Decision
            </h2>
            {(enrollment?.status === "approved" || enrollment?.status === "rejected") ? (
              <div className={`p-4 rounded-lg flex items-start gap-3 ${enrollment.status === "approved" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                {enrollment.status === "approved" ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" /> : <XCircle className="w-5 h-5 mt-0.5 text-rose-600" />}
                <div>
                  <h3 className="font-semibold">{enrollment.status === "approved" ? "Application Approved" : "Application Rejected"}</h3>
                  {enrollment.remarks && <p className="text-sm mt-1 opacity-90">{enrollment.remarks}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-[#0A2540] mb-2 block">
                    Update Enrollment Status
                  </label>
                  <Select
                    value={statusSelection}
                    onValueChange={(val: any) => setStatusSelection(val)}
                    disabled={enrollment?.status === "approved" || enrollment?.status === "rejected"}
                  >
                    <SelectTrigger className="w-full sm:w-[280px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
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
                  <label className="text-sm font-medium text-[#0A2540] mb-2 block">
                    Remarks
                  </label>
                  <Textarea
                    placeholder="e.g., Your documents have been verified and you are now officially enrolled."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    maxLength={500}
                  />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={reviewMutation.isPending}
                      className="font-semibold px-6"
                    >
                      Save
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
                      <AlertDialogAction onClick={() => decide(statusSelection as any)}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )}

        {!isAdmin && (
          <div className="flex justify-center sm:justify-end pt-4">
            <Button onClick={() => navigate({ to: "/dashboard" })} className="w-full sm:w-auto px-8" size="lg">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a single official enrollment slip copy (e.g. REGISTRAR'S COPY or PROGRAM HEAD'S COPY)
 * precisely matching the physical form layout in the photo.
 */
function OldStudentSlipCopy({
  copyTitle,
  student,
  enrollment,
  subjects,
  rotc,
}: {
  copyTitle: string;
  student: any;
  enrollment: any;
  subjects: SubjectScheduleItem[];
  rotc: RotcWatcDetails;
}) {
  const paddedSubjects = [...subjects];
  while (paddedSubjects.length < 8) {
    paddedSubjects.push({ course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" });
  }

  const totalUnits = subjects.reduce((sum, s) => {
    const u = Number(s.units);
    return sum + (isNaN(u) ? 0 : u);
  }, 0);

  const isOldStudent = enrollment.student_type === "old" || !enrollment.student_type || enrollment.student_type === "returnee";

  return (
    <div className="border border-black p-3.5 relative text-[10px] leading-tight font-sans">
      {/* Right Margin Vertical Copy Indicator */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180 text-black border-l border-black pl-1 h-36 flex items-center justify-center">
        {copyTitle}
      </div>

      {/* Header */}
      <div className="text-center relative pb-2 border-b border-black pr-6">
        <div className="flex items-center justify-center gap-6">
          <img src="/province-logo-white.png" alt="Province Logo" className="h-14 w-14 object-contain print:block" />
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-wide">Republic of the Philippines</p>
            <p className="text-[8px] uppercase font-semibold">Zamboanga Peninsula, Region-IX</p>
            <p className="text-[8.5px] uppercase font-bold">PROVINCE OF ZAMBOANGA DEL SUR</p>
            <h1 className="text-xs font-black uppercase tracking-wider">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
            <p className="text-[8px] uppercase">DIMATALING, ZAMBOANGA DEL SUR</p>
          </div>
          <img src="/logo.png" alt="ZDSPGC Logo" className="h-14 w-14 object-contain print:block" />
        </div>
        <p className="text-left text-[7.5px] italic mt-1 font-bold uppercase tracking-wide border-t border-black pt-0.5">
          WRITE IN CAPITAL LETTERS: Fill-out this Form Correctly &amp; Legibly.
        </p>
      </div>

      {/* Top Student Box */}
      <div className="border-b border-black py-2.5 pr-6 grid grid-cols-12 gap-1 text-[10px]">
        {/* Name Section */}
        <div className="col-span-6 flex flex-col justify-end border-r border-black pr-2">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="font-bold text-[10px] shrink-0 mr-1">NAME:</span>
            <div className="flex justify-between flex-1 uppercase font-bold text-[12px] px-1">
              <span className="text-left w-1/3 truncate">{student?.last_name || enrollment.last_name || ""}</span>
              <span className="text-center w-1/3 truncate">{student?.first_name || enrollment.first_name || ""}</span>
              <span className="text-right w-1/3 truncate">{student?.middle_name || enrollment.middle_name || ""}</span>
            </div>
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 pt-0.5 px-1 border-t border-slate-300 ml-10">
            <span className="text-left w-1/3">Last Name</span>
            <span className="text-center w-1/3">First Name</span>
            <span className="text-right w-1/3">Middle Name</span>
          </div>
        </div>

        {/* Course, Major, Student Number */}
        <div className="col-span-6 grid grid-cols-3 gap-1 pl-2">
          <div>
            <span className="font-bold text-[9px] block">COURSE:</span>
            <span className="font-bold text-[11px] uppercase">{student?.program_code || enrollment.program_code || "—"}</span>
          </div>
          <div>
            <span className="font-bold text-[9px] block">MAJOR:</span>
            <span className="font-bold text-[11px] uppercase">{student?.major || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-[9px] block">STUDENT NUMBER:</span>
            <span className="font-mono font-bold text-[11px] uppercase">{student?.student_no || "—"}</span>
          </div>
        </div>
      </div>

      {/* Term & Registration Details Grid */}
      <div className="border-b border-black py-2 pr-6 grid grid-cols-12 gap-2 text-[10px]">
        <div className="col-span-5 space-y-1 border-r border-black pr-2">
          <div className="flex justify-between">
            <span><strong>Semester:</strong> {enrollment.semester?.includes("1st") ? "[✔] 1st" : enrollment.semester?.includes("2nd") ? "[✔] 2nd" : enrollment.semester}</span>
            <span><strong>Summer:</strong> {enrollment.semester === "Summer" ? "[✔]" : "____"}</span>
          </div>
          <div className="flex justify-between">
            <span><strong>SY:</strong> {enrollment.school_year}</span>
            <span><strong>Year Level:</strong> {student?.year_level ? `${student.year_level} Year` : "—"}</span>
          </div>
          <div>
            <strong>Date Enrolled:</strong> {enrollment.date_enrolled ? format(new Date(enrollment.date_enrolled), "PP") : format(new Date(), "PP")}
          </div>
        </div>

        {/* Status of Registration */}
        <div className="col-span-5 space-y-1 border-r border-black pr-2">
          <span className="font-bold uppercase text-[10px] block">STATUS OF REGISTRATION</span>
          <div className="grid grid-cols-2 gap-0.5 text-[10px]">
            <span>{enrollment.student_type === "new" ? "[✔]" : "[ ]"} New Student</span>
            <span>{enrollment.student_type === "transferee" ? "[✔]" : "[ ]"} Transferee</span>
            <span>{isOldStudent ? "[✔]" : "[ ]"} Old Student</span>
            <span>{enrollment.student_type === "returnee" ? "[✔]" : "[ ]"} Returning</span>
          </div>
        </div>

        {/* Sex */}
        <div className="col-span-2 flex flex-col justify-center">
          <span className="font-bold uppercase text-[10px] block">SEX</span>
          <div className="text-[10px] space-y-0.5">
            <span>{student?.gender === "male" ? "[✔]" : "[ ]"} Male</span><br />
            <span>{student?.gender === "female" ? "[✔]" : "[ ]"} Female</span>
          </div>
        </div>
      </div>

      {/* Subject Schedule Table */}
      <div className="pr-6 pt-1">
        <table className="w-full text-left border-collapse border border-black text-[8px]">
          <thead>
            <tr className="bg-slate-100 divide-x divide-black border-b border-black font-bold text-center">
              <th className="p-1 w-20">Course No.</th>
              <th className="p-1">Descriptive Title</th>
              <th className="p-1 w-10">Units</th>
              <th className="p-1 w-24">Time</th>
              <th className="p-1 w-14">Days</th>
              <th className="p-1 w-14">Room</th>
              <th className="p-1 w-16">Final Grade</th>
              <th className="p-1 w-20">Posted by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paddedSubjects.map((sub, idx) => (
              <tr key={idx} className="divide-x divide-black h-4.5">
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

      {/* Bottom Signatories & ROTC Block */}
      <div className="pr-6 pt-1.5 space-y-1 text-[8px]">
        <div className="grid grid-cols-12 gap-2 border-b border-black pb-1">
          <div className="col-span-4 flex items-center gap-1">
            <strong>Total Units:</strong> <span className="font-bold underline text-[9px]">{totalUnits || enrollment.total_units || "—"}</span>
          </div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">ADVISED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">
                {enrollment.advised_by || "JOANNAH LEA S. LAMBAN"}
              </p>
              <span className="text-[7px] block">DSA</span>
            </div>
          </div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">APPROVED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">
                {enrollment.approved_by || "JEFFRYL DAVE S. ALBELLAR"}
              </p>
              <span className="text-[7px] block">Registrar</span>
            </div>
          </div>
        </div>

        {/* ROTC & Signature */}
        <div className="grid grid-cols-12 gap-2 pt-0.5">
          <div className="col-span-8 text-[7.5px] leading-tight space-y-0.5">
            <div>
              <strong>ROTC/WATC:</strong> {rotc?.status === "deferred" ? "[✔]" : "[ ]"} Deferred by: {rotc?.deferred_by || "_____"} · Assessed by: {rotc?.assessed_by || "_____"} · OR No.: {rotc?.or_no || "_____"}
            </div>
            <div>
              {rotc?.status === "exempted" ? "[✔]" : "[ ]"} Exempted · {rotc?.status === "enrolled" ? "[✔]" : "[✔]"} Enrolled · Commandant: {rotc?.commandant || "________________"}
            </div>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#0A2540]/20 bg-white shadow-md overflow-hidden">
      <div className="bg-[#0A2540] px-6 py-4">
        <h2 className="font-display text-base font-bold text-white">{title}</h2>
      </div>
      <div className="p-6 pt-4">{children}</div>
    </div>
  );
}

/**
 * Page 2 (back page) for old student downloadable form.
 * Mirrors OldStudentBackPage in apply.tsx but reads from DB student/enrollment objects.
 */
function OldStudentBackPageDisplay({ student, enrollment }: { student: any; enrollment: any }) {
  const s = student || {};
  const fb = (() => {
    const raw = s.family_background || (enrollment as any)?.family_background || {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
  })();
  const eb = (() => {
    const raw = s.educational_background || (enrollment as any)?.educational_background || {};
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
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Age:</span><Box value={age} /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Sex:</span><Box value={s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : ""} /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Civil Status:</span><Box value={s.civil_status} wide /></F>
          </div>

          {/* Place of Birth / Zip */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Place of Birth:</span><Box value={s.place_of_birth} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Zip Code:</span><Box value={s.postal_code} /></F>
          </div>

          {/* Birthdate */}
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Birthdate:</span><Box value={dob} wide /></F>

          {/* Home Address */}
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Home Address:</span><Box value={s.address} wide /></F>

          {/* Present Address */}
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Present Address:</span><Box value={s.address} wide /></F>

          {/* Contact / Email */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Contact Number:</span><Box value={s.contact_number} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Email Address:</span><Box value={s.email} wide /></F>
          </div>

          {/* Citizenship */}
          <div>
            <span className="font-bold uppercase">CITIZENSHIP:</span>{" "}
            <span className="mr-2">{isFilipinoOrBlank ? "[✔]" : "[ ]"} Filipino</span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px", flexWrap: "wrap" }}>
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
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
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
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Father's Complete Name:</span><Box value={fb.father_name} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Occupation:</span><Box value={fb.father_occupation} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Monthly Income:</span><Box value={fb.father_company} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Contact Number:</span><Box value={fb.father_contact} wide /></F>
          </div>

          {/* Mother */}
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Mother's Complete Maiden Name:</span><Box value={fb.mother_name} wide /></F>
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Contact No.:</span><Box value={fb.mother_contact} wide /></F>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Occupation:</span><Box value={fb.mother_occupation} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Monthly Income:</span><Box value={fb.mother_company} wide /></F>
          </div>
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Parents' Address:</span><Box value={fb.father_address || fb.mother_address} wide /></F>

          {/* Guardian */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Guardian's Name:</span><Box value={fb.guardian_name} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Contact Number:</span><Box value={fb.guardian_contact} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Monthly Income:</span><Box value="" wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Relationship:</span><Box value={fb.guardian_relationship} wide /></F>
          </div>
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Address:</span><Box value={fb.guardian_address} wide /></F>
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
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Elementary:</span><Box value={eb.elementary_school} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Year Graduated:</span><Box value={eb.elementary_years} /></F>
          </div>
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Address:</span><Box value={eb.elementary_address} wide /></F>

          {/* Secondary (Senior HS) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Secondary (Senior HS):</span><Box value={eb.junior_high_school} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Year Graduated:</span><Box value={eb.junior_high_years} /></F>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Address:</span><Box value={eb.junior_high_address} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Track:</span><Box value={eb.senior_high_track} wide /></F>
          </div>

          {/* School Last Attended (College) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>School Last Attended (COLLEGE):</span><Box value={eb.senior_high_school} wide /></F>
            <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Course &amp; Year:</span><Box value={eb.senior_high_years} wide /></F>
          </div>
          <F><span className="font-bold" style={{ whiteSpace: "nowrap" }}>Address:</span><Box value={eb.senior_high_address} wide /></F>
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
