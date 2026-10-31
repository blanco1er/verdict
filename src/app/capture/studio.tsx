"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { reportAction } from "@/components/visit-beacon";
import { MeshCanvas, type Fit } from "@/components/vx/face-overlay";
import { faceBox, guide, imageLandmarker, readFace, videoLandmarker, type FaceReading } from "@/lib/face/landmarker";
import type { CaptureQuality } from "@/lib/tracking/model";

const CONSENT_KEY = "verdict:consent:v1";
const HOLD_MS = 1300;
/** The sample face: a real selfie, shared with consent (see docs/CONSENT.md). */
const sampleReady = true;

export interface Shot {
  blob: Blob;
  quality: CaptureQuality;
  source: "camera" | "sample";
}

function luma(d: Uint8ClampedArray, x0 = 0, x1 = 1, w = 1): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const x = ((i / 4) % w) / w;
    if (x < x0 || x >= x1) continue;
    s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    n++;
  }
  return n ? s / n / 255 : 0;
}

/**
 * Frames the face the way YouCam wants it (face about 2/3 of the width, 3:4 portrait),
 * so a selfie taken from afar or imported from the library still measures well.
 */
function cropToFace(src: CanvasImageSource, w: number, h: number, l: NormalizedLandmark[] | null): { canvas: HTMLCanvasElement; faceRatio: number } {
  const out = document.createElement("canvas");
  if (!l) {
    out.width = w;
    out.height = h;
    out.getContext("2d")!.drawImage(src, 0, 0);
    return { canvas: out, faceRatio: 0 };
  }
  const b = faceBox(l);
  const fw = (b.x1 - b.x0) * w;
  const cx = ((b.x0 + b.x1) / 2) * w;
  const cy = ((b.y0 + b.y1) / 2) * h;
  let cw = Math.min(w, fw / 0.68);
  const ch = Math.min(h, (cw * 4) / 3);
  cw = Math.min(cw, (ch * 3) / 4);
  const x = Math.max(0, Math.min(w - cw, cx - cw / 2));
  const y = Math.max(0, Math.min(h - ch, cy - ch * 0.48));
  const scale = Math.max(1, 720 / cw);
  out.width = Math.round(cw * scale);
  out.height = Math.round(ch * scale);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, x, y, cw, ch, 0, 0, out.width, out.height);
  return { canvas: out, faceRatio: fw / cw };
}

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The photo studio: full-screen camera, a live face mesh, one instruction at a time,
 * and an automatic shot once the face matches the reference conditions.
 */
