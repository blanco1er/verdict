import { LOOK_VTO_UNITS, skinAnalysisCost, skinSimulationCost } from "../youcam/costs";

/**
 * Plan for the 1,000 free hackathon units (valid 90 days after redeeming).
 * Every paid call is an SD Skin Analysis with <= 4 concerns (9 units) unless
 * stated. Failed tasks cost nothing; free calls (balance, feature cost) are
 * not listed.
 */
const SA = skinAnalysisCost(["redness", "acne", "pore", "texture"]); // 9
const SIM = skinSimulationCost(2); // 4

export interface BudgetLine {
  id: string;
  when: string;
  purpose: string;
  calls: number;
  unitsPerCall: number;
}

export const HACKATHON_UNITS = 1000;

/**
 * Compressed plan (owner rule: submit by Wednesday 21 Oct 2026, evening).
 * The first paid call is also calibration photo 1: nothing is spent on a
 * throw-away smoke test (the key itself is checked with free calls).
 */
export const BUDGET_PLAN: BudgetLine[] = [
  { id: "noise", when: "20-21 Oct", purpose: "Repeatability: 5 photos, same session, same light (first one doubles as the end-to-end check)", calls: 5, unitsPerCall: SA },
  { id: "control", when: "20-21 Oct", purpose: "Positive control: same face hours later, oiliness is expected to move", calls: 2, unitsPerCall: SA },
  { id: "series", when: "20-21 Oct", purpose: "Owner's real series on a real product (day 0 = repeatability median, then days 1 and 2)", calls: 3, unitsPerCall: SA },
  { id: "dev", when: "20-21 Oct", purpose: "Integration and bug fixing with the live API", calls: 6, unitsPerCall: SA },
  { id: "simulation", when: "21 Oct", purpose: "Skin Simulation 'promised result' renders (cached)", calls: 2, unitsPerCall: SIM },
  { id: "look", when: "21 Oct", purpose: "Look VTO alternative renders (cached)", calls: 3, unitsPerCall: LOOK_VTO_UNITS },
  { id: "video", when: "21 Oct", purpose: "Live takes for the demo video", calls: 4, unitsPerCall: SA },
  { id: "jury", when: "22 Oct - 20 Nov", purpose: "Judges testing live (per-visitor quota, real-balance floor)", calls: 60, unitsPerCall: SA },
];

export function plannedUnits(plan: BudgetLine[] = BUDGET_PLAN): number {
  return plan.reduce((sum, l) => sum + l.calls * l.unitsPerCall, 0);
}

export function safetyMargin(plan: BudgetLine[] = BUDGET_PLAN): number {
  return HACKATHON_UNITS - plannedUnits(plan);
}

/** Live-mode guards for public visitors (judges). */
export const VISITOR_LIMITS = {
  analysesPerVisitorPerDay: 3,
  analysesPerDayGlobal: 15,
  /** Below this balance, the app switches to the pre-filled demo only (YOUCAM_UNIT_FLOOR overrides it). */
  hardFloorUnits: 100,
};

/** Per-visitor daily quota, in memory (swap for a DB row in production). */
export class VisitorQuota {
  private perVisitor = new Map<string, number>();
  private global = 0;
  private day = "";

  constructor(private readonly limits: { analysesPerVisitorPerDay: number; analysesPerDayGlobal: number; hardFloorUnits: number } = VISITOR_LIMITS) {}

  private roll(today: string) {
    if (today !== this.day) {
      this.day = today;
      this.perVisitor.clear();
      this.global = 0;
    }
  }

  /** What is left today, without counting anything. */
  leftFor(visitorId: string, today: string): { visitor: number; global: number } {
    this.roll(today);
    return {
      visitor: this.limits.analysesPerVisitorPerDay - (this.perVisitor.get(visitorId) ?? 0),
      global: this.limits.analysesPerDayGlobal - this.global,
    };
  }

  /** Returns true and counts the call if allowed. */
  tryConsume(visitorId: string, today: string, remainingUnits: number): boolean {
    this.roll(today);
    if (remainingUnits - SA < this.limits.hardFloorUnits) return false;
    if (this.global >= this.limits.analysesPerDayGlobal) return false;
    const used = this.perVisitor.get(visitorId) ?? 0;
    if (used >= this.limits.analysesPerVisitorPerDay) return false;
    this.perVisitor.set(visitorId, used + 1);
    this.global++;
    return true;
  }
}
