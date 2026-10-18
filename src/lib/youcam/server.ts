import "server-only";
import { YouCamClient } from "./client";
import { UnitLedger } from "./ledger";
import { MockTransport } from "./mock";
import { TracingTransport } from "./tracing";
import { LiveTransport, type Transport } from "./transport";
import { YOUCAM_API_BASE } from "./types";

/**
 * Server-side factory. Mock mode is the default; live mode requires BOTH
 * YOUCAM_MODE=live and YOUCAM_API_KEY in a local, git-ignored .env file.
 */
export type YouCamMode = "mock" | "live";

let ledger: UnitLedger | undefined;
let singleton: { client: YouCamClient; mode: YouCamMode } | undefined;

function sharedLedger(): UnitLedger {
  if (ledger) return ledger;
  const cap = Number(process.env.YOUCAM_UNIT_CAP ?? "100");
  ledger = new UnitLedger(Number.isFinite(cap) ? cap : 100);
  return ledger;
}

export function youCamMode(): YouCamMode {
  return process.env.YOUCAM_MODE === "live" && (process.env.YOUCAM_API_KEY ?? "") !== "" ? "live" : "mock";
}

/** Live analyses from the public site are off unless YOUCAM_PUBLIC_LIVE=1 (protects the 1,000 units). */
export function publicLiveEnabled(): boolean {
  return youCamMode() === "live" && process.env.YOUCAM_PUBLIC_LIVE === "1";
}

function baseTransport(mode: YouCamMode): Transport {
  if (mode === "live") {
    return new LiveTransport({ apiKey: process.env.YOUCAM_API_KEY ?? "", baseUrl: process.env.YOUCAM_API_BASE ?? YOUCAM_API_BASE });
  }
  return new MockTransport();
}

export function getYouCam(): { client: YouCamClient; mode: YouCamMode } {
  if (singleton) return singleton;
  const mode = youCamMode();
  singleton = {
    mode,
    client: new YouCamClient({ transport: baseTransport(mode), ledger: sharedLedger(), pollIntervalMs: mode === "mock" ? 300 : 3000 }),
  };
  return singleton;
}

/** A client for one request whose every API step is recorded for the UI. */
export function createTracedClient(): { client: YouCamClient; mode: YouCamMode; trace: TracingTransport } {
  const mode = youCamMode();
  const trace = new TracingTransport(baseTransport(mode));
  const client = new YouCamClient({ transport: trace, ledger: sharedLedger(), pollIntervalMs: mode === "mock" ? 250 : 3000 });
  return { client, mode, trace };
}
