"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card, PageHeader, SectionTitle, Swatch } from "@/components/ui";
import { addUserCapture, loadUserItems } from "@/lib/demo/store";
import { concernDef } from "@/lib/tracking/concerns";
import type { CaptureQuality } from "@/lib/tracking/model";
import { ISSUE_HINTS, QUALITY_RULES, checkCapture, type QualityReport } from "@/lib/tracking/quality";
import { skinAnalysisCost } from "@/lib/youcam/costs";
import type { SdAction, SkinAnalysisOutput } from "@/lib/youcam/types";

interface TraceStep {
  method: string;
  path: string;
  status: number;
  ms: number;
  taskStatus?: string;
}
type Phase =
  | { kind: "consent" }
  | { kind: "camera" }
  | { kind: "review"; url: string; size: number; quality: CaptureQuality; report: QualityReport; source: "camera" | "sample" }
  | { kind: "analyzing"; url: string; stage: number }
  | { kind: "done"; url: string; output: SkinAnalysisOutput[]; trace: TraceStep[]; units: number; mode: string; saved: boolean }
  | { kind: "error"; url?: string; message: string; trace?: TraceStep[] };

interface Props {
  id: string;
  demo: { name: string; concerns: SdAction[]; hue: number } | null;
  baseline: CaptureQuality | null;
  mode: "mock" | "live";
  liveUploads: boolean;
  choices: Array<{ id: string; name: string }>;
}

const noop = () => () => {};
const STAGES = ["Declaring the file (File API)", "Uploading to the pre-signed URL", "Starting the Skin Analysis task", "Waiting for the result"];

