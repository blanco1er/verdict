import { after } from "next/server";
import { YouCamApiError, YouCamTaskError } from "@/lib/youcam/client";
import { skinAnalysisCost } from "@/lib/youcam/costs";
import { REFUSAL_TEXT, type GateRefusal } from "@/lib/youcam/guard";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { createTracedClient, liveGate, youCamMode } from "@/lib/youcam/server";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";
import { track, visitContext } from "@/lib/visits/server";

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
 * Demo mode (default): the browser sends only the photo's size and name; the
 * photo itself never leaves the device, and no unit is spent.
 * Live mode: multipart upload, only when the live gate agrees (YOUCAM_PUBLIC_LIVE=1,
 * per-visitor and daily quota, real unit balance above the floor). When the gate
 * says no, the same pipeline runs in demo mode and the answer says why.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const headers = new Headers(request.headers);
  let concerns: SdAction[] | null;
  let bytes: Uint8Array;
  let fileName = "verdict-capture.jpg";
  let contentType: "image/jpeg" | "image/png" = "image/jpeg";
  let refused: GateRefusal | null = null;
  let live = false;

  const isMultipart = (request.headers.get("content-type") ?? "").startsWith("multipart/form-data");
  if (isMultipart) {
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
    if (concerns == null) return Response.json({ error: "concerns: 1 to 4 SD Skin Analysis actions" }, { status: 400 });
    if (youCamMode() !== "live") {
      refused = "public_live_off";
    } else {
      const ok = await liveGate().take(visitContext(headers).v, skinAnalysisCost(concerns));
      if (ok.ok) live = true;
      else refused = ok.reason;
    }
    if (live) {
      contentType = photo.type;
      bytes = new Uint8Array(await photo.arrayBuffer());
    } else {
      // Refused: the photo is dropped unread; only its size feeds the demo pipeline.
      bytes = new Uint8Array(Math.min(photo.size, MAX_BYTES));
    }
  } else {
    let body: { fileName?: unknown; fileSize?: unknown; concerns?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    concerns = parseConcerns(body.concerns);
    const size = Number(body.fileSize);
    // The demo only needs the size; the photo stays on the device.
    bytes = new Uint8Array(Number.isFinite(size) && size > 0 ? Math.min(size, MAX_BYTES) : 120_000);
    if (typeof body.fileName === "string" && /^[\w.-]{1,80}$/u.test(body.fileName)) fileName = body.fileName;
    if (concerns == null) return Response.json({ error: "concerns: 1 to 4 SD Skin Analysis actions" }, { status: 400 });
  }

  const { client, mode, trace } = createTracedClient(live ? undefined : "mock");
  const units = skinAnalysisCost(concerns);
  const notice = refused ? REFUSAL_TEXT[refused] : undefined;
  const log = (outcome: string, extra: Record<string, unknown> = {}) =>
    after(() =>
      track(headers, "analysis", { mode, refused: refused ?? undefined, concerns: concerns!.length, units: mode === "live" ? units : 0, outcome, ms: Date.now() - t0, ...extra }),
    );
  try {
    const fileId = await client.uploadImage({ bytes, contentType, fileName });
    const output = await client.analyzeSkin({ src_file_id: fileId }, concerns);
    if (mode === "live") liveGate().spent(units);
    log("ok");
    return Response.json({ mode, units: mode === "live" ? units : 0, concerns, output, trace: trace.steps, notice });
  } catch (error) {
    const steps = trace.steps;
    if (error instanceof UnitBudgetExceeded) {
      log("budget");
      return Response.json({ error: error.message, trace: steps }, { status: 402 });
    }
    if (error instanceof YouCamTaskError) {
      log("task_error", { code: error.code });
      return Response.json({ error: error.code, detail: "The task failed, so no units were charged.", trace: steps }, { status: 422 });
    }
    if (error instanceof YouCamApiError) {
      log("api_error", { status: error.status });
      return Response.json({ error: error.message, trace: steps }, { status: 502 });
    }
    log("crash");
    throw error;
  }
}
