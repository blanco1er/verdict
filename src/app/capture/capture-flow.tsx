"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NavBar, useImmersive } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { LargeTitle, Row } from "@/components/ui";
import { reportAction } from "@/components/visit-beacon";
import { toast } from "@/design-system/motion.js";
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
  | { kind: "analyzing"; url: string; stage: number; quality: CaptureQuality }
  | { kind: "done"; url: string; output: SkinAnalysisOutput[]; trace: TraceStep[]; units: number; mode: string; saved: boolean; notice?: string }
  | { kind: "error"; url?: string; message: string; trace?: TraceStep[] };

interface Props {
  id: string;
  demo: { name: string; concerns: SdAction[] } | null;
  baseline: CaptureQuality | null;
  mode: "mock" | "live";
  liveUploads: boolean;
  choices: Array<{ id: string; name: string }>;
}

const noop = () => () => {};
const STAGES = ["Declare the file (File API)", "Upload to the pre-signed URL", "Start the Skin Analysis task", "Poll until the result is ready"];

export function CaptureFlow({ id, demo, baseline, mode, liveUploads, choices }: Props) {
  const userJson = useSyncExternalStore(noop, () => (demo ? "" : JSON.stringify(loadUserItems().find((u) => u.product.id === id)?.product ?? null)), () => "");
  const userProduct = userJson ? (JSON.parse(userJson) as { name: string; concerns: SdAction[] } | null) : null;
  const target = demo ?? userProduct;
  const [phase, setPhase] = useState<Phase>({ kind: "consent" });
  const [consent, setConsent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState<{ brightness: number; face: number | null; detector: boolean }>({ brightness: 0, face: null, detector: false });
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Live analysis for this visitor right now? Asked before any photo is sent, so a photo is
  // never uploaded when it would only run in demo mode.
  const [liveOk, setLiveOk] = useState<{ ok: boolean; left?: number; notice?: string }>({ ok: mode === "live" && liveUploads });
  useImmersive(phase.kind !== "consent");

  useEffect(() => {
    if (mode !== "live") return;
    let gone = false;
    fetch("/api/youcam/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { live?: boolean; left?: number; notice?: string }) => !gone && setLiveOk({ ok: j.live === true, left: j.left, notice: j.notice }))
      .catch(() => !gone && setLiveOk({ ok: false }));
    return () => {
      gone = true;
    };
  }, [mode, phase.kind]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  // Live light and framing meter, measured on the phone before any unit is spent.
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
      reportAction("camera_open");
      setPhase({ kind: "camera" });
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      reportAction("camera_denied");
      setCameraError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera access was declined. You can allow it in your browser settings, or use the sample photo to see the full flow."
          : "No camera is available here. Use the sample photo to see the full flow.",
      );
    }
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
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
        const report = checkCapture(quality, baseline ?? undefined);
        if (!report.ok) reportAction("quality_blocked");
        setPhase({ kind: "review", url: URL.createObjectURL(blob), size: blob.size, quality, report, source: "camera" });
      },
      "image/jpeg",
      0.9,
    );
  }

  function useSample() {
    reportAction("sample_photo");
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

  async function analyze(url: string, size: number, quality: CaptureQuality, source: "camera" | "sample") {
    if (!target) return;
    setPhase({ kind: "analyzing", url, stage: 0, quality });
    const tick = setInterval(() => setPhase((p) => (p.kind === "analyzing" ? { ...p, stage: Math.min(STAGES.length - 1, p.stage + 1) } : p)), 420);
    try {
      let res: Response;
      const day = new Date().toLocaleDateString("en-CA");
      // The sample photo has no face: it always runs in demo mode, live units are kept for real photos.
      if (mode === "live" && liveOk.ok && source === "camera") {
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
        setPhase({ kind: "error", url, message: json.detail ? `${json.error}. ${json.detail}` : (json.error ?? `HTTP ${res.status}`), trace: json.trace });
        return;
      }
      let saved = false;
      if (!demo) {
        const scores: Record<string, { raw: number; ui: number }> = {};
        for (const o of json.output as SkinAnalysisOutput[]) if (o.type !== "all" && o.raw_score != null && o.ui_score != null) scores[o.type] = { raw: o.raw_score, ui: o.ui_score };
        saved = addUserCapture(id, { id: `u-${Date.now()}`, productId: id, takenOn: day, quality, scores });
        if (saved) toast({ title: "Added to your timeline", detail: `${target.name}, ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, tone: "ok" });
      }
      setPhase({ kind: "done", url, output: json.output, trace: json.trace, units: json.units, mode: json.mode, saved, notice: json.notice });
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
        <NavBar title="Today's photo" back={{ href: "/", label: "Today" }} />
        <main className="vd-page vd-page--narrow">
          <LargeTitle title="Today's photo">
            <span>Which product are you tracking?</span>
          </LargeTitle>
          <section className="ui-list-section">
            <ul className="ui-list">
              {choices.map((c) => (
                <li key={c.id}>
                  <Row href={`/capture?id=${c.id}`} title={c.name} />
                </li>
              ))}
            </ul>
            <p className="ui-list__footer">The product you opened is not stored in this browser. Pick one from the demo shelf.</p>
          </section>
        </main>
      </>
    );
  }

  const units = skinAnalysisCost(target.concerns);
  const concerns = target.concerns.map((c) => concernDef(c).label).join(", ");
  const backHref = demo || userProduct ? `/product?id=${encodeURIComponent(id)}` : "/";

  if (phase.kind === "camera") {
    const lightOkNow = lightOk(live.brightness);
    const hint = !lightOkNow ? (live.brightness < QUALITY_RULES.minBrightness ? ISSUE_HINTS.too_dark : ISSUE_HINTS.overexposed) : "Hold still, then tap the shutter.";
    const pos = Math.max(0, Math.min(1, live.brightness));
    return (
      <main className="vd-page vd-page--narrow" style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
        <div className="vd-camera">
          <video ref={videoRef} playsInline muted />
          <div className="vd-camera__mask" aria-hidden>
            <div className={`vd-camera__oval${lightOkNow ? "" : " is-bad"}`} />
          </div>
          <div className="vd-camera__top" aria-live="polite">
            <span className="vd-chip ui-glass-clear is-dimmed" data-ok={lightOkNow}>
              <span className="vd-chip__dot" aria-hidden />
              Light {Math.round(live.brightness * 100)}%
            </span>
            <span className="vd-chip ui-glass-clear is-dimmed" data-ok={live.face == null ? undefined : live.face > QUALITY_RULES.minFaceWidthRatio}>
              <span className="vd-chip__dot" aria-hidden />
              {live.detector ? (live.face ? `Face ${Math.round(live.face * 100)}% wide` : "No face yet") : "Fill the oval"}
            </span>
            {baseline && (
              <span className="vd-chip ui-glass-clear is-dimmed" data-ok={Math.abs(live.brightness - baseline.brightness) <= QUALITY_RULES.maxBrightnessDrift}>
                <span className="vd-chip__dot" aria-hidden />
                Like day 0
              </span>
            )}
          </div>
          <div className="vd-lightbar ui-glass-clear is-dimmed" aria-hidden>
            <div className="vd-lightbar__track">
              <span className="vd-lightbar__ok" style={{ left: `${QUALITY_RULES.minBrightness * 100}%`, right: `${(1 - QUALITY_RULES.maxBrightness) * 100}%` }} />
              <span className="vd-lightbar__knob" style={{ left: `${pos * 100}%` }} />
            </div>
            <div className="vd-lightbar__label">
              <span>Dark</span>
              <span>Bright</span>
            </div>
          </div>
          <div className="vd-camera__bottom">
            <button
              type="button"
              className="ui-icon-button ui-glass-clear is-dimmed"
              onClick={() => {
                stopCamera();
                setPhase({ kind: "consent" });
              }}
              aria-label="Close the camera"
            >
              <Icon name="close" />
            </button>
            <button type="button" className="vd-shutter ui-glass-clear" onClick={shoot} aria-label="Take the photo">
              <span />
            </button>
            <span style={{ width: 48 }} aria-hidden />
          </div>
        </div>
        <p className="vd-footnote mt-3 text-center" aria-live="polite">
          {hint}
        </p>
      </main>
    );
  }

  return (
    <>
      <NavBar title="Today's photo" back={{ href: backHref, label: demo || userProduct ? target.name : "Today" }} />
      <main className="vd-page vd-page--narrow">
        <LargeTitle title="Today's photo">
          <span>
            {target.name} · {concerns}
          </span>
          {demo && <DemoNote />}
        </LargeTitle>

        {phase.kind === "consent" && (
          <div className="vd-stack">
            <section className="ui-list-section" aria-labelledby="c-h">
              <div className="ui-list__header">
                <strong id="c-h">Same conditions as day 0</strong>
              </div>
              <ul className="ui-list">
                <li>
                  <Row icon="sun" title="Same spot and time of day" subtitle="Face the same window or lamp" />
                </li>
                <li>
                  <Row icon="glasses" title="Glasses off, no makeup" subtitle="Hair off the forehead" />
                </li>
                <li>
                  <Row icon="face" title="Look straight ahead" subtitle="Fill the oval: your face should cover most of the frame" />
                </li>
              </ul>
              <p className="ui-list__footer">Comparable photos are what make a trend trustworthy. Photos that differ are set aside, not averaged in.</p>
            </section>

            <section className="ui-list-section" aria-labelledby="p-h">
              <div className="ui-list__header">
                <strong id="p-h">Privacy</strong>
              </div>
              <ul className="ui-list">
                <li>
                  <label className="ui-row" style={{ cursor: "pointer", minHeight: 56 }}>
                    <span className="ui-row__icon">
                      <Icon name="lock" />
                    </span>
                    <span className="ui-row__body">
                      <span className="ui-row__title">Use my face photo for cosmetic tracking</span>
                    </span>
                    <input type="checkbox" role="switch" className="ui-switch" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  </label>
                </li>
              </ul>
              <p className="ui-list__footer">
                {liveOk.ok
                  ? `Live: a camera photo is sent to YouCam AI Skin Analysis for the concerns above, then not kept by Verdict.${liveOk.left != null ? ` ${liveOk.left} live ${liveOk.left === 1 ? "analysis" : "analyses"} left for you today.` : ""}`
                  : `${liveOk.notice ? `${liveOk.notice.replace(", so this photo ran in demo mode.", ".")} ` : ""}Demo mode: the photo never leaves this device. Only its size is sent, to simulate the upload.`}{" "}
                {liveOk.ok ? `Each analysis costs ${units} units and runs only after the photo passes the quality check on this phone.` : "No units are spent in demo mode."}
              </p>
            </section>

            {cameraError && (
              <div className="ui-banner ui-banner--warn" role="alert">
                <Icon name="alert" />
                <div>
                  <strong>Camera unavailable</strong>
                  <p>{cameraError}</p>
                </div>
              </div>
            )}

            <div className="vd-actions">
              <button type="button" disabled={!consent} onClick={openCamera} className="ui-button ui-button--prominent ui-button--xl">
                <Icon name="camera" />
                Open camera
              </button>
              <button type="button" disabled={!consent} onClick={useSample} className="ui-button ui-button--lg">
                Use a sample photo
              </button>
              {!consent && <p className="vd-footnote text-center">Turn on the consent switch to continue.</p>}
            </div>
          </div>
        )}

        {phase.kind === "review" && (
          <div className="vd-photo-row">
            <Photo url={phase.url} label={phase.source === "sample" ? "Sample photo" : "Your photo"} />
            <div className="vd-stack">
              <section className="ui-list-section" aria-labelledby="q-h">
                <div className="ui-list__header">
                  <strong id="q-h">Quality check</strong>
                  <span>on this phone · 0 units</span>
                </div>
                <ul className="ui-list">
                  <Check
                    ok={phase.quality.brightness >= QUALITY_RULES.minBrightness && phase.quality.brightness <= QUALITY_RULES.maxBrightness}
                    title="Light"
                    detail={`${Math.round(phase.quality.brightness * 100)}%`}
                  />
                  <Check ok={phase.quality.faceWidthRatio > QUALITY_RULES.minFaceWidthRatio} title="Face fills the frame" detail="> 60% wide" />
                  <Check ok={phase.quality.shortSidePx >= QUALITY_RULES.minShortSidePx} title="Resolution" detail={`${phase.quality.shortSidePx} px`} />
                  {baseline && <Check ok={!phase.report.issues.includes("lighting_changed")} title="Lighting matches day 0" />}
                </ul>
                {phase.report.issues.length > 0 && (
                  <p className="ui-list__footer">
                    {phase.report.issues.map((i) => ISSUE_HINTS[i]).join(" ")}
                    {phase.report.ok && !phase.report.comparable ? " This photo would be set aside from the trend." : ""}
                  </p>
                )}
              </section>
              <div className="vd-actions">
                <button
                  type="button"
                  disabled={!phase.report.ok}
                  onClick={() => analyze(phase.url, phase.size, phase.quality, phase.source)}
                  className="ui-button ui-button--prominent ui-button--xl"
                >
                  {liveOk.ok && phase.source === "camera" ? `Analyze · ${units} units` : "Analyze · demo"}
                </button>
                <button type="button" onClick={reset} className="ui-button ui-button--lg">
                  <Icon name="retake" />
                  Retake
                </button>
                {!phase.report.ok && <p className="vd-footnote text-center">Blocked before upload, so no units are spent.</p>}
              </div>
            </div>
          </div>
        )}

        {phase.kind === "analyzing" && (
          <div className="vd-photo-row">
            <Photo url={phase.url} label="Analyzing" dim />
            <section className="ui-list-section" aria-labelledby="a-h" aria-busy="true">
              <div className="ui-list__header">
                <strong id="a-h">YouCam AI Skin Analysis</strong>
                <span>{concerns}</span>
              </div>
              <ol className="vd-steps ui-list" aria-live="polite">
                {STAGES.map((s, i) => (
                  <li key={s} className={i > phase.stage ? "is-todo" : ""}>
                    <span className="vd-step-icon" aria-hidden>
                      {i < phase.stage ? (
                        <Icon name="checkCircle" />
                      ) : i === phase.stage ? (
                        <span className="ui-spinner">
                          {Array.from({ length: 8 }, (_, k) => (
                            <i key={k} />
                          ))}
                        </span>
                      ) : null}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="ui-list__footer">A failed task costs nothing. Units are confirmed only when the task succeeds.</p>
            </section>
          </div>
        )}

        {phase.kind === "done" && (
          <div className="vd-photo-row">
            <Photo url={phase.url} label={phase.mode === "mock" ? "Stayed on this device" : "Analyzed"} />
            <div className="vd-stack">
              <section className="ui-list-section" aria-labelledby="r-h">
                <div className="ui-list__header">
                  <strong id="r-h">Result</strong>
                  <span>{phase.mode === "mock" ? "Synthetic scores" : "Live · YouCam"}</span>
                </div>
                <ul className="ui-list">
                  {phase.output
                    .filter((o) => o.type !== "all")
                    .map((o) => (
                      <li key={o.type}>
                        <div className="ui-row">
                          <span className="ui-row__body">
                            <span className="ui-row__title">{concernDef(o.type as SdAction).label}</span>
                            <span className="ui-row__subtitle">raw {o.raw_score}</span>
                          </span>
                          <span className="vd-row-trailing">
                            <b className="text-label" style={{ fontSize: "var(--text-title3)", fontWeight: 600 }}>
                              {o.ui_score}
                            </b>
                            /100
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
                <p className="ui-list__footer">
                  {phase.saved
                    ? "Added to this product's timeline on this device."
                    : "Demo product: this photo is not added to its synthetic series. Add your own product to build a real timeline."}
                </p>
              </section>
              {phase.notice && (
                <div className="ui-banner" role="status">
                  <Icon name="info" />
                  <div>
                    <p>{phase.notice}</p>
                  </div>
                </div>
              )}
              <TraceList trace={phase.trace} units={phase.units} />
              <div className="vd-actions">
                <Link href={`/product?id=${encodeURIComponent(id)}`} className="ui-button ui-button--prominent ui-button--xl">
                  See the timeline
                </Link>
                <button type="button" onClick={reset} className="ui-button ui-button--lg ui-button--destructive">
                  <Icon name="trash" />
                  Delete photo
                </button>
              </div>
            </div>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="vd-photo-row">
            {phase.url ? <Photo url={phase.url} label="Not analyzed" dim /> : <span />}
            <div className="vd-stack">
              <div className="ui-banner ui-banner--critical" role="alert">
                <Icon name="alert" />
                <div>
                  <strong>The analysis did not complete</strong>
                  <p>{phase.message} No units were charged.</p>
                </div>
              </div>
              {phase.trace && phase.trace.length > 0 && <TraceList trace={phase.trace} units={0} />}
              <div className="vd-actions">
                <button type="button" onClick={reset} className="ui-button ui-button--prominent ui-button--xl">
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
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

function Check({ ok, title, detail }: { ok: boolean; title: string; detail?: string }) {
  return (
    <li>
      <div className="ui-row">
        <span className="ui-row__icon" style={{ background: "transparent", color: ok ? "var(--status-ok)" : "var(--status-critical)" }} aria-hidden>
          <Icon name={ok ? "checkCircle" : "stop"} />
        </span>
        <span className="ui-row__body">
          <span className="ui-row__title">{title}</span>
        </span>
        {detail && <span className="vd-row-trailing">{detail}</span>}
        <span className="ui-visually-hidden">{ok ? "passed" : "failed"}</span>
      </div>
    </li>
  );
}

function Photo({ url, label, dim }: { url: string; label: string; dim?: boolean }) {
  return (
    <div className={`vd-photo${dim ? " is-dim" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded in demo mode */}
      <img src={url} alt={label} />
      <span className="vd-chip ui-glass-clear is-dimmed">
        <span className="vd-chip__dot" aria-hidden />
        {label}
      </span>
    </div>
  );
}

function TraceList({ trace, units }: { trace: TraceStep[]; units: number }) {
  return (
    <section className="ui-list-section" aria-labelledby="t-h">
      <div className="ui-list__header">
        <strong id="t-h">API calls</strong>
        <span className="ui-num">{units ? `${units} units` : "0 units charged"}</span>
      </div>
      <ol className="vd-trace ui-list">
        {trace.map((t, i) => (
          <li key={i}>
            <span className="m">{t.method}</span>
            <span className="p">{t.path}</span>
            <span className={`s${t.status < 300 ? "" : " is-bad"}`}>{t.taskStatus ?? t.status}</span>
          </li>
        ))}
      </ol>
      <p className="ui-list__footer">The pre-signed upload URL is never shown or logged. The API key stays on the server.</p>
    </section>
  );
}
