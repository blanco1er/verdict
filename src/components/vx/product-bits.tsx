import type { DemoItem } from "@/lib/demo/shelf";
import { daysBetween, type IsoDay } from "@/lib/tracking/model";
import type { VerdictStatus } from "@/lib/tracking/verdict";

export type BottleKind = "dropper" | "jar" | "tube" | "pump";

/** The container a product most likely comes in, read from its name. */
export function bottleKind(name: string): BottleKind {
  const n = name.toLowerCase();
  if (/cream|balm|butter|mask/.test(n)) return "jar";
  if (/toner|cleanser|wash|mist|lotion/.test(n)) return "pump";
  if (/gel|spf|sunscreen/.test(n)) return "tube";
  return "dropper";
}

/** Share of the return window still open: 1 on purchase day, 0 on the deadline. */
export function windowLeft(item: DemoItem, today: IsoDay): number {
  const d = daysBetween(item.product.purchasedOn, today);
  return Math.max(0, Math.min(1, 1 - d / item.product.returnWindowDays));
}

/** One or two words, never a sentence. */
export const WORD: Record<VerdictStatus, string> = {
  collecting: "Measuring",
  keep: "Keep it",
  return: "Return it",
  mixed: "Your call",
  stop: "Stop",
  inconclusive: "Not enough photos",
  "window-closed": "Closed",
};

export function shortDay(day: IsoDay): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
