"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ZONES, meshEdges } from "@/lib/face/landmarker";

/** Laser lines on the face structure (MediaPipe landmark indices). */
const LASER: number[][] = [
  [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152], // symmetry axis
  [54, 103, 67, 109, 10, 338, 297, 332, 284], // hairline arc
  [70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300], // brow line
  [234, 50, 129], // left cheekbone to nose wing
  [50, 61], // left cheek to mouth corner
  [454, 280, 358], // right cheekbone to nose wing
  [280, 291], // right cheek to mouth corner
  [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397], // jaw
];
const NODES = [10, 9, 1, 0, 199, 50, 280, 61, 291, 105, 334, 234, 454, 152];

export interface Fit {
  /** Container size in CSS px. */
  cw: number;
  ch: number;
  /** Media intrinsic size. */
  mw: number;
  mh: number;
  mirrored: boolean;
}

/** object-fit: cover mapping from normalized landmark to container pixels. */
export function project(fit: Fit, p: { x: number; y: number }): [number, number] {
  const s = Math.max(fit.cw / fit.mw, fit.ch / fit.mh);
  const ox = (fit.cw - fit.mw * s) / 2;
  const oy = (fit.ch - fit.mh * s) / 2;
  let x = ox + p.x * fit.mw * s;
  const y = oy + p.y * fit.mh * s;
  if (fit.mirrored) x = fit.cw - x;
  return [x, y];
}

/**
 * The live mesh: 478 points, the face contour and the measured zones.
 * `reveal` (0..1) uncovers it top to bottom, for the scan of a still photo.
 */
export function MeshCanvas({ landmarks, fit, ok, reveal = 1, zones = true, tagText }: { landmarks: NormalizedLandmark[] | null; fit: Fit | null; ok: boolean; reveal?: number; zones?: boolean; tagText?: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tagRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const edgesRef = useRef<Array<{ start: number; end: number }> | null>(null);
  useEffect(() => {
    meshEdges().then((e) => (edgesRef.current = e)).catch(() => {});
  }, []);

  const props = useRef({ landmarks, fit, ok, reveal, zones, tagText });
  useLayoutEffect(() => {
    props.current = { landmarks, fit, ok, reveal, zones, tagText };
  });

  function draw(t: number) {
    const { landmarks, fit, ok, reveal, zones, tagText } = props.current;
    const c = ref.current;
    if (!c || !fit) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (c.width !== Math.round(fit.cw * dpr)) {
      c.width = Math.round(fit.cw * dpr);
      c.height = Math.round(fit.ch * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fit.cw, fit.ch);
    if (!landmarks) {
      tagRefs.current.forEach((el) => el && (el.style.opacity = "0"));
      return;
    }
    const pts = landmarks.map((p) => project(fit, p));
    const ys = pts.map((p) => p[1]);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const cut = top + (bottom - top) * reveal;

    // Facial mapping, in the spirit of a light projected on the skin: a faint low-poly mesh,
    // warm laser lines on the structure of the face, and a few glowing measuring nodes.
    const laser = ok ? "120, 230, 170" : "255, 132, 112";
    const visible = (i: number) => pts[i][1] <= cut;
    const edges = edgesRef.current;
    const top0 = Math.min(...ys);
    const span = Math.max(...ys) - top0 || 1;
    const waveY = top0 + span * (((t / 2600) % 1.25) - 0.1);
    if (edges) {
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = `rgba(255, 255, 255, ${ok ? 0.1 : 0.08})`;
      ctx.beginPath();
      for (const { start, end } of edges) {
        if (!visible(start) || !visible(end)) continue;
        ctx.moveTo(pts[start][0], pts[start][1]);
        ctx.lineTo(pts[end][0], pts[end][1]);
      }
      ctx.stroke();
      // a band of light travelling down the mesh
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `rgba(${ok ? "160, 255, 200" : "255, 190, 175"}, 0.42)`;
      ctx.beginPath();
      for (const { start, end } of edges) {
        const y = (pts[start][1] + pts[end][1]) / 2;
        if (Math.abs(y - waveY) > 26 || !visible(start) || !visible(end)) continue;
        ctx.moveTo(pts[start][0], pts[start][1]);
        ctx.lineTo(pts[end][0], pts[end][1]);
      }
      ctx.stroke();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = `rgba(${laser}, 0.9)`;
    for (const [width, alpha, blur] of [
      [3.2, 0.18, 10],
      [1.1, 0.85, 4],
    ] as const) {
      ctx.lineWidth = width;
      ctx.shadowBlur = blur;
      ctx.strokeStyle = `rgba(${laser}, ${alpha})`;
      ctx.beginPath();
      for (const line of LASER) {
        let on = false;
        for (const i of line) {
          if (!visible(i)) {
            on = false;
            continue;
          }
          if (!on) ctx.moveTo(pts[i][0], pts[i][1]);
          else ctx.lineTo(pts[i][0], pts[i][1]);
          on = true;
        }
      }
      ctx.stroke();
    }
    // light pulses running along every laser line
    ctx.setLineDash([16, 220]);
    ctx.lineDashOffset = -t * 0.11;
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    for (const line of LASER) {
      let on = false;
      for (const i of line) {
        if (!visible(i)) {
          on = false;
          continue;
        }
        if (!on) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
        on = true;
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // measuring nodes: a soft halo and a bright core
    NODES.forEach((i, n) => {
      if (!visible(i)) return;
      const [x, y] = pts[i];
      const breath = 0.5 + 0.5 * Math.sin(t / 420 + n * 0.9);
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(${laser}, ${0.22 + 0.3 * breath})`;
      ctx.beginPath();
      ctx.arc(x, y, 3.4 + 2.6 * breath, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
    // a ring on the chin and between the brows, like a projected target
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${laser}, 0.8)`;
    for (const i of [9, 199]) {
      if (!visible(i)) continue;
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 7 + Math.sin(t / 500) * 1.5, t / 700, t / 700 + Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // scan front line while revealing
    if (reveal < 1) {
      const g = ctx.createLinearGradient(0, cut - 40, 0, cut);
      g.addColorStop(0, "rgba(255, 125, 157, 0)");
      g.addColorStop(1, "rgba(255, 125, 157, 0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, cut - 40, fit.cw, 40);
      ctx.fillStyle = "rgba(255, 125, 157, 0.95)";
      ctx.fillRect(0, cut - 1, fit.cw, 2);
    }

    const noseX = pts[4][0];
    ZONES.forEach((z, i) => {
      const el = tagRefs.current[i];
      if (!el) return;
      const [x, y] = pts[z.at];
      const text = tagText ? tagText[z.key] : z.label;
      const show = zones && y <= cut && !!text;
      const label = el.querySelector("b");
      if (label && text && label.textContent !== text) label.textContent = text;
      el.style.opacity = show ? "1" : "0";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.classList.toggle("is-ok", ok);
      el.classList.toggle("is-left", x < noseX - 8);
    });
  }


  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
  });
  // One loop draws every frame: the face moves in the camera, the light moves on a still photo.
  useEffect(() => {
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      drawRef.current(t);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="vx-mesh" aria-hidden>
      <canvas ref={ref} style={{ width: fit?.cw, height: fit?.ch }} />
      {ZONES.map((z, i) => (
        <span
          key={z.key}
          ref={(el) => {
            tagRefs.current[i] = el;
          }}
          className="vx-mesh__tag"
          style={{ opacity: 0 }}
        >
          <i />
          <b>{z.label}</b>
        </span>
      ))}
    </div>
  );
}
