import { describe, expect, it } from "vitest";
import { merchantSummary, MERCHANT_ROWS, pct } from "./merchant";
import { DEMO_SHELF, DEMO_TODAY, demoItem } from "./shelf";
import { decidedSentence, trackVerdictLabel, verdictSummary } from "./summary";
import { addDays, daysBetween, formatDay } from "../tracking/model";
import { computeVerdict } from "../tracking/verdict";

const joined = (s: ReturnType<typeof decidedSentence>) => (s ? s.lead + s.strong + s.tail : null);

describe("one verdict, the same facts on every screen", () => {
  it("Calming Serum: decided on day 13 (Nov 2), 17 days before Nov 19, from 6 comparable photos", () => {
    const s = verdictSummary(demoItem("calming-serum")!, DEMO_TODAY);
    expect(s.status).toBe("keep");
    expect(s.decided).toEqual({ day: 13, on: "2026-11-02", daysBeforeDeadline: 17, fromPhotos: 6 });
    expect(s.deadline).toBe("2026-11-19");
    expect(joined(decidedSentence(s))).toBe("Decided on day 13 (Nov 2), 17 days before the return deadline, from 6 comparable photos.");
    // The track label shows the real decision date, never the scheduled due date.
    expect(trackVerdictLabel(s)).toEqual({ label: "Decided", date: "Nov 2", day: 13 });
    // More photos arrived after the decision: "so far" and "decided from" are different facts.
    expect(s.comparableSoFar).toBe(7);
  });

  for (const item of DEMO_SHELF) {
    const id = item.product.id;
    const today = verdictSummary(item, DEMO_TODAY);

    it(`${id}: Today, product page (any replay day after the decision) and proof agree`, () => {
      if (!today.decided) return;
      // Product page cursor on every day from the decision to today: Today screen and proof use DEMO_TODAY.
      for (let d = today.decided.day; d <= today.day; d++) {
        const atCursor = verdictSummary(item, addDays(item.product.purchasedOn, d));
        expect(atCursor.decided).toEqual(today.decided);
        expect(joined(decidedSentence(atCursor))).toBe(joined(decidedSentence(today)));
        expect(trackVerdictLabel(atCursor)).toEqual(trackVerdictLabel(today));
      }
    });

    it(`${id}: every derived date and count matches the raw data`, () => {
      const v = computeVerdict(item.product, item.captures, DEMO_TODAY);
      expect(today.deadline).toBe(addDays(item.product.purchasedOn, item.product.returnWindowDays));
      expect(today.daysToDeadline).toBe(daysBetween(DEMO_TODAY, today.deadline));
      expect(today.comparableSoFar).toBe(v.usableCaptures);
      expect(today.day).toBe(daysBetween(item.product.purchasedOn, DEMO_TODAY));
      if (today.decided) {
        expect(today.decided.on).toBe(addDays(item.product.purchasedOn, today.decided.day));
        expect(today.decided.daysBeforeDeadline).toBe(daysBetween(today.decided.on, today.deadline));
        expect(today.decided.daysBeforeDeadline).toBe(item.product.returnWindowDays - today.decided.day);
        expect(today.decided.fromPhotos).toBe(computeVerdict(item.product, item.captures, today.decided.on).usableCaptures);
        // The day before the decision, the verdict was still being measured.
        expect(computeVerdict(item.product, item.captures, addDays(today.decided.on, -1)).status).toBe("collecting");
      } else {
        expect(trackVerdictLabel(today)).toEqual({ label: "Verdict due", date: formatDay(today.dueOn), day: item.product.returnWindowDays - 2 });
      }
    });

    it(`${id}: the shelf story does not contradict the computed numbers`, () => {
      const numbers = [...item.story.matchAll(/(\d+) days?/g)].map((m) => Number(m[1]));
      for (const k of numbers) {
        const known = [today.decided?.daysBeforeDeadline, today.decided?.day, item.product.returnWindowDays, item.product.promisedDays, today.daysToDeadline];
        expect(known).toContain(k);
      }
    });
  }

  it("Before the decision, the product page shows the scheduled date, labelled as due", () => {
    const item = demoItem("calming-serum")!;
    const s = verdictSummary(item, addDays(item.product.purchasedOn, 8));
    expect(s.decided).toBeNull();
    expect(trackVerdictLabel(s)).toEqual({ label: "Verdict due", date: "Nov 17", day: 28 });
  });
});

describe("Brands screen figures are derived, not typed", () => {
  it("summary sentence, stats band and rows agree", () => {
    const m = merchantSummary();
    expect(m.tracking).toBe(MERCHANT_ROWS.reduce((s, r) => s + r.tracking, 0));
    expect(m.tracking).toBe(479);
    expect(pct(m.improved)).toBe(45);
    expect(pct(m.returned)).toBe(13);
    expect(m.worst.sku).toBe("Pore Refining Toner");
    expect(pct(m.worst.returned)).toBe(24);
    // Weighted median lead: 61+87 customers at 2 days, 203 at 8 days → median 8.
    expect(m.medianLead).toBe(8);
  });
});
