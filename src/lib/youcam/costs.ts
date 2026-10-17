import { HD_ACTIONS, type SkinAction } from "./types";

/**
 * Unit costs from the official "Unit Consumption" tables (2026-10-17).
 * A task that ends in `error` consumes no units.
 * Live check (free): GET /s2s/v2.0/credit/feature-cost
 */
export const SKIN_ANALYSIS_TIERS = [
  { maxConcerns: 4, sd: 9, hd: 12 },
  { maxConcerns: 8, sd: 12, hd: 16 },
  { maxConcerns: 12, sd: 14, hd: 20 },
  { maxConcerns: 16, sd: 16, hd: 22 },
] as const;

export const SKIN_SIMULATION_TIERS = [
  { maxConcerns: 4, units: 4 },
  { maxConcerns: 10, units: 6 },
] as const;

export const LOOK_VTO_UNITS = 2;

const HD_SET: ReadonlySet<string> = new Set(HD_ACTIONS);

export function isHdAction(action: SkinAction): boolean {
  return HD_SET.has(action);
}

/** Validates the SD/HD rule and returns the unit cost of one analysis. */
export function skinAnalysisCost(actions: readonly SkinAction[]): number {
  if (actions.length === 0) {
    throw new Error("Skin Analysis needs at least one dst_action");
  }
  const unique = new Set(actions);
  if (unique.size !== actions.length) {
    throw new Error("Duplicate dst_actions");
  }
  const hd = actions.filter(isHdAction).length;
  if (hd !== 0 && hd !== actions.length) {
    throw new Error("cannot mix HD and SD dst_actions");
  }
  const tier = SKIN_ANALYSIS_TIERS.find((t) => actions.length <= t.maxConcerns);
  if (tier == null) {
    throw new Error("At most 16 concerns per analysis");
  }
  return hd > 0 ? tier.hd : tier.sd;
}

export function skinSimulationCost(activeConcerns: number): number {
  if (activeConcerns < 1) {
    throw new Error("Skin Simulation needs at least one non-zero concern");
  }
  const tier = SKIN_SIMULATION_TIERS.find((t) => activeConcerns <= t.maxConcerns);
  if (tier == null) {
    throw new Error("Skin Simulation supports at most 10 concerns");
  }
  return tier.units;
}
