import { after } from "next/server";
import { TRY_ON, YouCamApiError, YouCamTaskError, type TryKind } from "@/lib/youcam/client";
import { REFUSAL_TEXT } from "@/lib/youcam/guard";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { createTracedClient, tryGate, youCamMode } from "@/lib/youcam/server";
import { findTemplate } from "@/lib/youcam/try-catalogue";
import { track, visitContext } from "@/lib/visits/server";

const MAX_BYTES = 10 * 1024 * 1024 - 1;
const KINDS: ReadonlySet<string> = new Set(["look", "hair", "outfit"]);

/**
 * POST multipart { kind, template, photo } -> { url, units, trace } | { demo, notice }
 * Try a YouCam catalogue template (makeup look, hairstyle, outfit) on the user's photo.
 * Live only behind the same visitor gate as the skin analysis; otherwise nothing is sent.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const headers = new Headers(request.headers);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const kind = String(form.get("kind") ?? "");
  const template = String(form.get("template") ?? "");
  const photo = form.get("photo");
  if (!KINDS.has(kind)) return Response.json({ error: "kind: look, hair or outfit" }, { status: 400 });
  const ref = form.get("ref");
  const own = ref instanceof File && ref.size > 0;
  if (own && (kind === "look" || ref.size > MAX_BYTES || (ref.type !== "image/jpeg" && ref.type !== "image/png"))) {
    return Response.json({ error: "ref: a JPEG or PNG garment or haircut photo under 10 MB (outfits and hair only)" }, { status: 400 });
  }
  const tpl = own ? null : findTemplate(kind as TryKind, template);
  if (!own && !tpl) return Response.json({ error: "Unknown template" }, { status: 400 });
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_BYTES || (photo.type !== "image/jpeg" && photo.type !== "image/png")) {
    return Response.json({ error: "photo: a JPEG or PNG under 10 MB is required" }, { status: 400 });
  }
  const units = TRY_ON[kind as TryKind].units;
  const log = (outcome: string, u = 0) => after(() => track(headers, "try_on", { mode: youCamMode(), kind, units: u, outcome, ms: Date.now() - t0 }));

  if (youCamMode() !== "live") {
    log("demo");
    return Response.json({ demo: true, notice: "Demo mode: try-ons run with the live YouCam API only. Your photo was not sent." });
  }
  const gate = await tryGate().take(visitContext(headers).v, units);
  if (!gate.ok) {
    log("refused");
    return Response.json({ demo: true, notice: REFUSAL_TEXT[gate.reason].replace(", so this photo ran in demo mode.", ".") });
  }

  const { client, trace } = createTracedClient();
  try {
    const fileId = await client.uploadImage({ bytes: new Uint8Array(await photo.arrayBuffer()), contentType: photo.type as "image/jpeg" | "image/png", fileName: `verdict-try.${photo.type === "image/png" ? "png" : "jpg"}` });
    let taskId: string;
    if (own) {
      const refId = await client.uploadImage({ bytes: new Uint8Array(await (ref as File).arrayBuffer()), contentType: (ref as File).type as "image/jpeg" | "image/png", fileName: "verdict-ref.jpg" });
      taskId = await client.runTryOnWithRef(kind as "outfit" | "hair", { src_file_id: fileId }, refId);
    } else {
      taskId = await client.runTryOn(kind as TryKind, { src_file_id: fileId }, tpl!);
    }
    const url = await client.waitForTryOn(kind as TryKind, taskId);
    tryGate().spent(units);
    log("ok", units);
    return Response.json({ url, units, template: tpl, trace: trace.steps });
  } catch (error) {
    if (error instanceof UnitBudgetExceeded) return log("budget"), Response.json({ error: error.message, trace: trace.steps }, { status: 402 });
    if (error instanceof YouCamTaskError) return log("task_error"), Response.json({ error: error.code, detail: "The try-on failed, so no units were charged.", trace: trace.steps }, { status: 422 });
    if (error instanceof YouCamApiError) return log("api_error"), Response.json({ error: error.message, trace: trace.steps }, { status: 502 });
    log("crash");
    throw error;
  }
}
