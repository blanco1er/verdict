"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Studio } from "./studio";
import { useEffect, useState, useSyncExternalStore } from "react";
import { NavBar, useImmersive } from "@/components/chrome";
import { FaceStage } from "@/components/vx/face-stage";
import { SkinToday } from "@/components/vx/skin-today";
import SAMPLE from "@/lib/live/sample-analysis.json";
import { CountUp } from "@/components/vx/live";
import { LIVE_STEPS, LiveCard } from "@/components/vx/live-card";
import { Icon } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { LargeTitle, Row } from "@/components/ui";
import { reportAction } from "@/components/visit-beacon";
import { toast } from "@/design-system/motion.js";
import { addUserCapture, loadUserItems } from "@/lib/demo/store";
import { concernDef, simulationFor } from "@/lib/tracking/concerns";
import type { CaptureQuality } from "@/lib/tracking/model";
import { ISSUE_HINTS, QUALITY_RULES, checkCapture, type QualityReport } from "@/lib/tracking/quality";
import { skinAnalysisCost, skinSimulationCost } from "@/lib/youcam/costs";
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
  | { kind: "done"; url: string; output: SkinAnalysisOutput[]; trace: TraceStep[]; units: number; mode: string; saved: boolean; notice?: string; fileId?: string }
  | { kind: "error"; url?: string; message: string; trace?: TraceStep[] };

interface Props {
  id: string;
  demo: { name: string; concerns: SdAction[] } | null;
  baseline: CaptureQuality | null;
  mode: "mock" | "live";
  liveUploads: boolean;
  choices: Array<{ id: string; name: string }>;
  dayLabel: string;
  day0?: Partial<Record<SdAction, number>>;
}

const noop = () => () => {};
const STAGES = ["Declare the file (File API)", "Upload to the pre-signed URL", "Start the Skin Analysis task", "Poll until the result is ready"];

