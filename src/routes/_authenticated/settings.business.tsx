import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/business")({
  component: BusinessSettings,
});

function BusinessSettings() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", sku_prefix: "", time_zone: "UTC", tax_number_1: "", tax_label_1: "",
    default_profit_percent: 25, fy_start_month: 1, accounting_method: "fifo",
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("id, code, currency, symbol").order("code")).data ?? [],
  });

  useEffect(() => {
    if (business) {
      supabase.from("businesses").select("*").eq("id", business.id).single().then(({ data }) => {
        if (data) setForm({
          name: data.name, sku_prefix: data.sku_prefix ?? "", time_zone: data.time_zone,
          tax_number_1: data.tax_number_1 ?? "", tax_label_1: data.tax_label_1 ?? "",
          default_profit_percent: Number(data.default_profit_percent),
          fy_start_month: data.fy_start_month, accounting_method: data.accounting_method,
        });
      });
    }
  }, [business?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!business) return;
      const { error } = await supabase.from("businesses").update(form).eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Business updated");
      qc.invalidateQueries({ queryKey: ["current-business"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!business) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 max-w-2xl"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        </Field>
        <Field label="SKU prefix">
          <input value={form.sku_prefix} onChange={(e) => setForm({ ...form, sku_prefix: e.target.value.toUpperCase() })} maxLength={5} className={input} />
        </Field>
        <Field label="Time zone">
          <input value={form.time_zone} onChange={(e) => setForm({ ...form, time_zone: e.target.value })} className={input} />
        </Field>
        <Field label="Default profit %">
          <input type="number" step="0.01" value={form.default_profit_percent}
            onChange={(e) => setForm({ ...form, default_profit_percent: Number(e.target.value) })} className={input} />
        </Field>
        <Field label="Tax label 1">
          <input value={form.tax_label_1} onChange={(e) => setForm({ ...form, tax_label_1: e.target.value })} placeholder="GSTIN" className={input} />
        </Field>
        <Field label="Tax number 1">
          <input value={form.tax_number_1} onChange={(e) => setForm({ ...form, tax_number_1: e.target.value })} className={input} />
        </Field>
        <Field label="Fiscal year start month">
          <select value={form.fy_start_month} onChange={(e) => setForm({ ...form, fy_start_month: Number(e.target.value) })} className={input}>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Accounting method">
          <select value={form.accounting_method} onChange={(e) => setForm({ ...form, accounting_method: e.target.value })} className={input}>
            <option value="fifo">FIFO</option>
            <option value="lifo">LIFO</option>
            <option value="avco">Average</option>
          </select>
        </Field>
      </div>
      <button type="submit" disabled={save.isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

const input = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
