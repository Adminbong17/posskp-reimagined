import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/repair/")({
  component: RepairOverview,
});

const OPEN_STATUSES = ["received", "diagnosing", "in_progress", "ready"];

function RepairOverview() {
  const { data: business } = useCurrentBusiness();
  const { data: stats } = useQuery({
    queryKey: ["repair-stats", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("repair_jobs")
        .select("status,estimated_cost,final_cost,advance_paid")
        .eq("business_id", business!.id);
      const rows = data ?? [];
      const by = (s: string) => rows.filter((r: any) => r.status === s).length;
      const revenue = rows
        .filter((r: any) => r.status === "delivered")
        .reduce((s: number, r: any) => s + Number(r.final_cost || 0), 0);
      const pendingDue = rows
        .filter((r: any) => OPEN_STATUSES.includes(r.status))
        .reduce((s: number, r: any) => s + (Number(r.estimated_cost || 0) - Number(r.advance_paid || 0)), 0);
      return {
        total: rows.length,
        received: by("received"),
        diagnosing: by("diagnosing"),
        inProgress: by("in_progress"),
        ready: by("ready"),
        delivered: by("delivered"),
        revenue,
        pendingDue,
      };
    },
  });

  const cards = [
    { label: "Total Jobs", value: stats?.total ?? 0 },
    { label: "Received", value: stats?.received ?? 0 },
    { label: "Diagnosing", value: stats?.diagnosing ?? 0 },
    { label: "In Progress", value: stats?.inProgress ?? 0 },
    { label: "Ready", value: stats?.ready ?? 0 },
    { label: "Delivered", value: stats?.delivered ?? 0 },
    { label: "Revenue (Delivered)", value: `৳${(stats?.revenue ?? 0).toLocaleString()}` },
    { label: "Pending Due (Open)", value: `৳${(stats?.pendingDue ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => printHrmReport({
            title: "Repair Overview Summary",
            business,
            columns: [{ label: "Metric" }, { label: "Value", align: "right" }],
            rows: cards.map((c) => [c.label, String(c.value)]),
            filename: "repair-overview",
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
