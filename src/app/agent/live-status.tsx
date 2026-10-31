"use client";

import { useEffect, useState } from "react";

/** One line: is the live YouCam API on for this visitor right now (read-only call). */
export function LiveStatus() {
  const [s, setS] = useState<{ mode: string; live: boolean; left?: number; notice?: string } | null>(null);
  useEffect(() => {
    fetch("/api/youcam/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ mode: "unknown", live: false }));
  }, []);
  const on = s?.live === true;
  return (
    <p className="vx-sub" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }} aria-live="polite">
      <span className={`vx-dot${on ? " vx-dot--live" : ""}`} style={{ ["--_c" as string]: on ? "var(--vx-go)" : "var(--vx-wait)" }} />
      {s == null
        ? "Checking the YouCam API…"
        : on
          ? `Live YouCam API · ${s.left} real ${s.left === 1 ? "analysis" : "analyses"} left for you`
          : s.mode === "mock"
            ? "Demo mode · scores are generated, nothing is sent"
            : (s.notice ?? "Live analyses are paused")}
    </p>
  );
}
