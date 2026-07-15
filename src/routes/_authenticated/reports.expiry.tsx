import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/expiry")({
  head: () => ({ meta: [{ title: "Expiring Batches — QweekPOS" }] }),
  component: ExpiryPage,
});

function daysLeft(d: string) {
  const t = new Date(d).getTime() - Date.now();
  return Math.ceil(t / (1000 * 60 * 60 * 24));
}

function ExpiryPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expiry-batches-full", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => supabase
        .from("transaction_purchase_lines")
        .select("id, lot_no, expire_date, quantity, purchase_price, product:products(name, sku), transaction:transactions!inner(business_id, transaction_date, ref_no)")
        .eq("transaction.business_id", businessId!)
        .not("expire_date", "is", null)
        .order("expire_date", { ascending: true })),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h1 className="font-display text-2xl font-semibold">Expiring Batches</h1>
        </div>
        <Link to="/reports" className="text-xs underline text-muted-foreground hover:text-foreground">← Back to Reports</Link>
      </div>
      <p className="text-sm text-muted-foreground">Showing all batches, sorted by nearest expiry.</p>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Batch</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-left p-2">Purchased</th>
              <th className="text-left p-2">Expire date</th>
              <th className="text-right p-2">Days left</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No batches with expiry dates.</td></tr>
            )}
            {rows.map((b: any) => {
              const dl = daysLeft(b.expire_date);
              const cls = dl < 0 ? "text-destructive" : dl <= 30 ? "text-amber-600" : "text-muted-foreground";
              return (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.product?.name ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{b.product?.sku ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{b.lot_no ?? "—"}</td>
                  <td className="p-2 text-right">{Number(b.quantity)}</td>
                  <td className="p-2">{formatDate(b.transaction?.transaction_date) || "—"}</td>
                  <td className="p-2">{formatDate(b.expire_date)}</td>
                  <td className={`p-2 text-right font-medium ${cls}`}>{dl < 0 ? `${Math.abs(dl)}d ago` : `${dl}d`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
