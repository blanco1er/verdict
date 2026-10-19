"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Anonymous usage beacon (see /privacy). Sends the page opened, how long it
 * stayed open, named actions and JavaScript errors. Never a photo, a score or
 * anything typed. Every call is wrapped: it can never break the app.
 */
let sent = 0;
function send(body: Record<string, unknown>) {
  try {
    if (sent >= 60 || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    sent++;
    navigator.sendBeacon("/api/visit", new Blob([JSON.stringify(body)], { type: "application/json" }));
  } catch {
    /* never in the way */
  }
}

/** A named action from the allow-list in src/lib/visits/core.ts (ACTIONS). */
export function reportAction(name: string) {
  try {
    send({ t: "action", name, path: location.pathname + location.search });
  } catch {
    /* never in the way */
  }
}

export function VisitBeacon() {
  const path = usePathname();
  const search = useSearchParams();
  const first = useRef(true);
  const t0 = useRef(0);

  useEffect(() => {
    const full = path + (search.size ? `?${search.toString()}` : "");
    const src = search.get("ref") ?? search.get("utm_source") ?? undefined;
    // document.referrer is the outside site only on the first page of the visit.
    send({ t: "page", path: full, ref: first.current ? document.referrer : "", src, w: window.innerWidth });
    first.current = false;
  }, [path, search]);

  useEffect(() => {
    t0.current = Date.now();
    const onHide = () => {
      if (document.visibilityState === "hidden") send({ t: "leave", path: location.pathname, ms: Date.now() - t0.current });
    };
    const ours = (src?: string) => !src || src.startsWith(location.origin);
    const onError = (e: ErrorEvent) => {
      if (e.message && ours(e.filename)) send({ t: "client_error", msg: e.message, src: `${String(e.filename ?? "").replace(location.origin, "")}:${e.lineno ?? 0}` });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | undefined;
      send({ t: "client_error", msg: String(r?.message ?? r ?? "unhandled rejection") });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
