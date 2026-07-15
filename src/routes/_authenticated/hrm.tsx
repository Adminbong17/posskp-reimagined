import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Users, CalendarCheck, Plane, Wallet, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hrm")({
  head: () => ({ meta: [{ title: "HRM — QweekPOS" }] }),
  component: HrmLayout,
});

const tabs = [
  { to: "/hrm", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/hrm/employees", label: "Employees", icon: Users },
  { to: "/hrm/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/hrm/leaves", label: "Leaves", icon: Plane },
  { to: "/hrm/payroll", label: "Payroll", icon: Wallet },
];

function HrmLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Human Resources</h1>
        <p className="text-sm text-muted-foreground">Employees, attendance, leaves and payroll.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted"
            activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
