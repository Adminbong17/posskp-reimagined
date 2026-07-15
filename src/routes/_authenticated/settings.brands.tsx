import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { MasterDataTable } from "@/components/master-data-table";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/brands")({
  component: BrandsPage,
});

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

function BrandsPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      if (!business) throw new Error("No business");
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("CSV is empty");
      const payload = rows
        .filter((r) => r.name)
        .map((r) => ({
          business_id: business.id,
          name: r.name,
          description: r.description || null,
        }));
      if (!payload.length) throw new Error("No valid rows (require 'name' column)");
      const { error } = await supabase.from("brands").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => { toast.success(`Imported ${n} brand(s)`); qc.invalidateQueries({ queryKey: ["brands"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function downloadTemplate() {
    const csv = "name,description\nSample Brand,Optional description\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "brands-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium">
          <Download className="h-3.5 w-3.5" /> CSV template
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importCsv.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium">
          <Upload className="h-3.5 w-3.5" /> {importCsv.isPending ? "Importing…" : "Import CSV"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsv.mutate(f);
            e.target.value = "";
          }}
        />
      </div>
      <MasterDataTable
        table="brands"
        title="Brands"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "description", label: "Description" },
          { key: "use_for_repair", label: "Use for repair", type: "checkbox" },
        ]}
        listColumns={[
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
        ]}
      />
    </div>
  );
}
