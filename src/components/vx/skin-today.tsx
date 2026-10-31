"use client";

import { useId } from "react";
import { CountUp, useMounted } from "@/components/vx/live";
import { concernDef } from "@/lib/tracking/concerns";
import type { SdAction, SkinAnalysisOutput } from "@/lib/youcam/types";

/** Plain words for a score (higher = healthier-looking), never a diagnosis. */
const WORDS: Partial<Record<SdAction, [string, string, string]>> = {
  redness: ["Calm", "A little redness", "Visible redness"],
  pore: ["Refined", "Visible pores", "Enlarged pores"],
  wrinkle: ["Smooth", "Fine lines", "Visible lines"],
  acne: ["Clear", "A few blemishes", "Breakouts"],
  age_spot: ["Even", "Some spots", "Dark spots"],
  radiance: ["Radiant", "Soft glow", "Dull"],
  moisture: ["Hydrated", "A little dry", "Dry"],
  oiliness: ["Balanced", "Some shine", "Oily"],
  texture: ["Smooth", "Some texture", "Uneven"],
  dark_circle_v2: ["Bright", "Light circles", "Dark circles"],
  eye_bag: ["Rested", "Slight puffiness", "Puffy"],
  firmness: ["Firm", "Softening", "Less firm"],
};

function word(type: SdAction, score: number): string {
  const w = WORDS[type] ?? ["Great", "Good", "Needs care"];
  return score >= 75 ? w[0] : score >= 55 ? w[1] : w[2];
}

function Gauge({ score }: { score: number }) {
  const on = useMounted(200);
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg className="vx-gauge" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--vx-data)" />
          <stop offset="1" stopColor="var(--vx-peach)" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} className="vx-gauge__track" />
      <circle cx="50" cy="50" r={r} className="vx-gauge__arc" stroke={`url(#${id})`} strokeDasharray={c} strokeDashoffset={on ? c * (1 - score / 100) : c} transform="rotate(-90 50 50)" />
    </svg>
  );
}

/** "Your skin today": one soft gauge per measured concern, a word, and the change since day 0. */
export function SkinToday({ output, day0, live }: { output: SkinAnalysisOutput[]; day0?: Partial<Record<SdAction, number>>; live: boolean }) {
  const rows = output
    .filter((o) => o.ui_score != null)
    .map((o) => {
      const type = o.type as SdAction;
      const score = Math.round(o.ui_score ?? 0);
      const base = day0?.[type];
      return { type, score, label: concernDef(type).label, word: word(type, score), delta: base != null ? score - base : null };
    });
  if (rows.length === 0) return null;
  const words = rows.map((r, i) => (i === 0 ? r.word : r.word.toLowerCase()));
  const headline = `${words.join(", ")}.`;
  return (
    <section className="vx-today" aria-labelledby="today-h">
      <p className="vx-eyebrow">Your skin today{live ? "" : " · demo scores"}</p>
      <h2 id="today-h" className="vx-today__title">
        {headline}
      </h2>
      <div className="vx-gauges" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.type} className="vx-gauges__item">
            <div className="vx-gauges__ring">
              <Gauge score={r.score} />
              <b>
                <CountUp value={r.score} />
              </b>
            </div>
            <strong>{r.label}</strong>
            <span>{r.word}</span>
            {r.delta != null && r.delta !== 0 && (
              <em className={r.delta > 0 ? "is-up" : "is-down"}>
                {`${r.delta > 0 ? "+" : ""}${r.delta} since day 0`}
              </em>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
