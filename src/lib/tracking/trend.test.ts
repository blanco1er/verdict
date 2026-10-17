import { describe, expect, it } from "vitest";
import { computeTrend } from "./trend";

const pts = (values: number[], step = 2) => values.map((value, i) => ({ day: i * step, value }));

describe("trend on raw_score", () => {
  it("needs enough points and days", () => {
    expect(computeTrend(pts([60, 70])).direction).toBe("insufficient");
    expect(computeTrend(pts([60, 61, 62], 1)).direction).toBe("insufficient"); // 2-day span
  });

  it("detects a steady improvement above the noise floor", () => {
    const t = computeTrend(pts([60, 61.5, 63, 64, 66, 67.5]));
    expect(t.direction).toBe("improving");
    expect(t.change).toBeGreaterThan(6);
  });

  it("does not call one lucky photo an improvement", () => {
    expect(computeTrend(pts([60, 59, 61, 60, 68])).direction).toBe("flat");
  });

  it("detects worsening", () => {
    expect(computeTrend(pts([70, 68, 66.5, 64, 62.5, 60])).direction).toBe("worsening");
  });

  it("small real changes inside the noise floor stay flat", () => {
    expect(computeTrend(pts([60, 60.4, 60.8, 61.2, 61.6])).direction).toBe("flat");
  });
});
