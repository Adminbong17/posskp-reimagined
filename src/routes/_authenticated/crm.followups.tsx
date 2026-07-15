import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm/followups")({
  component: FollowupsPage,
});

function FollowupsPage() {
  const { data: business } = useCurrentBusiness();
  const { data: rows = [] } = useQuery({
    queryKey: ["crm_followups_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("crm_followups").select("*")
        .eq("business_id", business!.id).order("follow_up_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => printHrmReport({
          title: "Follow-ups Report",
          business,
          columns: [{ label: "Date" }, { label: "Note" }, { label: "Status" }],
          rows: rows.map((r: any) => [
            formatDate(r.follow_up_date),
            r.note ?? "—",
            r.done ? "Done" : "Pending",
          ]),
          filename: "followups",
        })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="crm_followups"
        title="Follow-ups"
        orderBy="follow_up_date"
        fields={[
          { key: "follow_up_date", label: "Date", type: "date", required: true },
          { key: "note", label: "Note", type: "textarea" },
          { key: "done", label: "Done", type: "checkbox" },
        ]}
        listColumns={[
          { key: "follow_up_date", label: "Date", render: (r) => formatDate(r.follow_up_date) },
          { key: "note", label: "Note" },
          { key: "done", label: "Status", render: (r) => r.done ? "Done" : "Pending" },
        ]}
      />
    </div>
  );
}
