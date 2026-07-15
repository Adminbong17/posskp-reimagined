import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Camera } from "lucide-react";

export const Route = createFileRoute("/scan/$sessionId")({
  head: () => ({ meta: [{ title: "Phone Scanner — QweekPOS" }] }),
  component: PhoneScannerPage,
});

function PhoneScannerPage() {
  const { sessionId } = useParams({ from: "/scan/$sessionId" });
  const containerId = "phone-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [lastCode, setLastCode] = useState<string>("");
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Connecting…");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const lastSentRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    const ch = supabase.channel(`phone-scan-${sessionId}`, {
      config: { broadcast: { self: false } },
    });
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus("Connected — tap Start to scan");
        ch.send({ type: "broadcast", event: "hello", payload: { at: Date.now() } });
      } else if (s === "CHANNEL_ERROR") {
        setStatus("Connection error — check internet");
      }
    });
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [sessionId]);

  // Start camera MUST run inside a user gesture (button click) — browsers block
  // getUserMedia when called after async work outside a gesture context.
  const startCamera = async () => {
    if (scanning) return;
    setError("");
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => {
          const now = Date.now();
          if (decoded === lastSentRef.current.code && now - lastSentRef.current.at < 1500) return;
          lastSentRef.current = { code: decoded, at: now };
          setLastCode(decoded);
          setCount((c) => c + 1);
          channelRef.current?.send({
            type: "broadcast",
            event: "barcode",
            payload: { code: decoded },
          });
        },
        () => {}
      );
      setScanning(true);
      setStatus("Scanning — point at a barcode");
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError") setError("Camera permission denied. Allow camera in browser settings.");
      else if (name === "NotFoundError") setError("No camera found on this device.");
      else if (name === "NotReadableError") setError("Camera is in use by another app.");
      else setError("Camera error: " + (e?.message || e));
    }
  };

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        Promise.resolve(s.stop()).catch(() => {}).finally(() => {
          try { s.clear(); } catch {}
        });
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen p-4 space-y-3 max-w-md mx-auto">
      <h1 className="text-lg font-semibold">Phone Scanner</h1>
      <div className="text-xs text-muted-foreground">{status}</div>
      <div id={containerId} className="w-full aspect-[4/3] rounded overflow-hidden bg-black" />
      {!scanning && (
        <button
          onClick={startCamera}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-3 font-medium"
        >
          <Camera className="h-4 w-4" /> Start camera
        </button>
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="rounded border p-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Sent: <strong>{count}</strong>
        </div>
        {lastCode && (
          <div className="mt-1 text-xs font-mono break-all">Last: {lastCode}</div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Keep this page open. Each scan is sent instantly to your PC.
      </p>
    </div>
  );
}