export function CaptureFlow({ id, demo, baseline, mode, liveUploads, choices }: Props) {
  const userJson = useSyncExternalStore(noop, () => (demo ? "" : JSON.stringify(loadUserItems().find((u) => u.product.id === id)?.product ?? null)), () => "");
  const userProduct = userJson ? (JSON.parse(userJson) as { name: string; concerns: SdAction[] } | null) : null;
  const target = demo ?? (userProduct ? { ...userProduct, hue: 18 } : null);
  const [phase, setPhase] = useState<Phase>({ kind: "consent" });
  const [consent, setConsent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState<{ brightness: number; face: number | null; detector: boolean }>({ brightness: 0, face: null, detector: false });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  // Live light / framing meter, measured on-device before any unit is spent.
  useEffect(() => {
    if (phase.kind !== "camera") return;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    type Detector = { detect: (v: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> };
    const FD = (window as unknown as { FaceDetector?: new (o?: object) => Detector }).FaceDetector;
    const detector = FD ? new FD({ fastMode: true, maxDetectedFaces: 1 }) : null;
    const t = setInterval(async () => {
      const v = videoRef.current;
      if (!v || !ctx || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 64, 48);
      const brightness = meanLuma(ctx.getImageData(0, 0, 64, 48).data);
      let face: number | null = null;
      if (detector) {
        try {
          const faces = await detector.detect(v);
          face = faces[0] ? faces[0].boundingBox.width / v.videoWidth : 0;
        } catch {
          face = null;
        }
      }
      setLive({ brightness, face, detector: detector != null });
    }, 300);
    return () => clearInterval(t);
  }, [phase.kind]);

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
      streamRef.current = stream;
      setPhase({ kind: "camera" });
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      setCameraError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was declined." : "No camera available here.");
    }
  }

  function shoot() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const quality: CaptureQuality = {
      faceWidthRatio: live.face ?? 0.65, // without a face detector the oval guides framing
      brightness: live.brightness,
      yawDeg: 0,
      shortSidePx: Math.min(v.videoWidth, v.videoHeight),
    };
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        setPhase({ kind: "review", url: URL.createObjectURL(blob), size: blob.size, quality, report: checkCapture(quality, baseline ?? undefined), source: "camera" });
      },
      "image/jpeg",
      0.9,
    );
  }

  function useSample() {
    const canvas = sampleImage();
    const small = document.createElement("canvas");
    small.width = 64;
    small.height = 48;
    small.getContext("2d")!.drawImage(canvas, 0, 0, 64, 48);
    const brightness = meanLuma(small.getContext("2d")!.getImageData(0, 0, 64, 48).data);
    const quality: CaptureQuality = { faceWidthRatio: 0.68, brightness, yawDeg: 1, shortSidePx: canvas.width };
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhase({ kind: "review", url: URL.createObjectURL(blob), size: blob.size, quality, report: checkCapture(quality, baseline ?? undefined), source: "sample" });
      },
      "image/jpeg",
      0.9,
    );
  }

  async function analyze(url: string, size: number) {
    if (!target) return;
    setPhase({ kind: "analyzing", url, stage: 0 });
    const tick = setInterval(() => setPhase((p) => (p.kind === "analyzing" ? { ...p, stage: Math.min(STAGES.length - 1, p.stage + 1) } : p)), 420);
    try {
      let res: Response;
      const day = new Date().toLocaleDateString("en-CA");
      if (mode === "live" && liveUploads) {
        const form = new FormData();
        form.set("photo", await (await fetch(url)).blob(), `verdict-${day}.jpg`);
        form.set("concerns", target.concerns.join(","));
        res = await fetch("/api/youcam/analyze", { method: "POST", body: form });
      } else {
        // Demo mode: only the size and a file name leave the device, never the photo.
        res = await fetch("/api/youcam/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: `verdict-${day}.jpg`, fileSize: size, concerns: target.concerns }),
        });
      }
      const json = await res.json();
      clearInterval(tick);
      if (!res.ok) {
        setPhase({ kind: "error", url, message: json.detail ? `${json.error}. ${json.detail}` : json.error ?? `HTTP ${res.status}`, trace: json.trace });
        return;
      }
      let saved = false;
      if (!demo) {
        const scores: Record<string, { raw: number; ui: number }> = {};
        for (const o of json.output as SkinAnalysisOutput[]) if (o.type !== "all" && o.raw_score != null && o.ui_score != null) scores[o.type] = { raw: o.raw_score, ui: o.ui_score };
        saved = addUserCapture(id, {
          id: `u-${Date.now()}`,
          productId: id,
          takenOn: day,
          quality: (phase as { quality?: CaptureQuality }).quality ?? { faceWidthRatio: 0.65, brightness: 0.55, yawDeg: 0, shortSidePx: 1080 },
          scores,
        });
      }
      setPhase({ kind: "done", url, output: json.output, trace: json.trace, units: json.units, mode: json.mode, saved });
    } catch (e) {
      clearInterval(tick);
      setPhase({ kind: "error", url, message: e instanceof Error ? e.message : String(e) });
    }
  }

  const reset = () => {
    if ("url" in phase && phase.url) URL.revokeObjectURL(phase.url);
    setPhase({ kind: "consent" });
  };

  if (!target) {
    return (
      <>
        <PageHeader back={{ href: "/", label: "Today" }} />
        <Card>
          <p className="font-semibold">Pick the product you&apos;re tracking</p>
          <ul className="mt-3 flex flex-col gap-2">
            {choices.map((c) => (
              <li key={c.id}>
                <Link href={`/capture?id=${c.id}`} className="block rounded-2xl border border-line px-4 py-3 text-sm font-medium hover:border-foreground/25">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </>
    );
  }

  const units = skinAnalysisCost(target.concerns);
  return (
    <>
      <PageHeader back={{ href: demo ? `/product?id=${id}` : "/", label: demo ? target.name : "Today" }} />
      <section className="rise">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">Today&apos;s photo</h1>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
          <Swatch hue={target.hue} size={20} />
          {target.name} · {target.concerns.map((c) => concernDef(c).label).join(", ")} · {units} units
        </p>
      </section>

      {phase.kind === "consent" && (
        <>
          <Card>
            <SectionTitle>Same conditions as day 0</SectionTitle>
            <ul className="mt-3 space-y-2.5 text-[14px] leading-6">
              {["Same spot and time of day, facing the same light.", "Glasses off, hair off the forehead, no makeup.", "Look straight at the camera and fill the oval."].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold ring-1 ring-line">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </Card>
          <label className="card flex cursor-pointer items-start gap-3 p-4 text-[13.5px] leading-5">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--foreground)]" />
            <span>
              I agree to take a face photo for cosmetic tracking.{" "}
              <span className="text-muted">
                {mode === "live" && liveUploads
                  ? "It is sent to YouCam for analysis and can be deleted anytime."
                  : "Demo mode: the photo never leaves this device; only its size is used to simulate the API call."}
              </span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!consent}
              onClick={openCamera}
              className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background transition active:scale-[.98] disabled:opacity-40"
            >
              Open camera
            </button>
            <button
              type="button"
              disabled={!consent}
              onClick={useSample}
              className="h-12 rounded-full border border-line bg-surface text-[15px] font-semibold transition hover:border-foreground/25 disabled:opacity-40"
            >
              Use a sample
            </button>
          </div>
          {cameraError && (
            <p role="alert" className="rounded-2xl bg-mixed/10 px-4 py-3 text-[13.5px] text-mixed">
              {cameraError} Use the sample image to see the full flow.
            </p>
          )}
        </>
      )}

      {phase.kind === "camera" && (
        <>
          <div className="relative overflow-hidden rounded-[28px] bg-black shadow-[0_24px_48px_-24px_rgba(0,0,0,.6)]" style={{ aspectRatio: "3 / 4" }}>
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className="h-[70%] w-[62%] rounded-[50%] border-2 transition-colors"
                style={{ borderColor: lightOk(live.brightness) ? "rgba(255,255,255,.95)" : "rgba(255,180,160,.9)", boxShadow: "0 0 0 9999px rgba(0,0,0,.38)" }}
              />
            </div>
            <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
              <Meter ok={lightOk(live.brightness)} label={`Light ${Math.round(live.brightness * 100)}%`} />
              <Meter ok={live.face == null ? null : live.face > QUALITY_RULES.minFaceWidthRatio} label={live.detector ? (live.face ? `Face ${Math.round(live.face * 100)}% wide` : "No face yet") : "Fill the oval"} />
              {baseline && <Meter ok={Math.abs(live.brightness - baseline.brightness) <= QUALITY_RULES.maxBrightnessDrift} label="Like day 0" />}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button type="button" onClick={shoot} className="h-14 rounded-full bg-foreground text-[16px] font-semibold text-background transition active:scale-[.98]">
              Take photo
            </button>
            <button type="button" onClick={() => { stopCamera(); setPhase({ kind: "consent" }); }} className="h-14 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold">
              Cancel
            </button>
          </div>
        </>
      )}

      {phase.kind === "review" && (
        <>
          <Photo url={phase.url} label={phase.source === "sample" ? "Sample image" : "Your photo"} />
          <Card>
            <SectionTitle aside={<span className="text-[12px] text-muted">checked on this device · 0 units</span>}>Quality gate</SectionTitle>
            <ul className="mt-3 space-y-2 text-[14px]">
              <Check ok={phase.quality.brightness >= QUALITY_RULES.minBrightness && phase.quality.brightness <= QUALITY_RULES.maxBrightness} label={`Light ${Math.round(phase.quality.brightness * 100)}%`} />
              <Check ok={phase.quality.faceWidthRatio > QUALITY_RULES.minFaceWidthRatio} label="Face fills more than 60% of the width" />
              <Check ok={phase.quality.shortSidePx >= QUALITY_RULES.minShortSidePx} label={`Resolution ${phase.quality.shortSidePx}px (SD needs 480)`} />
              {baseline && <Check ok={!phase.report.issues.includes("lighting_changed")} label="Lighting matches day 0" />}
            </ul>
            {phase.report.issues.length > 0 && (
              <p className="mt-3 rounded-2xl bg-mixed/10 px-3.5 py-3 text-[13px] leading-5 text-mixed">
                {phase.report.issues.map((i) => ISSUE_HINTS[i]).join(" ")}
                {phase.report.ok && !phase.report.comparable ? " This photo would be set aside from the trend." : ""}
              </p>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!phase.report.ok}
              onClick={() => analyze(phase.url, phase.size)}
              className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background transition active:scale-[.98] disabled:opacity-40"
            >
              Analyze · {units} units
            </button>
            <button type="button" onClick={reset} className="h-12 rounded-full border border-line bg-surface text-[15px] font-semibold">
              Retake
            </button>
          </div>
          {!phase.report.ok && <p className="text-center text-[12.5px] text-muted">Blocked before upload, so no units are spent.</p>}
        </>
      )}

      {phase.kind === "analyzing" && (
        <>
          <Photo url={phase.url} label="Analyzing" dim />
          <Card>
            <SectionTitle>YouCam AI Skin Analysis</SectionTitle>
            <ol className="mt-3 space-y-2.5 text-[14px]">
              {STAGES.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 ${i > phase.stage ? "text-muted" : ""}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < phase.stage ? "bg-keep text-white" : i === phase.stage ? "border-2 border-foreground border-t-transparent animate-spin" : "ring-1 ring-line"}`}>
                    {i < phase.stage ? "✓" : ""}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}

      {phase.kind === "done" && (
        <>
          <Photo url={phase.url} label={phase.mode === "mock" ? "Stayed on this device" : "Analyzed"} />
          <Card className="rise">
            <SectionTitle aside={<span className="text-[12px] font-semibold text-accent-ink">{phase.mode === "mock" ? "Synthetic scores" : "Live"}</span>}>Result</SectionTitle>
            <ul className="mt-3 divide-y divide-line">
              {phase.output
                .filter((o) => o.type !== "all")
                .map((o) => (
                  <li key={o.type} className="flex items-center justify-between py-3">
                    <span className="text-[15px] font-semibold">{concernDef(o.type as SdAction).label}</span>
                    <span className="text-right tabular-nums">
                      <span className="text-[20px] font-semibold tracking-tight">{o.ui_score}</span>
                      <span className="text-[13px] text-muted">/100</span>
                      <span className="ml-2 text-[12px] text-muted">raw {o.raw_score}</span>
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[12.5px] leading-5 text-muted">
              {phase.saved
                ? "Added to this product's timeline on this device."
                : "Demo product: this photo is not added to its synthetic series. Add your own product to build a real timeline."}
            </p>
          </Card>
          <TraceCard trace={phase.trace} units={phase.units} />
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/product?id=${encodeURIComponent(id)}`} className="inline-flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background">
              See the timeline
            </Link>
            <button type="button" onClick={reset} className="h-12 rounded-full border border-line bg-surface text-[15px] font-semibold">
              Delete photo
            </button>
          </div>
        </>
      )}

      {phase.kind === "error" && (
        <>
          {phase.url && <Photo url={phase.url} label="Not analyzed" dim />}
          <Card>
            <p role="alert" className="text-[16px] font-semibold text-return">The analysis did not complete.</p>
            <p className="mt-2 text-[14px] leading-6 text-muted">{phase.message}</p>
          </Card>
          {phase.trace && phase.trace.length > 0 && <TraceCard trace={phase.trace} units={0} />}
          <button type="button" onClick={reset} className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background">
            Try again
          </button>
        </>
      )}
    </>
  );
}

