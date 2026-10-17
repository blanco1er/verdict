/**
 * Trend of one concern over time, on raw_score (1..100, higher = better).
 *
 * Why raw and not ui: the docs say ui_score is adjusted upwards "as a
 * psychological motivator"; a calibrated curve can hide small changes, so we
 * show ui_score but decide on raw_score.
 *
 * Why a regression and not "last minus first": single captures are noisy
 * (light, angle, time of day). A least-squares slope over all comparable
 * captures, with a noise floor, avoids verdicts driven by one bad photo.
 */
export type TrendDirection = "improving" | "worsening" | "flat" | "insufficient";

export interface TrendPoint {
  day: number; // days since the first point
  value: number;
}

export interface Trend {
  direction: TrendDirection;
  /** Points per day. */
  slope: number;
  /** Fitted change across the observed span, in raw points. */
  change: number;
  /** slope / standard error (signal-to-noise). */
  t: number;
  n: number;
  spanDays: number;
}

export interface TrendOptions {
  /** Test-retest noise of one capture, raw points. TO CALIBRATE (TECH.md). */
  noiseSigma?: number;
  /** Smallest change worth calling an effect, raw points. TO CALIBRATE. */
  minEffect?: number;
  minPoints?: number;
  minSpanDays?: number;
}

export const TREND_DEFAULTS: Required<TrendOptions> = {
  noiseSigma: 3,
  minEffect: 3,
  minPoints: 3,
  minSpanDays: 4,
};

export function computeTrend(points: TrendPoint[], options: TrendOptions = {}): Trend {
  const o = { ...TREND_DEFAULTS, ...options };
  const n = points.length;
  const spanDays = n > 0 ? Math.max(...points.map((p) => p.day)) - Math.min(...points.map((p) => p.day)) : 0;
  if (n < o.minPoints || spanDays < o.minSpanDays) {
    return { direction: "insufficient", slope: 0, change: 0, t: 0, n, spanDays };
  }
  const mx = points.reduce((s, p) => s + p.day, 0) / n;
  const my = points.reduce((s, p) => s + p.value, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.day - mx) ** 2;
    sxy += (p.day - mx) * (p.value - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (const p of points) sse += (p.value - (intercept + slope * p.day)) ** 2;
  const residual = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  // Never trust a fit tighter than the known measurement noise.
  const sigma = Math.max(residual, o.noiseSigma);
  const se = sigma / Math.sqrt(sxx);
  const t = slope / se;
  const change = slope * spanDays;

  let direction: TrendDirection = "flat";
  if (change >= o.minEffect && t >= 2) direction = "improving";
  else if (change <= -o.minEffect && t <= -2) direction = "worsening";

  return { direction, slope, change, t, n, spanDays };
}
