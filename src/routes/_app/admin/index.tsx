import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, AlertCircle, Users, FileSearch, Database, Activity } from "lucide-react";
import { enrollments as enrollmentsApi } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
});

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending",      tone: "text-warning" },
  under_review: { label: "Under Review", tone: "text-secondary" },
  approved:     { label: "Approved",     tone: "text-success" },
  rejected:     { label: "Rejected",     tone: "text-destructive" },
};

function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  // Stats from the /stats/overview endpoint
  const { data: statsData } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-enrollment-stats"],
    queryFn: () => enrollmentsApi.stats().then((r) => r.stats),
    refetchInterval: 30_000,
  });

  // Recent enrollments
  const { data: recentData = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-enrollments-recent"],
    queryFn: () => enrollmentsApi.list({ page: 1, limit: 10 }).then((r) => r.enrollments),
  });

  if (!isAdmin) return null;

  const stats = [
    { label: "Total Students",  value: statsData?.total_students ?? 0, icon: Users,        text: "text-blue-700", bg: "bg-gradient-to-br from-blue-50 to-blue-100", border: "border-blue-200" },
    { label: "Pending",         value: statsData?.pending ?? 0,         icon: Clock,        text: "text-amber-600", bg: "bg-gradient-to-br from-amber-50 to-amber-100", border: "border-amber-200" },
    { label: "Under Review",    value: statsData?.under_review ?? 0,    icon: AlertCircle,  text: "text-purple-600", bg: "bg-gradient-to-br from-purple-50 to-purple-100", border: "border-purple-200" },
    { label: "Approved",        value: statsData?.approved ?? 0,        icon: CheckCircle2, text: "text-emerald-600", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100", border: "border-emerald-200" },
    { label: "Rejected",        value: statsData?.rejected ?? 0,        icon: XCircle,      text: "text-rose-600", bg: "bg-gradient-to-br from-rose-50 to-rose-100", border: "border-rose-200" },
  ];

  const pieData = [
    { name: "Pending", value: statsData?.pending ?? 0, color: "#f59e0b" },
    { name: "Under Review", value: statsData?.under_review ?? 0, color: "#a855f7" },
    { name: "Approved", value: statsData?.approved ?? 0, color: "#10b981" },
    { name: "Rejected", value: statsData?.rejected ?? 0, color: "#f43f5e" },
  ].filter(d => d.value > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-800">Registrar Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of all pre-enrollment activity & analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success shadow-sm">
            <Database className="h-3 w-3" /> System Active
          </span>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/admin/applications"><FileSearch className="mr-2 h-4 w-4" /> Review Applications</Link>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, text, bg, border }) => (
          <div key={label} className={`rounded-2xl border ${border} ${bg} p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs font-bold uppercase tracking-wider ${text}`}>{label}</span>
              <div className={`p-2 rounded-full bg-white/60 shadow-sm`}>
                <Icon className={`h-5 w-5 ${text}`} />
              </div>
            </div>
            <p className={`font-display text-4xl font-extrabold ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* Charts */}
        <div className="rounded-xl border bg-white shadow-sm p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="font-display text-lg font-semibold text-slate-800">Status Distribution</h2>
          </div>
          <div className="flex-1 min-h-[250px] relative">
            {pieData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent enrollments table */}
        <div className="rounded-xl border bg-white shadow-sm flex flex-col">
          <div className="border-b px-5 py-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-800">Recent Applications</h2>
            <Link to="/admin/applications" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          {recentData.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No enrollment submissions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 flex-1 overflow-auto max-h-[350px]">
              {recentData.map((e) => {
                const meta = STATUS_META[e.status] ?? { label: e.status, tone: "" };
                return (
                  <li key={e.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {e.first_name} {e.last_name}{" "}
                        {e.student_no && (
                          <span className="text-xs font-normal text-slate-500">({e.student_no})</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {e.program_code} · {e.school_year} {e.semester} ·{" "}
                        {formatDistanceToNow(new Date(e.submitted_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <Link to="/admin/review/$id" params={{ id: e.id }}>Review</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
