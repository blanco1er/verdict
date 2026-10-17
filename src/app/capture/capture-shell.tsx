"use client";

import { useState } from "react";
import type { SkinAnalysisOutput } from "@/lib/youcam/types";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; mode: string; output: SkinAnalysisOutput[] }
  | { kind: "error"; message: string };

/**
 * Shell only: the real flow will measure light/framing on-device first
 * (src/lib/tracking/quality.ts), then upload. Here we call the server route,
 * which answers from the mock unless live mode is explicitly enabled.
 */
export function CaptureShell() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function analyze() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/youcam/skin-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src_file_url: "https://example.com/sample-selfie.jpg", dst_actions: ["redness", "pore"] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState({ kind: "done", mode: json.mode, output: json.output });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-3xl bg-foreground/90">
        <div className="h-[72%] w-[64%] rounded-[50%] border-2 border-dashed border-white/60" />
        <span className="absolute bottom-4 text-xs text-white/70">Camera preview (coming)</span>
      </div>
      <button
        onClick={analyze}
        disabled={state.kind === "running"}
        className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-50"
      >
        {state.kind === "running" ? "Analyzing…" : "Analyze sample photo"}
      </button>
      {state.kind === "done" && (
        <div className="w-full rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">{state.mode} mode</p>
          {state.output
            .filter((o) => o.type !== "all")
            .map((o) => (
              <div key={o.type} className="flex justify-between py-1">
                <span className="capitalize">{o.type}</span>
                <span className="tabular-nums">
                  {o.ui_score}/100 <span className="text-muted">(raw {o.raw_score})</span>
                </span>
              </div>
            ))}
        </div>
      )}
      {state.kind === "error" && <p className="text-sm text-return">{state.message}</p>}
    </div>
  );
}
