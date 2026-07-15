import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

const STATUS = [
  { value: "new", label: "New" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "served", label: "Served" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const ORDER_TYPE = [
  { value: "dine_in", label: "Dine-in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
];

export const Route = createFileRoute("/_authenticated/restaurant/orders")({
  component: RestaurantOrdersPage,
});

function RestaurantOrdersPage() {
  const { data: business } = useCurrentBusiness();
  const { data: rows = [] } = useQuery({
    queryKey: ["restaurant_orders_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("restaurant_orders").select("*")
        .eq("business_id", business!.id).order("ordered_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => printHrmReport({
            title: "Restaurant Orders (KOT) Report",
            business,
            columns: [
              { label: "Order #" }, { label: "Table" }, { label: "Type" },
              { label: "Customer" }, { label: "Waiter" }, { label: "Status" },
              { label: "Total", align: "right" }, { label: "Ordered" },
            ],
            rows: rows.map((r: any) => [
              r.order_no ?? "—",
              r.table_name ?? "—",
              ORDER_TYPE.find((s) => s.value === r.order_type)?.label ?? r.order_type,
              r.customer_name ?? "—",
              r.waiter ?? "—",
              STATUS.find((s) => s.value === r.status)?.label ?? r.status,
              `৳ ${Number(r.total || 0).toLocaleString()}`,
              r.ordered_at ? formatDate(r.ordered_at) : "—",
            ]),
            filename: "restaurant-orders",
          })}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="restaurant_orders"
        title="Orders (KOT)"
        orderBy="ordered_at"
        fields={[
          { key: "order_no", label: "Order No" },
          { key: "table_name", label: "Table" },
          { key: "order_type", label: "Type", type: "select", options: ORDER_TYPE, defaultValue: "dine_in", required: true },
          { key: "customer_name", label: "Customer" },
          { key: "waiter", label: "Waiter" },
          { key: "status", label: "Status", type: "select", options: STATUS, defaultValue: "new", required: true },
          { key: "subtotal", label: "Subtotal", type: "number", defaultValue: 0 },
          { key: "discount", label: "Discount", type: "number", defaultValue: 0 },
          { key: "tax", label: "Tax", type: "number", defaultValue: 0 },
          { key: "total", label: "Total", type: "number", defaultValue: 0, required: true },
          { key: "notes", label: "Order Notes / Items", type: "textarea" },
          { key: "ordered_at", label: "Ordered At", type: "date" },
          { key: "served_at", label: "Served At", type: "date" },
        ]}
        listColumns={[
          { key: "order_no", label: "Order #" },
          { key: "table_name", label: "Table" },
          { key: "order_type", label: "Type", render: (r) => ORDER_TYPE.find((s) => s.value === r.order_type)?.label ?? r.order_type },
          { key: "customer_name", label: "Customer" },
          { key: "waiter", label: "Waiter" },
          { key: "status", label: "Status", render: (r) => STATUS.find((s) => s.value === r.status)?.label ?? r.status },
          { key: "total", label: "Total", render: (r) => `৳${Number(r.total ?? 0).toLocaleString()}` },
          { key: "ordered_at", label: "Ordered", render: (r) => r.ordered_at ? formatDate(r.ordered_at) : "—" },
        ]}
      />
    </div>
  );
}
