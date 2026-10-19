import { describe, expect, it } from "vitest";
import { readClaim, readPromisedDays, simulationFor } from "./concerns";

describe("claim reading (no-AI fallback)", () => {
  it("keeps only the concerns the product promises, in claim order", () => {
    expect(readClaim("Calming serum that reduces redness and refines pores in 14 days").concerns).toEqual(["redness", "pore"]);
    expect(readClaim("Vitamin C drops to fade dark spots for a radiant glow").concerns).toEqual(["age_spot", "radiance"]);
    expect(readClaim("Hydrating gel, plumps fine lines").concerns).toEqual(["moisture", "wrinkle"]);
  });

  it("caps at 4 concerns to stay in the 9-unit tier", () => {
    const r = readClaim("Clears acne, minimizes pores, mattifies oil, smooths texture, fades dark spots, adds glow");
    expect(r.concerns).toHaveLength(4);
    expect(r.concerns).toEqual(["acne", "pore", "oiliness", "texture"]);
  });

  it("reads promised timeframes", () => {
    expect(readPromisedDays("visible results in 14 days")).toBe(14);
    expect(readPromisedDays("within 4 weeks")).toBe(28);
    expect(readPromisedDays("after two weeks")).toBe(14);
    expect(readPromisedDays("in 3 months")).toBe(90);
    expect(readPromisedDays("instant glow")).toBeNull();
  });

  it("builds a Skin Simulation body only for simulatable concerns", () => {
    expect(simulationFor(["redness", "pore", "moisture"], 0.6)).toEqual({ redness: 0.6, pores: 0.6 });
  });

  it("reads verbs in the third person, as claims are written", () => {
    expect(readClaim("Hydrates and visibly calms redness in 4 weeks.").concerns).toEqual(expect.arrayContaining(["moisture", "redness"]));
    expect(readClaim("Brightens, firms and moisturizes.").concerns).toEqual(expect.arrayContaining(["radiance", "firmness", "moisture"]));
  });
});
