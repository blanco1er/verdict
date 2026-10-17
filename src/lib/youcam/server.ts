import "server-only";
import { YouCamClient } from "./client";
import { UnitLedger } from "./ledger";
import { MockTransport } from "./mock";
import { LiveTransport } from "./transport";
import { YOUCAM_API_BASE } from "./types";

/**
 * Server-side factory. Mock mode is the default; live mode requires BOTH
 * YOUCAM_MODE=live and YOUCAM_API_KEY in a local, git-ignored .env file.
 */
let singleton: { client: YouCamClient; mode: "mock" | "live" } | undefined;

export function getYouCam(): { client: YouCamClient; mode: "mock" | "live" } {
  if (singleton) return singleton;
  const wantsLive = process.env.YOUCAM_MODE === "live";
  const apiKey = process.env.YOUCAM_API_KEY ?? "";
  const cap = Number(process.env.YOUCAM_UNIT_CAP ?? "100");
  const ledger = new UnitLedger(Number.isFinite(cap) ? cap : 100);
  if (wantsLive && apiKey) {
    singleton = {
      mode: "live",
      client: new YouCamClient({
        transport: new LiveTransport({ apiKey, baseUrl: process.env.YOUCAM_API_BASE ?? YOUCAM_API_BASE }),
        ledger,
      }),
    };
  } else {
    singleton = {
      mode: "mock",
      client: new YouCamClient({ transport: new MockTransport(), ledger, pollIntervalMs: 300 }),
    };
  }
  return singleton;
}
