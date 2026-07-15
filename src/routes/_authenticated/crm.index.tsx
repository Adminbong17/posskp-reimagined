import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";

export const Route = createFileRoute("/_authenticated/crm/")({
  component: CRMOverview,
});

function CRMOverview() {
  const { data: business } = useCurrentBusiness();
  const { data: stats } = useQuery({
    queryKey: ["crm-stats", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const [leads, followups, campaigns] = await Promise.all([
        supabase.from("crm_leads").select("stage,value").eq("business_id", business!.id),
        supabase.from("crm_followups").select("done,follow_up_date").eq("business_id", business!.id),
        supabase.from("crm_campaigns").select("status").eq("business_id", business!.id),
      ]);
      const leadsData = leads.data ?? [];
      const fups = followups.data ?? [];
      const today = new Date().toISOString().slice(0, 10);
      return {
        totalLeads: leadsData.length,
        pipeline: leadsData.reduce((s, l: any) => s + Number(l.value ?? 0), 0),
        won: leadsData.filter((l: any) => l.stage === "won").length,
        pendingFollowups: fups.filter((f: any) => !f.done).length,
        dueToday: fups.filter((f: any) => !f.done && f.follow_up_date <= today).length,
        campaigns: (campaigns.data ?? []).length,
      };
    },
  });

  const cards = [
    { label: "Total Leads", value: stats?.totalLeads ?? 0 },
    { label: "Pipeline Value", value: `৳${(stats?.pipeline ?? 0).toLocaleString()}` },
    { label: "Won Deals", value: stats?.won ?? 0 },
    { label: "Pending Follow-ups", value: stats?.pendingFollowups ?? 0 },
    { label: "Due Today / Overdue", value: stats?.dueToday ?? 0 },
    { label: "Campaigns", value: stats?.campaigns ?? 0 },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
