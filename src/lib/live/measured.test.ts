import { describe, expect, it } from "vitest";
import { computeVerdict } from "../tracking/verdict";
import { liveStats, localDay, positiveControl, realSeries, repeatability, type Measured, type MeasuredSession } from "./measured";

const s = (kind: MeasuredSession["kind"], takenAt: string, scores: Record<string, number>): MeasuredSession => ({
  id: `${kind}-${takenAt}`,
  kind,
  takenAt,
  analyzedAt: takenAt,
  scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { raw: v, ui: Math.round(v + 12) }])),
  taskId: "t",
  latencyMs: 8000,
  units: 9,
  photo: { shortSidePx: 1200, longSidePx: 1600, brightness: 0.6 },
});

const M: Measured = {
  schema: 1,
  updated: "2026-10-21T08:00:00Z",
  product: { name: "Daily moisturizer", claim: "Reduces redness and oiliness in 4 weeks.", purchasedOn: "2026-10-18", returnWindowDays: 30 },
  sessions: [
    s("repeatability", "2026-10-20T07:00:00Z", { redness: 60, oiliness: 70 }),
    s("repeatability", "2026-10-20T07:01:00Z", { redness: 61, oiliness: 71 }),
    s("repeatability", "2026-10-20T07:02:00Z", { redness: 59, oiliness: 69 }),
    s("repeatability", "2026-10-20T07:03:00Z", { redness: 60, oiliness: 70 }),
    s("control", "2026-10-20T07:05:00Z", { redness: 60, oiliness: 72 }),
    s("control", "2026-10-20T15:05:00Z", { redness: 60.5, oiliness: 61 }),
    s("series", "2026-10-21T07:00:00Z", { redness: 60.2, oiliness: 70.4 }),
  ],
};

describe("real measurements", () => {
  it("computes test-retest noise per concern", () => {
    const r = repeatability(M);
    const red = r.find((x) => x.concern === "redness")!;
    expect(red.n).toBe(4);
    expect(red.meanRaw).toBe(60);
    expect(red.sdRaw).toBeCloseTo(0.82, 2);
    expect(red.uiGap).toBe(12);
  });

  it("calls a change detected only above 2·√2·σ", () => {
    const c = positiveControl(M);
    const oil = c.find((x) => x.concern === "oiliness")!;
    const red = c.find((x) => x.concern === "redness")!;
    expect(oil.delta).toBe(-11);
    expect(oil.detected).toBe(true);
    expect(red.detected).toBe(false);
    expect(oil.hours).toBe(8);
  });

  it("feeds the real series to the verdict engine without inventing a verdict", () => {
    const real = realSeries(M)!;
    expect(real.product.concerns).toEqual(["redness", "oiliness"]);
    expect(real.captures).toHaveLength(5);
    const v = computeVerdict(real.product, real.captures, "2026-10-21");
    expect(v.status).toBe("collecting");
  });

  it("is empty-safe before the first live session", () => {
    const empty: Measured = { schema: 1, updated: null, product: null, sessions: [] };
    expect(repeatability(empty)).toEqual([]);
    expect(positiveControl(empty)).toEqual([]);
    expect(realSeries(empty)).toBeNull();
    expect(liveStats(empty).photos).toBe(0);
  });

  it("dates photos on the Paris calendar", () => {
    expect(localDay("2026-10-20T23:30:00Z")).toBe("2026-10-21");
  });
});
