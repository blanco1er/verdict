import { describe, expect, it } from "vitest";
import { skinAnalysisCost, skinSimulationCost } from "./costs";

describe("unit costs (docs, 2026-10-17)", () => {
  it("prices SD and HD skin analysis by concern count", () => {
    expect(skinAnalysisCost(["redness"])).toBe(9);
    expect(skinAnalysisCost(["redness", "pore", "acne", "texture"])).toBe(9);
    expect(skinAnalysisCost(["redness", "pore", "acne", "texture", "wrinkle"])).toBe(12);
    expect(skinAnalysisCost(["hd_redness", "hd_pore"])).toBe(12);
    expect(
      skinAnalysisCost([
        "wrinkle", "pore", "texture", "acne", "oiliness", "radiance", "eye_bag", "age_spot",
        "dark_circle_v2", "droopy_upper_eyelid", "droopy_lower_eyelid", "firmness", "moisture",
        "redness", "tear_trough", "skin_type",
      ]),
    ).toBe(16);
  });

  it("rejects mixed SD/HD, empty and duplicate action lists", () => {
    expect(() => skinAnalysisCost(["redness", "hd_pore"])).toThrow("cannot mix HD and SD");
    expect(() => skinAnalysisCost([])).toThrow();
    expect(() => skinAnalysisCost(["pore", "pore"])).toThrow();
  });

  it("prices skin simulation", () => {
    expect(skinSimulationCost(1)).toBe(4);
    expect(skinSimulationCost(4)).toBe(4);
    expect(skinSimulationCost(5)).toBe(6);
    expect(() => skinSimulationCost(0)).toThrow();
    expect(() => skinSimulationCost(11)).toThrow();
  });
});
