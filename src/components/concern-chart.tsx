"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/icons";
import { fmtDay } from "@/components/ui";
import { concernDef } from "@/lib/tracking/concerns";
import { addDays, daysBetween, type Capture, type Product } from "@/lib/tracking/model";
import { checkCapture } from "@/lib/tracking/quality";
import type { Trend } from "@/lib/tracking/trend";
import type { SdAction } from "@/lib/youcam/types";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

interface Pt {
  day: number;
  raw: number;
  ui: number;
  ok: boolean;
}

/**
 * One concern over the return window, on raw_score (higher = better skin).
 * Filled dots: comparable photos. Dashed rings: photos set aside by the quality gate.
 * Dashed line: least-squares trend used by the verdict. Shaded: decision zone.
 * Rendered at the real pixel width so labels stay 11 px on every screen.
 */
export function ConcernChart({
  product,
  captures,
  action,
  index,
  asOfDay,
  decisionDay,
  trend,
}: {
  product: Product;
  captures: Capture[];
  action: SdAction;
  index: number;
  asOfDay: number;
  decisionDay: number;
  trend?: Trend;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [hover, setHover] = useState<Pt | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 164;
  const padL = 2;
  const padR = 34;
  const padT = 14;
  const padB = 26;
  const win = product.returnWindowDays;
  const color = SERIES[index % SERIES.length];
  const label = concernDef(action).label;

  const all = captures.filter((c) => c.scores[action] != null);
  const values = all.map((c) => c.scores[action]!.raw);
  let lo = Math.floor((Math.min(...values, 60) - 3) / 5) * 5;
  let hi = Math.ceil((Math.max(...values, 65) + 3) / 5) * 5;
  if (hi - lo < 15) {
    lo -= 5;
    hi += 5;
  }
  const step = hi - lo > 30 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);

  const x = (day: number) => padL + (day / win) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const seen = all.filter((c) => daysBetween(product.purchasedOn, c.takenOn) <= asOfDay);
  const firstGood = seen.find((c) => checkCapture(c.quality).ok);
  const pts: Pt[] = seen.map((c) => ({
    day: daysBetween(product.purchasedOn, c.takenOn),
    raw: c.scores[action]!.raw,
    ui: c.scores[action]!.ui,
    ok: checkCapture(c.quality, firstGood?.quality).comparable,
  }));
  const good = pts.filter((p) => p.ok);
  const line = good.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.raw).toFixed(1)}`).join(" ");

  let fit: string | null = null;
  if (good.length >= 2 && trend && trend.direction !== "insufficient") {
    const mx = good.reduce((s, p) => s + p.day, 0) / good.length;
    const my = good.reduce((s, p) => s + p.raw, 0) / good.length;
    const a = good[0].day;
    const b = good[good.length - 1].day;
    fit = `M${x(a).toFixed(1)},${y(my + trend.slope * (a - mx)).toFixed(1)} L${x(b).toFixed(1)},${y(my + trend.slope * (b - mx)).toFixed(1)}`;
  }

  const delta =
    !trend || trend.direction === "insufficient"
      ? null
      : { text: `${trend.change >= 0 ? "+" : "−"}${Math.abs(trend.change).toFixed(1)}`, dir: trend.direction };
  const now = Math.max(0, Math.min(win, asOfDay));

  function pick(clientX: number) {
    const el = box.current;
    if (!el || pts.length === 0) return;
    const r = el.getBoundingClientRect();
    const day = ((clientX - r.left - padL) / (w - padL - padR)) * win;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.day - day) < Math.abs(best.day - day)) best = p;
    setHover(Math.abs(best.day - day) <= 3 ? best : null);
  }

  const summary = delta
    ? `${label}: ${good.length} comparable photos, ${delta.text} raw points in ${trend!.spanDays} days, ${trend!.direction}.`
    : `${label}: ${good.length} comparable ${good.length === 1 ? "photo" : "photos"} so far; a trend needs 3.`;

  return (
    <div className="vd-chart" style={{ "--_c": color } as CSSProperties}>
      <div className="vd-chart__head">
        <h3>{label}</h3>
        <span className={`vd-chart__delta${delta?.dir === "improving" ? " is-up" : delta?.dir === "worsening" ? " is-down" : ""}`}>
          {delta ? (
            <>
              {delta.dir === "improving" && <Icon name="arrowUp" />}
              {delta.dir === "worsening" && <Icon name="arrowDown" />}
              {delta.dir === "flat" && <Icon name="minus" />}
              {delta.text} in {trend!.spanDays} days
            </>
          ) : (
            "Needs 3 good photos"
          )}
        </span>
      </div>
      <div
        ref={box}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        style={{ position: "relative" }}
      >
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={summary}>
          <rect className="vd-chart__zone" x={x(decisionDay)} y={padT - 6} width={Math.max(0, x(win) - x(decisionDay))} height={H - padT - padB + 6} rx="4" />
          {ticks.map((t) => (
            <g key={t}>
              <line className="ui-chart__grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} />
              <text className="ui-chart__label" x={w - padR + 8} y={y(t) + 4}>
                {t}
              </text>
            </g>
          ))}
          <line className="vd-chart__deadline" x1={x(win)} x2={x(win)} y1={padT - 6} y2={H - padB} />
          <line className="vd-chart__now" x1={x(now)} x2={x(now)} y1={padT - 6} y2={H - padB} />
          {line && <path className="vd-chart__path" d={line} />}
          {fit && <path className="vd-chart__fit" d={fit} />}
          {pts.map((p) =>
            p.ok ? (
              <circle key={p.day} className="ui-chart__dot" cx={x(p.day)} cy={y(p.raw)} r={hover?.day === p.day ? 5.5 : 4} />
            ) : (
              <circle key={p.day} className="vd-chart__aside" cx={x(p.day)} cy={y(p.raw)} r={4.5}>
                <title>Set aside: lighting differed from day 0</title>
              </circle>
            ),
          )}
          <text className="ui-chart__label" x={padL} y={H - 6}>
            {fmtDay(product.purchasedOn)}
          </text>
          <text className="ui-chart__label" x={x(win)} y={H - 6} textAnchor="end">
            {fmtDay(addDays(product.purchasedOn, win))}
          </text>
        </svg>
        {hover && (
          <div
            className="ui-chart__tooltip ui-glass vd-chart__tooltip is-visible"
            style={{ left: Math.max(78, Math.min(w - 78, x(hover.day))), top: y(hover.raw) }}
            role="status"
          >
            <b>
              {fmtDay(addDays(product.purchasedOn, hover.day))} · day {hover.day}
            </b>
            raw {hover.raw.toFixed(1)} <span>· shown {hover.ui}/100</span>
            {!hover.ok && <span style={{ display: "block" }}>Set aside: lighting differed</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartLegend() {
  return (
    <ul className="vd-legend">
      <li>
        <i className="is-dot" />
        Comparable photo
      </li>
      <li>
        <i className="is-ring" />
        Set aside
      </li>
      <li>
        <i className="is-dash" />
        Trend
      </li>
      <li>
        <i className="is-zone" />
        Verdict zone
      </li>
    </ul>
  );
}
