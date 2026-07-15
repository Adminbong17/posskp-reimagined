import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

const STATUS = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

export const Route = createFileRoute("/_authenticated/crm/campaigns")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const { data: business } = useCurrentBusiness();
  const { data: rows = [] } = useQuery({
    queryKey: ["crm_campaigns_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("crm_campaigns").select("*")
        .eq("business_id", business!.id).order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => printHrmReport({
          title: "Campaigns Report",
          business,
          columns: [
            { label: "Name" }, { label: "Channel" }, { label: "Status" },
            { label: "Budget", align: "right" }, { label: "Start" }, { label: "End" },
          ],
          rows: rows.map((c: any) => [
            c.name,
            c.channel ?? "—",
            STATUS.find((s) => s.value === c.status)?.label ?? c.status ?? "—",
            `৳ ${Number(c.budget || 0).toLocaleString()}`,
            c.start_date ? formatDate(c.start_date) : "—",
            c.end_date ? formatDate(c.end_date) : "—",
          ]),
          footer: [[
            "Total", "", "",
            `৳ ${rows.reduce((s: number, c: any) => s + Number(c.budget || 0), 0).toLocaleString()}`,
            "", "",
          ]],
          filename: "campaigns",
        })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="crm_campaigns"
        title="Campaigns"
        orderBy="name"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "channel", label: "Channel", placeholder: "Facebook, SMS, Email…" },
          { key: "start_date", label: "Start Date", type: "date" },
          { key: "end_date", label: "End Date", type: "date" },
          { key: "budget", label: "Budget", type: "number" },
          { key: "status", label: "Status", type: "select", options: STATUS, defaultValue: "planned" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        listColumns={[
          { key: "name", label: "Name" },
          { key: "channel", label: "Channel" },
          { key: "status", label: "Status", render: (r) => STATUS.find((s) => s.value === r.status)?.label ?? r.status },
          { key: "budget", label: "Budget", render: (r) => `৳${Number(r.budget ?? 0).toLocaleString()}` },
          { key: "start_date", label: "Start", render: (r) => formatDate(r.start_date) },
          { key: "end_date", label: "End", render: (r) => formatDate(r.end_date) },
        ]}
      />
    </div>
  );
}
