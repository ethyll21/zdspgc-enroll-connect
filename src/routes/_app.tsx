import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, LayoutDashboard, FilePlus2, User, LogOut, ShieldCheck, FileSearch } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }


  const studentNav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/apply", label: "New Application", icon: FilePlus2 },
    { to: "/profile", label: "My Profile", icon: User },
  ];
  const adminNav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/applications", label: "Applications", icon: FileSearch },
    { to: "/profile", label: "My Profile", icon: User },
  ];
  const nav = isAdmin ? adminNav : studentNav;

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`hidden w-64 shrink-0 flex-col border-r md:flex ${isAdmin ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-sidebar text-sidebar-foreground border-sidebar-border'}`}>
        <div className={`flex items-center gap-3 px-6 py-5 border-b ${isAdmin ? 'border-slate-800' : 'border-sidebar-border'}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className={`font-display text-sm font-semibold ${isAdmin ? 'text-white' : ''}`}>ZDSPGC</p>
            <p className={`text-[10px] uppercase tracking-wider ${isAdmin ? 'text-slate-400' : 'text-sidebar-foreground/60'}`}>Dimataling</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {isAdmin && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-gold/10 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-gold border border-gold/20">
              <ShieldCheck className="h-4 w-4" /> Registrar Portal
            </div>
          )}
          {nav.map((item) => {
            const active = item.to === "/admin" || item.to === "/dashboard"
              ? pathname === item.to
              : pathname.startsWith(item.to);
              
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? (isAdmin ? "bg-blue-600 text-white font-medium shadow-sm" : "bg-sidebar-accent text-sidebar-accent-foreground")
                    : (isAdmin ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t p-3 ${isAdmin ? 'border-slate-800' : 'border-sidebar-border'}`}>
          <div className={`mb-2 px-3 text-xs truncate ${isAdmin ? 'text-slate-500' : 'text-sidebar-foreground/60'}`}>{user?.email}</div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={`w-full justify-start ${isAdmin ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className={`flex items-center justify-between border-b px-4 py-3 md:px-8 ${isAdmin ? 'bg-slate-900 text-slate-200 border-slate-800 shadow-sm' : 'bg-card'}`}>
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <span className={`font-display text-sm font-semibold ${isAdmin ? 'text-white' : 'text-primary'}`}>ZDSPGC</span>
          </div>
          <div className="hidden md:block">
            <p className={`text-xs font-semibold uppercase tracking-wider ${isAdmin ? 'text-gold' : 'text-muted-foreground'}`}>
              {isAdmin ? "Registrar Administration" : "Student Portal"}
            </p>
          </div>
          <div className="md:hidden">
            <Button size="sm" variant="ghost" onClick={handleSignOut} className={isAdmin ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : ''}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
        {/* mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t bg-card py-2 md:hidden">
          {nav.map((item) => {
            const active = pathname === item.to || (item.to !== "/dashboard" && item.to !== "/admin" && pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon className="h-5 w-5" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
