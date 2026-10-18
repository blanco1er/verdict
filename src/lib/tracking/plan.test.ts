import { describe, expect, it } from "vitest";
import { claimMatches, newProduct, trackingPlan } from "./plan";

describe("tracking plan from a product claim", () => {
  it("keeps the words that triggered each concern", () => {
    const m = claimMatches("Calming serum that visibly reduces redness and refines pores in 14 days.");
    expect(m.map((x) => x.action)).toEqual(["redness", "pore"]);
    expect(m[0].evidence.toLowerCase()).toBe("calming");
  });

  it("prices the whole window before the first photo", () => {
    const p = trackingPlan("Reduces redness and refines pores in 14 days.", "2026-10-15", 30);
    expect(p.tracked).toEqual(["redness", "pore"]);
    expect(p.unitsPerPhoto).toBe(9);
    expect(p.decisionDate).toBe("2026-11-12");
    // every 2 days until day 24, then daily to day 28: 0,2,...,24 (13) + 25..28 (4)
    expect(p.photos).toBe(17);
    expect(p.totalUnits).toBe(17 * 9);
  });

  it("caps tracking at 4 concerns and lists the rest", () => {
    const p = trackingPlan("Hydrating glow serum for pores, fine lines, redness, dark spots and texture.", "2026-10-01", 30);
    expect(p.tracked).toHaveLength(4);
    expect(p.dropped.length).toBeGreaterThan(0);
  });

  it("flags a promise longer than the return window", () => {
    const p = trackingPlan("Visibly reduces fine lines in 12 weeks.", "2026-10-01", 30);
    expect(p.promiseExceedsWindow).toBe(true);
  });

  it("costs nothing when the claim has nothing measurable", () => {
    const p = trackingPlan("A lovely scent you will adore.", "2026-10-01", 30);
    expect(p.tracked).toHaveLength(0);
    expect(p.totalUnits).toBe(0);
    expect(newProduct({ name: " ", claim: "x", purchasedOn: "2026-10-01", returnWindowDays: 30 }, "u-1").name).toBe("My product");
  });
});
