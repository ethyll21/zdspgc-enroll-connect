import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Users,
  FileSearch, Activity, TrendingUp,
} from "lucide-react";
import { enrollments as enrollmentsApi } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: statsData } = useQuery({
    enabled: typeof window !== 'undefined' && isAdmin,
    queryKey: ["admin-enrollment-stats"],
    queryFn: () => enrollmentsApi.stats().then((r) => r.stats),
    refetchInterval: 30_000,
  });

  if (!isAdmin) return null;

  const total = (statsData?.pending ?? 0) + (statsData?.under_review ?? 0) +
    (statsData?.approved ?? 0) + (statsData?.rejected ?? 0);

  const stats = [
    {
      label: "Total Students",
      value: total,
      icon: Users,
      borderColor: "border-l-[#0A2540]",
      textColor: "text-[#0A2540]",
      iconBg: "bg-[#0A2540]/8",
    },
    {
      label: "Pending",
      value: statsData?.pending ?? 0,
      icon: Clock,
      borderColor: "border-l-amber-500",
      textColor: "text-amber-700",
      iconBg: "bg-amber-50",
    },
    {
      label: "Under Review",
      value: statsData?.under_review ?? 0,
      icon: AlertCircle,
      borderColor: "border-l-blue-600",
      textColor: "text-blue-700",
      iconBg: "bg-blue-50",
    },
    {
      label: "Approved",
      value: statsData?.approved ?? 0,
      icon: CheckCircle2,
      borderColor: "border-l-emerald-600",
      textColor: "text-emerald-700",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Rejected",
      value: statsData?.rejected ?? 0,
      icon: XCircle,
      borderColor: "border-l-rose-500",
      textColor: "text-rose-700",
      iconBg: "bg-rose-50",
    },
  ];

  const pieData = [
    { name: "Pending",      value: statsData?.pending ?? 0,      color: "#d97706" },
    { name: "Under Review", value: statsData?.under_review ?? 0, color: "#1d4ed8" },
    { name: "Approved",     value: statsData?.approved ?? 0,     color: "#059669" },
    { name: "Rejected",     value: statsData?.rejected ?? 0,     color: "#e11d48" },
  ].filter(d => d.value > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-6">
        <div>

          <h1 className="font-display text-3xl font-bold text-[#0A2540]">Dashboard</h1>

        </div>
        <div className="flex items-center gap-3">

          <Button asChild className="bg-[#0A2540] hover:bg-[#0c2f58] text-white rounded shadow-sm">
            <Link to="/admin/applications">
              <FileSearch className="mr-2 h-4 w-4" />
              Review Applications
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, borderColor, textColor, iconBg }) => (
          <div
            key={label}
            className={`rounded-lg border border-slate-200 border-l-4 ${borderColor} bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded ${iconBg}`}>
                <Icon className={`h-4 w-4 ${textColor}`} />
              </div>
            </div>
            <p className={`font-display text-3xl font-bold ${textColor}`}>{value}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Charts & summary ────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">

        {/* Status Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0A2540]" />
            <h2 className="font-display text-base font-bold text-[#0A2540]">Status Distribution</h2>
          </div>
          <div className="p-5 min-h-[280px] relative">
            {pieData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-400 gap-2">
                <Activity className="h-8 w-8 text-slate-200" />
                No enrollment data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.375rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                      fontFamily: "Inter, system-ui, sans-serif",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Summary statistics table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#0A2540]" />
            <h2 className="font-display text-base font-bold text-[#0A2540]">Application Summary</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Total Applications", value: total, color: "text-[#0A2540]" },
              { label: "Pending Review", value: statsData?.pending ?? 0, color: "text-amber-700" },
              { label: "Under Review", value: statsData?.under_review ?? 0, color: "text-blue-700" },
              { label: "Approved", value: statsData?.approved ?? 0, color: "text-emerald-700" },
              { label: "Rejected", value: statsData?.rejected ?? 0, color: "text-rose-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className="text-sm text-slate-600">{label}</span>
                <span className={`font-display text-xl font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
