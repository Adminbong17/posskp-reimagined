import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

const STATUS = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "cleaning", label: "Cleaning" },
];

export const Route = createFileRoute("/_authenticated/restaurant/tables")({
  component: RestaurantTablesPage,
});

function RestaurantTablesPage() {
  const { data: business } = useCurrentBusiness();
  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant_tables_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("restaurant_tables").select("*")
        .eq("business_id", business!.id).order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => printHrmReport({
            title: "Restaurant Tables",
            business,
            columns: [
              { label: "Name" }, { label: "Area" },
              { label: "Seats", align: "right" }, { label: "Status" }, { label: "Notes" },
            ],
            rows: tables.map((t: any) => [
              t.name ?? "—",
              t.area ?? "—",
              String(t.seats ?? 0),
              STATUS.find((s) => s.value === t.status)?.label ?? t.status ?? "—",
              t.notes ?? "—",
            ]),
            filename: "restaurant-tables",
          })}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="restaurant_tables"
        title="Tables"
        orderBy="name"
        fields={[
          { key: "name", label: "Table Name / No", required: true },
          { key: "area", label: "Area / Floor" },
          { key: "seats", label: "Seats", type: "number", defaultValue: 4 },
          { key: "status", label: "Status", type: "select", options: STATUS, defaultValue: "available", required: true },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        listColumns={[
          { key: "name", label: "Name" },
          { key: "area", label: "Area" },
          { key: "seats", label: "Seats" },
          { key: "status", label: "Status", render: (r) => STATUS.find((s) => s.value === r.status)?.label ?? r.status },
        ]}
      />
    </div>
  );
}
