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
  ];
  const nav = isAdmin ? adminNav : studentNav;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold text-gold-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">ZDSPGC</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Dimataling</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {isAdmin && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-gold/15 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <ShieldCheck className="h-3.5 w-3.5" /> Registrar
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-3 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:px-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-semibold text-primary">ZDSPGC</span>
          </div>
          <div className="hidden md:block">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {isAdmin ? "Registrar Portal" : "Student Portal"}
            </p>
          </div>
          <div className="md:hidden">
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
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
