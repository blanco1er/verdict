import { INTERNAL_COOKIE, internalCookieValue, internalLinkKey, safeEqual } from "@/lib/visits/core";
import { visitsToken } from "@/lib/visits/server";

/**
 * Secret link the owner opens once per device (printed by scripts/visits-report.mjs --lien-interne):
 * sets a cookie so his own visits are flagged "internal" and left out of the report.
 * The link key is derived from the token and cannot read the log.
 */
export async function GET(request: Request) {
  const token = visitsToken();
  const url = new URL(request.url);
  const k = url.searchParams.get("k") ?? "";
  if (!token || !k || !safeEqual(k, internalLinkKey(token))) return new Response("Not found", { status: 404 });
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      location: "/",
      "set-cookie": `${INTERNAL_COOKIE}=${internalCookieValue(token)}; Path=/; Max-Age=${180 * 86400}; HttpOnly; SameSite=Lax${secure}`,
      "cache-control": "no-store",
    },
  });
}
