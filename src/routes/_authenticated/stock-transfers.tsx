import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, PackageCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { PrintSizeButton, type PrintSize } from "@/components/print-size-select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/stock-transfers")({
  head: () => ({ meta: [{ title: "Stock Transfers — QweekPOS" }] }),
  component: StockTransfersPage,
});

type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";
type Location = { id: string; name: string };
type Product = { id: string; name: string };
type Variation = { id: string; product_id: string; name: string; default_purchase_price: number | null };
type Transfer = {
  id: string;
  ref_no: string | null;
  transfer_date: string;
  status: TransferStatus;
  shipping_charges: number;
  additional_notes: string | null;
  total_amount: number;
  from_location_id: string;
  to_location_id: string;
};
type LineDraft = { product_id: string; variation_id: string; quantity: number; unit_cost: number };

const money = (n: number) => Number(n || 0).toFixed(2);
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

const statusColor: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  received: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
};

function StockTransfersPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const locations = useQuery({
    queryKey: ["biz-locations", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase.from("business_locations").select("id, name").eq("business_id", businessId!).order("name");
      return (data ?? []) as Location[];
    },
  });

  const products = useQuery({
    queryKey: ["biz-products-basic", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("business_id", businessId!).order("name").limit(1000);
      return (data ?? []) as Product[];
    },
  });

  const variations = useQuery({
    queryKey: ["biz-variations-basic", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("variations")
        .select("id, product_id, name, default_purchase_price, products!inner(business_id)")
        .eq("products.business_id", businessId!)
        .order("name");
      return (data ?? []) as unknown as Variation[];
    },
  });

  const transfers = useQuery({
    queryKey: ["stock-transfers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("id, ref_no, transfer_date, status, shipping_charges, additional_notes, total_amount, from_location_id, to_location_id")
        .eq("business_id", businessId!)
        .order("transfer_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transfer[];
    },
  });

  const locName = (id: string) => locations.data?.find((l) => l.id === id)?.name ?? "—";

  const receive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("receive_stock_transfer" as any, { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer received");
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_stock_transfer" as any, { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground">Move inventory between locations with shipping costs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>
          </DialogTrigger>
          <NewTransferDialog
            businessId={businessId}
            locations={locations.data ?? []}
            products={products.data ?? []}
            variations={variations.data ?? []}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>From → To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Shipping</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.data?.length ? transfers.data.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{fmtDate(t.transfer_date)}</TableCell>
                <TableCell>{t.ref_no ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  <span className="font-medium">{locName(t.from_location_id)}</span>
                  <ArrowRight className="inline mx-1 h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{locName(t.to_location_id)}</span>
                </TableCell>
                <TableCell><Badge className={statusColor[t.status]}>{t.status}</Badge></TableCell>
                <TableCell className="text-right">{money(t.shipping_charges)}</TableCell>
                <TableCell className="text-right font-medium">{money(t.total_amount)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    {t.status !== "received" && t.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => receive.mutate(t.id)}>
                        <PackageCheck className="mr-1 h-3.5 w-3.5" /> Receive
                      </Button>
                    )}
                    {(t.status === "in_transit" || t.status === "received") && (
                      <PrintSizeButton
                        label=""
                        onPrint={(size) => printTransfer(t.id, size, business?.name ?? "Stock Transfer", locations.data ?? [])}
                      />
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this transfer?")) del.mutate(t.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transfers yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewTransferDialog({
  businessId, locations, products, variations, onClose,
}: {
  businessId?: string; locations: Location[]; products: Product[]; variations: Variation[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [fromLoc, setFromLoc] = useState<string>("");
  const [toLoc, setToLoc] = useState<string>("");
  const [status, setStatus] = useState<TransferStatus>("in_transit");
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const linesTotal = useMemo(() => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0), [lines]);
  const grandTotal = linesTotal + Number(shipping || 0);

  const addLine = () => setLines((prev) => [...prev, { product_id: "", variation_id: "", quantity: 1, unit_cost: 0 }]);
  const updateLine = (i: number, patch: Partial<LineDraft>) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const create = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Missing business");
      if (!fromLoc || !toLoc) throw new Error("Select both locations");
      if (fromLoc === toLoc) throw new Error("From and To must differ");
      if (!lines.length) throw new Error("Add at least one line");
      for (const l of lines) if (!l.variation_id || !l.product_id || l.quantity <= 0) throw new Error("Complete all lines");

      const { data, error } = await supabase.rpc("create_stock_transfer" as any, {
        _payload: {
          business_id: businessId,
          from_location_id: fromLoc,
          to_location_id: toLoc,
          ref_no: refNo || null,
          transfer_date: new Date(date).toISOString(),
          status,
          shipping_charges: Number(shipping || 0),
          additional_notes: notes || null,
          lines,
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Transfer created");
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Ref No</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Auto" /></div>
          <div><Label>Date</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>From</Label>
            <Select value={fromLoc} onValueChange={setFromLoc}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>To</Label>
            <Select value={toLoc} onValueChange={setToLoc}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TransferStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variation</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Unit Cost</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const varsForProduct = variations.filter((v) => v.product_id === l.product_id);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.product_id} onValueChange={(v) => updateLine(i, { product_id: v, variation_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={l.variation_id}
                        onValueChange={(v) => {
                          const found = varsForProduct.find((x) => x.id === v);
                          updateLine(i, { variation_id: v, unit_cost: l.unit_cost || Number(found?.default_purchase_price ?? 0) });
                        }}
                        disabled={!l.product_id}
                      >
                        <SelectTrigger><SelectValue placeholder="Variation" /></SelectTrigger>
                        <SelectContent>{varsForProduct.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={0} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input type="number" min={0} value={l.unit_cost} onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right">{money(Number(l.quantity || 0) * Number(l.unit_cost || 0))}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={6}><Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-3.5 w-3.5" /> Add line</Button></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Shipping charges</Label><Input type="number" min={0} value={shipping} onChange={(e) => setShipping(Number(e.target.value))} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>

        <div className="flex justify-end gap-6 text-sm">
          <div>Lines: <span className="font-medium">{money(linesTotal)}</span></div>
          <div>Shipping: <span className="font-medium">{money(Number(shipping || 0))}</span></div>
          <div className="text-base">Total: <span className="font-semibold">{money(grandTotal)}</span></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>Create Transfer</Button>
      </DialogFooter>
    </DialogContent>
  );
}