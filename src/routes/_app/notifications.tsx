import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { notifications } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
                className={`group relative flex gap-5 items-start p-6 transition-all duration-300 cursor-pointer ${
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
                      <p className={`leading-relaxed ${
                        !n.is_read ? "text-slate-600 text-sm" : "text-slate-500 text-sm"
                      }`}>
                        {n.message}
                      </p>
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
