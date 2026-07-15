export type ReceiptLine = {
  name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
};

export type ReceiptSale = {
  invoice_no: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  customer_name: string | null;
  date: string;
  served_by?: string | null;
  counter_id?: string | null;
  vat?: number;
};

export type ReceiptHeader = {
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  vatReg?: string;
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
  return value.replace(/[&<>'"]/g, (c) => entities[c] ?? c);
}

function splitDateTime(input: string): { date: string; time: string } {
  if (!input) return { date: "", time: "" };
  // Try common formats: "dd/mm/yyyy hh:mm AM", "7/13/2026, 9:21:37 PM"
  const commaIdx = input.indexOf(",");
  if (commaIdx > -1) return { date: input.slice(0, commaIdx).trim(), time: input.slice(commaIdx + 1).trim() };
  const parts = input.trim().split(/\s+/);
  if (parts.length >= 2) {
    // If last token looks like AM/PM, take last two as time
    const tail = parts[parts.length - 1].toUpperCase();
    if (tail === "AM" || tail === "PM") {
      const time = parts.slice(-2).join(" ");
      const date = parts.slice(0, -2).join(" ");
      return { date, time };
    }
    return { date: parts[0], time: parts.slice(1).join(" ") };
  }
  return { date: input, time: "" };
}

export function receiptHtml(sale: ReceiptSale, header: ReceiptHeader) {
  const { date, time } = splitDateTime(sale.date);
  const vat = sale.vat ?? 0;
  const paidCard = sale.payment_method?.toLowerCase() === "card" ? sale.paid : 0;
  const paidCash = sale.payment_method?.toLowerCase() === "card" ? 0 : sale.paid;

  const rows = sale.lines.map((l, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="l">${escapeHtml(l.name)}</td>
      <td class="r">${l.unit_price.toFixed(2)}</td>
      <td class="c">${l.quantity}</td>
      <td class="r">${l.total_amount.toFixed(2)}</td>
    </tr>
  `).join("");

  return `
    <div class="brand">${escapeHtml(header.businessName)}</div>
    ${header.businessAddress ? `<div class="addr">${escapeHtml(header.businessAddress)}</div>` : ""}
    ${header.businessMobile ? `<div class="addr">Phone: ${escapeHtml(header.businessMobile)}</div>` : ""}
    ${header.vatReg ? `<div class="addr">VAT Reg # ${escapeHtml(header.vatReg)}</div>` : ""}
    <div class="title">Sales Receipt</div>
    <div class="invoice">Invoice : ${escapeHtml(sale.invoice_no)}</div>

    <div class="meta">
      <div class="two"><span>Date: ${escapeHtml(date)}</span><span>Time: ${escapeHtml(time)}</span></div>
      ${sale.counter_id || sale.served_by ? `<div class="two"><span>Counter ID: ${escapeHtml(sale.counter_id ?? "")}</span><span>Served By: ${escapeHtml(sale.served_by ?? "")}</span></div>` : ""}
      <div>Customer Name: ${escapeHtml(sale.customer_name ?? "")}</div>
    </div>

    <table class="items">
      <thead>
        <tr><th class="c">SL</th><th class="l">Item / Code</th><th class="r">Price</th><th class="c">Qty</th><th class="r">Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Total :</span><span>${sale.subtotal.toFixed(2)}</span></div>
      <div class="row"><span>VAT :</span><span>${vat.toFixed(2)}</span></div>
      ${sale.discount > 0 ? `<div class="row"><span>Less Amount :</span><span>${sale.discount.toFixed(2)}</span></div>` : ""}
      <div class="row net"><span class="netlabel">Net Amount (TK)</span><span class="netbox">${sale.total.toFixed(2)}</span></div>
      <div class="row"><span>Pay Type :</span><span>${escapeHtml(sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1))}</span></div>
      <div class="row"><span>Paid By Card :</span><span>${paidCard.toFixed(2)}</span></div>
      <div class="row"><span>Paid By Cash :</span><span>${paidCash.toFixed(2)}</span></div>
      ${sale.change > 0 ? `<div class="row"><span>Change :</span><span>${sale.change.toFixed(2)}</span></div>` : ""}
      ${sale.change < 0 ? `<div class="row"><span>Due :</span><span>${Math.abs(sale.change).toFixed(2)}</span></div>` : ""}
    </div>

    <div class="thanks">Thank you!</div>
  `;
}

export function receiptCss(scope: string, fontSize: string, widthCss: string) {
  return baseReceiptCss(scope, fontSize, widthCss);
}

function baseReceiptCss(scope: string, fontSize: string, widthCss: string) {
  return `
    ${scope}, ${scope} * { color:#000 !important; background:#fff !important; box-shadow:none !important; text-shadow:none !important; filter:none !important; border-color:#000 !important; box-sizing:border-box !important; overflow-wrap:anywhere !important; word-break:break-word !important; font-family: Georgia, 'Times New Roman', serif !important; }
    ${scope} { font-size:${fontSize} !important; line-height:1.3 !important; width:${widthCss} !important; max-width:${widthCss} !important; }
    ${scope} .brand { text-align:center !important; font-weight:900 !important; font-size:1.7em !important; letter-spacing:0.3px !important; margin-bottom:2px !important; }
    ${scope} .addr { text-align:center !important; font-size:0.95em !important; }
    ${scope} .title { text-align:center !important; font-weight:900 !important; font-size:1.35em !important; margin-top:4px !important; }
    ${scope} .invoice { text-align:center !important; font-weight:700 !important; font-size:1.05em !important; margin-bottom:4px !important; }
    ${scope} .meta { margin:4px 0 !important; }
    ${scope} .meta .two { display:flex !important; justify-content:space-between !important; gap:8px !important; }
    ${scope} table.items { width:100% !important; border-collapse:collapse !important; margin:4px 0 !important; }
    ${scope} table.items thead th { border-top:1px solid #000 !important; border-bottom:1px solid #000 !important; padding:3px 2px !important; font-weight:700 !important; }
    ${scope} table.items tbody td { padding:2px !important; vertical-align:top !important; }
    ${scope} table.items tbody tr:last-child td { border-bottom:1px dashed #000 !important; }
    ${scope} table.items .l { text-align:left !important; }
    ${scope} table.items .c { text-align:center !important; }
    ${scope} table.items .r { text-align:right !important; }
    ${scope} .totals { margin-top:2px !important; }
    ${scope} .totals .row { display:flex !important; justify-content:space-between !important; padding:1px 0 !important; }
    ${scope} .totals .row.net { font-weight:900 !important; font-size:1.1em !important; margin:3px 0 !important; }
    ${scope} .totals .netbox { border:1.5px solid #000 !important; padding:2px 8px !important; min-width:70px !important; text-align:right !important; }
    ${scope} .thanks { text-align:center !important; margin-top:6px !important; font-style:italic !important; }
  `;
}

export function printReceiptInWhitePage(sale: ReceiptSale, width: "58" | "80" | "A4", header: ReceiptHeader) {
  const isA4 = width === "A4";
  const mm = width === "58" ? "58mm" : width === "80" ? "80mm" : "190mm";
  const pageSize = isA4 ? "A4" : `${mm} auto`;
  const pageMargin = isA4 ? "10mm" : "3mm 2mm";
  const fontSize = width === "58" ? "12px" : width === "80" ? "14px" : "13px";
  const printId = "pos-white-receipt-print-page";
  const styleId = "pos-white-receipt-print-style";
  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  const receiptRules = baseReceiptCss(`#${printId}`, fontSize, mm) + baseReceiptCss(`.receipt-preview-clone`, fontSize, mm);
  style.textContent = `
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    ${receiptRules}
    @media print {
      :root, html, body, #root { color-scheme: only light !important; background:#fff !important; color:#000 !important; forced-color-adjust: none !important; }
      html, body { margin:0 !important; padding:0 !important; }
      body > *:not(#${printId}) { display:none !important; visibility:hidden !important; }
      #${printId} { display:block !important; visibility:visible !important; position:static !important; width:100% !important; margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    }
  `;

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = receiptHtml(sale, header);
  printPage.style.cssText = `position:fixed;left:-10000px;top:0;z-index:-1;width:${mm};max-width:${mm};background:#fff;color:#000;`;

  const prevBg = document.body.style.background;
  const prevColor = document.body.style.color;
  document.body.style.background = "#fff";
  document.body.style.color = "#000";
  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    document.body.style.background = prevBg;
    document.body.style.color = prevColor;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  import("./print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `receipt-${sale.invoice_no}` });
  });
}
