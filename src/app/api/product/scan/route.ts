import { after } from "next/server";
import { readClaim } from "@/lib/tracking/concerns";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";
import { track, visitContext } from "@/lib/visits/server";

const MAX_BYTES = 8 * 1024 * 1024;
const PER_VISITOR_PER_DAY = 12;
const used = new Map<string, { day: string; n: number }>();
const ALLOWED: ReadonlySet<string> = new Set(SD_ACTIONS);

const PROMPT = `You read a photo of a skincare product (box, bottle, jar or tube).
Return only what is printed or clearly visible. Never invent a claim.
- name: the product name as printed (without the brand).
- brand: the brand, or "" if not visible.
- kind: one of serum, cream, toner, cleanser, oil, mask, sunscreen, other.
- claim: the efficacy promise as printed, in English (translate if needed), one sentence, e.g. "Visibly reduces redness in 14 days". "" if none is visible.
- promised_days: number of days the claim states (weeks x 7), or 0.
- concerns: which of these the claim targets (max 4): ${SD_ACTIONS.join(", ")}.
- actives: the active ingredients printed on the pack (e.g. "TXA", "niacinamide", "beta arbutin", "hyaluronic acid", "retinol"), [] if none.
- ingredient_concerns: which of the same concerns these actives are well known to target (max 4), [] if none. This is dermatology knowledge about the ingredients, not a claim.
- barcode: the EAN/UPC digits if printed and readable, else "".
- confidence: 0 to 1, how sure you are this is a skincare product you read correctly.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    brand: { type: "STRING" },
    kind: { type: "STRING" },
    claim: { type: "STRING" },
    promised_days: { type: "NUMBER" },
    concerns: { type: "ARRAY", items: { type: "STRING" } },
    actives: { type: "ARRAY", items: { type: "STRING" } },
    ingredient_concerns: { type: "ARRAY", items: { type: "STRING" } },
    barcode: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: ["name", "brand", "kind", "claim", "promised_days", "concerns", "actives", "ingredient_concerns", "barcode", "confidence"],
};

/** Open Beauty Facts: a free public database of cosmetics, looked up by barcode. */
async function beautyFacts(code: string): Promise<{ name?: string; brand?: string; image?: string } | null> {
  if (!/^\d{8,14}$/.test(code)) return null;
  try {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${code}.json?fields=product_name,brands,image_front_small_url`, {
      headers: { "User-Agent": "Verdict/1.0 (hackathon demo)" },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: number; product?: { product_name?: string; brands?: string; image_front_small_url?: string } };
    if (j.status !== 1 || !j.product) return null;
    return { name: j.product.product_name || undefined, brand: j.product.brands?.split(",")[0]?.trim() || undefined, image: j.product.image_front_small_url || undefined };
  } catch {
    return null;
  }
}

/**
 * POST multipart { photo } -> the product read from its packaging:
 * name, brand, the printed promise, the concerns to measure, the promised delay.
 * Gemini reads the label; Open Beauty Facts confirms it when the barcode is readable.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const headers = new Headers(request.headers);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return Response.json({ error: "scan_off", notice: "Product scanning is not set up here. Type the product instead." }, { status: 409 });

  const visitor = visitContext(headers).v || "anon";
  const day = new Date().toISOString().slice(0, 10);
  const u = used.get(visitor);
  const n = u && u.day === day ? u.n : 0;
  if (n >= PER_VISITOR_PER_DAY) return Response.json({ error: "quota", notice: "Scan limit reached for today. Type the product instead." }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_BYTES || !/^image\/(jpeg|png|webp)$/.test(photo.type)) {
    return Response.json({ error: "photo: a JPEG, PNG or WebP under 8 MB is required" }, { status: 400 });
  }
  used.set(visitor, { day, n: n + 1 });

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const b64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  let read: { name: string; brand: string; kind: string; claim: string; promised_days: number; concerns: string[]; actives?: string[]; ingredient_concerns?: string[]; barcode: string; confidence: number };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: photo.type, data: b64 } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!res.ok) throw new Error(j.error?.message ?? `Gemini HTTP ${res.status}`);
    read = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  } catch (e) {
    after(() => track(headers, "product_scan", { outcome: "error", ms: Date.now() - t0 }));
    return Response.json({ error: "scan_failed", notice: "Could not read this photo. Try again closer to the label, or type it.", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const facts = await beautyFacts(read.barcode ?? "");
  const fromClaim = readClaim(read.claim ?? "");
  const fromLabel = [...new Set((read.concerns ?? []).filter((c) => ALLOWED.has(c)) as SdAction[])];
  const fromActives = [...new Set((read.ingredient_concerns ?? []).filter((c) => ALLOWED.has(c)) as SdAction[])];
  // The printed promise comes first; the actives complete it (or stand in when nothing is promised).
  const concerns = [...new Set([...fromLabel, ...(fromLabel.length ? fromClaim.concerns : []), ...fromActives])].slice(0, 4);
  const basis = fromLabel.length && fromActives.some((c) => !fromLabel.includes(c)) ? "both" : fromLabel.length ? "claim" : fromActives.length ? "actives" : "none";
  const result = {
    name: (facts?.name || read.name || "").trim(),
    brand: (facts?.brand || read.brand || "").trim(),
    kind: read.kind || "other",
    claim: (read.claim || "").trim(),
    promisedDays: read.promised_days > 0 ? Math.round(read.promised_days) : fromClaim.promisedDays,
    concerns: concerns.length ? concerns : fromClaim.concerns,
    actives: (read.actives ?? []).slice(0, 5),
    basis,
    barcode: read.barcode || "",
    image: facts?.image,
    verifiedBy: facts ? "Open Beauty Facts" : null,
    confidence: Math.max(0, Math.min(1, Number(read.confidence) || 0)),
    model,
    ms: Date.now() - t0,
  };
  after(() => track(headers, "product_scan", { outcome: "ok", concerns: result.concerns.length, verified: !!facts, ms: result.ms }));
  return Response.json(result);
}
