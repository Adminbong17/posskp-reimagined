// Simple A4 report print for HRM pages.
// Builds an offscreen printable node and shows the shared print preview modal.
import { showPrintPreview } from "@/lib/print-preview";

export function printHrmReport(opts: {
  title: string;
  subtitle?: string;
  business?: { name?: string | null } | null;
  columns: { label: string; align?: "left" | "right" | "center" }[];
  rows: (string | number)[][];
  footer?: (string | number)[][];
  filename?: string;
}) {
  const { title, subtitle, business, columns, rows, footer = [], filename } = opts;

  const styleId = "hrm-print-style";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
      #hrm-print-page { display:none; }
      @media print {
        @page { size: A4; margin: 12mm; }
        body * { visibility: hidden !important; }
        #hrm-print-page, #hrm-print-page * { visibility: visible !important; }
        #hrm-print-page { display:block !important; position:absolute; left:0; top:0; width:100%; background:#fff; color:#000; }
      }
      .receipt-preview-clone.hrm-report { display:block !important; width: 210mm; font-family: ui-sans-serif, system-ui, Arial, sans-serif; color:#000; }
      .receipt-preview-clone.hrm-report table { width:100%; border-collapse: collapse; font-size: 12px; }
      .receipt-preview-clone.hrm-report th, .receipt-preview-clone.hrm-report td { border:1px solid #000; padding: 4px 6px; }
      .receipt-preview-clone.hrm-report th { background:#eee; text-align:left; }
    `;
    document.head.appendChild(st);
  }

  const page = document.createElement("div");
  page.id = "hrm-print-page";
  page.className = "hrm-report";
  page.style.cssText = "font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#000;background:#fff;padding:8px;";

  const align = (a?: string) => a === "right" ? "right" : a === "center" ? "center" : "left";
  const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

  page.innerHTML = `
    <div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:18px;font-weight:800;">${esc(business?.name ?? "")}</div>
      <div style="font-size:14px;font-weight:700;">${esc(title)}</div>
      ${subtitle ? `<div style="font-size:11px;">${esc(subtitle)}</div>` : ""}
      <div style="font-size:10px;">Printed: ${new Date().toLocaleString("en-GB")}</div>
    </div>
    <table>
      <thead><tr>${columns.map((c) => `<th style="text-align:${align(c.align)}">${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align:${align(columns[i]?.align)}">${esc(cell)}</td>`).join("")}</tr>`).join("")}
        ${footer.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align:${align(columns[i]?.align)};font-weight:700;background:#f4f4f4;">${esc(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;

  document.body.appendChild(page);

  const cleanup = () => { page.remove(); };
  window.addEventListener("afterprint", cleanup, { once: true });

  showPrintPreview({ printPage: page, cleanup, filename: filename ?? title.toLowerCase().replace(/\s+/g, "-") });
}
