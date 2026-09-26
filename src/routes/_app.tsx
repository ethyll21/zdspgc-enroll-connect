import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { enrollments, notifications } from "@/integrations/localdb/client";
import { GraduationCap, LayoutDashboard, FilePlus2, User, LogOut, ShieldCheck, FileSearch, ChevronRight, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: typeof window !== 'undefined' && !!user && !isAdmin,
    queryFn: () => enrollments.my().then((r) => r.enrollments),
  });

  const { data: myNotifs = [] } = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    retry: false,
    queryFn: () => notifications.my().then((r) => r.notifications),
    refetchInterval: 30_000,
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const unreadCount = myNotifs.filter((n) => !n.is_read).length;
  const hasActiveApplication = myEnrollments.length > 0;

  const studentNav = [
    { to: "/dashboard",  label: "Dashboard",       icon: LayoutDashboard, badge: 0 },
    hasActiveApplication 
      ? { to: "/applications/$appId", params: { appId: myEnrollments[0]?.id }, label: "Application", icon: FileSearch, badge: 0 } 
      : { to: "/apply", label: "Application", icon: FileSearch, badge: 0 },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { to: "/profile",    label: "Profile",          icon: User, badge: 0 },
  ];
  const adminNav = [
    { to: "/admin",              label: "Dashboard",     icon: LayoutDashboard, badge: 0 },
    { to: "/admin/applications", label: "Applications",  icon: FileSearch, badge: 0 },
    { to: "/notifications",      label: "Notifications", icon: Bell, badge: unreadCount },
    { to: "/profile",            label: "Profile",       icon: User, badge: 0 },
  ];
  const nav = isAdmin ? adminNav : studentNav;

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0A2540] md:flex">

        {/* Logo / brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white shadow-sm p-0.5">
            <img src="/logo.png" alt="ZDSPGC Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-white">
              ZDSPGC
            </p>
            <p className="text-[10px] uppercase tracking-widest font-medium text-gold/70">
              Dimataling Campus
            </p>
          </div>
        </div>

        {/* Portal badge */}
        <div className="px-4 pt-5 pb-2">
          {isAdmin ? (
            <div className="flex items-center gap-2 rounded px-3 py-2.5 border border-gold/30 bg-gold/10">
              <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                Registrar Portal
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded px-3 py-2.5 border border-white/20 bg-white/10">
              <GraduationCap className="h-3.5 w-3.5 text-white shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                Student Portal
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map((item) => {
            const active =
              item.to === "/admin" || item.to === "/dashboard"
                ? pathname === item.to
                : item.to === "/applications/$appId"
                  ? pathname.startsWith("/applications/")
                  : pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                params={item.params}
                className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-white/10 text-white border-l-2 border-gold pl-[10px]"
                    : "text-slate-400 hover:bg-white/6 hover:text-white border-l-2 border-transparent pl-[10px]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white px-1 shadow-sm">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-1.5 rounded bg-white/5 px-3 py-1">
            <p className="mb-0.5 font-semibold uppercase tracking-wider text-[10px] text-slate-500">
              Signed in as
            </p>
            <p className="truncate text-xs font-medium text-slate-300">
              {user?.email}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start text-sm text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will need to sign in again to access your dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignOut}>Yes</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-x-hidden flex flex-col">

        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0C2D50] px-4 py-3 md:px-8">
          {/* Mobile: logo */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-white p-0.5 shadow-sm">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <span className="font-display text-sm font-bold text-white">
              ZDSPGC
            </span>
          </div>

          {/* Right: user info */}
          <div className="ml-auto flex items-center gap-3">

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:bg-white/10 hover:text-white md:hidden"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to sign in again to access your dashboard.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>Yes</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t bg-white py-2 shadow-lg md:hidden">
          {nav.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/dashboard" && item.to !== "/admin" &&
                (item.to === "/applications/$appId"
                  ? pathname.startsWith("/applications/")
                  : pathname.startsWith(item.to)));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  active ? "text-[#0A2540]" : "text-slate-400"
                }`}
              >
                <span className="relative">
                  <item.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white px-0.5">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                {item.label.split(" ")[0]}
                {active && <span className="absolute bottom-0 w-8 h-0.5 bg-[#0A2540] rounded-t-full" />}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
