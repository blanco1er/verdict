"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/** True once the component has painted: CSS transitions start from their empty state, then fill. */
export function useMounted(delay = 60): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A number that counts up to its value (ease-out), tabular so nothing jumps. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", ms = 1100 }: { value: number; decimals?: number; prefix?: string; suffix?: string; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const quick = reducedMotion();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = quick ? 1 : Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return (
    <span className="vx-num">
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * The product, as a bottle whose liquid is the return window still open:
 * full on purchase day, empty on the deadline. The surface moves, slowly.
 */
export function Bottle({ hue, level, kind = "dropper", size = 56, status }: { hue: number; level: number; kind?: "dropper" | "jar" | "tube" | "pump"; size?: number; status?: string }) {
  const on = useMounted(120);
  const id = `b${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const fill = Math.max(0.04, Math.min(1, level));
  // Body box in a 40×64 viewBox.
  const body =
    kind === "jar"
      ? { x: 6, y: 30, w: 28, h: 30, r: 7 }
      : kind === "tube"
        ? { x: 11, y: 12, w: 18, h: 48, r: 6 }
        : { x: 9, y: 22, w: 22, h: 38, r: 7 };
  const top = body.y + body.h * (1 - (on ? fill : 1));
  const milky = kind === "jar";
  const liquid = milky ? `hsl(${hue} 30% 92%)` : `hsl(${hue} 42% 78%)`;
  const deep = milky ? `hsl(${hue} 22% 82%)` : `hsl(${hue} 40% 62%)`;
  return (
    <svg className="vx-bottle" data-status={status} viewBox="0 0 40 64" width={size * 0.625} height={size} aria-hidden>
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.r} />
        </clipPath>
        <linearGradient id={`${id}g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={liquid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      {/* cap */}
      {kind === "dropper" && (
        <>
          <rect x="15" y="4" width="10" height="11" rx="5" className="vx-bottle__cap" />
          <rect x="13" y="14" width="14" height="8" rx="2" className="vx-bottle__collar" />
        </>
      )}
      {kind === "pump" && (
        <>
          <path d="M18 3h10v3h-6v5h-4z" className="vx-bottle__cap" />
          <rect x="14" y="11" width="12" height="11" rx="2" className="vx-bottle__collar" />
        </>
      )}
      {kind === "jar" && <rect x="5" y="22" width="30" height="9" rx="3" className="vx-bottle__cap" />}
      {kind === "tube" && <rect x="13" y="4" width="14" height="9" rx="2" className="vx-bottle__cap" />}
      {/* glass */}
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.r} className="vx-bottle__glass" />
      <g clipPath={`url(#${id}c)`}>
        <g className="vx-bottle__liquid" style={{ transform: `translateY(${top - body.y}px)` } as CSSProperties}>
          <path
            className="vx-bottle__wave"
            d={`M${body.x - 40} ${body.y} q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${body.y + body.h + 4} H${body.x - 40} Z`}
            fill={`url(#${id}g)`}
          />
        </g>
      </g>
      <rect x={body.x + 3} y={body.y + 4} width="3" height={body.h - 12} rx="1.5" className="vx-bottle__shine" />
    </svg>
  );
}

/** A line that draws itself once, with its last point breathing. */
export function Spark({ values, width = 120, height = 34, min, max }: { values: number[]; width?: number; height?: number; min?: number; max?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = min ?? Math.min(...values) - 2;
  const hi = max ?? Math.max(...values) + 2;
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (width - 6), height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="vx-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <path d={`${d} L${lx} ${height} L3 ${height} Z`} className="vx-spark__area" />
      <path d={d} pathLength={1} className="vx-spark__line" />
      <circle cx={lx} cy={ly} r="3" className="vx-spark__dot" />
      <circle cx={lx} cy={ly} r="3" className="vx-spark__pulse" />
    </svg>
  );
}

/**
 * The return window as a ring: elapsed days fill clockwise, the decision day is a notch,
 * today is a dot that breathes.
 */
export function WindowRing({ day, total, decisionDay, size = 168, children }: { day: number; total: number; decisionDay: number | null; size?: number; children?: React.ReactNode }) {
  const on = useMounted(150);
  const r = 70;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, day / total));
  const angle = (f: number) => -Math.PI / 2 + f * 2 * Math.PI;
  // Rounded so the server and the browser print the same coordinates (hydration).
  const at = (f: number, rr = r) => [Math.round((80 + rr * Math.cos(angle(f))) * 100) / 100, Math.round((80 + rr * Math.sin(angle(f))) * 100) / 100] as const;
  const [tx, ty] = at(on ? k : 0);
  const notch = decisionDay != null ? at(decisionDay / total) : null;
  return (
    <div className="vx-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden>
        <circle cx="80" cy="80" r={r} className="vx-ring__track" />
        {Array.from({ length: total + 1 }, (_, d) => {
          const [x1, y1] = at(d / total, r - 9);
          const [x2, y2] = at(d / total, r - (d % 7 === 0 ? 14 : 11));
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className={`vx-ring__tick${d <= day ? " is-past" : ""}`} />;
        })}
        <circle
          cx="80"
          cy="80"
          r={r}
          className="vx-ring__arc"
          strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - k) : c}
          transform="rotate(-90 80 80)"
        />
        {notch && <circle cx={notch[0]} cy={notch[1]} r="5" className="vx-ring__notch" />}
        <circle cx={tx} cy={ty} r="6.5" className="vx-ring__today" style={{ transition: "cx 1.2s var(--vx-ease), cy 1.2s var(--vx-ease)" }} />
      </svg>
      <div className="vx-ring__center">{children}</div>
    </div>
  );
}
