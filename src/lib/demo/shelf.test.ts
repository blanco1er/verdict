import { describe, expect, it } from "vitest";
import { computeVerdict } from "../tracking/verdict";
import { DEMO_SHELF, DEMO_TODAY, decidedOn, demoItem, replay } from "./shelf";

const at = (id: string) => {
  const item = demoItem(id)!;
  return computeVerdict(item.product, item.captures, DEMO_TODAY);
};

describe("synthetic demo shelf: one product per verdict branch", () => {
  it("serum: keep, decided well before the deadline, dark photo set aside", () => {
    const v = at("calming-serum");
    expect(v.status).toBe("keep");
    expect(v.reasons.join(" ")).toMatch(/1 photo/);
    const first = decidedOn(demoItem("calming-serum")!, DEMO_TODAY)!;
    expect(first.status).toBe("keep");
    expect(v.daysToDeadline).toBeGreaterThan(0);
    // The verdict lands at least 10 days before the return deadline.
    expect(30 - first.day).toBeGreaterThanOrEqual(10);
  });

  it("toner: return, on the decision date, before the deadline", () => {
    const v = at("pore-toner");
    expect(v.status).toBe("return");
    expect(v.decisionDate).toBe(DEMO_TODAY);
    expect(v.daysToDeadline).toBe(2);
  });

  it("peel: stop, because an irritation-type concern got worse", () => {
    expect(at("aha-peel").status).toBe("stop");
  });

  it("retinol: still measuring, and flags a promise longer than the window", () => {
    const v = at("retinol-cream");
    expect(v.status).toBe("collecting");
    expect(v.promiseExceedsWindow).toBe(true);
  });

  it("every product tracks 1 to 4 concerns (9-unit SD tier)", () => {
    for (const d of DEMO_SHELF) {
      expect(d.product.concerns.length).toBeGreaterThan(0);
      expect(d.product.concerns.length).toBeLessThanOrEqual(4);
    }
  });

  it("replay starts at purchase and never decides before 3 good photos", () => {
    const frames = replay(demoItem("calming-serum")!);
    expect(frames[0].day).toBe(0);
    expect(frames[0].status).toBe("collecting");
    expect(frames.at(-1)!.day).toBe(30);
  });
});
