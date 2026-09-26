import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertCircle, Trash2, CheckCircle, XCircle, ArrowRight, Eye } from "lucide-react";
import { notifications } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// ─── Helper: parse or detect rich notification payload ──────────────────────────
function parseRichPayload(title: string, message: string, createdAt: string) {
  // Try JSON first — handles both application-level and document-level rich cards
  try {
    const parsed = JSON.parse(message);
    if (parsed?.isRichCard) return parsed;
  } catch {}

  const t = title.toLowerCase();
  const m = message.toLowerCase();

  // Document-level detection: check if title contains a known doc type keyword
  const docTypeMap: Record<string, string> = {
    'psa birth certificate': 'PSA Birth Certificate',
    'form 138': 'Form 138',
    'good moral certificate': 'Good Moral Certificate',
    'transfer certificate': 'Transfer Certificate',
    'registration form': 'Registration Form',
  };
  for (const [key, label] of Object.entries(docTypeMap)) {
    if (t.includes(key)) {
      const type = t.includes('approv') ? 'doc_approved' : t.includes('reject') ? 'doc_rejected' : null;
      if (type) {
        return { isRichCard: true, type, docLabel: label, date: createdAt, fallbackMessage: message };
      }
    }
  }

  // Application-level detection (legacy plain text)
  if (t.includes('approv') || (m.includes('enrollment') && m.includes('approved'))) {
    return { isRichCard: true, type: 'approved', date: createdAt, fallbackMessage: message };
  }
  if (t.includes('application rejected') || t.includes('enrollment rejected') || (m.includes('enrollment') && m.includes('rejected'))) {
    return { isRichCard: true, type: 'rejected', date: createdAt, fallbackMessage: message };
  }
  if (t.includes('under review') || t.includes('under_review') || (m.includes('enrollment') && m.includes('under review'))) {
    return { isRichCard: true, type: 'under_review', date: createdAt, fallbackMessage: message };
  }
  return null;
}

