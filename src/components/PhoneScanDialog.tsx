import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { X, Smartphone } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function PhoneScanDialog({ open, onClose, onDetected }: Props) {
  const [status, setStatus] = useState("Waiting for phone…");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  // Stable for the lifetime of the parent screen — closing/reopening the
  // dialog keeps the same session so the phone tab stays connected.
  const sessionId = useMemo(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    []
  );

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/scan/${sessionId}`;
  }, [sessionId]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 260, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [url]);

  // Subscribe for the entire parent-screen lifetime, not just while the
  // dialog is open — otherwise closing the dialog kills the channel and
  // the phone keeps scanning into the void.
  useEffect(() => {
    const channel = supabase.channel(`phone-scan-${sessionId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "barcode" }, (payload) => {
        const code = (payload?.payload as any)?.code;
        if (typeof code === "string" && code.trim()) {
          detectedRef.current(code.trim());
          setStatus(`Received: ${code}`);
        }
      })
      .on("broadcast", { event: "hello" }, () => setStatus("Phone connected ✔ — scan away"))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Smartphone className="h-4 w-4" /> Scan with phone</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Open this QR on your phone (must be logged in). Every scan on the phone instantly adds the product here.
        </p>
        <div className="flex justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Scan URL" className="rounded border" />
          ) : (
            <div className="h-[260px] w-[260px] bg-muted animate-pulse rounded" />
          )}
        </div>
        <div className="text-[11px] font-mono break-all text-center text-muted-foreground">{url}</div>
        <div className="text-xs text-center">{status}</div>
        <p className="text-[11px] text-muted-foreground text-center">
          The dialog stays open — keep scanning items on the phone. Close when done.
        </p>
      </div>
    </div>
  );
}
