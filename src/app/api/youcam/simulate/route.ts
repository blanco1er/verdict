import { after } from "next/server";
import { YouCamApiError, YouCamTaskError } from "@/lib/youcam/client";
import { skinSimulationCost } from "@/lib/youcam/costs";
import { REFUSAL_TEXT } from "@/lib/youcam/guard";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { createTracedClient, liveGate, youCamMode } from "@/lib/youcam/server";
import { simulationFor } from "@/lib/tracking/concerns";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";
import { track, visitContext } from "@/lib/visits/server";

const ALLOWED: ReadonlySet<string> = new Set(SD_ACTIONS);

/**
 * POST { fileId, concerns } -> { url, units, trace }
 * "The promised result": YouCam Skin Simulation on the photo that was just
 * analysed live, reusing its file_id (no second upload). Live only, behind the
 * same gate as the analysis. The result URL is YouCam's (valid about 2 hours);
 * Verdict does not store it.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const headers = new Headers(request.headers);
  if (youCamMode() !== "live") return Response.json({ error: "Skin Simulation runs with the live API key only." }, { status: 409 });
  let body: { fileId?: unknown; concerns?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fileId = typeof body.fileId === "string" && /^[\w=+/-]{1,300}$/.test(body.fileId) ? body.fileId : null;
  const concerns = Array.isArray(body.concerns) ? body.concerns.filter((c): c is SdAction => typeof c === "string" && ALLOWED.has(c)).slice(0, 4) : [];
  const params = simulationFor(concerns, 0.5);
  const active = Object.keys(params).length;
  if (!fileId || active === 0) return Response.json({ error: "fileId and at least one concern Skin Simulation can render are required" }, { status: 400 });
  const units = skinSimulationCost(active);
  const ok = await liveGate().take(visitContext(headers).v, units);
  if (!ok.ok) return Response.json({ error: REFUSAL_TEXT[ok.reason].replace(", so this photo ran in demo mode.", ".") }, { status: 429 });

  const { client, trace } = createTracedClient();
  const log = (outcome: string) => after(() => track(headers, "simulation", { mode: "live", units: outcome === "ok" ? units : 0, outcome, ms: Date.now() - t0 }));
  try {
    const taskId = await client.runSkinSimulation({ src_file_id: fileId }, params);
    const url = await client.waitForSkinSimulation(taskId);
    liveGate().spent(units);
    log("ok");
    return Response.json({ url, units, params, trace: trace.steps });
  } catch (error) {
    if (error instanceof UnitBudgetExceeded) return log("budget"), Response.json({ error: error.message, trace: trace.steps }, { status: 402 });
    if (error instanceof YouCamTaskError) return log("task_error"), Response.json({ error: error.code, detail: "The task failed, so no units were charged.", trace: trace.steps }, { status: 422 });
    if (error instanceof YouCamApiError) return log("api_error"), Response.json({ error: error.message, trace: trace.steps }, { status: 502 });
    log("crash");
    throw error;
  }
}
