import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/repair")({
  head: () => ({ meta: [{ title: "Repair — QweekPOS" }] }),
  component: RepairLayout,
});

function RepairLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/repair", label: "Overview" },
    { to: "/repair/jobs", label: "Job Cards" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-semibold">Repair</h1>
      </div>
      <div className="flex gap-2 border-b border-border/60 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.to === "/repair" ? pathname === "/repair" : pathname.startsWith(t.to);
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
