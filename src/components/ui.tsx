import Link from "next/link";
import type { ReactNode } from "react";
import { concernDef } from "@/lib/tracking/concerns";
import { addDays, daysBetween, type Capture, type IsoDay, type Product } from "@/lib/tracking/model";
import { checkCapture } from "@/lib/tracking/quality";
import type { Trend } from "@/lib/tracking/trend";
import type { VerdictStatus } from "@/lib/tracking/verdict";
import type { SdAction } from "@/lib/youcam/types";

export function SyntheticBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Demo data: generated scores in the documented YouCam response shape, not real measurements."
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-ink ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      Synthetic data
    </span>
  );
}

/** @deprecated kept for older imports */
export const SampleBadge = SyntheticBadge;

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`card p-5 ${className}`}>{children}</Tag>;
}

export const STATUS_STYLE: Record<VerdictStatus, { label: string; tone: string; text: string; color: string }> = {
  collecting: { label: "Measuring", tone: "bg-collect/10", text: "text-collect", color: "var(--collect)" },
  keep: { label: "Keep it", tone: "bg-keep/10", text: "text-keep", color: "var(--keep)" },
  return: { label: "Return it", tone: "bg-return/10", text: "text-return", color: "var(--return)" },
  mixed: { label: "Mixed", tone: "bg-mixed/10", text: "text-mixed", color: "var(--mixed)" },
  stop: { label: "Stop using", tone: "bg-return/10", text: "text-return", color: "var(--return)" },
  inconclusive: { label: "Not enough data", tone: "bg-mixed/10", text: "text-mixed", color: "var(--mixed)" },
  "window-closed": { label: "Window closed", tone: "bg-line", text: "text-muted", color: "var(--subtle)" },
};

export function StatusPill({ status, className = "" }: { status: VerdictStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${s.tone} ${s.text} ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/** Brand mark: a ring closing on a point (the verdict, before the deadline). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--foreground)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--background)" strokeOpacity=".25" strokeWidth="2.6" />
      <path d="M16 7.5a8.5 8.5 0 1 1-8.1 11" fill="none" stroke="#f3a48c" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="#f3a48c" />
    </svg>
  );
}

/** Product swatch: a soft luminous gradient, no third-party imagery. */
export function Swatch({ hue, size = 44 }: { hue: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-2xl border border-black/5"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 90% 96%), hsl(${hue} 55% 82%) 55%, hsl(${hue} 40% 66%))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.7), 0 6px 14px -8px hsl(${hue} 40% 40% / .6)`,
      }}
    />
  );
}

/**
 * Return-window ring: how much of the window has elapsed, coloured by verdict.
 * The centre carries the number that matters: days left to return.
 */
