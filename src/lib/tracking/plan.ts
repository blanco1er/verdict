import { skinAnalysisCost } from "../youcam/costs";
import { CONCERNS, MAX_TRACKED, readClaim } from "./concerns";
import { addDays, type IsoDay, type Product } from "./model";
import type { SdAction } from "../youcam/types";

export interface ClaimMatch {
  action: SdAction;
  label: string;
  /** The words in the claim that triggered this concern. */
  evidence: string;
}

export interface TrackingPlan {
  matches: ClaimMatch[];
  tracked: SdAction[];
  dropped: ClaimMatch[];
  promisedDays: number | null;
  promiseExceedsWindow: boolean;
  decisionDate: IsoDay;
  deadline: IsoDay;
  photos: number;
  unitsPerPhoto: number;
  totalUnits: number;
}

/** Every concern a claim mentions, in reading order, with the words that matched. */
export function claimMatches(claim: string): ClaimMatch[] {
  const text = claim.toLowerCase();
  const out: Array<ClaimMatch & { index: number }> = [];
  for (const def of CONCERNS) {
    const m = def.keywords.exec(text);
    if (m) out.push({ action: def.action, label: def.label, evidence: claim.slice(m.index, m.index + m[0].length), index: m.index });
  }
  return out.sort((a, b) => a.index - b.index).map((m) => ({ action: m.action, label: m.label, evidence: m.evidence }));
}

/**
 * What tracking this product will cost before the verdict: a photo every
 * `cadence` days, then one a day in the final 4 days (same rule as the verdict).
 */
export function trackingPlan(claim: string, purchasedOn: IsoDay, returnWindowDays: number, cadence = 2, decisionBufferDays = 2): TrackingPlan {
  const matches = claimMatches(claim);
  const reading = readClaim(claim);
  const tracked = reading.concerns;
  const deadline = addDays(purchasedOn, returnWindowDays);
  const decisionDay = Math.max(0, returnWindowDays - decisionBufferDays);
  let photos = 0;
  for (let day = 0; day <= decisionDay; ) {
    photos++;
    day += decisionDay - day <= 4 ? 1 : cadence;
  }
  const unitsPerPhoto = tracked.length > 0 ? skinAnalysisCost(tracked) : 0;
  return {
    matches,
    tracked,
    dropped: matches.slice(MAX_TRACKED),
    promisedDays: reading.promisedDays,
    promiseExceedsWindow: reading.promisedDays != null && reading.promisedDays > returnWindowDays,
    decisionDate: addDays(purchasedOn, decisionDay),
    deadline,
    photos: tracked.length > 0 ? photos : 0,
    unitsPerPhoto,
    totalUnits: tracked.length > 0 ? photos * unitsPerPhoto : 0,
  };
}

export function newProduct(input: { name: string; brand?: string; claim: string; purchasedOn: IsoDay; returnWindowDays: number }, id: string): Product {
  const reading = readClaim(input.claim);
  return {
    id,
    name: input.name.trim() || "My product",
    brand: input.brand?.trim() || undefined,
    claim: input.claim.trim(),
    purchasedOn: input.purchasedOn,
    returnWindowDays: input.returnWindowDays,
    concerns: reading.concerns,
    promisedDays: reading.promisedDays,
  };
}
