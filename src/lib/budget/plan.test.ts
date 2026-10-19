import { describe, expect, it } from "vitest";
import { BUDGET_PLAN, HACKATHON_UNITS, plannedUnits, safetyMargin, VisitorQuota } from "./plan";

describe("1,000-unit budget", () => {
  it("fits with a safety margin of at least 20 %", () => {
    expect(plannedUnits()).toBeLessThanOrEqual(HACKATHON_UNITS);
    expect(safetyMargin()).toBeGreaterThanOrEqual(200);
    expect(BUDGET_PLAN.find((l) => l.id === "jury")!.calls).toBeGreaterThanOrEqual(40);
  });

  it("caps visitors per day and stops near the floor", () => {
    const q = new VisitorQuota();
    expect([1, 2, 3, 4].map(() => q.tryConsume("judge-a", "2026-11-05", 500))).toEqual([true, true, true, false]);
    expect(q.tryConsume("judge-b", "2026-11-05", 105)).toBe(false); // would go under the 100-unit floor
    expect(q.tryConsume("judge-a", "2026-11-06", 500)).toBe(true); // new day
  });
});
