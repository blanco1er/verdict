import { YouCamApiError, YouCamTaskError } from "@/lib/youcam/client";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { getYouCam, liveGate } from "@/lib/youcam/server";
import { skinAnalysisCost } from "@/lib/youcam/costs";
import { visitContext } from "@/lib/visits/server";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";

const ALLOWED: ReadonlySet<string> = new Set(SD_ACTIONS);

/**
 * POST { src_file_url | src_file_id, dst_actions } -> { mode, output }
 * The API key stays on the server. In live mode the same gate as the app
 * applies (YOUCAM_PUBLIC_LIVE=1, per-visitor and daily quota, real balance
 * above the floor), so this route cannot be used to drain the units.
 */
export async function POST(request: Request) {
  const { client, mode } = getYouCam();
  let body: { src_file_url?: unknown; src_file_id?: unknown; dst_actions?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const actions = Array.isArray(body.dst_actions) ? body.dst_actions : [];
  if (actions.length < 1 || actions.length > 4 || !actions.every((a) => typeof a === "string" && ALLOWED.has(a))) {
    return Response.json({ error: "dst_actions: 1 to 4 SD concerns" }, { status: 400 });
  }
  const source =
    typeof body.src_file_id === "string"
      ? { src_file_id: body.src_file_id }
      : typeof body.src_file_url === "string" && body.src_file_url.startsWith("https://")
        ? { src_file_url: body.src_file_url }
        : null;
  if (source == null) {
    return Response.json({ error: "src_file_id or https src_file_url required" }, { status: 400 });
  }
  if (mode === "live") {
    const ok = await liveGate().take(visitContext(request.headers).v, skinAnalysisCost(actions as SdAction[]));
    if (!ok.ok) return Response.json({ error: `Live analysis refused: ${ok.reason}` }, { status: 403 });
  }
  try {
    const output = await client.analyzeSkin(source, actions as SdAction[]);
    return Response.json({ mode, output, unitsLeftInLocalCap: client.ledger?.remaining ?? null });
  } catch (error) {
    if (error instanceof UnitBudgetExceeded) return Response.json({ error: error.message }, { status: 402 });
    if (error instanceof YouCamTaskError) return Response.json({ error: error.code }, { status: 422 });
    if (error instanceof YouCamApiError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