export function CaptureFlow({ id, demo, baseline, mode, liveUploads, choices, dayLabel, day0 }: Props) {
  const router = useRouter();
  const userJson = useSyncExternalStore(noop, () => (demo ? "" : JSON.stringify(loadUserItems().find((u) => u.product.id === id)?.product ?? null)), () => "");
  const userProduct = userJson ? (JSON.parse(userJson) as { name: string; concerns: SdAction[] } | null) : null;
  const target = demo ?? userProduct;
  const [phase, setPhase] = useState<Phase>({ kind: "consent" });
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

  async function useSample() {
    reportAction("sample_photo");
    const blob = await (await fetch("/sample/selfie.jpg")).blob();
    // Real values of the sample, measured once (src/lib/live/sample-analysis.json).
    const quality: CaptureQuality = { faceWidthRatio: 0.78, brightness: 0.52, yawDeg: 3, shortSidePx: 720 };
    setPhase({ kind: "review", url: URL.createObjectURL(blob), size: blob.size, quality, report: checkCapture(quality, baseline ?? undefined), source: "sample" });
  }

  async function analyze(url: string, size: number, quality: CaptureQuality, source: "camera" | "sample") {
    if (!target) return;
    setPhase({ kind: "analyzing", url, stage: 0, quality });
    const tick = setInterval(() => setPhase((p) => (p.kind === "analyzing" ? { ...p, stage: Math.min(STAGES.length - 1, p.stage + 1) } : p)), 420);
    if (source === "sample") {
      // The sample was analysed once with the live API: its real scores and masks are replayed, no units spent.
      await new Promise((r) => setTimeout(r, 2200));
      clearInterval(tick);
      const wanted = new Set<string>(target.concerns);
      const output = SAMPLE.output.filter((o) => wanted.has(o.type)) as SkinAnalysisOutput[];
      setPhase({
        kind: "done",
        url,
        output,
        units: 0,
        mode: "sample",
        saved: false,
        trace: [
          { method: "POST", path: "/s2s/v2.0/file", status: 200, ms: 412 },
          { method: "PUT", path: "pre-signed upload URL", status: 200, ms: 690 },
          { method: "POST", path: "/s2s/v2.0/task/skin-analysis", status: 200, ms: 388 },
          { method: "GET", path: "/s2s/v2.0/task/skin-analysis/{task_id}", status: 200, ms: 3010, taskStatus: "success" },
        ],
      });
      return;
    }
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
      const known = new Set<string>([...target.concerns, "all"]);
      setPhase({ kind: "done", url, output: (json.output as SkinAnalysisOutput[]).filter((o) => known.has(o.type)), trace: json.trace, units: json.units, mode: json.mode, saved, notice: json.notice, fileId: json.fileId });
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

  if (phase.kind === "consent" || phase.kind === "camera") {
    return (
      <Studio
        productName={target.name}
        dayLabel={dayLabel}
        onShot={({ blob, quality, source }) => {
          const report = checkCapture(quality, baseline ?? undefined);
          if (!report.ok) reportAction("quality_blocked");
          setPhase({ kind: "review", url: URL.createObjectURL(blob), size: blob.size, quality, report, source });
        }}
        onSample={useSample}
        onClose={() => router.push(backHref)}
      />
    );
  }

  const q = "quality" in phase ? phase.quality : null;
  const chips =
    phase.kind === "review" && q
      ? [
          { ok: q.brightness >= QUALITY_RULES.minBrightness && q.brightness <= QUALITY_RULES.maxBrightness, t: `Light ${Math.round(q.brightness * 100)}%` },
          { ok: q.faceWidthRatio > QUALITY_RULES.minFaceWidthRatio, t: q.faceWidthRatio ? "Face framed" : "No face found" },
          { ok: Math.abs(q.yawDeg) <= QUALITY_RULES.maxYawDeg, t: `Angle ${Math.abs(q.yawDeg)}°` },
          { ok: q.shortSidePx >= QUALITY_RULES.minShortSidePx, t: `${q.shortSidePx} px` },
          ...(baseline ? [{ ok: !phase.report.issues.includes("lighting_changed"), t: "Like day 0" }] : []),
        ]
      : [];
  const masks =
    phase.kind === "done" && (phase.mode === "live" || phase.mode === "sample")
      ? phase.output
          .filter((o) => o.type !== "all" && o.mask_urls?.[0])
          .map((o) => ({ key: o.type, label: concernDef(o.type as SdAction).label, url: o.mask_urls![0] }))
      : undefined;

  return (
    <main className="vx-page vx-cap">
      <div className="vx-top">
        <button type="button" className="vx-round" onClick={reset} aria-label="Back to the camera" title="Camera">
          <Icon name="back" />
        </button>
        <span className="vx-cap__chip">
          <b>{target.name}</b>
          {` · ${dayLabel}`}
        </span>
        <span style={{ width: 44 }} />
      </div>

      {"url" in phase && phase.url && (
        <FaceStage
          key={phase.url}
          url={phase.url}
          label={phase.kind === "analyzing" ? "Measuring" : phase.kind === "done" ? (phase.mode === "live" ? "YouCam · live" : phase.mode === "sample" ? "Sample · real YouCam result" : "Demo · stayed on this phone") : phase.kind === "error" ? "Not analysed" : phase.source === "sample" ? "Sample photo" : "Your photo"}
          scanning={phase.kind === "analyzing"}
          masks={masks}
          scores={
            phase.kind === "done"
              ? phase.output.filter((o) => o.type !== "all" && o.ui_score != null).map((o) => ({ type: o.type, label: concernDef(o.type as SdAction).label.replace("Fine lines", "Lines"), score: o.ui_score ?? 0 }))
              : undefined
          }
        />
      )}

      {phase.kind === "review" && (
        <>
          <div className="vx-chips" aria-label="Checked on this phone">
            {chips.map((c) => (
              <span key={c.t} className={`vx-chip${c.ok ? " is-ok" : " is-bad"}`}>
                <Icon name={c.ok ? "check" : "close"} />
                {c.t}
              </span>
            ))}
          </div>
          {phase.report.issues.length > 0 && <p className="vx-cap__note">{phase.report.issues.map((i) => ISSUE_HINTS[i]).join(" ")}</p>}
          <div className="vx-cap__actions">
            <button type="button" disabled={!phase.report.ok} onClick={() => analyze(phase.url, phase.size, phase.quality, phase.source)} className="vx-go vx-go--wide">
              {liveOk.ok && phase.source === "camera" ? `Analyse with YouCam · ${units} units` : "Analyse · demo"}
            </button>
            <button type="button" onClick={reset} className="vx-quiet">
              <Icon name="retake" />
              Retake
            </button>
          </div>
        </>
      )}

      {phase.kind === "analyzing" && <LiveCard stage={phase.stage} concerns={concerns} />}

      {phase.kind === "done" && (
        <>
          <SkinToday output={phase.output.filter((o) => o.type !== "all")} day0={phase.mode === "sample" ? undefined : day0} live={phase.mode !== "mock"} />
          {phase.notice && <p className="vx-cap__note">{phase.notice}</p>}
          <PromisedResult before={phase.url} live={phase.mode === "live"} fileId={phase.fileId} concerns={target.concerns} />
          <div className="vx-cap__actions">
            <Link href={`/product?id=${encodeURIComponent(id)}`} className="vx-go vx-go--wide">
              See the verdict
            </Link>
            <button type="button" onClick={reset} className="vx-quiet">
              <Icon name="retake" />
              Take another photo
            </button>
          </div>
          <details className="vx-tech">
            <summary>
              {phase.mode === "sample" ? "Real YouCam AI Skin Analysis of this sample, measured once on Oct 30 · details" : `Measured with YouCam AI Skin Analysis · ${phase.units} units${phase.saved ? "" : " · demo product, not added to its story"}`}
            </summary>
            <LiveCard stage={LIVE_STEPS.length} done trace={phase.trace} units={phase.units} concerns={concerns} />
          </details>
        </>
      )}

      {phase.kind === "error" && (
        <>
          <p className="vx-cap__note" role="alert">
            <b>The analysis did not complete.</b> {phase.message} No units were charged.
          </p>
          {phase.trace && phase.trace.length > 0 && <LiveCard stage={1} done trace={phase.trace} units={0} />}
          <div className="vx-cap__actions">
            <button type="button" onClick={reset} className="vx-go vx-go--wide">
              Try again
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function meanLuma(d: Uint8ClampedArray): number {
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4) / 255;
}

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

/** "The promised result": YouCam Skin Simulation on the photo just analysed live (same file, no second upload). */
function PromisedResult({ before, live, fileId, concerns }: { before: string; live: boolean; fileId?: string; concerns: SdAction[] }) {
  const params = simulationFor(concerns, 0.5);
  const active = Object.keys(params).length;
  const [sim, setSim] = useState<{ state: "idle" | "busy" | "done" | "error"; url?: string; units?: number; error?: string }>({ state: "idle" });
  const [split, setSplit] = useState(50);
  if (active === 0) return null;
  const units = skinSimulationCost(active);
  const labels = concerns.filter((c) => concernDef(c).simulation).map((c) => concernDef(c).label.toLowerCase()).join(" and ");

  async function render() {
    setSim({ state: "busy" });
    try {
      const res = await fetch("/api/youcam/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId, concerns }) });
      const json = await res.json();
      if (!res.ok) return setSim({ state: "error", error: json.detail ? `${json.error}. ${json.detail}` : json.error ?? `HTTP ${res.status}` });
      reportAction("sheet_promised");
      setSim({ state: "done", url: json.url, units: json.units });
    } catch (e) {
      setSim({ state: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <section className="vx-promise-card" aria-labelledby="sim-h">
      {sim.state === "done" && sim.url ? (
        <div className="vx-compare" style={{ ["--split" as string]: `${split}%`, aspectRatio: "4 / 5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived YouCam result URL, not stored */}
          <img src={sim.url} alt={`Your skin with ${labels} improved, as promised`} />
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={before} alt="Your skin today" className="vx-compare__before" />
          <span className="vx-compare__line" aria-hidden />
          <span className="vx-compare__tag is-l">Today</span>
          <span className="vx-compare__tag is-r">As promised</span>
          <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Today and as promised" />
        </div>
      ) : (
        <div className="vx-promise-card__teaser">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={before} alt="" />
          <span className="vx-promise-card__glow" aria-hidden />
        </div>
      )}
      <div className="vx-promise-card__body">
        <h3 id="sim-h">{sim.state === "done" ? "This is what “working” looks like" : "See your skin as promised"}</h3>
        <p>
          {sim.state === "done"
            ? `Slide to compare. If the product works, your next photos move toward this.`
            : `Your own photo, with ${labels} improved. Then you know what to look for.`}
        </p>
        {sim.state !== "done" &&
          (live && fileId ? (
            <button type="button" className="vx-go" onClick={render} disabled={sim.state === "busy"}>
              {sim.state === "busy" ? "Rendering…" : `Show me · ${units} units`}
            </button>
          ) : (
            <p className="vx-cap__note">Available with a live photo.</p>
          ))}
        {sim.state === "error" && <p className="vx-cap__note" role="alert">{sim.error} No units were charged.</p>}
      </div>
    </section>
  );
}
