import { describe, expect, it } from "vitest";
import { checkCapture } from "./quality";

const good = { faceWidthRatio: 0.7, brightness: 0.55, yawDeg: 3, shortSidePx: 1080 };

describe("capture quality gate", () => {
  it("accepts a good frontal photo", () => {
    expect(checkCapture(good)).toEqual({ ok: true, issues: [], comparable: true });
  });

  it("rejects photos the API documents as failing", () => {
    expect(checkCapture({ ...good, faceWidthRatio: 0.5 }).issues).toContain("face_too_small");
    expect(checkCapture({ ...good, shortSidePx: 400 }).issues).toContain("image_too_small");
    expect(checkCapture({ ...good, brightness: 0.2 }).issues).toContain("too_dark");
    expect(checkCapture({ ...good, yawDeg: -18 }).issues).toContain("not_frontal");
  });

  it("flags lighting drift vs. day 1 as not comparable, but still analyzable", () => {
    const r = checkCapture({ ...good, brightness: 0.75 }, good);
    expect(r.ok).toBe(true);
    expect(r.comparable).toBe(false);
    expect(r.issues).toEqual(["lighting_changed"]);
  });
});
