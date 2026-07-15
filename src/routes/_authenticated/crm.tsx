import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — QweekPOS" }] }),
  component: CRMLayout,
});

function CRMLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/crm", label: "Overview" },
    { to: "/crm/leads", label: "Leads" },
    { to: "/crm/followups", label: "Follow-ups" },
    { to: "/crm/campaigns", label: "Campaigns" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-semibold">CRM</h1>
      </div>
      <div className="flex gap-2 border-b border-border/60 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.to === "/crm" ? pathname === "/crm" : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to as any}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
