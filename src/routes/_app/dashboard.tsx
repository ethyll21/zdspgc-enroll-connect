import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FilePlus2, Clock, CheckCircle2, XCircle,
  AlertCircle, Check
} from "lucide-react";
import { enrollments, documents } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  component: StudentDashboard,
});

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  pending:      { label: "Pending",      tone: "text-amber-700 bg-amber-50  border-amber-200 border-l-amber-500",  icon: Clock },
  under_review: { label: "Under Review", tone: "text-blue-700  bg-blue-50   border-blue-200  border-l-blue-500",   icon: AlertCircle },
  approved:     { label: "Approved",     tone: "text-emerald-700 bg-emerald-50 border-emerald-200 border-l-emerald-500", icon: CheckCircle2 },
  rejected:     { label: "Rejected",     tone: "text-rose-700 bg-rose-50 border-rose-200 border-l-rose-500",       icon: XCircle },
};



const STEPS = ["Submitted", "Under Review", "Approved"];

function getStepIndex(status: string, hasDocs: boolean) {
  if (status === "approved") return 2;
  if (status === "under_review") return 1;
  return 0;
}

function StudentDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/admin", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: myEnrollments = [], isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    queryFn: () => enrollments.my().then((r) => r.enrollments),
  });


  const { data: myDocs = [] } = useQuery({
    queryKey: ["my-documents", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    queryFn: () => documents.my().then((r) => r.documents),
  });

  const activeEnrollment = myEnrollments[0] ?? null;
  const activeMeta = activeEnrollment ? (STATUS_META[activeEnrollment.status] ?? STATUS_META.pending) : null;
  const stepIndex = activeEnrollment ? getStepIndex(activeEnrollment.status, myDocs.length > 0) : 0;

  // A student cannot start a new application if they already have ANY enrollment record.
  // Only an admin deleting the enrollment record allows resubmission.
  const hasActiveApplication = activeEnrollment !== null;

  if (isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">

      {/* ── Welcome banner ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-lg border border-[#0A2540]/15 bg-[#0A2540] text-white shadow-lg">
        {/* Gold top stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-[#e8c96a] to-gold" />
        {/* Subtle watermark pattern */}
        <div
          className="absolute right-0 top-0 h-full w-1/3 opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-7 md:p-8">
          <div>

            <h1 className="font-display text-3xl font-bold text-white md:text-4xl">
              {myEnrollments.length > 0 ? "Welcome back" : "Welcome"},{" "}
              {user?.full_name?.split(" ")[0] || "Student"}.
            </h1>
            <p className="mt-1.5 text-white/65 text-sm">
              Manage your enrollment, upload requirements, and track your application.
            </p>
          </div>

        </div>
      </div>

      {/* ── Current Enrollment Status ──────────────────────────────────────────── */}
      {activeEnrollment ? (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0A2540]" />
              <h2 className="font-display text-base font-bold text-[#0A2540]">
                Current Enrollment Status
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-slate-200"
              onClick={() => navigate({ to: "/applications/$appId", params: { appId: activeEnrollment.id } })}
            >
              View Details
            </Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status badge */}
            <div className={`flex items-center gap-3 rounded border border-l-4 p-4 ${activeMeta!.tone}`}>
              <div className="flex items-center justify-center w-9 h-9 rounded bg-white/70 shadow-sm">
                {activeMeta && <activeMeta.icon className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-bold text-sm uppercase tracking-wider">
                  Status: {activeMeta!.label}
                </p>
                <p className="text-sm opacity-75 mt-0.5">
                  {activeEnrollment.program_name} · {activeEnrollment.school_year} · {activeEnrollment.semester}
                </p>
              </div>
            </div>

            {/* Progress stepper */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                Application Progress
              </p>
              <div className="relative flex items-start justify-between">
                <div className="absolute top-4 left-4 right-4 h-px bg-slate-200 z-0" />
                <div
                  className="absolute top-4 left-4 h-px bg-[#0A2540] z-0 transition-all duration-500"
                  style={{ width: `${(stepIndex / (STEPS.length - 1)) * (100 - 8)}%` }}
                />
                {STEPS.map((label, i) => {
                  const done = i <= stepIndex;
                  return (
                    <div key={label} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm transition-all ${
                        done
                          ? i === STEPS.length - 1 && activeEnrollment.status === "approved"
                            ? "bg-emerald-600 text-white"
                            : "bg-[#0A2540] text-white"
                          : "bg-white border-2 border-slate-200 text-slate-400"
                      }`}>
                        {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        done ? "text-[#0A2540]" : "text-slate-400"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>


          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center flex flex-col items-center justify-center">
          {isLoadingEnrollments ? (
            <p className="text-slate-400 text-sm">Loading enrollment data…</p>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-[#0A2540]/6 flex items-center justify-center mb-4">
                <FilePlus2 className="h-7 w-7 text-[#0A2540]/30" />
              </div>
              <p className="font-display font-bold text-slate-700 text-lg">No Active Enrollment</p>
              <p className="text-slate-400 text-sm mt-1 max-w-sm">
                You haven't submitted any pre-enrollment application yet.
              </p>
              <Button asChild className="mt-5 bg-[#0A2540] hover:bg-[#0c2f58] text-white rounded">
                <Link to="/apply">Start Pre-enrollment</Link>
              </Button>
            </>
          )}
        </div>
      )}



      <div className="grid grid-cols-1 gap-8">

        {/* ── Main column ───────────────────────────────────────────────────── */}
        <div className="space-y-6">




          {/* Past enrollments */}
          {myEnrollments.length > 1 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-display text-base font-bold text-[#0A2540]">Past Enrollments</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {myEnrollments.slice(1).map(e => (
                  <li key={e.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{e.program_code} — {e.semester}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{e.school_year}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded border border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
                      {e.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