function meanLuma(d: Uint8ClampedArray): number {
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4) / 255;
}
const lightOk = (b: number) => b >= QUALITY_RULES.minBrightness && b <= QUALITY_RULES.maxBrightness;

/** A neutral sample frame for browsers without a camera (no face, no person). */
function sampleImage(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1440;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 1440);
  bg.addColorStop(0, "#a99a90");
  bg.addColorStop(1, "#8f8077");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1080, 1440);
  const r = g.createRadialGradient(540, 640, 60, 540, 700, 420);
  r.addColorStop(0, "#d6b29c");
  r.addColorStop(1, "#b48a72");
  g.fillStyle = r;
  g.beginPath();
  g.ellipse(540, 700, 330, 440, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function Meter({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold backdrop-blur ${ok == null ? "bg-black/45 text-white" : ok ? "bg-white/90 text-keep" : "bg-white/90 text-return"}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: ok == null ? "#fff" : ok ? "var(--keep)" : "var(--return)" }} />
      {label}
    </span>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${ok ? "bg-keep" : "bg-return"}`}>{ok ? "✓" : "!"}</span>
      <span>{label}</span>
      <span className="sr-only">{ok ? "passed" : "failed"}</span>
    </li>
  );
}

function Photo({ url, label, dim }: { url: string; label: string; dim?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-black/5" style={{ aspectRatio: "3 / 4", maxHeight: 360 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded in demo mode */}
      <img src={url} alt="" className={`h-full w-full object-cover ${dim ? "opacity-60" : ""}`} />
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-black backdrop-blur">{label}</span>
    </div>
  );
}

function TraceCard({ trace, units }: { trace: TraceStep[]; units: number }) {
  return (
    <Card>
      <SectionTitle aside={<span className="text-[12px] text-muted tabular-nums">{units ? `${units} units` : "0 units charged"}</span>}>API calls</SectionTitle>
      <ol className="mt-3 space-y-1.5 font-mono text-[11.5px] leading-5">
        {trace.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className={`w-10 shrink-0 font-semibold ${t.status < 300 ? "text-keep" : "text-return"}`}>{t.method}</span>
            <span className="min-w-0 flex-1 truncate">{t.path}</span>
            <span className="shrink-0 text-muted">{t.taskStatus ?? t.status}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
