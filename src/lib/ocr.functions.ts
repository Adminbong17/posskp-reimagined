import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ocrImageWithAI = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ imageDataUrl: z.string().min(20) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the main PRODUCT NAME/BRAND printed on this packet. Reply with only the product name in plain text, no extra words." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI OCR failed: ${res.status} ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text: text.trim() };
  });
