import type { ReactNode } from "react";
import type { VerdictStatus } from "@/lib/tracking/verdict";

export function SampleBadge() {
  return (
    <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
      Sample data
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${className}`}>{children}</section>;
}

const STATUS_STYLE: Record<VerdictStatus, { label: string; className: string }> = {
  collecting: { label: "Measuring", className: "bg-collect/10 text-collect" },
  keep: { label: "Keep it", className: "bg-keep/10 text-keep" },
  return: { label: "Return it", className: "bg-return/10 text-return" },
  mixed: { label: "Mixed", className: "bg-mixed/10 text-mixed" },
  stop: { label: "Stop", className: "bg-return/10 text-return" },
  inconclusive: { label: "Not enough data", className: "bg-mixed/10 text-mixed" },
  "window-closed": { label: "Window closed", className: "bg-line text-muted" },
};

export function StatusPill({ status }: { status: VerdictStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

/** Tiny SVG timeline of raw scores, with the comparable points only. */
export function Sparkline({ points, improving }: { points: Array<{ day: number; value: number }>; improving: boolean }) {
  if (points.length === 0) return null;
  const w = 280;
  const h = 64;
  const maxDay = Math.max(1, ...points.map((p) => p.day));
  const values = points.map((p) => p.value);
  const lo = Math.min(...values) - 2;
  const hi = Math.max(...values) + 2;
  const x = (d: number) => 6 + (d / maxDay) * (w - 12);
  const y = (v: number) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const stroke = improving ? "var(--keep)" : "var(--muted)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" role="img" aria-label="Score over time">
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r={3} fill="var(--surface)" stroke={stroke} strokeWidth={2} />
      ))}
    </svg>
  );
}
