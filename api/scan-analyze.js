// POST /api/scan-analyze
// The "generate an answer from a scanned document" brain for the scan→answer→
// glasses demo. Takes a captured/uploaded document image, runs Claude Vision, and
// returns a structured { verdict, claims } analysis — the same shape the offline
// worked-mock returns, so demos/scan-analyze can swap its analyze() seam to this
// endpoint (and the client still Ed25519-signs the result, so the ANSWER is real
// and the RECORD is attested).
//
// Body: { image_base64, media_type?, kind? }   media_type default "image/png"
// Returns: { verdict:{text,tone}, claims:[{text,source}], model_id }
// 503 with a clear message when no ANTHROPIC_API_KEY — the demo falls back to its
// offline mock (recommended for an airplane-mode venue).
const MODEL = "claude-haiku-4-5";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only", example: { image_base64: "<base64>", media_type: "image/png", kind: "financial statement" } });
  }

  const { image_base64, media_type = "image/png", kind = "financial document" } = req.body ?? {};
  if (!image_base64 || typeof image_base64 !== "string") {
    return res.status(400).json({ error: "missing 'image_base64' (base64 of the scanned document image)" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "vision analysis not configured (ANTHROPIC_API_KEY unset)",
      hint: "the scan-analyze demo falls back to its offline worked-mock; set ANTHROPIC_API_KEY to enable real analysis",
    });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const t0 = Date.now();
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data: image_base64 } },
          { type: "text", text:
            `You are a financial-review assistant reading a scanned ${kind}. Analyze it and return ONLY a JSON object, no prose, of the form:\n` +
            `{"verdict":{"text":"<one-sentence bottom line>","tone":"ok|warn|bad"},"claims":[{"text":"<a specific finding>","source":"<the line/figure it came from>","region":[x0,y0,x1,y1]}]}\n` +
            `Give 3-6 claims, each tied to a specific figure or line in the document. Be concrete (numbers, ratios). tone: ok=healthy, warn=attention, bad=material concern.\n` +
            `"region" is the bounding box of that source on the page, as [x0,y0,x1,y1] NORMALIZED to 0..1 (x0/y0 top-left, x1/y1 bottom-right); estimate it from where the figure sits on the page so a reviewer can be pointed to the exact spot. Omit region only if you truly cannot locate it.` },
        ],
      }],
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("model did not return JSON");
    const parsed = JSON.parse(match[0]);
    if (!parsed.verdict || !Array.isArray(parsed.claims)) throw new Error("analysis missing verdict/claims");
    return res.status(200).json({ verdict: parsed.verdict, claims: parsed.claims, model_id: MODEL, latency_ms: Date.now() - t0 });
  } catch (err) {
    return res.status(502).json({ error: `vision analysis failed: ${err?.message ?? String(err)}` });
  }
}
