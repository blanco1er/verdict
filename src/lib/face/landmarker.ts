"use client";

import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * On-device face tracking (MediaPipe Face Landmarker, 478 points). The model and the
 * WASM runtime are served by this app (public/mediapipe): no frame leaves the phone.
 */
let video: Promise<FaceLandmarker> | null = null;
let image: Promise<FaceLandmarker> | null = null;

async function create(mode: "VIDEO" | "IMAGE"): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks("/mediapipe");
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
    runningMode: mode,
    numFaces: 1,
  });
  try {
    return await FaceLandmarker.createFromOptions(files, options("GPU"));
  } catch {
    return FaceLandmarker.createFromOptions(files, options("CPU"));
  }
}

let edges: Promise<Array<{ start: number; end: number }>> | null = null;
/** The 3D mesh triangulation (for drawing the live mesh), loaded with the library. */
export function meshEdges(): Promise<Array<{ start: number; end: number }>> {
  edges ??= import("@mediapipe/tasks-vision").then((m) => m.FaceLandmarker.FACE_LANDMARKS_TESSELATION);
  return edges;
}

export function videoLandmarker(): Promise<FaceLandmarker> {
  video ??= create("VIDEO");
  return video;
}
export function imageLandmarker(): Promise<FaceLandmarker> {
  image ??= create("IMAGE");
  return image;
}

/** Points used to read the head and to place the zones. */
export const P = { forehead: 10, chin: 152, nose: 1, leftEye: 33, rightEye: 263, leftEdge: 234, rightEdge: 454, leftCheek: 205, rightCheek: 425, glabella: 168 } as const;

export const ZONES: Array<{ key: string; label: string; at: number }> = [
  { key: "forehead", label: "Forehead", at: 151 },
  { key: "lcheek", label: "Cheek", at: 205 },
  { key: "rcheek", label: "Cheek", at: 425 },
  { key: "nose", label: "Nose", at: 4 },
  { key: "chin", label: "Chin", at: 199 },
];

export interface FaceReading {
  /** Face width / frame width (YouCam asks for > 0.6 of the short side, we use width). */
  width: number;
  /** Face centre offset from the frame centre, -1..1. */
  dx: number;
  dy: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/** Head pose and framing, read from the landmarks only (no 3D matrix needed). */
export function readFace(l: NormalizedLandmark[]): FaceReading {
  const L = l[P.leftEdge], R = l[P.rightEdge], N = l[P.nose], T = l[P.forehead], B = l[P.chin], le = l[P.leftEye], re = l[P.rightEye];
  const width = Math.abs(R.x - L.x);
  const cx = (L.x + R.x) / 2;
  const cy = (T.y + B.y) / 2;
  // Nose against the midpoint of the eyes, in eye-distance units: about 0 when frontal.
  const yaw = (N.x - (le.x + re.x) / 2) / (re.x - le.x || 1) * 1.6; // -1..1
  const pitch = ((N.y - T.y) / (B.y - T.y || 1) - 0.56) * 2;
  const roll = (Math.atan2(re.y - le.y, re.x - le.x) * 180) / Math.PI;
  return { width, dx: (cx - 0.5) * 2, dy: (cy - 0.5) * 2, yawDeg: Math.round(yaw * 450) / 10, pitchDeg: Math.round(pitch * 600) / 10, rollDeg: Math.round(roll * 10) / 10 };
}

export type Hint = { ok: boolean; text: string };

/** One instruction at a time, the most important first. Mirrored preview: "left" is the user's left. */
export function guide(f: FaceReading | null, light: number, balance: number): Hint {
  if (!f) return { ok: false, text: "Bring your face into the frame" };
  if (light < 0.28) return { ok: false, text: "More light, face a window" };
  if (light > 0.86) return { ok: false, text: "Too bright, step out of direct light" };
  if (f.width < 0.42) return { ok: false, text: "Come a little closer" };
  if (f.width > 0.78) return { ok: false, text: "A little further back" };
  if (Math.abs(f.dx) > 0.22 || Math.abs(f.dy) > 0.26) return { ok: false, text: "Centre your face in the oval" };
  if (f.yawDeg > 9) return { ok: false, text: "Turn slightly to your right" };
  if (f.yawDeg < -9) return { ok: false, text: "Turn slightly to your left" };
  if (f.pitchDeg > 10) return { ok: false, text: "Lift your chin a little" };
  if (f.pitchDeg < -10) return { ok: false, text: "Lower your chin a little" };
  if (Math.abs(f.rollDeg) > 7) return { ok: false, text: "Keep your head straight" };
  if (Math.abs(balance) > 0.16) return { ok: false, text: balance > 0 ? "Light is uneven: turn toward the light" : "Light is uneven: turn toward the light" };
  return { ok: true, text: "Hold still" };
}

/** Normalised box around the face (forehead to chin, edge to edge). */
export function faceBox(l: NormalizedLandmark[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of l) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Which zone of the face shows each measured concern. */
export const CONCERN_ZONE: Record<string, string> = {
  redness: "lcheek",
  radiance: "rcheek",
  moisture: "rcheek",
  pore: "nose",
  wrinkle: "forehead",
  texture: "forehead",
  acne: "chin",
  firmness: "chin",
  age_spot: "rcheek",
  oiliness: "nose",
};
