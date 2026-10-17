import { YouCamApiError, YouCamTaskError } from "@/lib/youcam/client";
import { UnitBudgetExceeded } from "@/lib/youcam/ledger";
import { getYouCam } from "@/lib/youcam/server";
import { SD_ACTIONS, type SdAction } from "@/lib/youcam/types";

const ALLOWED: ReadonlySet<string> = new Set(SD_ACTIONS);

/**
 * POST { src_file_url | src_file_id, dst_actions } -> { mode, output }
 * The API key stays on the server. Live calls from the public site are
 * refused unless YOUCAM_PUBLIC_LIVE=1 (protects the 1,000 units).
 */
export async function POST(request: Request) {
  const { client, mode } = getYouCam();
  if (mode === "live" && process.env.YOUCAM_PUBLIC_LIVE !== "1") {
    return Response.json({ error: "Live analysis is disabled on this deployment" }, { status: 403 });
  }
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
