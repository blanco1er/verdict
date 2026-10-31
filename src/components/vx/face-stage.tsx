"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { MeshCanvas, type Fit } from "@/components/vx/face-overlay";
import { CONCERN_ZONE, ZONES, imageLandmarker } from "@/lib/face/landmarker";

export interface MaskLayer {
  key: string;
  label: string;
  url: string;
}

/**
 * A photo, scanned: the mesh is revealed top to bottom (on the phone), then the
 * YouCam masks of the measured concerns light up on the face, one toggle each.
 */
export function FaceStage({ url, label, scanning, masks, scores }: { url: string; label: string; scanning?: boolean; masks?: MaskLayer[]; scores?: Array<{ type: string; label: string; score: number }> }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [reveal, setReveal] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [clock, setClock] = useState(0);

  // A clock for the live numbers: scanning percentages, then scores counting up.
  const sig = scores?.map((x) => `${x.type}${x.score}`).join(",") ?? "";
  useEffect(() => {
    if (!scanning && !sig) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      setClock(now - t0);
      if (scanning || now - t0 < 1600) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scanning, sig]);

  let tagText: Record<string, string> | undefined;
  if (scanning) {
    tagText = Object.fromEntries(ZONES.map((z, i) => [z.key, `${z.label} · ${Math.max(0, Math.min(99, Math.floor((clock - i * 260) / 22)))}%`]));
  } else if (scores?.length) {
    const k = Math.min(1, clock / 1400);
    const e = 1 - Math.pow(1 - k, 3);
    const byZone: Record<string, string[]> = {};
    for (const sc of scores) {
      const zone = CONCERN_ZONE[sc.type] ?? "forehead";
      (byZone[zone] ??= []).push(`${sc.label} ${Math.round(sc.score * e)}`);
    }
    tagText = Object.fromEntries(ZONES.map((z) => [z.key, byZone[z.key]?.join(" · ") ?? ""]));
  }

  // Landmarks on the still photo, then a 1.6 s reveal.
  useEffect(() => {
    let alive = true;
    let raf = 0;
    const run = async () => {
      const el = img.current;
      if (!el) return;
      if (!el.complete) await new Promise((r) => el.addEventListener("load", r, { once: true }));
      try {
        const lm = await imageLandmarker();
        const l = lm.detect(el).faceLandmarks?.[0] ?? null;
        if (!alive) return;
        setLandmarks(l);
      } catch {
        /* no tracking on this device: the photo stays plain */
      }
      const t0 = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const k = Math.min(1, (now - t0) / 1600);
        setReveal(k);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    void run();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [url]);

  useEffect(() => {
    const measure = () => {
      const b = box.current, i = img.current;
      if (b && i && i.naturalWidth) setFit({ cw: b.clientWidth, ch: b.clientHeight, mw: i.naturalWidth, mh: i.naturalHeight, mirrored: false });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    img.current?.addEventListener("load", measure);
    return () => ro.disconnect();
  }, [url]);

  const shown = masks?.filter((m) => loaded[m.key]) ?? [];
  const current = active ?? shown[0]?.key ?? null;

  return (
    <div className="vx-stage">
      <div ref={box} className={`vx-stage__photo${scanning ? " is-scanning" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
        <img ref={img} src={url} alt={label} />
        {masks?.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element -- YouCam result mask (signed URL, 2 h)
          <img
            key={m.key}
            src={m.url}
            alt=""
            className={`vx-stage__mask${current === m.key ? " is-on" : ""}`}
            onLoad={() => setLoaded((l) => ({ ...l, [m.key]: true }))}
            onError={() => setLoaded((l) => ({ ...l, [m.key]: false }))}
          />
        ))}
        <MeshCanvas landmarks={landmarks} fit={fit} ok={!scanning && reveal >= 1} reveal={reveal} zones={!current || current === "none" || !!scores?.length} tagText={tagText} />
        {scanning && <span className="vx-scan__line" aria-hidden />}
        <span className="vx-scan__label">{label}</span>
        {landmarks && (
          <span className="vx-stage__readout" aria-hidden>
            {landmarks.length} points · {ZONES.length} zones{scanning ? ` · ${(clock / 1000).toFixed(1)} s` : ""}
          </span>
        )}
      </div>
      {shown.length > 0 && (
        <div className="vx-stage__toggles" role="tablist" aria-label="YouCam masks">
          {shown.map((m) => (
            <button key={m.key} type="button" role="tab" aria-selected={current === m.key} onClick={() => setActive(m.key)}>
              {m.label}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={current === "none"} onClick={() => setActive("none")}>
            Mesh
          </button>
        </div>
      )}
    </div>
  );
}
