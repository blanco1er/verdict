import { addDays, daysBetween, formatDay, type IsoDay } from "../tracking/model";
import { computeVerdict, type VerdictStatus } from "../tracking/verdict";
import { replay, type DemoItem } from "./shelf";

/**
 * One source of truth for every number and date a screen shows about a verdict.
 * Today, the product page (at any replay day), the shelf and the printable proof
 * all read this object, so a judge never sees two versions of the same fact.
 */
export interface VerdictSummary {
  status: VerdictStatus;
  headline: string;
  /** Day of the return window that `asOf` falls on (0 = purchase day). */
  day: number;
  purchasedOn: IsoDay;
  deadline: IsoDay;
  /** Latest date the verdict is scheduled (deadline − 2 days). */
  dueOn: IsoDay;
  daysToDeadline: number;
  /** Comparable photos available on `asOf`. */
  comparableSoFar: number;
  /** All photos taken up to `asOf`. */
  photosSoFar: number;
  /** When the verdict became final, if it already has on `asOf`. Fixed once reached. */
  decided: null | {
    day: number;
    on: IsoDay;
    daysBeforeDeadline: number;
    /** Comparable photos the decision was based on (counted on the decision day). */
    fromPhotos: number;
  };
}

export function verdictSummary(item: DemoItem, asOf: IsoDay): VerdictSummary {
  const { product, captures } = item;
  const v = computeVerdict(product, captures, asOf);
  const day = daysBetween(product.purchasedOn, asOf);
  const first = replay(item, asOf).find((f) => f.status !== "collecting" && f.day <= day);
  return {
    status: v.status,
    headline: v.headline,
    day,
    purchasedOn: product.purchasedOn,
    deadline: v.deadline,
    dueOn: v.decisionDate,
    daysToDeadline: v.daysToDeadline,
    comparableSoFar: v.usableCaptures,
    photosSoFar: captures.filter((c) => daysBetween(c.takenOn, asOf) >= 0).length,
    decided: first
      ? {
          day: first.day,
          on: addDays(product.purchasedOn, first.day),
          daysBeforeDeadline: daysBetween(first.date, v.deadline),
          fromPhotos: first.verdict.usableCaptures,
        }
      : null,
  };
}

const n = (k: number, one: string) => `${k} ${k === 1 ? one : `${one}s`}`;

/** The decision sentence, split so the UI can bold the middle part. Same words on every screen. */
export function decidedSentence(s: VerdictSummary): { lead: string; strong: string; tail: string } | null {
  if (!s.decided) return null;
  return {
    lead: `Decided on day ${s.decided.day} (${formatDay(s.decided.on)}), `,
    strong: `${n(s.decided.daysBeforeDeadline, "day")} before the return deadline`,
    tail: `, from ${n(s.decided.fromPhotos, "comparable photo")}.`,
  };
}

/** Label under the return-window track: the real decision date once known, else the scheduled one. */
export function trackVerdictLabel(s: VerdictSummary): { label: string; date: string; day: number } {
  return s.decided
    ? { label: "Decided", date: formatDay(s.decided.on), day: s.decided.day }
    : { label: "Verdict due", date: formatDay(s.dueOn), day: daysBetween(s.purchasedOn, s.dueOn) };
}