export function VerdictRing({
  status,
  elapsedDays,
  windowDays,
  daysLeft,
  size = 148,
}: {
  status: VerdictStatus;
  elapsedDays: number;
  windowDays: number;
  daysLeft: number;
  size?: number;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, elapsedDays / windowDays));
  const color = STATUS_STYLE[status].color;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${daysLeft} days left in a ${windowDays}-day return window`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          style={{ transition: "stroke-dasharray .5s cubic-bezier(.2,.8,.2,1), stroke .3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums" style={{ fontSize: size * 0.23 }}>
          {Math.max(0, daysLeft)}
        </span>
        <span className="mt-1 text-[11px] font-medium text-muted">days to return</span>
      </div>
    </div>
  );
}

/** Purchase -> decision -> deadline, with "today". */
export function WindowBar({ product, today, decisionDate }: { product: Product; today: IsoDay; decisionDate: IsoDay }) {
  const w = product.returnWindowDays;
  const t = Math.max(0, Math.min(w, daysBetween(product.purchasedOn, today)));
  const d = daysBetween(product.purchasedOn, decisionDate);
  const promise = product.promisedDays;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/80" style={{ width: `${(t / w) * 100}%`, transition: "width .3s" }} />
        <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground" style={{ left: `${(d / w) * 100}%` }} title="Verdict due" />
        {promise != null && promise <= w && (
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-accent" style={{ left: `${(promise / w) * 100}%` }} title="Brand's promised result" />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted tabular-nums">
        <span>Bought {fmtDay(product.purchasedOn)}</span>
        <span>Verdict {fmtDay(decisionDate)}</span>
        <span>Return by {fmtDay(addDays(product.purchasedOn, w))}</span>
      </div>
    </div>
  );
}

export function fmtDay(day: IsoDay): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Timeline of one concern on raw_score: comparable photos (filled), photos set
 * aside by the quality gate (hollow), fitted trend, verdict date and deadline.
 */
export function TimelineChart({
  product,
  captures,
  action,
  asOf,
  trend,
  decisionDate,
}: {
  product: Product;
  captures: Capture[];
  action: SdAction;
  asOf: IsoDay;
  trend?: Trend;
  decisionDate: IsoDay;
}) {
  const W = 320;
  const H = 120;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 20;
  const win = product.returnWindowDays;
  const all = captures.filter((c) => c.scores[action] != null);
  const values = all.map((c) => c.scores[action]!.raw);
  const lo = Math.floor(Math.min(...values, 60) - 4);
  const hi = Math.ceil(Math.max(...values, 70) + 4);
  const x = (day: number) => padL + (day / win) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const seen = all.filter((c) => daysBetween(c.takenOn, asOf) >= 0);
  const firstGood = seen.find((c) => checkCapture(c.quality).ok);
  const pts = seen.map((c) => {
    const q = checkCapture(c.quality, firstGood?.quality);
    return { day: daysBetween(product.purchasedOn, c.takenOn), v: c.scores[action]!.raw, ok: q.comparable };
  });
  const good = pts.filter((p) => p.ok);
  let fit: string | null = null;
  if (good.length >= 2 && trend && trend.direction !== "insufficient") {
    const mx = good.reduce((s, p) => s + p.day, 0) / good.length;
    const my = good.reduce((s, p) => s + p.v, 0) / good.length;
    const a = good[0].day;
    const b = good[good.length - 1].day;
    fit = `M${x(a).toFixed(1)},${y(my + trend.slope * (a - mx)).toFixed(1)} L${x(b).toFixed(1)},${y(my + trend.slope * (b - mx)).toFixed(1)}`;
  }
  const color =
    trend?.direction === "improving" ? "var(--keep)" : trend?.direction === "worsening" ? "var(--return)" : "var(--muted)";
  const today = Math.max(0, Math.min(win, daysBetween(product.purchasedOn, asOf)));
  const dd = daysBetween(product.purchasedOn, decisionDate);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${concernDef(action).label} raw score over the return window`}>
      <rect x={x(dd)} y={padT - 6} width={x(win) - x(dd)} height={H - padT - padB + 6} fill="var(--line)" opacity=".45" rx="4" />
      {[0, 0.5, 1].map((k) => (
        <line key={k} x1={padL} x2={W - padR} y1={padT + k * (H - padT - padB)} y2={padT + k * (H - padT - padB)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <line x1={x(today)} x2={x(today)} y1={padT - 8} y2={H - padB} stroke="var(--accent)" strokeWidth="1.5" />
      {fit && <path d={fit} stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity=".9" />}
      {pts.map((p) =>
        p.ok ? (
          <circle key={p.day} cx={x(p.day)} cy={y(p.v)} r="3.6" fill="var(--surface)" stroke={color} strokeWidth="2" />
        ) : (
          <g key={p.day}>
            <circle cx={x(p.day)} cy={y(p.v)} r="3.6" fill="none" stroke="var(--subtle)" strokeWidth="1.5" strokeDasharray="2 2" />
            <title>Set aside: lighting differed</title>
          </g>
        ),
      )}
      <text x={padL} y={H - 5} fontSize="9" fill="var(--muted)">
        Day 0
      </text>
      <text x={W - padR - 3} y={padT + 4} fontSize="9" fill="var(--muted)" textAnchor="end">
        verdict zone
      </text>
      <text x={W - padR} y={H - 5} fontSize="9" fill="var(--muted)" textAnchor="end">
        Day {win}
      </text>
    </svg>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside}
    </div>
  );
}

export function PageHeader({ back, title, right }: { back?: { href: string; label: string }; title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex min-h-10 items-center justify-between gap-3">
      {back ? (
        <Link href={back.href} className="-ml-2 rounded-full px-2 py-1 text-sm font-medium text-muted hover:text-foreground">
          ← {back.label}
        </Link>
      ) : (
        <Link href="/" className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight lg:invisible" aria-label="Verdict home">
          <Logo />
          Verdict
        </Link>
      )}
      {title}
      {right ?? <SyntheticBadge />}
    </header>
  );
}

export function PrimaryLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-semibold text-background shadow-[0_10px_24px_-12px_rgba(18,19,22,.6)] transition active:scale-[.98] ${className}`}
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-[15px] font-semibold transition hover:border-foreground/25 active:scale-[.98] ${className}`}
    >
      {children}
    </Link>
  );
}
