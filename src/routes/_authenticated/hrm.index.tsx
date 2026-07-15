import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Users, CalendarCheck, Plane, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hrm/")({
  component: HrmDashboard,
});

function HrmDashboard() {
  const { data: business } = useCurrentBusiness();

  const { data: stats } = useQuery({
    queryKey: ["hrm-stats", business?.id],
    enabled: !!business,
    queryFn: async () => {
      if (!business) return null;
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);

      const [emp, att, lv, pr] = await Promise.all([
        supabase.from("hrm_employees").select("id, is_active", { count: "exact" }).eq("business_id", business.id),
        supabase.from("hrm_attendance").select("id, status", { count: "exact" }).eq("business_id", business.id).eq("date", today),
        supabase.from("hrm_leaves").select("id, status", { count: "exact" }).eq("business_id", business.id).eq("status", "pending"),
        supabase.from("hrm_payrolls").select("net").eq("business_id", business.id).eq("period_month", month),
      ]);

      const active = (emp.data ?? []).filter((e: any) => e.is_active).length;
      const present = (att.data ?? []).filter((a: any) => a.status === "present").length;
      const monthPay = (pr.data ?? []).reduce((s: number, r: any) => s + Number(r.net || 0), 0);

      return {
        totalEmp: emp.count ?? 0,
        activeEmp: active,
        presentToday: present,
        pendingLeaves: lv.count ?? 0,
        monthPayroll: monthPay,
        month,
      };
    },
  });

  const cards = [
    { label: "Employees", value: `${stats?.activeEmp ?? 0} / ${stats?.totalEmp ?? 0}`, hint: "Active / Total", icon: Users, to: "/hrm/employees" },
    { label: "Present today", value: stats?.presentToday ?? 0, hint: new Date().toLocaleDateString("en-GB"), icon: CalendarCheck, to: "/hrm/attendance" },
    { label: "Pending leaves", value: stats?.pendingLeaves ?? 0, hint: "Awaiting approval", icon: Plane, to: "/hrm/leaves" },
    { label: `Payroll ${stats?.month ?? ""}`, value: `৳ ${(stats?.monthPayroll ?? 0).toLocaleString()}`, hint: "Net paid this month", icon: Wallet, to: "/hrm/payroll" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} to={c.to} className="rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <c.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
        </Link>
      ))}
    </div>
  );
}