function RichNotificationCard({ payload }: { payload: any }) {
  // ── Admin-specific card types ─────────────────────────────────────────────
  if (payload.type === 'admin_new_application') {
    const rows = [
      payload.appNo    ? { label: 'Application No.', value: payload.appNo }    : null,
      payload.program  ? { label: 'Program',         value: payload.program }  : null,
      payload.schoolYear ? { label: 'School Year',   value: payload.schoolYear } : null,
      payload.semester ? { label: 'Semester',        value: payload.semester } : null,
      { label: 'Status', badge: 'PENDING REVIEW', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
      payload.date     ? { label: 'Submitted',       value: format(new Date(payload.date), 'MMMM d, yyyy') } : null,
    ].filter(Boolean) as any[];

    return (
      <div className="rounded-lg border border-blue-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-blue-100 bg-blue-50">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600">
            <Bell className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <h3 className="font-semibold text-sm text-slate-800">New Application Submitted</h3>
        </div>
        <div className="px-4 py-3 space-y-1.5 bg-white">
          {rows.map((row: any) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-24 sm:w-28 shrink-0">{row.label}:</span>
              {row.badge ? (
                <span className={`inline-flex whitespace-nowrap items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${row.badgeColor}`}>
                  <span className={`w-1 h-1 rounded-full ${row.dotColor}`} />
                  {row.badge}
                </span>
              ) : (
                <span className="font-semibold text-slate-800 text-xs">{row.value}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-blue-100 bg-blue-50/60">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border border-blue-400 text-blue-600">
            <ArrowRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Action:</p>
            <p className="text-xs font-semibold text-slate-700">Open the application to begin review</p>
          </div>
        </div>
      </div>
    );
  }

  if (payload.type === 'admin_doc_resubmit') {
    const rows = [
      payload.appNo      ? { label: 'Application No.', value: payload.appNo }      : null,
      payload.studentName? { label: 'Student',         value: payload.studentName } : null,
      payload.docLabel   ? { label: 'Document',        value: payload.docLabel }    : null,
      { label: 'Status', badge: 'DOCUMENT RESUBMITTED', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' },
      payload.date       ? { label: 'Resubmitted',     value: format(new Date(payload.date), 'MMMM d, yyyy') } : null,
    ].filter(Boolean) as any[];

    return (
      <div className="rounded-lg border border-amber-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-amber-100 bg-amber-50">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500">
            <Bell className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <h3 className="font-semibold text-sm text-slate-800">Document Resubmitted</h3>
        </div>
        <div className="px-4 py-3 space-y-1.5 bg-white">
          {rows.map((row: any) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-28 shrink-0">{row.label}:</span>
              {row.badge ? (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${row.badgeColor}`}>
                  <span className={`w-1 h-1 rounded-full ${row.dotColor}`} />
                  {row.badge}
                </span>
              ) : (
                <span className="font-semibold text-slate-800 text-xs">{row.value}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-amber-100 bg-amber-50/60">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border border-amber-400 text-amber-600">
            <ArrowRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Action:</p>
            <p className="text-xs font-semibold text-slate-700">Review the resubmitted document</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Under Review (student-facing) ───────────────────────────────────────
  if (payload.type === 'under_review') {
    const rows = [
      payload.studentName ? { label: 'Student',         value: payload.studentName } : null,
      payload.appNo       ? { label: 'Application No.', value: payload.appNo }       : null,
      payload.program     ? { label: 'Program',         value: payload.program }     : null,
      { label: 'Status', badge: 'UNDER REVIEW', badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200', dotColor: 'bg-indigo-500' },
      payload.reviewedBy  ? { label: 'Reviewed by',     value: payload.reviewedBy }  : null,
      payload.date        ? { label: 'Date Updated',    value: format(new Date(payload.date), 'MMMM d, yyyy') } : null,
    ].filter(Boolean) as any[];

    return (
      <div className="rounded-lg border border-indigo-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-indigo-100 bg-indigo-50">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600">
            <Eye className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <h3 className="font-semibold text-sm text-slate-800">Application Under Review</h3>
        </div>
        <div className="px-4 py-3 space-y-1.5 bg-white">
          {rows.map((row: any) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-24 sm:w-28 shrink-0">{row.label}:</span>
              {row.badge ? (
                <span className={`inline-flex whitespace-nowrap items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${row.badgeColor}`}>
                  <span className={`w-1 h-1 rounded-full ${row.dotColor}`} />
                  {row.badge}
                </span>
              ) : (
                <span className="font-semibold text-slate-800 text-xs">{row.value}</span>
              )}
            </div>
          ))}
          {payload.remarks && (
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-xs w-24 sm:w-28 shrink-0">Remarks:</span>
              <span className="text-slate-600 text-xs italic">{payload.remarks}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-indigo-100 bg-indigo-50/60">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border border-indigo-400 text-indigo-600">
            <ArrowRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Action:</p>
            <p className="text-xs font-semibold text-slate-700">Your application is currently being reviewed</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Student-facing card types ─────────────────────────────────────────────
  const isDocCard = payload.type === 'doc_approved' || payload.type === 'doc_rejected' || payload.type === 'doc_pending';
  const isApproved = payload.type === 'approved' || payload.type === 'doc_approved';
  const isRejected = payload.type === 'rejected' || payload.type === 'doc_rejected';

  const heading = isDocCard
    ? isApproved ? `${payload.docLabel} Approved` : isRejected ? `${payload.docLabel} Rejected` : `${payload.docLabel} Updated`
    : isApproved ? 'Application Approved' : 'Application Rejected';

  const actionText = isDocCard
    ? isApproved ? 'Your document has been verified. No further action needed.' : 'Please re-upload the rejected document to continue.'
    : isApproved ? 'Proceed to the Official enrollment' : 'Review and re-upload required documents';

  const gc = isApproved;
  const borderCls   = gc ? 'border-green-200'               : 'border-red-200';
  const headerBg    = gc ? 'border-green-100 bg-green-50'   : 'border-red-100 bg-red-50';
  const iconBg      = gc ? 'bg-green-500'                   : 'bg-red-500';
  const footerBg    = gc ? 'border-green-100 bg-green-50/60': 'border-red-100 bg-red-50/60';
  const arrowCls    = gc ? 'border-blue-400 text-blue-600'  : 'border-slate-400 text-slate-600';
  const badgeText   = isDocCard
    ? (gc ? 'DOCUMENT APPROVED' : 'DOCUMENT REJECTED')
    : (gc ? 'APPLICATION APPROVED' : 'APPLICATION REJECTED');
  const badgeColor  = gc ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  const dotColor    = gc ? 'bg-green-500' : 'bg-red-500';

  const rows = [
    payload.studentName ? { label: 'Student',         value: payload.studentName } : null,
    payload.appNo       ? { label: 'Application No.', value: payload.appNo }       : null,
    isDocCard           ? { label: 'Document',        value: payload.docLabel }    : null,
    payload.program     ? { label: 'Program',         value: payload.program }     : null,
    { label: 'Status', badge: badgeText, badgeColor, dotColor },
    payload.reviewedBy  ? { label: 'Reviewed by',     value: payload.reviewedBy }  : null,
    payload.date        ? { label: gc ? 'Date Approved' : 'Date Reviewed', value: format(new Date(payload.date), 'MMMM d, yyyy') } : null,
  ].filter(Boolean) as any[];

  return (
    <div className={`rounded-lg border overflow-hidden ${borderCls}`}>
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${headerBg}`}>
        <div className={`flex items-center justify-center w-7 h-7 rounded-full ${iconBg}`}>
          {isApproved ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <XCircle className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <h3 className="font-semibold text-sm text-slate-800">{heading}</h3>
      </div>

      {/* Details grid */}
      <div className="px-4 py-3 space-y-1.5 bg-white">
        {rows.map((row: any) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-slate-400 text-xs w-24 sm:w-28 shrink-0">{row.label}:</span>
            {row.badge ? (
              <span className={`inline-flex whitespace-nowrap items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${row.badgeColor}`}>
                <span className={`w-1 h-1 rounded-full ${row.dotColor}`} />
                {row.badge}
              </span>
            ) : (
              <span className="font-semibold text-slate-800 text-xs">{row.value}</span>
            )}
          </div>
        ))}
        {!payload.studentName && !isDocCard && payload.fallbackMessage && (
          <div className="flex items-start gap-3">
            <span className="text-slate-400 text-xs w-28 shrink-0">Message:</span>
            <span className="text-slate-600 text-xs">{payload.fallbackMessage}</span>
          </div>
        )}
        {payload.remarks && (
          <div className="flex items-start gap-3">
            <span className="text-slate-400 text-xs w-28 shrink-0">Remarks:</span>
            <span className="text-slate-600 text-xs italic">{payload.remarks}</span>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className={`flex items-center gap-3 px-4 py-2 border-t ${footerBg}`}>
        <div className={`flex items-center justify-center w-6 h-6 rounded-full border ${arrowCls}`}>
          <ArrowRight className="w-3 h-3" />
        </div>
        <div>
          <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Action:</p>
          <p className="text-xs font-semibold text-slate-700">{actionText}</p>
        </div>
      </div>
    </div>
  );
}
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notifToDelete, setNotifToDelete] = useState<any>(null);

  const { data: myNotifs = [], isLoading, isError, error } = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    retry: false,
    queryFn: () => notifications.my().then((r) => r.notifications),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notifications.markRead(id),
    onMutate: async (id) => {
      // Optimistically update the cache to instantly clear the badge
      await queryClient.cancelQueries({ queryKey: ["my-notifications", user?.id] });
      
      const previousNotifs = queryClient.getQueryData(["my-notifications", user?.id]);
      
      queryClient.setQueryData(["my-notifications", user?.id], (old: any) => 
        old ? old.map((n: any) => n.id === id ? { ...n, is_read: true } : n) : old
      );

      return { previousNotifs };
    },
    onError: (err, id, context: any) => {
      if (context?.previousNotifs) {
        queryClient.setQueryData(["my-notifications", user?.id], context.previousNotifs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications", user?.id] });
    },
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => notifications.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["my-notifications", user?.id] });
      const previous = queryClient.getQueryData(["my-notifications", user?.id]);
      queryClient.setQueryData(["my-notifications", user?.id], (old: any) =>
        old ? old.filter((n: any) => n.id !== id) : old
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-notifications", user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications", user?.id] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-lg border border-[#0A2540]/15 bg-white shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-[#e8c96a] to-gold" />
        <div className="p-7 md:p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#0A2540]/6 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-[#0A2540]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {isAdmin ? "Admin Portal" : "Student Portal"}
              </p>
              <h1 className="font-display text-2xl font-bold text-[#0A2540]">
                Notifications
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading notifications…</div>
        ) : isError ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <p className="font-display font-bold text-slate-700 text-lg">Could not load notifications</p>
            <p className="text-slate-500 text-sm mt-1">{(error as any)?.message || "Please try again later."}</p>
          </div>
        ) : myNotifs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-display font-bold text-slate-700 text-lg">You're all caught up!</p>
            <p className="text-slate-500 text-sm mt-1">There are no new notifications at the moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {myNotifs.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markRead.mutate(n.id);
                  if (n.link) navigate({ to: n.link });
                }}
                className={`group relative flex gap-3 sm:gap-5 items-start p-4 sm:p-6 transition-all duration-300 cursor-pointer ${
                  !n.is_read 
                    ? "bg-blue-50/40 hover:bg-blue-50/80" 
                    : "bg-white hover:bg-slate-50/80"
                }`}
              >
                {!n.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />
                )}
                
                <div className={`mt-0.5 shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm ${
                  !n.is_read 
                    ? "bg-white text-blue-500 border border-blue-100 group-hover:scale-105 transition-transform" 
                    : "bg-slate-50 text-slate-400 border border-slate-100"
                }`}>
                  {!n.is_read ? <AlertCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 w-full">
                      {(() => {
                        let rich = parseRichPayload(n.title, n.message, n.created_at);
                        // Inject appNo from the link if the card doesn't already have one
                        if (rich && !rich.appNo && n.link) {
                          const match = n.link.match(/\/applications\/([a-f0-9-]+)/i);
                          if (match) {
                            rich = { ...rich, appNo: `APP-${match[1].split('-')[0].toUpperCase()}` };
                          }
                        }
                        return (
                          <>
                            {!rich && (
                              <div className="flex items-center justify-between gap-4">
                                <p className={`text-[15px] tracking-tight ${
                                  !n.is_read ? "font-bold text-[#0A2540]" : "font-semibold text-slate-700"
                                }`}>
                                  {n.title}
                                </p>
                                {!n.is_read && (
                                  <span className="flex h-2 w-2 rounded-full bg-blue-500 shrink-0 shadow-sm shadow-blue-500/50" />
                                )}
                              </div>
                            )}
                            {rich ? (
                              <div className="mt-1">
                                <RichNotificationCard payload={rich} />
                              </div>
                            ) : (
                              <p className={`leading-relaxed ${
                                !n.is_read ? "text-slate-600 text-sm" : "text-slate-500 text-sm"
                              }`}>
                                {n.message}
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-1">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${
                          !n.is_read ? "text-blue-500/70" : "text-slate-400"
                        }`}>
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setNotifToDelete(n); }}
                          disabled={deleteNotif.isPending}
                          title="Delete notification"
                          className="p-2 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-100 transition-colors duration-200"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ── Delete Confirmation Dialog ───────────────────────────────────────── */}
      <Dialog open={!!notifToDelete} onOpenChange={(open) => !open && setNotifToDelete(null)}>
        <DialogContent className="max-w-[400px] p-8 overflow-hidden border-0 shadow-2xl rounded-xl bg-slate-50">
          <div className="flex flex-col space-y-4">
            <h2 className="text-xl font-bold text-[#0A2540]">
              Are you sure you want to delete this notification?
            </h2>
            <p className="text-slate-500 text-[15px]">
              This action cannot be undone.
            </p>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <Button
              variant="outline"
              className="px-6 font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setNotifToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              className="px-8 font-semibold bg-[#0A2540] hover:bg-[#0C2D50] text-white"
              disabled={deleteNotif.isPending}
              onClick={() => {
                deleteNotif.mutate(notifToDelete.id, {
                  onSuccess: () => setNotifToDelete(null),
                  onError: () => setNotifToDelete(null),
                });
              }}
            >
              {deleteNotif.isPending ? "Yes..." : "Yes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
