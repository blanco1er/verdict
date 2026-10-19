import { after } from "next/server";
import { ACTIONS, CLIENT_EVENTS, maskText, normalizePath, productOf, refOf } from "@/lib/visits/core";
import { track } from "@/lib/visits/server";

const ACTION_SET: ReadonlySet<string> = new Set(ACTIONS);
const TYPE_SET: ReadonlySet<string> = new Set(CLIENT_EVENTS);

/**
 * Beacon from the app (navigator.sendBeacon): a page opened, the page left
 * (time spent), a named action, or a JavaScript error. Only allow-listed
 * fields are kept; the answer is always 204 so it can never break the app.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length <= 2048) body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  const type = typeof body.t === "string" && TYPE_SET.has(body.t) ? body.t : null;
  if (!type) return new Response(null, { status: 204 });

  const headers = new Headers(request.headers);
  const self = new URL(request.url).hostname;
  const data: Record<string, unknown> = {};
  if (type === "page") {
    const p = normalizePath(body.path);
    if (!p) return new Response(null, { status: 204 });
    data.path = p;
    data.product = productOf(body.path);
    data.ref = refOf(body.ref, self);
    const src = typeof body.src === "string" ? body.src.toLowerCase() : "";
    if (/^[\w.-]{1,40}$/.test(src)) data.src = src;
    if (body.w != null) data.w = Math.max(0, Math.min(10000, Number(body.w) || 0));
  } else if (type === "leave") {
    data.path = normalizePath(body.path) ?? undefined;
    data.ms = Math.max(0, Math.min(6 * 3600e3, Number(body.ms) || 0));
  } else if (type === "action") {
    if (typeof body.name !== "string" || !ACTION_SET.has(body.name)) return new Response(null, { status: 204 });
    data.name = body.name;
    data.path = normalizePath(body.path) ?? undefined;
    data.product = productOf(body.path);
  } else {
    data.msg = maskText(body.msg);
    data.src = maskText(body.src, 80);
  }
  after(() => track(headers, type, data));
  return new Response(null, { status: 204 });
}
