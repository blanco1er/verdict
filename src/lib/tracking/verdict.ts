import type { SdAction } from "../youcam/types";
import { concernDef } from "./concerns";
import { addDays, daysBetween, type Capture, type IsoDay, type Product } from "./model";
import { checkCapture } from "./quality";
import { computeTrend, type Trend, type TrendOptions } from "./trend";

export type VerdictStatus =
  | "collecting" // keep taking photos, verdict not due yet
  | "keep" // target concerns measurably improving
  | "return" // no measurable effect by the decision date
  | "mixed" // some better, some not: user decides, alternatives offered
  | "stop" // an irritation-type concern is getting worse
  | "inconclusive" // decision date reached without enough comparable photos
  | "window-closed"; // return deadline passed

export interface VerdictOptions extends TrendOptions {
  /** Decide this many days before the deadline (time to ship it back). */
  decisionBufferDays?: number;
  /** Photo cadence before the final stretch. */
  captureEveryDays?: number;
}

export interface Verdict {
  status: VerdictStatus;
  headline: string;
  reasons: string[];
  deadline: IsoDay;
  decisionDate: IsoDay;
  daysToDeadline: number;
  trends: Partial<Record<SdAction, Trend>>;
  usableCaptures: number;
  nextCaptureOn: IsoDay | null;
  promiseExceedsWindow: boolean;
}

export function computeVerdict(
  product: Product,
  captures: Capture[],
  asOf: IsoDay,
  options: VerdictOptions = {},
): Verdict {
  const buffer = options.decisionBufferDays ?? 2;
  const cadence = options.captureEveryDays ?? 2;
  const deadline = addDays(product.purchasedOn, product.returnWindowDays);
  const decisionDate = addDays(deadline, -buffer);
  const daysToDeadline = daysBetween(asOf, deadline);
  const reasons: string[] = [];

  // 1. Only well-shot captures, compared against the first good one.
  const mine = captures
    .filter((c) => c.productId === product.id && daysBetween(c.takenOn, asOf) >= 0)
    .sort((a, b) => daysBetween(b.takenOn, a.takenOn));
  const ok = mine.filter((c) => checkCapture(c.quality).ok);
  const baseline = ok[0];
  const usable = ok.filter((c) => checkCapture(c.quality, baseline?.quality).comparable);
  const skipped = mine.length - usable.length;
  if (skipped > 0) reasons.push(`${skipped} photo${skipped === 1 ? "" : "s"} set aside: light, framing or angle differed from day 0.`);

  // 2. One trend per tracked concern.
  const trends: Partial<Record<SdAction, Trend>> = {};
  for (const action of product.concerns) {
    const points = usable
      .filter((c) => c.scores[action] != null)
      .map((c) => ({ day: daysBetween(baseline!.takenOn, c.takenOn), value: c.scores[action]!.raw }));
    trends[action] = computeTrend(points, options);
  }
  const list = product.concerns.map((a) => ({ action: a, trend: trends[a]! }));
  const improving = list.filter((x) => x.trend.direction === "improving");
  const worsening = list.filter((x) => x.trend.direction === "worsening");
  const insufficient = list.filter((x) => x.trend.direction === "insufficient");

  const promiseExceedsWindow = product.promisedDays != null && product.promisedDays > product.returnWindowDays;
  if (promiseExceedsWindow) {
    reasons.push(
      `The brand promises results in ${product.promisedDays} days, longer than the ${product.returnWindowDays}-day return window: we judge the early trend.`,
    );
  }

  const names = (xs: typeof list) => xs.map((x) => concernDef(x.action).label.toLowerCase()).join(", ");
  const base = { deadline, decisionDate, daysToDeadline, trends, usableCaptures: usable.length, promiseExceedsWindow };
  const done = (status: VerdictStatus, headline: string, nextCaptureOn: IsoDay | null = null): Verdict => ({
    ...base,
    status,
    headline,
    reasons,
    nextCaptureOn,
  });

  if (daysToDeadline < 0) {
    return done("window-closed", "The return window has closed.");
  }

  // 3. Irritation beats everything (cosmetic guidance, not medical advice).
  const irritation = worsening.filter((x) => concernDef(x.action).irritationSignal);
  if (irritation.length > 0) {
    reasons.push("Cosmetic guidance only. See a professional if irritation persists.");
    return done("stop", `Your ${names(irritation)} is getting worse. Consider stopping and returning it.`);
  }

  // 4. Clear improvement on every target: verdict can come early.
  if (improving.length === list.length && list.length > 0) {
    return done("keep", `It's working: ${names(improving)} measurably improved.`);
  }

  // 5. Before the decision date: keep measuring.
  if (daysBetween(asOf, decisionDate) > 0) {
    const last = usable.at(-1)?.takenOn ?? product.purchasedOn;
    const step = daysBetween(asOf, decisionDate) <= 4 ? 1 : cadence;
    let next = addDays(last, step);
    if (daysBetween(next, asOf) > 0) next = asOf;
    if (daysBetween(decisionDate, next) > 0) next = decisionDate;
    const left = daysBetween(asOf, decisionDate);
    return done("collecting", `Verdict in ${left} day${left === 1 ? "" : "s"}. Keep your photo streak.`, next);
  }

  // 6. Decision date reached.
  if (insufficient.length * 2 > list.length) {
    reasons.push("Too few comparable photos to measure a change.");
    return done("inconclusive", "Not enough comparable photos to judge. Returning is the safe call.");
  }
  if (improving.length === 0) {
    return done("return", `No measurable change in ${names(list)}. Return it before ${deadline}.`);
  }
  return done("mixed", `Mixed: ${names(improving)} improved, ${names(list.filter((x) => x.trend.direction !== "improving"))} did not.`);
}
