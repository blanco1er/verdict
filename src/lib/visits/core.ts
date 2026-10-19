import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Anonymous visit log of the hosted demo: did judges try it, where did they
 * come from, how far did they go? Never who they are.
 *
 * Kept per event: time, type, an anonymous visitor id (salted HMAC of address +
 * browser, never the address), browser / system / device families, the
 * referring site's host name, the page path and, for analyses, the mode, the
 * number of concerns, the unit cost and the outcome. Never: address, photo,
 * score, name, e-mail, key. What is kept is explained on /privacy.
 *
 * Pure functions only (no I/O) so every rule is unit-tested.
 */

export interface VisitEvent {
  /** ISO time. */
  t: string;
  /** Event type (allow-listed). */
  e: string;
  /** Anonymous visitor id. */
  v: string;
  br: string;
  os: string;
  dev: "mobile" | "tablet" | "desktop";
  bot?: 1;
  /** The developer's own devices and scripts. */
  int?: 1;
  [key: string]: string | number | undefined;
}

export interface VisitContext {
  v: string;
  br: string;
  os: string;
  dev: "mobile" | "tablet" | "desktop";
  bot?: 1;
  int?: 1;
}

/** Event types a browser may send through the beacon. Server-side events are added by the routes. */
export const CLIENT_EVENTS = ["page", "leave", "action", "client_error"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

/** Named actions the app reports (no free text). */
export const ACTIONS = [
  "replay",
  "scrub",
  "sheet_promised",
  "sheet_look",
  "sheet_about",
  "add_product",
  "delete_product",
  "camera_open",
  "camera_denied",
  "sample_photo",
  "quality_blocked",
  "proof_print",
  "phone_view",
] as const;

/** Pages worth counting. Query strings are dropped; product ids are kept (they are demo ids, never personal). */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p: string;
  try {
    p = new URL(raw, "https://x.invalid").pathname;
  } catch {
    return null;
  }
  const known = ["/", "/product", "/capture", "/add", "/merchant", "/proof", "/phone", "/privacy", "/measured"];
  return known.includes(p) ? p : null;
}

/** Demo product id from a query string, only if it looks like one of ours. */
export function productOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const id = new URL(raw, "https://x.invalid").searchParams.get("id") ?? "";
    return /^[a-z0-9-]{1,40}$/.test(id) ? id : id ? "user-product" : undefined;
  } catch {
    return undefined;
  }
}

/** E-mails, phone and card numbers, IBANs and "key: value" secrets are masked, then the text is cut. */
export function maskText(s: unknown, max = 160): string {
  let t = String(s ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]");
  t = t.replace(/\b(passwords?|token|secret|api[ _-]?key|bearer)\b(\s*(?:[:=]|\bis\b)?\s*)\S+/gi, "$1$2[hidden]");
  t = t.replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, "[iban]");
  t = t.replace(/(?:\+|\(|\b)\d(?:[\s().\/-]{0,2}\d){8,}/g, (m) => (m.replace(/\D/g, "").length >= 13 ? "[card]" : "[number]"));
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Browser, system and device families only. */
export function uaInfo(ua: string): Omit<VisitContext, "v" | "int"> {
  const u = String(ua);
  const bot =
    !u ||
    /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl\/|wget|python|node-fetch|undici|axios|go-http|java\/|okhttp|headless|lighthouse|pingdom|uptime|monitor|vercel-/i.test(u);
  const br = /Edg(?:e|A|iOS)?\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
      ? "Opera"
      : /SamsungBrowser/.test(u)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(u)
          ? "Firefox"
          : /Chrome\/|CriOS|Chromium/.test(u)
            ? "Chrome"
            : /Safari\//.test(u) && /Version\//.test(u)
              ? "Safari"
              : /AppleWebKit/.test(u) && /iPhone|iPad/.test(u)
                ? "Safari (app)"
                : "Other";
  const os = /iPhone|iPod/.test(u)
    ? "iOS"
    : /iPad/.test(u)
      ? "iPadOS"
      : /Android/.test(u)
        ? "Android"
        : /CrOS/.test(u)
          ? "ChromeOS"
          : /Windows/.test(u)
            ? "Windows"
            : /Mac OS X|Macintosh/.test(u)
              ? "macOS"
              : /Linux/.test(u)
                ? "Linux"
                : "Other";
  const dev = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? "tablet" : /Mobi|iPhone|iPod|Android/.test(u) ? "mobile" : "desktop";
  return { br, os, dev, ...(bot ? { bot: 1 as const } : {}) };
}

/** The referring site's host only ("devpost.com"), "direct" or "self". */
export function refOf(referer: unknown, selfHost = ""): string {
  if (typeof referer !== "string" || referer === "") return "direct";
  try {
    const h = new URL(referer).hostname.toLowerCase().replace(/^(www|m)\./, "");
    return h === selfHost.toLowerCase().replace(/^www\./, "") ? "self" : h.slice(0, 80) || "other";
  } catch {
    return "other";
  }
}

/** First address of x-forwarded-for, else x-real-ip. Used only inside the HMAC, never stored. */
export function clientAddress(headers: Headers): string {
  const xff = headers.get("x-forwarded-for") ?? "";
  return (xff.split(",")[0] ?? "").trim() || (headers.get("x-real-ip") ?? "").trim() || "local";
}

export const visitorId = (salt: string, address: string, ua: string) =>
  `v_${createHmac("sha256", salt).update(`visitor|${address}|${ua}`).digest("hex").slice(0, 16)}`;

/** Key of the secret link that marks the owner's devices as internal (derived: it cannot read the log). */
export const internalLinkKey = (token: string) => createHmac("sha256", token).update("internal-link").digest("hex").slice(0, 40);
export const internalCookieValue = (token: string) => createHmac("sha256", token).update("internal-cookie").digest("hex").slice(0, 40);
export const INTERNAL_COOKIE = "verdict_internal";
export const INTERNAL_HEADER = "x-verdict-internal";

export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a === b;
}

export function cookieOf(cookieHeader: string | null, name: string): string {
  const m = String(cookieHeader ?? "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  try {
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

export function isInternal(headers: Headers, token: string): boolean {
  if (headers.get(INTERNAL_HEADER) === "1") return true;
  if (!token) return false;
  const c = cookieOf(headers.get("cookie"), INTERNAL_COOKIE);
  return c !== "" && safeEqual(c, internalCookieValue(token));
}

export function contextOf(headers: Headers, salt: string, token: string): VisitContext {
  const ua = (headers.get("user-agent") ?? "").slice(0, 512);
  return { v: visitorId(salt, clientAddress(headers), ua), ...uaInfo(ua), ...(isInternal(headers, token) ? { int: 1 as const } : {}) };
}

/** Builds one event; extra fields are clipped (strings 160 chars, only primitives). */
export function makeEvent(type: string, ctx: VisitContext, data: Record<string, unknown> = {}, now = new Date()): VisitEvent {
  const evt: VisitEvent = { t: now.toISOString(), e: type.slice(0, 30), ...ctx };
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "" || k in evt) continue;
    if (typeof v === "number") evt[k] = Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined;
    else if (typeof v === "boolean") evt[k] = v ? 1 : 0;
    else evt[k] = String(v).slice(0, 160);
  }
  return evt;
}

/** "YYYY-MM-DD" for ?since=, default 30 days back. */
export function parseSince(raw: string | null, now = new Date()): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
}

/** Days from `since` to today, inclusive (max 120). */
export function daysFrom(since: string, now = new Date()): string[] {
  const out: string[] = [];
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  for (let t = start; t <= end && out.length < 120; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
