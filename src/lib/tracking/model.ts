import type { SdAction } from "../youcam/types";

/** ISO date "YYYY-MM-DD" (local day). Kept as strings for easy storage. */
export type IsoDay = string;

export interface Product {
  id: string;
  name: string;
  brand?: string;
  claim: string;
  purchasedOn: IsoDay;
  /** Merchant return window, in days from purchase. */
  returnWindowDays: number;
  /** Concerns chosen by the agent (or the rule fallback), max 4. */
  concerns: SdAction[];
  /** Days the brand says results take, when stated. */
  promisedDays: number | null;
}

export interface CaptureQuality {
  /** Face width / image width (docs require > 0.6). */
  faceWidthRatio: number;
  /** Mean luminance 0..1 measured on-device before upload. */
  brightness: number;
  /** Head yaw in degrees (0 = frontal). */
  yawDeg: number;
  shortSidePx: number;
}

export interface ConcernScore {
  /** Model score 1..100, higher = healthier-looking. Used for trends. */
  raw: number;
  /** Calibrated display score (flattering by design). Shown, never trended. */
  ui: number;
}

export interface Capture {
  id: string;
  productId: string;
  takenOn: IsoDay;
  quality: CaptureQuality;
  scores: Partial<Record<SdAction, ConcernScore>>;
  /** YouCam task id, for audit/export. */
  taskId?: string;
}

const DAY_MS = 86_400_000;

export function dayIndex(day: IsoDay): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function addDays(day: IsoDay, days: number): IsoDay {
  return new Date((dayIndex(day) + days) * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDay, to: IsoDay): number {
  return dayIndex(to) - dayIndex(from);
}
