import JsBarcode from "jsbarcode";

export async function printSkuQr(opts: {
  sku: string;
  name?: string;
  price?: number | null;
  width: "58" | "80";
  copies?: number;
}) {
  const { sku, name, price, width, copies = 1 } = opts;
  if (!sku) return;

  // Generate barcode as SVG data URL
  const dataUrl = generateBarcodeDataUrl(sku, width);
  const paperW = width === "58" ? 58 : 80;
  const bcHeight = width === "58" ? 18 : 22; // mm (taller for readability)

  const label = `
    <div class="lbl">
      ${name ? `<div class="nm">${escapeHtml(name)}</div>` : ""}
      <img src="${dataUrl}" />
      ${price != null && !isNaN(Number(price)) ? `<div class="pr">৳ ${Number(price).toFixed(2)}</div>` : ""}
    </div>`;

  const printId = "sku-barcode-print-page";
  const styleId = "sku-barcode-print-style";
  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #${printId} { background:#fff; color:#000; font-family: ui-sans-serif, system-ui, Arial, sans-serif; width:${paperW}mm; margin:0 auto; }
    #${printId} * { box-sizing: border-box; }
    #${printId} .lbl { width: ${paperW - 4}mm; text-align:center; padding:1mm 0 2mm; page-break-after: always; margin: 0 auto; }
    #${printId} .lbl:last-child { page-break-after: auto; }
    #${printId} .nm { font-size: ${width === "58" ? 11 : 13}px; font-weight:700; line-height:1.15; margin-bottom:1mm;
          overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    #${printId} .lbl img { width: ${paperW - 4}mm; height: ${bcHeight}mm; display:block; margin: 0 auto;
               image-rendering: pixelated; image-rendering: crisp-edges; }
    #${printId} .pr { font-size: ${width === "58" ? 13 : 15}px; font-weight:800; margin-top: 0.8mm; }
    @page { size: ${paperW}mm auto; margin: 2mm; }
    @media print {
      html, body { background:#fff !important; color:#000 !important; margin:0 !important; padding:0 !important; }
      body > *:not(#${printId}) { display:none !important; visibility:hidden !important; }
      #${printId} { position:static !important; }
    }
  `;

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = Array.from({ length: Math.max(1, copies) }).map(() => label).join("");
  printPage.style.cssText = "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;";

  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  const { showPrintPreview } = await import("./print-preview");
  showPrintPreview({ printPage, cleanup, filename: `barcode-${sku}` });
}


function generateBarcodeDataUrl(value: string, width: "58" | "80"): string {
  // Render to a high-resolution PNG canvas — integer bar widths keep edges sharp
  // and avoid the anti-aliased fuzz that SVG at print scale produces.
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, String(value), {
      format: "CODE128",
      displayValue: true,
      fontSize: width === "58" ? 22 : 26,
      textMargin: 4,
      height: width === "58" ? 140 : 180,
      margin: 6,
      background: "#ffffff",
      lineColor: "#000000",
      width: width === "58" ? 3 : 4, // integer bar width in px → crisp
    });
  } catch {
    return "";
  }
  return canvas.toDataURL("image/png");
}


function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
