import { connection } from "next/server";
import { skinAnalysisCost } from "@/lib/youcam/costs";
import { REFUSAL_TEXT } from "@/lib/youcam/guard";
import { liveGate, youCamMode } from "@/lib/youcam/server";
import { visitContext } from "@/lib/visits/server";

/**
 * GET /api/youcam/status: may this visitor run a live analysis right now?
 * Read-only (counts nothing). The capture screen asks before sending a photo,
 * so a photo is never uploaded when it would only run in demo mode.
 */
export async function GET(request: Request) {
  await connection(); // never prerendered: the answer depends on this request and on live state
  const noStore = { headers: { "cache-control": "no-store" } };
  if (youCamMode() !== "live") return Response.json({ mode: "mock", live: false }, noStore);
  const s = await liveGate().status(visitContext(request.headers).v, skinAnalysisCost(["redness"]));
  return Response.json(s.ok ? { mode: "live", live: true, left: s.left } : { mode: "live", live: false, reason: s.reason, notice: REFUSAL_TEXT[s.reason] }, noStore);
}
