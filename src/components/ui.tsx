import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, MARK_PATH, ProductGlyph, type IconName } from "@/components/icons";
import type { ReplayFrame } from "@/lib/demo/shelf";
import { addDays, formatDay, type IsoDay, type Product } from "@/lib/tracking/model";
import type { VerdictStatus } from "@/lib/tracking/verdict";

export const STATUS: Record<VerdictStatus, { label: string; word: string }> = {
  collecting: { label: "Measuring", word: "Measuring" },
  keep: { label: "Keep it", word: "Keep it." },
  return: { label: "Return it", word: "Return it." },
  mixed: { label: "Your call", word: "Your call." },
  stop: { label: "Stop using", word: "Stop using it." },
  inconclusive: { label: "Not enough data", word: "Not enough data." },
  "window-closed": { label: "Window closed", word: "Window closed." },
};

/** Status colour for non-text marks (cells, dots). */
export function statusColor(status: VerdictStatus): string {
  switch (status) {
    case "keep":
      return "var(--vd-keep)";
    case "return":
    case "stop":
      return "var(--vd-return)";
    case "mixed":
    case "inconclusive":
      return "var(--vd-mixed)";
    default:
      return "var(--system-gray2)";
  }
}

export function StatusLabel({ status, className = "" }: { status: VerdictStatus; className?: string }) {
  return (
    <span className={`vd-status ${className}`} data-status={status}>
      {STATUS[status].label}
    </span>
  );
}

/** Same formatter as the verdict engine and the summary (lib/tracking/model). */
export const fmtDay = formatDay;

/** "Thursday, November 5": weekday computed, never typed. */
export function fmtLongDay(day: IsoDay): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Large title block (iOS): the title is the view, the line under it is real context. */
export function LargeTitle({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="vd-header">
      <h1 id="vd-large-title" className="ui-large-title">
        {title}
      </h1>
      {children && <div className="vd-header__sub">{children}</div>}
    </header>
  );
}

/**
 * The verdict, as a sentence you can act on. `changed` turns on the verdict-moment
 * animation, only when the status flips during a replay (never on page load).
 */
export function VerdictHero({
  status,
  headline,
  meta,
  product,
  subtitle,
  href,
  compact,
  changed,
  children,
}: {
  status: VerdictStatus;
  headline: string;
  meta?: ReactNode;
  product?: Product;
  subtitle?: string;
  href?: string;
  compact?: boolean;
  changed?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      {product && (
        <div className="vd-verdict__top">
          <div className="vd-verdict__product">
            <ProductGlyph name={product.name} />
            <span className="min-w-0">
              <b>{product.name}</b>
              {subtitle && <small>{subtitle}</small>}
            </span>
          </div>
          {href && <Icon name="chevron" className="ui-icon ui-row__chevron" />}
        </div>
      )}
      <p className="vd-verdict__word" key={`w-${status}`}>
        <span className="vd-mark" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d={MARK_PATH[status]} />
          </svg>
        </span>
        <span>{STATUS[status].word}</span>
      </p>
      <p className="vd-verdict__line" key={`l-${status}`}>
        {headline}
      </p>
      {meta && <p className="vd-verdict__meta">{meta}</p>}
    </>
  );
  const cls = `vd-verdict${compact ? " vd-verdict--compact" : ""}${changed ? " is-changed" : ""}`;
  if (href) {
    return (
      <Link href={href} className={cls} data-status={status} aria-label={`${product?.name ?? "Product"}: ${STATUS[status].label}. ${headline}`}>
        {body}
        {children}
      </Link>
    );
  }
  return (
    <div className={cls} data-status={status} aria-live="polite">
      {body}
      {children}
    </div>
  );
}

/**
 * Return window, one cell per day, coloured by the verdict that day.
 * Purchase on the left, return deadline on the right, decision day marked.
 */
export function WindowTrack({
  product,
  frames,
  day,
  todayDay,
  verdict,
  input,
}: {
  product: Product;
  frames: ReplayFrame[];
  day: number;
  todayDay: number;
  /** From trackVerdictLabel(): the real decision date once known, else the scheduled one. */
  verdict: { label: string; date: string; day: number };
  input?: ReactNode;
}) {
  const w = product.returnWindowDays;
  const decisionDay = verdict.day;
  const cells = Array.from({ length: w + 1 }, (_, d) => frames[d] ?? null);
  return (
    <div className="vd-track">
      <div className="vd-track__cells" style={{ gridTemplateColumns: `repeat(${w + 1}, minmax(0, 1fr))` }} aria-hidden>
        {cells.map((f, d) => {
          const past = f != null && d <= todayDay;
          const cls = [
            "vd-track__cell",
            past ? "is-past" : "",
            past && d > day ? "is-dim" : "",
            d === day ? "is-current" : "",
            d === decisionDay ? "is-decision" : "",
          ].join(" ");
          return <span key={d} className={cls} style={{ "--_cc": f ? statusColor(f.status) : undefined } as CSSProperties} />;
        })}
      </div>
      {input}
      <div className="vd-track__legend">
        <span>
          Bought <b>{fmtDay(product.purchasedOn)}</b>
        </span>
        <span>
          {verdict.label} <b>{verdict.date}</b>
        </span>
        <span>
          Return by <b>{fmtDay(addDays(product.purchasedOn, w))}</b>
        </span>
      </div>
    </div>
  );
}

/** A tappable inset-grouped row. */
export function Row({
  href,
  onClick,
  icon,
  title,
  subtitle,
  detail,
  tone,
  chevron = true,
}: {
  href?: string;
  onClick?: () => void;
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  tone?: "accent" | "destructive";
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon && (
        <span className="ui-row__icon">
          <Icon name={icon} />
        </span>
      )}
      <span className="ui-row__body">
        <span className="ui-row__title">{title}</span>
        {subtitle && <span className="ui-row__subtitle">{subtitle}</span>}
      </span>
      {detail && <span className="vd-row-trailing">{detail}</span>}
      {chevron && (href || onClick) && <Icon name="chevron" className="ui-icon ui-row__chevron" />}
    </>
  );
  const cls = `ui-row${tone === "destructive" ? " vd-row-destructive" : tone === "accent" ? " vd-row-accent" : ""}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
