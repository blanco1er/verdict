import { readClaim } from "../tracking/concerns";
import { addDays, daysBetween, type Capture, type CaptureQuality, type IsoDay, type Product } from "../tracking/model";
import { computeVerdict, type Verdict, type VerdictStatus } from "../tracking/verdict";
import type { SdAction } from "../youcam/types";
import { mockUiScore } from "../youcam/mock";

/**
 * SYNTHETIC demo shelf, labelled "Synthetic data" everywhere it is shown.
 * Four products, four outcomes (keep, return, stop, still measuring), so a
 * judge sees every branch of the verdict engine in one screen. Scores follow
 * the documented Skin Analysis shape (raw_score / ui_score, higher = better);
 * they are generated, not measured. Replaced by the owner's real series later.
 */
export const DEMO_TODAY: IsoDay = "2026-11-05";

export interface DemoItem {
  product: Product;
  captures: Capture[];
  retailer: string;
  price: string;
  /** One-line story for the shelf. */
  story: string;
  /** Hue used for the product swatch (no third-party imagery). */
  hue: number;
}

const BASE_QUALITY: CaptureQuality = { faceWidthRatio: 0.68, brightness: 0.58, yawDeg: 2, shortSidePx: 1080 };

// Deterministic jitter (test-retest noise of a few raw points), no Math.random().
const JITTER = [0.6, -1.1, 0.9, -0.4, 1.3, -0.8, 0.2, -1.4, 1.0, -0.2, 0.7, -0.9, 0.4, -0.6, 1.1];

interface SeriesSpec {
  id: string;
  name: string;
  brand: string;
  claim: string;
  purchasedOn: IsoDay;
  returnWindowDays: number;
  /** Days since purchase on which a photo was taken. */
  days: number[];
  /** raw_score model per concern: start + slope * day + jitter. */
  model: Partial<Record<SdAction, { start: number; slope: number }>>;
  /** Days whose photo was badly lit (set aside by the quality gate). */
  darkDays?: number[];
  retailer: string;
  price: string;
  story: string;
  hue: number;
}

function build(spec: SeriesSpec): DemoItem {
  const reading = readClaim(spec.claim);
  const product: Product = {
    id: spec.id,
    name: spec.name,
    brand: spec.brand,
    claim: spec.claim,
    purchasedOn: spec.purchasedOn,
    returnWindowDays: spec.returnWindowDays,
    concerns: reading.concerns,
    promisedDays: reading.promisedDays,
  };
  const captures: Capture[] = spec.days.map((day, i) => {
    const dark = spec.darkDays?.includes(day) ?? false;
    const scores: Capture["scores"] = {};
    for (const action of product.concerns) {
      const m = spec.model[action] ?? { start: 62, slope: 0 };
      // A dark photo reads lower: exactly the artefact the quality gate exists for.
      const raw = Math.round((m.start + m.slope * day + JITTER[(i + action.length) % JITTER.length] - (dark ? 7 : 0)) * 100) / 100;
      scores[action] = { raw, ui: mockUiScore(raw) };
    }
    return {
      id: `${spec.id}-d${day}`,
      productId: spec.id,
      takenOn: addDays(spec.purchasedOn, day),
      quality: { ...BASE_QUALITY, brightness: dark ? 0.28 : BASE_QUALITY.brightness + ((i % 3) - 1) * 0.02 },
      scores,
      taskId: `mocktask_skin-analysis_${spec.id}_${day}`,
    };
  });
  return { product, captures, retailer: spec.retailer, price: spec.price, story: spec.story, hue: spec.hue };
}

const every = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const DEMO_SHELF: DemoItem[] = [
  build({
    id: "calming-serum",
    name: "Calming Serum",
    brand: "Sample brand",
    claim: "Calming serum that visibly reduces redness and refines pores in 14 days.",
    purchasedOn: "2026-10-20",
    returnWindowDays: 30,
    days: every(1, 15, 2),
    model: { redness: { start: 57, slope: 0.95 }, pore: { start: 65, slope: 0.6 } },
    darkDays: [7],
    retailer: "Online store",
    price: "$38",
    story: "Both promised concerns improved: verdict landed 17 days before the deadline.",
    hue: 36,
  }),
  build({
    id: "pore-toner",
    name: "Pore Refining Toner",
    brand: "Sample brand",
    claim: "Minimizes pores and smooths texture in 2 weeks.",
    purchasedOn: "2026-10-08",
    returnWindowDays: 30,
    days: [...every(1, 23, 2), 24, 25, 26, 27, 28],
    model: { pore: { start: 64, slope: 0.02 }, texture: { start: 59, slope: -0.03 } },
    retailer: "Beauty retailer",
    price: "$24",
    story: "28 days, no measurable change: return it before the window closes.",
    hue: 200,
  }),
  build({
    id: "aha-peel",
    name: "Glow AHA Peel",
    brand: "Sample brand",
    claim: "Gentle peel that brightens dull skin and calms redness in 7 days.",
    purchasedOn: "2026-10-22",
    returnWindowDays: 30,
    days: every(1, 13, 2),
    model: { radiance: { start: 61, slope: 0.3 }, redness: { start: 72, slope: -1.1 } },
    retailer: "Online store",
    price: "$29",
    story: "Redness is getting worse: stop now, cosmetic guidance only.",
    hue: 16,
  }),
  build({
    id: "retinol-cream",
    name: "Retinol Night Cream",
    brand: "Sample brand",
    claim: "Retinol night cream that visibly reduces fine lines in 12 weeks.",
    purchasedOn: "2026-10-27",
    returnWindowDays: 30,
    days: every(1, 9, 2),
    model: { wrinkle: { start: 63, slope: 0.15 } },
    retailer: "Pharmacy",
    price: "$45",
    story: "The brand promises 12 weeks; the return window is 30 days. Verdict judges the early trend.",
    hue: 40,
  }),
];

export function demoItem(id: string | undefined): DemoItem | undefined {
  return DEMO_SHELF.find((d) => d.product.id === id);
}

export interface ReplayFrame {
  day: number;
  date: IsoDay;
  status: VerdictStatus;
  verdict: Verdict;
}

/**
 * Verdict recomputed for every day from purchase to deadline, using only the
 * photos taken up to that day. Drives the "replay the return window" slider.
 */
export function replay(item: DemoItem, until?: IsoDay): ReplayFrame[] {
  const { product, captures } = item;
  const deadline = addDays(product.purchasedOn, product.returnWindowDays);
  const last = until && daysBetween(until, deadline) > 0 ? until : deadline;
  const span = daysBetween(product.purchasedOn, last);
  return Array.from({ length: span + 1 }, (_, day) => {
    const date = addDays(product.purchasedOn, day);
    const verdict = computeVerdict(product, captures, date);
    return { day, date, status: verdict.status, verdict };
  });
}

/** First day the verdict became final (keep / return / stop / mixed / inconclusive). */
export function decidedOn(item: DemoItem, until?: IsoDay): ReplayFrame | undefined {
  return replay(item, until).find((f) => f.status !== "collecting");
}
