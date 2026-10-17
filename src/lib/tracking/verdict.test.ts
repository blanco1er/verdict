import { describe, expect, it } from "vitest";
import { DEMO_AS_OF, DEMO_CAPTURES, DEMO_PRODUCT } from "../demo/fixture";
import { addDays, type Capture, type Product } from "./model";
import { computeVerdict } from "./verdict";

const product: Product = {
  id: "p",
  name: "Serum",
  claim: "reduces redness",
  purchasedOn: "2026-10-01",
  returnWindowDays: 30, // deadline 10-31, decision 10-29
  concerns: ["redness", "pore"],
  promisedDays: 14,
};
const q = { faceWidthRatio: 0.7, brightness: 0.55, yawDeg: 0, shortSidePx: 1080 };

function series(redness: number[], pore: number[], start = "2026-10-02", step = 2): Capture[] {
  return redness.map((r, i) => ({
    id: `c${i}`,
    productId: "p",
    takenOn: addDays(start, i * step),
    quality: q,
    scores: { redness: { raw: r, ui: 0 }, pore: { raw: pore[i], ui: 0 } },
  }));
}

describe("verdict before the return deadline", () => {
  it("demo: collecting, redness improving, pores flat, dark photo set aside", () => {
    const v = computeVerdict(DEMO_PRODUCT, DEMO_CAPTURES, DEMO_AS_OF);
    expect(v.status).toBe("collecting");
    expect(v.deadline).toBe("2026-11-14");
    expect(v.decisionDate).toBe("2026-11-12");
    expect(v.trends.redness?.direction).toBe("improving");
    expect(v.trends.pore?.direction).toBe("flat");
    expect(v.usableCaptures).toBe(6);
    expect(v.reasons[0]).toMatch(/1 photo/);
    expect(v.nextCaptureOn).toBe("2026-10-31");
  });

  it("keeps early when every target concern improves", () => {
    const v = computeVerdict(product, series([60, 62, 64, 66, 68], [60, 62, 64, 66, 68]), "2026-10-12");
    expect(v.status).toBe("keep");
  });

  it("says return at the decision date when nothing moved", () => {
    const v = computeVerdict(product, series([60, 61, 60, 59, 60, 61], [70, 69, 70, 71, 70, 70]), "2026-10-29");
    expect(v.status).toBe("return");
    expect(v.headline).toMatch(/Return it before 2026-10-31/);
  });

  it("reports mixed results at the decision date", () => {
    const v = computeVerdict(product, series([60, 62, 64, 66, 68, 70], [70, 69, 70, 71, 70, 70]), "2026-10-29");
    expect(v.status).toBe("mixed");
  });

  it("stops early on worsening redness (irritation signal)", () => {
    const v = computeVerdict(product, series([70, 67, 65, 62, 60], [70, 70, 70, 70, 70]), "2026-10-12");
    expect(v.status).toBe("stop");
  });

  it("is inconclusive without enough comparable photos", () => {
    const v = computeVerdict(product, series([60, 61], [70, 70]), "2026-10-29");
    expect(v.status).toBe("inconclusive");
  });

  it("switches to daily photos in the last 4 days before the decision", () => {
    const v = computeVerdict(product, series([60, 61, 60], [70, 70, 70], "2026-10-20"), "2026-10-26");
    expect(v.status).toBe("collecting");
    expect(v.nextCaptureOn).toBe("2026-10-26");
  });

  it("closes after the deadline and flags promises longer than the window", () => {
    const long = { ...product, promisedDays: 84 };
    const v = computeVerdict(long, series([60, 61, 62], [70, 70, 70]), "2026-11-02");
    expect(v.status).toBe("window-closed");
    expect(v.promiseExceedsWindow).toBe(true);
  });
});
