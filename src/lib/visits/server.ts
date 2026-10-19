import "server-only";
import { createHash } from "node:crypto";
import { contextOf, makeEvent, type VisitContext, type VisitEvent } from "./core";
import { storeFromEnv, type VisitStore } from "./store";

/**
 * Server side of the visit log. Never in the app's way: every entry point
 * swallows its own errors, and events are written after the response.
 */
let store: VisitStore | null | undefined;

export function visitStore(): VisitStore | null {
  if (store === undefined) store = storeFromEnv();
  return store;
}

/** Test hook. */
export function _setVisitStore(s: VisitStore | null) {
  store = s;
}

/** The export token: at least 32 characters, else the log cannot be read at all. */
export function visitsToken(): string {
  const t = process.env.VERDICT_VISITS_TOKEN ?? "";
  return t.length >= 32 ? t : "";
}

function salt(): string {
  const s = process.env.VERDICT_VISITS_SALT || visitsToken();
  // Without a configured secret (local runs), a fixed local salt: ids are still one-way.
  return s ? createHash("sha256").update(`verdict-visits|${s}`).digest("hex") : "verdict-local-salt";
}

export function visitContext(headers: Headers): VisitContext {
  return contextOf(headers, salt(), visitsToken());
}

/** Writes one event; returns it (or null when off / failed). */
export async function track(headers: Headers, type: string, data: Record<string, unknown> = {}): Promise<VisitEvent | null> {
  const s = visitStore();
  if (!s) return null;
  try {
    const evt = makeEvent(type, visitContext(headers), data);
    await s.append(evt);
    return evt;
  } catch (e) {
    console.warn("[visits]", e instanceof Error ? e.message : e);
    return null;
  }
}
