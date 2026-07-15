// Shared print preview: shows a modal preview with Print + Save-as-JPG buttons.
// Callers prepare a printable node (`printPage`) already mounted in the DOM
// with the correct @media print CSS, then call showPrintPreview instead of
// window.print() directly.

export function showPrintPreview(opts: {
  printPage: HTMLElement;
  cleanup: () => void;
  filename?: string;
}) {
  const { printPage, cleanup, filename = "document" } = opts;

  const overlay = document.createElement("div");
  overlay.id = "print-preview-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;gap:12px;font-family:ui-sans-serif,system-ui,Arial,sans-serif;";

  const frame = document.createElement("div");
  frame.style.cssText =
    "background:#fff;color:#000;max-height:75vh;max-width:95vw;overflow:auto;border-radius:8px;padding:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);";

  const clone = printPage.cloneNode(true) as HTMLElement;
  clone.id = "";
  clone.className = (clone.className ? clone.className + " " : "") + "receipt-preview-clone";
  clone.style.cssText = "position:static;margin:0 auto;display:block;visibility:visible;background:#fff;color:#000;";
  frame.appendChild(clone);

  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";

  const mkBtn = (label: string, bg: string, color: string) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = `padding:10px 20px;border-radius:8px;border:0;font-weight:600;cursor:pointer;font-size:14px;background:${bg};color:${color};`;
    return b;
  };
  const saveBtn = mkBtn("💾 Save JPG", "#10b981", "#ffffff");
  const printBtn = mkBtn("🖨️ Print", "#3b82f6", "#ffffff");
  const cancelBtn = mkBtn("Cancel", "#e5e7eb", "#000000");
  btns.append(saveBtn, printBtn, cancelBtn);

  overlay.append(frame, btns);

  // Hide overlay itself when the browser print dialog captures the page
  const hideStyle = document.createElement("style");
  hideStyle.textContent = `@media print { #print-preview-overlay { display: none !important; } }`;
  document.head.appendChild(hideStyle);
  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    hideStyle.remove();
    cleanup();
  };

  cancelBtn.onclick = close;

  printBtn.onclick = () => {
    overlay.style.display = "none";
    // Existing afterprint listener (registered by caller) handles cleanup.
    setTimeout(() => {
      window.print();
      // As a fallback in case afterprint doesn't fire, clean up overlay only.
      setTimeout(() => {
        overlay.remove();
        hideStyle.remove();
      }, 1500);
    }, 50);
  };

  saveBtn.onclick = async () => {
    saveBtn.textContent = "Saving…";
    saveBtn.setAttribute("disabled", "true");
    try {
      const { toJpeg } = await import("html-to-image");
      const url = await toJpeg(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        quality: 0.95,
        skipFonts: true,
        filter: (node) => {
          // Skip <style>/<link> tags from being inlined (they may contain oklch)
          const tag = (node as HTMLElement).tagName;
          return tag !== "STYLE" && tag !== "LINK";
        },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      alert("Failed to save image: " + ((e as Error)?.message ?? "unknown"));
    }
    close();
  };
}
