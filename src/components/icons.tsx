import type { SVGProps } from "react";

/**
 * One icon set, SF Symbols style: 24 grid, 1.7 stroke, round caps (design system §7).
 * No emoji anywhere in the interface.
 */
const PATHS = {
  today: "M3.5 10.6 12 4l8.5 6.6M5.5 9.2V19a1 1 0 0 0 1 1h3.7v-5.2h3.6V20h3.7a1 1 0 0 0 1-1V9.2",
  camera: "M3.5 8.6A1.6 1.6 0 0 1 5.1 7h2.3l1.5-2.2h6.2L16.6 7h2.3a1.6 1.6 0 0 1 1.6 1.6v9.3a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6zM12 16.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z",
  brands: "M4 20V10.5M9.3 20V5m5.4 15v-7.5M20 20v-4.5M2.8 20h18.4",
  plus: "M12 5v14M5 12h14",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z",
  download: "M12 4v11M7.5 10.8 12 15.3l4.5-4.5M5 19.5h14",
  heart: "M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z",
  expand: "M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15",
  products: "M10 3.5h4v3.2l1.6 1.2a2 2 0 0 1 .8 1.6V19a1.5 1.5 0 0 1-1.5 1.5h-5.8A1.5 1.5 0 0 1 7.6 19V9.5a2 2 0 0 1 .8-1.6L10 6.7zM7.6 13h8.8",
  agent: "M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM7.5 10l2.5 2-2.5 2M12 14.5h4.5",
  back: "M14.5 5.5 8 12l6.5 6.5",
  chevron: "m9.5 5.5 6.5 6.5-6.5 6.5",
  share: "M12 3.8v11M8.2 7.4 12 3.6l3.8 3.8M7.5 10.5H6.4a1.4 1.4 0 0 0-1.4 1.4v6.8A1.4 1.4 0 0 0 6.4 20h11.2a1.4 1.4 0 0 0 1.4-1.4v-6.8a1.4 1.4 0 0 0-1.4-1.4h-1.1",
  play: "M8 5.6v12.8a.6.6 0 0 0 .9.5l10.2-6.4a.6.6 0 0 0 0-1L8.9 5.1a.6.6 0 0 0-.9.5z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  check: "m5.5 12.5 4.2 4.2 8.8-9.4",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-3.8-9.2 2.6 2.6 5.2-5.4",
  close: "M6.5 6.5l11 11m0-11-11 11",
  alert: "M12 8v5.2M12 16.3v.2M10.3 4.2 3 17.2A2 2 0 0 0 4.8 20h14.4a2 2 0 0 0 1.8-2.8L13.7 4.2a2 2 0 0 0-3.4 0z",
  uturn: "M9 14 4.5 9.5 9 5M5 9.5h9.5a5 5 0 0 1 0 10H11",
  stop: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.8v5M12 16v.2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13.2V12l2.8 2",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.6M12 16.4v.2",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.2M12 7.8v.2",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.8v1.6M12 19.6v1.6M4.2 12H2.8M21.2 12h-1.4M5.5 5.5l1 1M17.5 17.5l1 1M5.5 18.5l1-1M17.5 6.5l1-1",
  glasses: "M3 13.5a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 0 0-6.4 0zm11.6 0a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 0 0-6.4 0zM9.4 13.2c1.6-1 3.6-1 5.2 0M3 13l1.6-5.2M21 13l-1.6-5.2",
  face: "M12 20.5c3.9 0 6.5-3.6 6.5-8.3S15.9 3.5 12 3.5 5.5 7.5 5.5 12.2s2.6 8.3 6.5 8.3zM9.5 10.6v.6M14.5 10.6v.6M10 15.6c1.2.8 2.8.8 4 0",
  lock: "M7 10.5V8a5 5 0 0 1 10 0v2.5M6.4 10.5h11.2a1.4 1.4 0 0 1 1.4 1.4v6.7a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 18.6v-6.7a1.4 1.4 0 0 1 1.4-1.4z",
  doc: "M7 3.5h6.5L18 8v11.1a1.4 1.4 0 0 1-1.4 1.4H7a1.4 1.4 0 0 1-1.4-1.4V4.9A1.4 1.4 0 0 1 7 3.5zM13.3 3.7V8.2H18M8.8 12.5h6.4M8.8 16h4.2",
  compare: "M12 3.5v17M5.4 5h13.2A1.4 1.4 0 0 1 20 6.4v11.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 17.6V6.4A1.4 1.4 0 0 1 5.4 5zM15 9l2 2-2 2M9 9l-2 2 2 2",
  brush: "M14.5 4.5l5 5-7.3 7.3-5-5zM7.2 11.8l-1.6 1.6c-1.2 1.2-.8 3.4-2.6 5.1 2.3.4 4.6-.1 5.9-1.4l1.6-1.6",
  trash: "M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M6.5 6.5l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3l.9-12.2M10 10.5v5.5M14 10.5v5.5",
  retake: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9",
  arrowUp: "M12 19V5.5M6.5 11 12 5.5l5.5 5.5",
  arrowDown: "M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5",
  minus: "M5 12h14",
  phone: "M8 2.8h8a1.6 1.6 0 0 1 1.6 1.6v15.2a1.6 1.6 0 0 1-1.6 1.6H8a1.6 1.6 0 0 1-1.6-1.6V4.4A1.6 1.6 0 0 1 8 2.8zM10.5 5.2h3",
  tag: "M3.5 12.4V5a1.5 1.5 0 0 1 1.5-1.5h7.4l8.1 8.1a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0zM8 8.2v.2",
  calendar: "M5.4 5h13.2A1.4 1.4 0 0 1 20 6.4v12.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6V6.4A1.4 1.4 0 0 1 5.4 5zM4 9.5h16M8.5 3v3.5M15.5 3v3.5",
  coin: "M12 20.5c4.4 0 8-1.6 8-3.6V7.1M4 7.1v9.8c0 2 3.6 3.6 8 3.6M12 10.7c4.4 0 8-1.6 8-3.6s-3.6-3.6-8-3.6-8 1.6-8 3.6 3.6 3.6 8 3.6zM4 12c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6",
  bolt: "M13 3 5.5 13.2h6L11 21l7.5-10.2h-6z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, filled, ...rest }: { name: IconName; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`ui-icon${filled ? " is-filled" : ""}`} {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Verdict mark glyphs (drawn on the verdict moment). */
export const MARK_PATH: Record<string, string> = {
  keep: "m6 12.6 4 4L18.2 8",
  return: "M9.5 14.5 5.5 10.5l4-4M5.8 10.5h8.2a4.5 4.5 0 0 1 0 9h-3",
  stop: "M12 6.5v7M12 17.3v.2",
  mixed: "M6.5 12h11",
  inconclusive: "M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.6M12 16.8v.2",
  collecting: "M12 6.8V12l3.2 2.2",
  "window-closed": "M7 7l10 10M17 7 7 17",
};

/** Neutral product glyphs (no third-party packshots). */
export type ProductKind = "dropper" | "bottle" | "jar" | "tube";
const GLYPHS: Record<ProductKind, string> = {
  dropper: "M10.5 2.8h3v3.4h-3zM9 6.2h6l.6 2.3H8.4zM8.6 8.5h6.8a1 1 0 0 1 1 1V20a1.2 1.2 0 0 1-1.2 1.2H8.8A1.2 1.2 0 0 1 7.6 20V9.5a1 1 0 0 1 1-1zM7.6 13h8.8",
  bottle: "M10 2.8h4v2.6h-4zM9.4 5.4h5.2l1.8 3.2V20a1.2 1.2 0 0 1-1.2 1.2H8.8A1.2 1.2 0 0 1 7.6 20V8.6zM7.6 11.5h8.8v5.6H7.6",
  jar: "M5.2 7.2h13.6v3H5.2zM6 10.2h12v8.8a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 19zM6 14h12",
  tube: "M7.8 2.8h8.4l-.9 13.4H8.7zM9.6 16.2h4.8v2.6a.8.8 0 0 1-.8.8h-3.2a.8.8 0 0 1-.8-.8zM10.6 19.6h2.8v1.6h-2.8zM8.2 8.2h7.6",
};

export function productKind(name: string): ProductKind {
  const n = name.toLowerCase();
  if (/serum|drops|oil|peel|ampoule|essence/.test(n)) return "dropper";
  if (/toner|lotion|mist|water|cleanser/.test(n)) return "bottle";
  if (/cream|balm|mask|butter/.test(n)) return "jar";
  return "tube";
}

export function ProductGlyph({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  return (
    <span className={`vd-glyph${size === "sm" ? " vd-glyph--sm" : ""}`} aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d={GLYPHS[productKind(name)]} />
      </svg>
    </span>
  );
}

/** Brand mark: a return window (ring) closing on a decision (point). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ flex: "none" }}>
      <rect width="32" height="32" rx="8" fill="var(--label)" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="var(--bg-grouped-secondary)" strokeOpacity=".28" strokeWidth="2.4" />
      <path d="M16 8a8 8 0 1 1-7.6 10.5" fill="none" stroke="var(--bg-grouped-secondary)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.4" fill="var(--bg-grouped-secondary)" />
    </svg>
  );
}
