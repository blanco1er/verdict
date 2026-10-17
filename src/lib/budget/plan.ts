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

export const BUDGET_PLAN: BudgetLine[] = [
  { id: "smoke", when: "24-25 Oct", purpose: "First end-to-end call (upload, task, poll) on 2 consented test selfies", calls: 2, unitsPerCall: SA },
  { id: "noise", when: "24-25 Oct", purpose: "Noise calibration: 5 photos, same session, same light", calls: 5, unitsPerCall: SA },
  { id: "series", when: "24 Oct - 1 Nov", purpose: "Real daily series for the pre-filled demo (owner, 1 photo/day)", calls: 9, unitsPerCall: SA },
  { id: "dev", when: "28-31 Oct", purpose: "Integration and bug fixing with live API", calls: 10, unitsPerCall: SA },
  { id: "simulation", when: "30-31 Oct", purpose: "Skin Simulation 'promised result' renders (cached)", calls: 3, unitsPerCall: SIM },
  { id: "look", when: "30-31 Oct", purpose: "Look VTO alternative renders (cached)", calls: 5, unitsPerCall: LOOK_VTO_UNITS },
  { id: "video", when: "1 Nov", purpose: "Live takes for the demo video", calls: 5, unitsPerCall: SA },
  { id: "jury", when: "2-20 Nov", purpose: "Reserve for judges testing live (per-visitor cap below)", calls: 50, unitsPerCall: SA },
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
  analysesPerDayGlobal: 12,
  /** Below this balance, the app switches to the pre-filled demo only. */
  hardFloorUnits: 60,
} as const;

/** Per-visitor daily quota, in memory (swap for a DB row in production). */
export class VisitorQuota {
  private perVisitor = new Map<string, number>();
  private global = 0;
  private day = "";

  constructor(private readonly limits = VISITOR_LIMITS) {}

  /** Returns true and counts the call if allowed. */
  tryConsume(visitorId: string, today: string, remainingUnits: number): boolean {
    if (today !== this.day) {
      this.day = today;
      this.perVisitor.clear();
      this.global = 0;
    }
    if (remainingUnits - SA < this.limits.hardFloorUnits) return false;
    if (this.global >= this.limits.analysesPerDayGlobal) return false;
    const used = this.perVisitor.get(visitorId) ?? 0;
    if (used >= this.limits.analysesPerVisitorPerDay) return false;
    this.perVisitor.set(visitorId, used + 1);
    this.global++;
    return true;
  }
}
