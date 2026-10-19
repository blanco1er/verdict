import { connection } from "next/server";
import { clientAddress, daysFrom, parseSince, safeEqual } from "@/lib/visits/core";
import { visitStore, visitsToken } from "@/lib/visits/server";

/** Failed attempts per address and hour (in memory: enough to slow guessing a 64-character token). */
const failures = new Map<string, { n: number; since: number }>();

/**
 * GET /api/visits/export?since=YYYY-MM-DD with "Authorization: Bearer <VERDICT_VISITS_TOKEN>".
 * Read by scripts/visits-report.mjs, for the owner only. Without the variable
 * (32+ characters) this route does not exist (404). No public page shows the log.
 */
export async function GET(request: Request) {
  await connection(); // never prerendered: the answer depends on this request and on live state
  const token = visitsToken();
  const store = visitStore();
  if (!token || !store) return new Response("Not found", { status: 404 });

  const who = clientAddress(request.headers);
  const now = Date.now();
  const f = failures.get(who);
  if (f && now - f.since < 3600e3 && f.n >= 20) return new Response("Too many attempts", { status: 429 });

  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !safeEqual(given, token)) {
    failures.set(who, f && now - f.since < 3600e3 ? { n: f.n + 1, since: f.since } : { n: 1, since: now });
    if (failures.size > 5000) failures.delete(failures.keys().next().value!);
    return new Response("Not found", { status: 404 });
  }

  const since = parseSince(new URL(request.url).searchParams.get("since"));
  const days = daysFrom(since);
  const events = [];
  for (const d of days) events.push(...(await store.day(d)));
  return Response.json({ store: store.kind, since, days: days.length, count: events.length, events }, { headers: { "cache-control": "no-store" } });
}
