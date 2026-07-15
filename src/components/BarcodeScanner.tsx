import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const detectedRef = useRef(onDetected);
  const closeRef = useRef(onClose);

  detectedRef.current = onDetected;
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastRef.current.code && now - lastRef.current.at < 1500) return;
            lastRef.current = { code: decodedText, at: now };
            detectedRef.current(decodedText);
          },
          () => {}
        );
        if (cancelled) await scanner.stop().catch(() => {});
      } catch (e: any) {
        alert("Camera error: " + (e?.message || e));
        closeRef.current();
      }
    };
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        Promise.resolve(s.stop()).catch(() => {}).finally(() => {
          try { s.clear(); } catch {}
        });
        scannerRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Scan barcode</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div id={containerId} className="w-full rounded overflow-hidden bg-black" />
        <p className="text-xs text-muted-foreground text-center">
          Point the camera at a product barcode or QR code.
        </p>
      </div>
    </div>
  );
}
