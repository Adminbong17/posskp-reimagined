import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Set up your business — QweekPOS" }] }),
  component: Setup,
});

function Setup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [skuPrefix, setSkuPrefix] = useState("");
  const [locationName, setLocationName] = useState("Main Location");
  const [loading, setLoading] = useState(false);

  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data } = await supabase.from("currencies").select("id, code, currency, symbol").order("code");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!currencyId && currencies.length) {
      const usd = currencies.find((c) => c.code === "USD") ?? currencies[0];
      setCurrencyId(usd.id);
    }
  }, [currencies, currencyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currencyId) return;
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("business_requests").insert({
        user_id: u.user.id,
        name,
        currency_id: currencyId,
        sku_prefix: skuPrefix || null,
        location_name: locationName,
      });
      if (error) throw error;
      toast.success("Request submitted! Waiting for admin approval.");
      await qc.invalidateQueries({ queryKey: ["my-business-request"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create business");
    } finally {
      setLoading(false);
    }
  }

  const { data: myReq } = useQuery({
    queryKey: ["my-business-request"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("business_requests")
        .select("id, name, status, admin_notes, created_at, business_id")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (myReq?.status === "approved") {
      qc.invalidateQueries({ queryKey: ["current-business"] });
      navigate({ to: "/dashboard" });
    }
  }, [myReq?.status, qc, navigate]);

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="font-display text-2xl font-semibold">Set up your business</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your business details. An admin will review and approve your request.
      </p>
      {myReq && myReq.status === "pending" && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="font-medium">Request pending approval</div>
          <div className="text-muted-foreground mt-1">
            Your request for <b>{myReq.name}</b> is waiting for admin review.
          </div>
        </div>
      )}
      {myReq && myReq.status === "rejected" && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-medium">Request rejected</div>
          {myReq.admin_notes && <div className="text-muted-foreground mt-1">Reason: {myReq.admin_notes}</div>}
          <div className="text-muted-foreground mt-1">You can submit a new request below.</div>
        </div>
      )}
      {(!myReq || myReq.status === "rejected") && (
      <form className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-card p-6" onSubmit={submit}>
        <Field label="Business name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm" />
        </Field>
        <Field label="Currency">
          <select value={currencyId ?? ""} onChange={(e) => setCurrencyId(Number(e.target.value))}
            className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm">
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.currency} ({c.symbol})</option>
            ))}
          </select>
        </Field>
        <Field label="SKU prefix (optional)">
          <input value={skuPrefix} onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
            placeholder="e.g. AS" maxLength={5}
            className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm" />
        </Field>
        <Field label="First location name">
          <input required value={locationName} onChange={(e) => setLocationName(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm" />
        </Field>
        <button disabled={loading} type="submit"
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {loading ? "Creating…" : "Create business"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
