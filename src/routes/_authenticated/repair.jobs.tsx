import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

const STATUS = [
  { value: "received", label: "Received" },
  { value: "diagnosing", label: "Diagnosing" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export const Route = createFileRoute("/_authenticated/repair/jobs")({
  component: RepairJobsPage,
});

function RepairJobsPage() {
  const { data: business } = useCurrentBusiness();
  const { data: rows = [] } = useQuery({
    queryKey: ["repair_jobs_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("repair_jobs").select("*")
        .eq("business_id", business!.id).order("received_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => printHrmReport({
          title: "Repair Jobs Report",
          business,
          columns: [
            { label: "Job #" }, { label: "Customer" }, { label: "Phone" },
            { label: "Device" }, { label: "Status" },
            { label: "Est.", align: "right" }, { label: "Final", align: "right" },
            { label: "Received" },
          ],
          rows: rows.map((r: any) => [
            r.job_no ?? "—",
            r.customer_name,
            r.customer_phone ?? "—",
            [r.brand, r.model, r.device].filter(Boolean).join(" ") || "—",
            STATUS.find((s) => s.value === r.status)?.label ?? r.status,
            `৳ ${Number(r.estimated_cost || 0).toLocaleString()}`,
            `৳ ${Number(r.final_cost || 0).toLocaleString()}`,
            r.received_date ? formatDate(r.received_date) : "—",
          ]),
          filename: "repair-jobs",
        })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="repair_jobs"
        title="Job Cards"
        orderBy="received_date"
        fields={[
          { key: "job_no", label: "Job No" },
          { key: "customer_name", label: "Customer Name", required: true },
          { key: "customer_phone", label: "Phone" },
          { key: "device", label: "Device (Phone, Laptop…)" },
          { key: "brand", label: "Brand" },
          { key: "model", label: "Model" },
          { key: "serial_no", label: "Serial / IMEI" },
          { key: "problem", label: "Reported Problem", type: "textarea" },
          { key: "technician", label: "Technician" },
          { key: "status", label: "Status", type: "select", options: STATUS, defaultValue: "received", required: true },
          { key: "estimated_cost", label: "Estimated Cost", type: "number", defaultValue: 0 },
          { key: "advance_paid", label: "Advance Paid", type: "number", defaultValue: 0 },
          { key: "final_cost", label: "Final Cost", type: "number", defaultValue: 0 },
          { key: "warranty_days", label: "Warranty (days)", type: "number", defaultValue: 0 },
          { key: "received_date", label: "Received Date", type: "date" },
          { key: "delivered_date", label: "Delivered Date", type: "date" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        listColumns={[
          { key: "job_no", label: "Job #" },
          { key: "customer_name", label: "Customer" },
          { key: "customer_phone", label: "Phone" },
          { key: "device", label: "Device", render: (r) => [r.brand, r.model, r.device].filter(Boolean).join(" ") || "—" },
          { key: "status", label: "Status", render: (r) => STATUS.find((s) => s.value === r.status)?.label ?? r.status },
          { key: "estimated_cost", label: "Est.", render: (r) => `৳${Number(r.estimated_cost ?? 0).toLocaleString()}` },
          { key: "final_cost", label: "Final", render: (r) => `৳${Number(r.final_cost ?? 0).toLocaleString()}` },
          { key: "received_date", label: "Received", render: (r) => r.received_date ? formatDate(r.received_date) : "—" },
        ]}
      />
    </div>
  );
}
