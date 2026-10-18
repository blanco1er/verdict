import { YouCamApiError, YouCamTaskError } from "@/lib/youcam/client";
import { skinAnalysisCost } from "@/lib/youcam/costs";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { createTracedClient, publicLiveEnabled } from "@/lib/youcam/server";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";

const ALLOWED: ReadonlySet<string> = new Set(SD_ACTIONS);
const MAX_BYTES = 10 * 1024 * 1024 - 1;

function parseConcerns(value: unknown): SdAction[] | null {
  const list = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const clean = list.map((a) => String(a).trim()).filter(Boolean);
  if (clean.length < 1 || clean.length > 4 || !clean.every((a) => ALLOWED.has(a))) return null;
  return clean as SdAction[];
}

/**
 * Full Skin Analysis pipeline for one photo, with every API step traced:
 * POST /file -> PUT bytes -> POST /task/skin-analysis -> GET until success.
 *
 * Mock mode (default): the browser sends only the photo's size and name; the
 * photo itself never leaves the device. Live mode: multipart upload, and only
 * when YOUCAM_PUBLIC_LIVE=1 (protects the 1,000 hackathon units).
 */
export async function POST(request: Request) {
  const { client, mode, trace } = createTracedClient();
  let concerns: SdAction[] | null;
  let bytes: Uint8Array;
  let fileName = "verdict-capture.jpg";
  let contentType: "image/jpeg" | "image/png" = "image/jpeg";

  if (mode === "live") {
    if (!publicLiveEnabled()) {
      return Response.json({ error: "Live analysis is disabled on this public deployment." }, { status: 403 });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "Expected multipart/form-data with a photo" }, { status: 400 });
    }
    const photo = form.get("photo");
    concerns = parseConcerns(form.get("concerns"));
    if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_BYTES) {
      return Response.json({ error: "photo: a JPEG or PNG under 10 MB is required" }, { status: 400 });
    }
    if (photo.type !== "image/jpeg" && photo.type !== "image/png") {
      return Response.json({ error: "photo must be JPEG or PNG" }, { status: 400 });
    }
    contentType = photo.type;
    bytes = new Uint8Array(await photo.arrayBuffer());
  } else {
    let body: { fileName?: unknown; fileSize?: unknown; concerns?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    concerns = parseConcerns(body.concerns);
    const size = Number(body.fileSize);
    // The mock only needs the size; the photo stays on the device.
    bytes = new Uint8Array(Number.isFinite(size) && size > 0 ? Math.min(size, MAX_BYTES) : 120_000);
    if (typeof body.fileName === "string" && /^[\w.-]{1,80}$/u.test(body.fileName)) fileName = body.fileName;
  }
  if (concerns == null) {
    return Response.json({ error: "concerns: 1 to 4 SD Skin Analysis actions" }, { status: 400 });
  }

  const units = skinAnalysisCost(concerns);
  try {
    const fileId = await client.uploadImage({ bytes, contentType, fileName });
    const output = await client.analyzeSkin({ src_file_id: fileId }, concerns);
    return Response.json({ mode, units, concerns, output, trace: trace.steps });
  } catch (error) {
    const steps = trace.steps;
    if (error instanceof UnitBudgetExceeded) return Response.json({ error: error.message, trace: steps }, { status: 402 });
    if (error instanceof YouCamTaskError) {
      return Response.json({ error: error.code, detail: "The task failed, so no units were charged.", trace: steps }, { status: 422 });
    }
    if (error instanceof YouCamApiError) return Response.json({ error: error.message, trace: steps }, { status: 502 });
    throw error;
  }
}
