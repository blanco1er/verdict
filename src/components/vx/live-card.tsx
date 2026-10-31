"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

type TraceStep = { method: string; path: string; status: number; ms?: number; taskStatus?: string };

export const LIVE_STEPS = ["Check", "Upload", "Analyse", "Compare", "Verdict"] as const;

/** What the server does, in order, while the real trace is not back yet. */
const PLANNED: Array<{ at: number; m: string; p: string }> = [
  { at: 0, m: "CHECK", p: "light, framing, angle vs day 0" },
  { at: 1, m: "POST", p: "/s2s/v2.0/file" },
  { at: 1, m: "PUT", p: "pre-signed upload URL" },
  { at: 2, m: "POST", p: "/s2s/v2.0/task/skin-analysis" },
  { at: 2, m: "GET", p: "/s2s/v2.0/task/skin-analysis/…" },
  { at: 3, m: "TREND", p: "least squares on raw_score" },
];

/**
 * Verdict at work: the step bar, a percentage, and the calls as a small log.
 * Open by default; one tap folds it.
 */
export function LiveCard({ stage, done, trace, units, concerns }: { stage: number; done?: boolean; trace?: TraceStep[]; units?: number; concerns?: string }) {
  const [open, setOpen] = useState(true);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const target = done ? 100 : Math.min(94, 12 + stage * 21);
    const t = setInterval(() => setPct((p) => (p >= target ? target : p + 1)), done ? 8 : 38);
    return () => clearInterval(t);
  }, [stage, done]);

  const lines = trace
    ? trace.map((t) => ({ m: t.method, p: t.path, s: t.taskStatus ?? String(t.status), ms: t.ms }))
    : PLANNED.filter((l) => l.at <= stage).map((l, i, a) => ({ m: l.m, p: l.p, s: i === a.length - 1 ? "…" : "ok", ms: undefined as number | undefined }));

  return (
    <section className="vx-live" data-open={open} aria-busy={!done}>
      <button type="button" className="vx-live__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`vx-dot${done ? "" : " vx-dot--live"}`} style={{ ["--_c" as string]: "var(--vx-go)" }} />
        {done ? "Measured" : "Verdict at work"}
        <span className="vx-num">{done && units != null ? `${units} units · 100%` : `${pct}%`}</span>
        <Icon name="chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>
      <div className="vx-live__steps" aria-hidden>
        {LIVE_STEPS.map((s, i) => (
          <span key={s} className={`vx-live__step${done || i < stage ? " is-done" : i === stage ? " is-now" : ""}`}>
            <i />
            {s}
          </span>
        ))}
      </div>
      <ol className="vx-live__log" aria-live="polite">
        {concerns && (
          <li>
            <span>SKIN</span>
            <span>
              AI Skin Analysis · <b>{concerns}</b>
            </span>
            <span />
          </li>
        )}
        {lines.map((l, i) => (
          <li key={`${l.m}${l.p}${i}`}>
            <span>{l.m}</span>
            <span>
              <b>{l.p}</b>
              {l.ms != null && <> · {l.ms} ms</>}
            </span>
            <em style={{ color: /^(2\d\d|ok|success)$/.test(l.s) ? undefined : "var(--vx-ink-3)" }}>{l.s}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The photo while it is being measured: a sweep and a grid of measuring points. */
export function ScanPhoto({ url, label, scanning }: { url: string; label: string; scanning?: boolean }) {
  return (
    <div className={`vx-scan${scanning ? " is-scanning" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img src={url} alt={label} />
      {scanning && (
        <>
          <span className="vx-scan__grid" aria-hidden />
          <span className="vx-scan__line" aria-hidden />
        </>
      )}
      <span className="vx-scan__label">{label}</span>
    </div>
  );
}
