import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertCircle } from "lucide-react";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNotif, setSelectedNotif] = useState<any>(null);

  const { data: myNotifs = [], isLoading, isError, error } = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user,
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
                Student Portal
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
                  setSelectedNotif(n);
                  if (!n.is_read) markRead.mutate(n.id);
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
                      <div className="flex items-center gap-2 mt-3 pt-1">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${
                          !n.is_read ? "text-blue-500/70" : "text-slate-400"
                        }`}>
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotif} onOpenChange={(open) => !open && setSelectedNotif(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-[#0A2540] to-[#0C2D50] p-6 text-white flex items-start gap-4">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-inner backdrop-blur-sm">
              {selectedNotif?.title?.toLowerCase().includes("approve") ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : selectedNotif?.title?.toLowerCase().includes("reject") ? (
                <AlertCircle className="h-6 w-6 text-rose-400" />
              ) : (
                <Bell className="h-6 w-6 text-blue-300" />
              )}
            </div>
            <div>
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-bold tracking-tight text-white mt-1">
                  {selectedNotif?.title}
                </DialogTitle>
              </DialogHeader>
            </div>
          </div>
          
          <div className="p-6 bg-white">
            <DialogDescription className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">
              {selectedNotif?.message}
            </DialogDescription>
            
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {selectedNotif && format(new Date(selectedNotif.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <Button 
                onClick={() => setSelectedNotif(null)} 
                variant="outline" 
                size="sm"
                className="font-semibold text-slate-600 hover:text-[#0A2540] hover:bg-slate-50"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
