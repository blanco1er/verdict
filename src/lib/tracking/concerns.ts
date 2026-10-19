import type { SdAction, SkinSimulationParams } from "../youcam/types";

/**
 * Concerns that make sense for "is this product working?" tracking.
 * Each maps to one SD Skin Analysis action and, when available, to the
 * matching Skin Simulation parameter (used to render "the promised result").
 */
export interface ConcernDef {
  action: SdAction;
  label: string;
  simulation?: keyof SkinSimulationParams;
  /** A drop on these concerns can signal irritation, not just "no effect". */
  irritationSignal?: boolean;
  /** Claim keywords (lowercase regex sources), used by the no-AI fallback. */
  keywords: RegExp;
}

export const CONCERNS: ConcernDef[] = [
  { action: "redness", label: "Redness", simulation: "redness", irritationSignal: true, keywords: /\b(red(ness)?|calm(s|ing)?|sooth(e|es|ing)|rosacea|sensitive)\b/u },
  { action: "acne", label: "Blemishes", simulation: "acne", irritationSignal: true, keywords: /\b(acne|blemish(es)?|breakouts?|pimples?|spots? clear(ing)?)\b/u },
  { action: "pore", label: "Pores", simulation: "pores", keywords: /\bpores?\b/u },
  { action: "wrinkle", label: "Fine lines", simulation: "wrinkle", keywords: /\b(wrinkles?|fine lines?|anti[- ]?ag(e|ing)|retinol|retinal)\b/u },
  { action: "age_spot", label: "Dark spots", simulation: "spots", keywords: /\b(dark spots?|hyper-?pigmentation|age spots?|even(s)? (skin )?tone|discoloration)\b/u },
  { action: "radiance", label: "Radiance", simulation: "radiance", keywords: /\b(glow(s|ing)?|radian(ce|t)|dull(ness)?|bright(en(s|ing)?|er))\b/u },
  { action: "moisture", label: "Hydration", keywords: /\b(hydrat(e|es|ed|ing|ion)|moistur(e|izes|ises|izing|ising|izer|iser)|plump(s|ing)?|hyaluronic|dry(ness)?)\b/u },
  { action: "oiliness", label: "Oiliness", simulation: "oiliness", keywords: /\b(oil(y|iness)?|sebum|shine|matt(e|ifies|ifying))\b/u },
  { action: "texture", label: "Texture", simulation: "texture", keywords: /\b(texture|smooth(er|ing|s)?|exfoliat(e|es|ing|ion)|rough(ness)?)\b/u },
  { action: "dark_circle_v2", label: "Dark circles", simulation: "dark_circle", keywords: /\bdark circles?\b/u },
  { action: "eye_bag", label: "Puffiness", simulation: "eye_bags", keywords: /\b(puff(y|iness)|eye bags?|under-?eye bags?)\b/u },
  { action: "firmness", label: "Firmness", keywords: /\b(firm(s|ness|ing)?|lift(s|ing)?|elasticity|sagging)\b/u },
];

export const MAX_TRACKED = 4; // keeps every analysis in the 9-unit SD tier

export function concernDef(action: SdAction): ConcernDef {
  const def = CONCERNS.find((c) => c.action === action);
  if (def == null) throw new Error(`Untracked concern ${action}`);
  return def;
}

export interface ClaimReading {
  concerns: SdAction[];
  /** Days the brand says results take (e.g. "in 14 days", "4 weeks"). */
  promisedDays: number | null;
}

/**
 * Rule-based fallback for reading a product claim when the agent is offline.
 * Order of appearance in the claim decides priority; capped at 4 concerns.
 */
export function readClaim(claim: string): ClaimReading {
  const text = claim.toLowerCase();
  const hits: Array<{ action: SdAction; index: number }> = [];
  for (const def of CONCERNS) {
    const m = def.keywords.exec(text);
    if (m) hits.push({ action: def.action, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return { concerns: hits.slice(0, MAX_TRACKED).map((h) => h.action), promisedDays: readPromisedDays(text) };
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6, eight: 8, twelve: 12 };

export function readPromisedDays(text: string): number | null {
  const m = /\b(?:in|within|after)\s+(\d+|one|two|three|four|six|eight|twelve)\s*(days?|weeks?|months?)\b/u.exec(text.toLowerCase());
  if (m == null) return null;
  const n = /^\d+$/u.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
  const unit = m[2].startsWith("day") ? 1 : m[2].startsWith("week") ? 7 : 30;
  return n * unit;
}

/** Skin Simulation body showing "the promised result" for the tracked concerns. */
export function simulationFor(concerns: SdAction[], intensity = 0.5): SkinSimulationParams {
  const params: SkinSimulationParams = {};
  for (const action of concerns) {
    const key = concernDef(action).simulation;
    if (key) params[key] = intensity;
  }
  return params;
}
