import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle, User, Bell, Check, ArrowRight } from "lucide-react";
import { enrollments, documents, students, notifications } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  component: StudentDashboard,
});

const STATUS_META: Record<string, { label: string; tone: string; color: string; icon: any }> = {
  pending:      { label: "Pending",      tone: "text-amber-600 bg-amber-50 border-amber-200", color: "bg-amber-500", icon: Clock },
  under_review: { label: "Under Review", tone: "text-purple-600 bg-purple-50 border-purple-200", color: "bg-purple-500", icon: AlertCircle },
  approved:     { label: "Approved",     tone: "text-emerald-600 bg-emerald-50 border-emerald-200", color: "bg-emerald-500", icon: CheckCircle2 },
  rejected:     { label: "Rejected",     tone: "text-rose-600 bg-rose-50 border-rose-200", color: "bg-rose-500", icon: XCircle },
};

const DOC_TYPES = [
  { id: 'psa_birth_certificate', label: 'PSA Birth Certificate' },
  { id: 'form_138', label: 'Form 138 (Report Card)' },
  { id: 'good_moral', label: 'Good Moral Certificate' },
  { id: 'transfer_certificate', label: 'Transfer Certificate' },
];

function StudentDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/admin", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: myEnrollments = [], isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: () => enrollments.my().then((r) => r.enrollments),
  });

  const { data: studentInfo, isLoading: isLoadingStudent } = useQuery({
    queryKey: ["my-student-info", user?.id],
    enabled: !!user,
    queryFn: () => students.me().then((r) => r.student).catch(() => null), // Catch 404s if profile is incomplete
  });

  const { data: myDocs = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ["my-documents", user?.id],
    enabled: !!user,
    queryFn: () => documents.my().then((r) => r.documents),
  });

  const { data: myNotifs = [], isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user,
    queryFn: () => notifications.my().then((r) => r.notifications),
  });

  const activeEnrollment = myEnrollments.length > 0 ? myEnrollments[0] : null;
  const activeMeta = activeEnrollment ? (STATUS_META[activeEnrollment.status] || STATUS_META.pending) : null;

  if (isAdmin) return null; // Prevent flicker before redirect

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      {/* 1. Welcome Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {myEnrollments.length > 0 ? "Welcome back" : "Welcome"}, {user?.full_name || "Student"}!
          </h1>
          <p className="mt-2 text-blue-100/90 text-lg">Manage your enrollment, requirements, and academic journey.</p>
        </div>
        <div className="relative z-10">
          <Button asChild size="lg" className="bg-white text-indigo-700 hover:bg-blue-50 hover:text-indigo-800 shadow-lg rounded-xl font-semibold border-0 transition-transform hover:scale-105 active:scale-95">
            <Link to="/apply">
              <FilePlus2 className="mr-2 h-5 w-5" /> {activeEnrollment ? "Start New Enrollment" : "Start Pre-enrollment"}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content: Left Column (2 spans) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Enrollment Progress Tracker */}
          {activeEnrollment ? (
            <div className="rounded-2xl border bg-white shadow-sm p-6 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-indigo-600" />
                <h2 className="font-display text-xl font-semibold text-slate-800">Current Enrollment Status</h2>
              </div>
              
              <div className={`p-4 rounded-xl border ${activeMeta!.tone} flex items-center justify-between mb-8`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full bg-white shadow-sm`}>
                    {activeMeta && <activeMeta.icon className={`h-6 w-6`} />}
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wider text-sm">Status: {activeMeta!.label}</p>
                    <p className="text-sm opacity-80">{activeEnrollment.program_name} • {activeEnrollment.school_year}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="bg-white hover:bg-slate-50">
                   <Link to="/applications/$appId" params={{ appId: activeEnrollment.id }}>View Details</Link>
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="relative pt-4 pb-2 px-4">
                <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 rounded-full"></div>
                <div className="absolute top-1/2 left-4 h-1 bg-indigo-600 -translate-y-1/2 rounded-full transition-all duration-500" 
                     style={{ width: activeEnrollment.status === 'approved' ? '100%' : activeEnrollment.status === 'under_review' ? '66%' : '33%' }}></div>
                
                <div className="relative flex justify-between">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md ring-4 ring-white z-10"><Check className="w-4 h-4" /></div>
                    <span className="text-xs font-semibold text-slate-700">Submitted</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ring-4 ring-white z-10 ${myDocs.length > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {myDocs.length > 0 ? <Check className="w-4 h-4" /> : <span className="text-sm font-semibold">2</span>}
                    </div>
                    <span className={`text-xs font-semibold ${myDocs.length > 0 ? 'text-slate-700' : 'text-slate-400'}`}>Documents</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ring-4 ring-white z-10 ${['under_review', 'approved'].includes(activeEnrollment.status) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {['under_review', 'approved'].includes(activeEnrollment.status) ? <Check className="w-4 h-4" /> : <span className="text-sm font-semibold">3</span>}
                    </div>
                    <span className={`text-xs font-semibold ${['under_review', 'approved'].includes(activeEnrollment.status) ? 'text-slate-700' : 'text-slate-400'}`}>Review</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ring-4 ring-white z-10 ${activeEnrollment.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {activeEnrollment.status === 'approved' ? <Check className="w-4 h-4" /> : <span className="text-sm font-semibold">4</span>}
                    </div>
                    <span className={`text-xs font-semibold ${activeEnrollment.status === 'approved' ? 'text-emerald-600' : 'text-slate-400'}`}>Approved</span>
                  </div>
                </div>
              </div>

              {/* Registrar Feedback Panel */}
              {activeEnrollment.remarks && (
                <div className="mt-8 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                   <div className="p-2 bg-blue-100 text-blue-600 rounded-full shrink-0">
                     <AlertCircle className="w-5 h-5" />
                   </div>
                   <div>
                     <p className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-1">Registrar Feedback</p>
                     <p className="text-sm text-blue-800">{activeEnrollment.remarks}</p>
                   </div>
                </div>
              )}

            </div>
          ) : (
             <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center flex flex-col items-center justify-center h-64">
               {isLoadingEnrollments ? (
                 <p className="text-slate-500">Loading enrollment data...</p>
               ) : (
                 <>
                   <FilePlus2 className="h-10 w-10 text-slate-300 mb-4" />
                   <p className="font-semibold text-slate-600 text-lg">No Active Enrollment</p>
                   <p className="text-slate-500 text-sm mt-1 max-w-sm">You haven't submitted any pre-enrollment application yet. Get started to begin your journey!</p>
                 </>
               )}
             </div>
          )}

          {/* Requirement Checklist */}
          {activeEnrollment && (
            <div className="rounded-2xl border bg-white shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <h2 className="font-display text-xl font-semibold text-slate-800">Requirement Checklist</h2>
                </div>
                <Button variant="link" asChild className="text-blue-600 p-0 h-auto">
                  <Link to="/applications/$appId" params={{ appId: activeEnrollment.id }}>Manage Documents <ArrowRight className="ml-1 w-4 h-4"/></Link>
                </Button>
              </div>

              {isLoadingDocs ? (
                 <p className="text-sm text-slate-400">Loading documents...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DOC_TYPES.map(req => {
                    const uploaded = myDocs.find(d => d.doc_type === req.id);
                    const isApproved = uploaded?.status === 'approved';
                    const isRejected = uploaded?.status === 'rejected';
                    
                    return (
                      <div key={req.id} className={`flex items-start p-4 rounded-xl border transition-colors ${uploaded ? (isApproved ? 'border-emerald-200 bg-emerald-50/50' : isRejected ? 'border-rose-200 bg-rose-50/50' : 'border-blue-200 bg-blue-50/50') : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-3 ${uploaded ? (isApproved ? 'bg-emerald-500 text-white' : isRejected ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white') : 'border-2 border-slate-300 bg-white'}`}>
                          {uploaded && (isRejected ? <XCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${uploaded ? 'text-slate-800' : 'text-slate-500'}`}>{req.label}</p>
                          {uploaded ? (
                            <p className={`text-xs mt-1 ${isApproved ? 'text-emerald-600' : isRejected ? 'text-rose-600' : 'text-blue-600'}`}>
                              {isApproved ? 'Verified & Approved' : isRejected ? 'Rejected - Needs re-upload' : 'Uploaded - Pending Review'}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-1">Missing</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Past Enrollments */}
          {myEnrollments.length > 1 && (
            <div className="rounded-2xl border bg-white shadow-sm p-6">
              <h2 className="font-display text-lg font-semibold text-slate-800 mb-4">Past Enrollments</h2>
              <ul className="divide-y border rounded-xl overflow-hidden">
                {myEnrollments.slice(1).map(e => (
                   <li key={e.id} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                     <div>
                       <p className="font-semibold text-sm text-slate-800">{e.program_code} - {e.semester}</p>
                       <p className="text-xs text-slate-500">{e.school_year}</p>
                     </div>
                     <span className={`text-[10px] px-2 py-1 rounded-full border bg-slate-50 text-slate-600 uppercase font-bold tracking-wider`}>
                       {e.status.replace("_", " ")}
                     </span>
                   </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar: Right Column */}
        <div className="space-y-8">
          
          {/* Student Info Panel */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden relative">
             <div className="h-24 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
             <div className="px-6 pb-6 relative">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border p-1 -mt-10 flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-indigo-400" />
                </div>
                <div className="text-center mb-6">
                  <h3 className="font-bold text-lg text-slate-800">{user?.full_name || "Profile Incomplete"}</h3>
                  <p className="text-sm text-slate-500">{studentInfo?.student_no || "ID Pending"}</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Program</p>
                    <p className="text-sm font-medium text-slate-700">{studentInfo?.program_name || "—"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg flex justify-between">
                     <div className="flex-1 overflow-hidden pr-2">
                       <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Email</p>
                       <p className="text-sm font-medium text-slate-700 truncate">{user?.email}</p>
                     </div>
                     <div className="text-right shrink-0">
                       <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Year Level</p>
                       <p className="text-sm font-medium text-slate-700">{studentInfo?.year_level ? `Year ${studentInfo.year_level}` : "—"}</p>
                     </div>
                  </div>
                </div>
                
                {!studentInfo && !isLoadingStudent && (
                  <Button variant="outline" className="w-full mt-4 text-xs font-semibold" asChild>
                    <Link to="/apply">Complete Profile First</Link>
                  </Button>
                )}
             </div>
          </div>

          {/* Notification Center */}
          <div className="rounded-2xl border bg-white shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="h-5 w-5 text-rose-500" />
              <h2 className="font-display text-lg font-semibold text-slate-800">Notifications</h2>
            </div>
            
            {isLoadingNotifs ? (
               <p className="text-sm text-slate-400">Loading...</p>
            ) : myNotifs.length === 0 ? (
               <div className="text-center py-6">
                 <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                   <Bell className="w-5 h-5 text-slate-300" />
                 </div>
                 <p className="text-sm text-slate-500 font-medium">You're all caught up!</p>
                 <p className="text-xs text-slate-400 mt-1">Updates will appear here.</p>
               </div>
            ) : (
               <div className="space-y-4">
                 {myNotifs.slice(0, 4).map(n => (
                    <div key={n.id} className="flex gap-3 items-start p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-slate-200' : 'bg-blue-500'}`}></div>
                      <div>
                        <p className={`text-sm ${n.is_read ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{n.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                 ))}
                 {myNotifs.length > 4 && (
                   <Button variant="ghost" className="w-full text-xs text-blue-600 h-8 font-semibold">View all notifications</Button>
                 )}
               </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
