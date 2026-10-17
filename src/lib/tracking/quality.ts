import type { CaptureQuality } from "./model";

/**
 * Local capture gate, run on the phone BEFORE spending units.
 * Hard limits come from the Skin Analysis docs (SD: short side >= 480 px,
 * face width > 60 % of the image, even bright lighting, frontal pose).
 * Comparability limits (brightness drift, yaw) are our own and must be
 * calibrated with real photos (see TECH.md, "calibration du bruit").
 */
export const QUALITY_RULES = {
  minShortSidePx: 480,
  minFaceWidthRatio: 0.6,
  minBrightness: 0.35,
  maxBrightness: 0.85,
  maxYawDeg: 10,
  /** Max brightness drift vs. the baseline capture to stay comparable. */
  maxBrightnessDrift: 0.12,
} as const;

export type QualityIssue =
  | "image_too_small"
  | "face_too_small"
  | "too_dark"
  | "overexposed"
  | "not_frontal"
  | "lighting_changed";

export interface QualityReport {
  ok: boolean;
  issues: QualityIssue[];
  /** Same conditions as the baseline: OK to compare in the timeline. */
  comparable: boolean;
}

export function checkCapture(q: CaptureQuality, baseline?: CaptureQuality): QualityReport {
  const issues: QualityIssue[] = [];
  if (q.shortSidePx < QUALITY_RULES.minShortSidePx) issues.push("image_too_small");
  if (q.faceWidthRatio <= QUALITY_RULES.minFaceWidthRatio) issues.push("face_too_small");
  if (q.brightness < QUALITY_RULES.minBrightness) issues.push("too_dark");
  if (q.brightness > QUALITY_RULES.maxBrightness) issues.push("overexposed");
  if (Math.abs(q.yawDeg) > QUALITY_RULES.maxYawDeg) issues.push("not_frontal");
  const ok = issues.length === 0;
  let comparable = ok;
  if (ok && baseline != null && Math.abs(q.brightness - baseline.brightness) > QUALITY_RULES.maxBrightnessDrift) {
    issues.push("lighting_changed");
    comparable = false;
  }
  return { ok, issues, comparable };
}

export const ISSUE_HINTS: Record<QualityIssue, string> = {
  image_too_small: "Move closer or use the main camera.",
  face_too_small: "Fill the oval: your face should cover most of the frame.",
  too_dark: "Face a window or a lamp.",
  overexposed: "Too bright. Step away from direct light.",
  not_frontal: "Look straight at the camera.",
  lighting_changed: "Lighting differs from day 1. Use the same spot and time.",
};
