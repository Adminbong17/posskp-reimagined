import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { PrintSizeButton } from "@/components/print-size-select";
import { Printer } from "lucide-react";

const STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const Route = createFileRoute("/_authenticated/crm/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { data: business } = useCurrentBusiness();
  const { data: leads = [] } = useQuery({
    queryKey: ["crm_leads_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("crm_leads").select("*")
        .eq("business_id", business!.id).order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PrintSizeButton onPrint={(size) => printHrmReport({
          title: "Leads Report",
          business,
          columns: [
            { label: "Name" }, { label: "Phone" }, { label: "Email" },
            { label: "Source" }, { label: "Stage" },
            { label: "Value", align: "right" },
          ],
          rows: leads.map((l: any) => [
            l.name, l.phone ?? "—", l.email ?? "—",
            l.source ?? "—",
            STAGES.find((s) => s.value === l.stage)?.label ?? l.stage ?? "—",
            `৳ ${Number(l.value || 0).toLocaleString()}`,
          ]),
          footer: [[
            "Total", "", "", "", "",
            `৳ ${leads.reduce((s: number, l: any) => s + Number(l.value || 0), 0).toLocaleString()}`,
          ]],
          filename: "leads",
          size,
        })} />
      </div>
      <MasterDataTable
        table="crm_leads"
        title="Leads"
        orderBy="name"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "source", label: "Source", placeholder: "Facebook, Referral…" },
          { key: "stage", label: "Stage", type: "select", options: STAGES, defaultValue: "new", required: true },
          { key: "value", label: "Deal Value", type: "number" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        listColumns={[
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "stage", label: "Stage", render: (r) => STAGES.find((s) => s.value === r.stage)?.label ?? r.stage },
          { key: "value", label: "Value", render: (r) => `৳${Number(r.value ?? 0).toLocaleString()}` },
          { key: "source", label: "Source" },
        ]}
      />
    </div>
  );
}