export function Studio({
  productName,
  dayLabel,
  onShot,
  onSample,
  onClose,
}: {
  productName: string;
  dayLabel: string;
  onShot: (s: Shot) => void;
  onSample: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [face, setFace] = useState<FaceReading | null>(null);
  const [light, setLight] = useState({ mean: 0.5, balance: 0 });
  const [hold, setHold] = useState(0);
  const [fps, setFps] = useState(0);
  const [model, setModel] = useState<"loading" | "ready" | "off">("loading");
  const shotRef = useRef(false);
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const lightRef = useRef(0.5);
  const lastLm = useRef<NormalizedLandmark[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const ok = readConsent();
      setConsent(ok);
      if (ok) void startRef.current?.();
    }, 0);
    // Warm the model while the user reads the sheet.
    videoLandmarker().then(
      () => setModel("ready"),
      () => setModel("off"),
    );
    return () => clearTimeout(t);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setRunning(true);
      reportAction("camera_open");
    } catch (e) {
      reportAction("camera_denied");
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera access was declined. Import a photo instead." : "No camera here. Import a photo instead.");
    }
  }, []);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Live loop: landmarks, framing, light. Nothing leaves the phone.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    let alive = true;
    let okSince = 0;
    let frames = 0;
    let fpsAt = 0;
    const small = document.createElement("canvas");
    small.width = 48;
    small.height = 36;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    let lm: Awaited<ReturnType<typeof videoLandmarker>> | null = null;
    videoLandmarker().then((l) => (lm = l)).catch(() => {});

    const tick = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      const box = boxRef.current;
      if (!v || !box || v.readyState < 2 || now - last < 40) return;
      last = now;
      setFit((f) => {
        const next = { cw: box.clientWidth, ch: box.clientHeight, mw: v.videoWidth, mh: v.videoHeight, mirrored: true };
        return f && f.cw === next.cw && f.ch === next.ch && f.mw === next.mw ? f : next;
      });
      let mean = 0.5;
      let balance = 0;
      if (sctx) {
        sctx.drawImage(v, 0, 0, 48, 36);
        const d = sctx.getImageData(0, 0, 48, 36).data;
        mean = luma(d, 0, 1, 48);
        // Mirrored preview: the left of the frame is the user's right.
        balance = luma(d, 0.25, 0.5, 48) - luma(d, 0.5, 0.75, 48);
      }
      lightRef.current = mean;
      setLight({ mean, balance });
      if (!lm) return;
      frames++;
      if (now - fpsAt > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsAt || 1)));
        frames = 0;
        fpsAt = now;
      }
      const res = lm.detectForVideo(v, now);
      const l = res.faceLandmarks?.[0] ?? null;
      setLandmarks(l);
      lastLm.current = l;
      const f = l ? readFace(l) : null;
      setFace(f);
      const g = guide(f, mean, balance);
      if (g.ok) {
        okSince ||= now;
        const k = Math.min(1, (now - okSince) / HOLD_MS);
        setHold(k);
        if (k >= 1 && !shotRef.current) {
          shotRef.current = true;
          shoot(f!);
        }
      } else {
        okSince = 0;
        setHold(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shoot reads refs only
  }, [running]);

  function shoot(f: FaceReading | null) {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const { canvas: c, faceRatio } = cropToFace(v, v.videoWidth, v.videoHeight, lastLm.current);
    const quality: CaptureQuality = {
      faceWidthRatio: faceRatio || 0.65,
      brightness: lightRef.current,
      yawDeg: f?.yawDeg ?? 0,
      shortSidePx: Math.min(c.width, c.height),
    };
    navigator.vibrate?.(12);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onShot({ blob, quality, source: "camera" });
      },
      "image/jpeg",
      0.92,
    );
  }

  async function importPhoto(file: File) {
    reportAction("photo_import");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    let l: NormalizedLandmark[] | null = null;
    try {
      const lm = await imageLandmarker();
      l = lm.detect(img).faceLandmarks?.[0] ?? null;
    } catch {
      l = null;
    }
    const f = l ? readFace(l) : null;
    const { canvas, faceRatio } = cropToFace(img, img.naturalWidth, img.naturalHeight, l);
    const small = document.createElement("canvas");
    small.width = 48;
    small.height = 36;
    const sx = small.getContext("2d")!;
    sx.drawImage(canvas, 0, 0, 48, 36);
    const quality: CaptureQuality = {
      faceWidthRatio: faceRatio,
      brightness: luma(sx.getImageData(0, 0, 48, 36).data, 0, 1, 48),
      yawDeg: f?.yawDeg ?? 0,
      shortSidePx: Math.min(canvas.width, canvas.height),
    };
    URL.revokeObjectURL(url);
    stop();
    canvas.toBlob((blob) => {
      if (!blob) return;
      onShot({ blob, quality, source: "camera" });
    }, "image/jpeg", 0.92);
  }

  const hint = guide(face, light.mean, light.balance);
  const showSheet = consent === false;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="vx-studio">
      <div ref={boxRef} className="vx-studio__view">
        <video ref={videoRef} playsInline muted className={running ? "is-on" : ""} />
        <div className={`vx-studio__oval${hint.ok ? " is-ok" : ""}`} aria-hidden />
        {running && <MeshCanvas landmarks={landmarks} fit={fit} ok={hint.ok} />}
      </div>

      <div className="vx-studio__top">
        <button type="button" className="vx-round vx-round--dark" onClick={() => (stop(), onClose())} aria-label="Close the camera">
          <Icon name="close" />
        </button>
        <span className="vx-studio__chip">
          <b>{productName}</b> · {dayLabel}
        </span>
      </div>

      {running && face && (
        <div className="vx-hud" aria-hidden>
          <span>
            <em>YAW</em>
            <b className={Math.abs(face.yawDeg) <= 9 ? "is-ok" : ""}>{face.yawDeg.toFixed(1)}°</b>
          </span>
          <span>
            <em>PITCH</em>
            <b className={Math.abs(face.pitchDeg) <= 10 ? "is-ok" : ""}>{face.pitchDeg.toFixed(1)}°</b>
          </span>
          <span>
            <em>ROLL</em>
            <b className={Math.abs(face.rollDeg) <= 7 ? "is-ok" : ""}>{face.rollDeg.toFixed(1)}°</b>
          </span>
          <span>
            <em>FACE</em>
            <b className={face.width >= 0.42 && face.width <= 0.78 ? "is-ok" : ""}>{Math.round(face.width * 100)}%</b>
          </span>
          <span>
            <em>LIGHT</em>
            <b className={light.mean >= 0.28 && light.mean <= 0.86 ? "is-ok" : ""}>{Math.round(light.mean * 100)}%</b>
          </span>
          <span>
            <em>L/R</em>
            <b className={Math.abs(light.balance) <= 0.16 ? "is-ok" : ""}>{light.balance >= 0 ? "+" : ""}{Math.round(light.balance * 100)}%</b>
          </span>
          <span>
            <em>MESH</em>
            <b>{landmarks?.length ?? 0} pts · {fps} fps</b>
          </span>
        </div>
      )}

      {running && (
        <p className={`vx-studio__hint${hint.ok ? " is-ok" : ""}`} aria-live="polite">
          <span className="vx-dot" />
          {model === "loading" ? "Starting face tracking…" : hint.text}
        </p>
      )}

      <div className="vx-studio__bar">
        <button type="button" className="vx-studio__side" onClick={() => fileRef.current?.click()}>
          <Icon name="doc" />
          Import
        </button>
        <button
          type="button"
          className="vx-studio__shutter"
          aria-label="Take the photo"
          onClick={() => (running ? shoot(face) : consent ? start() : undefined)}
          disabled={!running && !consent}
        >
          <svg viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r={R} className="vx-studio__ring" />
            <circle cx="40" cy="40" r={R} className="vx-studio__prog" strokeDasharray={C} strokeDashoffset={C * (1 - hold)} transform="rotate(-90 40 40)" />
          </svg>
          <i />
        </button>
        {sampleReady ? (
          <button type="button" className="vx-studio__side" onClick={() => (stop(), onSample())}>
            <Icon name="face" />
            Sample
          </button>
        ) : (
          <span className="vx-studio__side" aria-hidden />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importPhoto(f);
          }}
        />
      </div>

      {!running && !error && (
        <div className="vx-ghost" aria-hidden>
          <svg viewBox="0 0 200 260">
            <path d="M100 18c44 0 70 34 70 84 0 60-30 118-70 118S30 162 30 102c0-50 26-84 70-84z" />
            <path d="M100 18v202M48 92h104M58 70c14-10 28-14 42-14s28 4 42 14M44 128l34 18 22-30 22 30 34-18M70 180c18 12 42 12 60 0" />
          </svg>
          <span>{consent ? "Opening the camera" : ""}</span>
        </div>
      )}
      {error && <p className="vx-studio__error">{error}</p>}

      {showSheet && (
        <div className="vx-sheet" role="dialog" aria-modal="true" aria-labelledby="consent-h">
          <span className="vx-sheet__grab" aria-hidden />
          <h2 id="consent-h">Your face, measured</h2>
          <p>
            YouCam analyses the photo for the concerns this product promises. Verdict keeps the scores, not the photo. Face tracking runs on this phone.
          </p>
          <button
            type="button"
            className="vx-go vx-go--wide"
            onClick={() => {
              try {
                localStorage.setItem(CONSENT_KEY, "1");
              } catch {}
              setConsent(true);
              reportAction("consent");
              void start();
            }}
          >
            Allow and open the camera
          </button>
          <button type="button" className="vx-quiet" style={{ alignSelf: "center" }} onClick={() => fileRef.current?.click()}>
            Import a photo instead
          </button>
        </div>
      )}
    </div>
  );
}
