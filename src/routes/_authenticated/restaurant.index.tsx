import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/restaurant/")({
  component: RestaurantOverview,
});

const OPEN = ["new", "preparing", "ready", "served"];

function RestaurantOverview() {
  const { data: business } = useCurrentBusiness();
  const { data: stats } = useQuery({
    queryKey: ["restaurant-stats", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const [{ data: tables }, { data: orders }] = await Promise.all([
        supabase.from("restaurant_tables").select("status").eq("business_id", business!.id),
        supabase.from("restaurant_orders").select("status,total,ordered_at").eq("business_id", business!.id),
      ]);
      const t = tables ?? [];
      const o = orders ?? [];
      const by = (s: string) => o.filter((r: any) => r.status === s).length;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayRevenue = o
        .filter((r: any) => r.status === "paid" && new Date(r.ordered_at) >= today)
        .reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      return {
        totalTables: t.length,
        occupied: t.filter((r: any) => r.status === "occupied").length,
        available: t.filter((r: any) => r.status === "available").length,
        totalOrders: o.length,
        openOrders: o.filter((r: any) => OPEN.includes(r.status)).length,
        new: by("new"),
        preparing: by("preparing"),
        ready: by("ready"),
        served: by("served"),
        paid: by("paid"),
        todayRevenue,
      };
    },
  });

  const cards = [
    { label: "Total Tables", value: stats?.totalTables ?? 0 },
    { label: "Available", value: stats?.available ?? 0 },
    { label: "Occupied", value: stats?.occupied ?? 0 },
    { label: "Open Orders", value: stats?.openOrders ?? 0 },
    { label: "New", value: stats?.new ?? 0 },
    { label: "Preparing", value: stats?.preparing ?? 0 },
    { label: "Ready", value: stats?.ready ?? 0 },
    { label: "Served", value: stats?.served ?? 0 },
    { label: "Paid", value: stats?.paid ?? 0 },
    { label: "Today Revenue", value: `৳${(stats?.todayRevenue ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => printHrmReport({
            title: "Restaurant Overview Summary",
            business,
            columns: [{ label: "Metric" }, { label: "Value", align: "right" }],
            rows: cards.map((c) => [c.label, String(c.value)]),
            filename: "restaurant-overview",
          })}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
