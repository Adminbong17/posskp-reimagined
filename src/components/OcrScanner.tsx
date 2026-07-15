import { useEffect, useRef, useState } from "react";
import { X, Camera, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Tesseract from "tesseract.js";
import { useServerFn } from "@tanstack/react-start";
import { ocrImageWithAI } from "@/lib/ocr.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  onText: (text: string) => void;
};

export function OcrScanner({ open, onClose, onText }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const aiOcr = useServerFn(ocrImageWithAI);

  useEffect(() => {
    if (!open) return;
    setErr(null); setPreview(null); setStatus("");
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setErr(e?.message || "Camera unavailable");
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const runOcr = async (dataUrl: string) => {
    setBusy(true);
    try {
      // 1) Try Tesseract (fast/free)
      setStatus("Reading text locally…");
      const { data } = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") setStatus(`Local OCR ${Math.round(m.progress * 100)}%`);
        },
      });
      const local = (data.text || "").replace(/\s+/g, " ").trim();

      // 2) If weak, fall back to AI vision
      if (local.length < 6 || (data.confidence ?? 0) < 55) {
        setStatus("Using AI vision…");
        const ai = await aiOcr({ data: { imageDataUrl: dataUrl } });
        const aiText = (ai.text || "").trim();
        if (!aiText) { setErr("Could not read packet. Try again closer & steadier."); setBusy(false); return; }
        onText(aiText); onClose(); return;
      }

      onText(local); onClose();
    } catch (e: any) {
      // Local failed → try AI
      try {
        setStatus("Using AI vision…");
        const ai = await aiOcr({ data: { imageDataUrl: dataUrl } });
        const aiText = (ai.text || "").trim();
        if (!aiText) throw new Error("empty");
        onText(aiText); onClose(); return;
      } catch (e2: any) {
        setErr(e2?.message || e?.message || "OCR failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
    await runOcr(dataUrl);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4">
      <div className="bg-background rounded-xl w-full max-w-md overflow-hidden border border-border">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="font-medium text-sm flex items-center gap-1"><Sparkles className="h-4 w-4" /> Scan product packet</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative bg-black aspect-[4/3]">
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          )}
          <canvas ref={canvasRef} className="hidden" />
          {busy && (
            <div className="absolute inset-0 bg-black/60 grid place-items-center text-white text-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                {status || "Working…"}
              </div>
            </div>
          )}
        </div>
        {err && <div className="p-2 text-xs text-red-500 text-center">{err}</div>}
        <div className="p-3 flex gap-2">
          {preview ? (
            <button onClick={() => { setPreview(null); setErr(null); }} disabled={busy}
              className="flex-1 h-10 rounded-lg border border-border flex items-center justify-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4" /> Retake
            </button>
          ) : (
            <button onClick={capture} disabled={busy || !!err}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm disabled:opacity-50">
              <Camera className="h-4 w-4" /> Capture & Read
            </button>
          )}
        </div>
        <div className="px-3 pb-3 text-[11px] text-muted-foreground text-center">
          Aim at the product name. Weak local read auto-switches to AI vision.
        </div>
      </div>
    </div>
  );
}
