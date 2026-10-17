import { readClaim } from "../tracking/concerns";
import { addDays, type Capture, type Product } from "../tracking/model";
import { mockUiScore } from "../youcam/mock";

/**
 * SAMPLE DATA, clearly labelled in the UI. Synthetic scores shaped like the
 * documented Skin Analysis output; replaced by the owner's real series later.
 * The demo date is fixed so pages can be prerendered deterministically.
 */
export const DEMO_AS_OF = "2026-10-29";

const claim = "Calming serum that visibly reduces redness and refines pores in 14 days.";
const reading = readClaim(claim);

export const DEMO_PRODUCT: Product = {
  id: "demo-serum",
  name: "Calming Serum (sample)",
  brand: "Sample brand",
  claim,
  purchasedOn: "2026-10-15",
  returnWindowDays: 30,
  concerns: reading.concerns, // ["redness", "pore"]
  promisedDays: reading.promisedDays, // 14
};

const quality = { faceWidthRatio: 0.68, brightness: 0.58, yawDeg: 2, shortSidePx: 1080 };

// Redness improves (~+0.6/day), pores stay flat; day 6 photo is too dark.
const series: Array<{ day: number; redness: number; pore: number; brightness?: number }> = [
  { day: 0, redness: 61, pore: 70 },
  { day: 2, redness: 62.5, pore: 69 },
  { day: 4, redness: 63, pore: 71 },
  { day: 6, redness: 55, pore: 64, brightness: 0.3 },
  { day: 8, redness: 66, pore: 70 },
  { day: 10, redness: 67.5, pore: 69.5 },
  { day: 12, redness: 68, pore: 70.5 },
];

export const DEMO_CAPTURES: Capture[] = series.map((p, i) => ({
  id: `demo-c${i + 1}`,
  productId: DEMO_PRODUCT.id,
  takenOn: addDays("2026-10-17", p.day),
  quality: { ...quality, brightness: p.brightness ?? quality.brightness },
  scores: {
    redness: { raw: p.redness, ui: mockUiScore(p.redness) },
    pore: { raw: p.pore, ui: mockUiScore(p.pore) },
  },
}));
