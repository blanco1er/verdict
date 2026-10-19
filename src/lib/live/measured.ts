import { readClaim } from "../tracking/concerns";
import type { Capture, IsoDay, Product } from "../tracking/model";
import { SD_ACTIONS, type SdAction } from "../youcam/types";
import raw from "./measured.json";

/**
 * REAL measurements: the owner's own photos analysed by YouCam AI Skin
 * Analysis (scripts/live.mjs). Only scores are stored, never the photos.
 * Everything computed here is shown on /measured, labelled as real data,
 * next to the synthetic demo shelf (labelled as such).
 */
export type SessionKind = "repeatability" | "control" | "series";

export interface MeasuredSession {
  id: string;
  kind: SessionKind;
  label?: string;
  takenAt: string;
  analyzedAt: string;
  scores: Partial<Record<SdAction, { raw: number; ui: number }>>;
  all?: number;
  taskId: string;
  latencyMs: number;
  units: number;
  photo: { shortSidePx: number; longSidePx: number; brightness: number | null };
}

export interface Measured {
  schema: number;
  updated: string | null;
  product: { name: string; claim: string; purchasedOn: IsoDay; returnWindowDays: number } | null;
  sessions: MeasuredSession[];
}

export const MEASURED = raw as Measured;

const SD: ReadonlySet<string> = new Set(SD_ACTIONS);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
/** Sample standard deviation (n - 1). */
function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export interface Repeatability {
  concern: SdAction;
  n: number;
  meanRaw: number;
  sdRaw: number;
  minRaw: number;
  maxRaw: number;
  meanUi: number;
  /** Mean ui_score minus mean raw_score: how much the display score flatters. */
  uiGap: number;
}

/** Test-retest noise per concern from photos taken in one session, same light. */
export function repeatability(m: Measured = MEASURED): Repeatability[] {
  const rep = m.sessions.filter((s) => s.kind === "repeatability");
  const concerns = [...new Set(rep.flatMap((s) => Object.keys(s.scores)))].filter((c) => SD.has(c)) as SdAction[];
  return concerns.map((c) => {
    const rs = rep.flatMap((s) => (s.scores[c] ? [s.scores[c]!.raw] : []));
    const us = rep.flatMap((s) => (s.scores[c] ? [s.scores[c]!.ui] : []));
    return {
      concern: c,
      n: rs.length,
      meanRaw: round(mean(rs)),
      sdRaw: round(sd(rs)),
      minRaw: round(Math.min(...rs)),
      maxRaw: round(Math.max(...rs)),
      meanUi: round(mean(us)),
      uiGap: round(mean(us) - mean(rs)),
    };
  });
}

export interface ControlResult {
  concern: SdAction;
  before: number;
  after: number;
  delta: number;
  /** Smallest difference between two single photos that noise alone rarely explains: 2 x sqrt(2) x sd. */
  threshold: number | null;
  detected: boolean | null;
  hours: number;
}

/** Positive control: first vs last "control" photo, compared with the measured noise. */
export function positiveControl(m: Measured = MEASURED): ControlResult[] {
  const ctl = m.sessions.filter((s) => s.kind === "control").sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  if (ctl.length < 2) return [];
  const first = ctl[0];
  const last = ctl[ctl.length - 1];
  const noise = new Map(repeatability(m).filter((r) => r.n >= 3).map((r) => [r.concern, r.sdRaw]));
  const hours = round((Date.parse(last.takenAt) - Date.parse(first.takenAt)) / 3600e3, 1);
  return (Object.keys(first.scores) as SdAction[])
    .filter((c) => last.scores[c])
    .map((c) => {
      const before = first.scores[c]!.raw;
      const after = last.scores[c]!.raw;
      const delta = round(after - before);
      const s = noise.get(c);
      const threshold = s != null ? round(2 * Math.SQRT2 * s) : null;
      return { concern: c, before: round(before), after: round(after), delta, threshold, detected: threshold == null ? null : Math.abs(delta) > threshold, hours };
    });
}

/** The owner's real product and its captures (day 0 = the repeatability photos), for the verdict engine. */
export function realSeries(m: Measured = MEASURED): { product: Product; captures: Capture[] } | null {
  if (!m.product) return null;
  const photos = m.sessions.filter((s) => s.kind === "repeatability" || s.kind === "series").sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  if (photos.length === 0) return null;
  const measured = [...new Set(photos.flatMap((s) => Object.keys(s.scores)))].filter((c) => SD.has(c)) as SdAction[];
  const fromClaim = readClaim(m.product.claim).concerns.filter((c) => measured.includes(c));
  const concerns = (fromClaim.length > 0 ? fromClaim : measured).slice(0, 4);
  const product: Product = {
    id: "real-series",
    name: m.product.name,
    claim: m.product.claim,
    purchasedOn: m.product.purchasedOn,
    returnWindowDays: m.product.returnWindowDays,
    concerns,
    promisedDays: readClaim(m.product.claim).promisedDays,
  };
  const captures: Capture[] = photos.map((s) => ({
    id: s.id,
    productId: product.id,
    takenOn: localDay(s.takenAt),
    // The API itself refuses faces under 60 % of the width (error_src_face_too_small): a scored photo passed it.
    quality: { faceWidthRatio: 0.65, brightness: s.photo.brightness ?? 0.55, yawDeg: 0, shortSidePx: s.photo.shortSidePx || 1080 },
    scores: Object.fromEntries(concerns.filter((c) => s.scores[c]).map((c) => [c, s.scores[c]!])),
    taskId: s.taskId,
  }));
  return { product, captures };
}

/** Paris calendar day of an ISO time (the owner's photos are taken in Paris). */
export function localDay(iso: string): IsoDay {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

export function liveStats(m: Measured = MEASURED) {
  const s = m.sessions;
  const lat = s.map((x) => x.latencyMs).sort((a, b) => a - b);
  return {
    photos: s.length,
    units: s.reduce((t, x) => t + x.units, 0),
    medianLatencyS: lat.length ? round(lat[Math.floor(lat.length / 2)] / 1000, 1) : null,
    first: s.length ? s.map((x) => x.takenAt).sort()[0] : null,
    last: s.length ? s.map((x) => x.takenAt).sort().at(-1)! : null,
  };
}
