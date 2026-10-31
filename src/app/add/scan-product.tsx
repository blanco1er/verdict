"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { fmtDay, plural } from "@/components/ui";
import { reportAction } from "@/components/visit-beacon";
import { Bottle } from "@/components/vx/live";
import { bottleKind } from "@/components/vx/product-bits";
import { toast } from "@/design-system/motion.js";
import { saveProductThumb, saveUserProduct, useLocalToday } from "@/lib/demo/store";
import { concernDef, readClaim } from "@/lib/tracking/concerns";
import { newProduct, trackingPlan } from "@/lib/tracking/plan";
import type { SdAction } from "@/lib/youcam/types";

const WINDOWS = [14, 30, 60, 90];
const MIN_DAYS = 7;
const MAX_DAYS = 180;
const READ_STEPS = ["Reading the label", "Finding the promise", "Choosing what to measure", "Checking the barcode"];

interface Scan {
  name: string;
  brand: string;
  kind: string;
  claim: string;
  promisedDays: number | null;
  concerns: SdAction[];
  image?: string;
  verifiedBy: string | null;
  confidence: number;
  actives?: string[];
  basis?: "claim" | "actives" | "both" | "none";
}

type Step = { at: "camera" } | { at: "reading"; url: string; stage: number } | { at: "result"; url?: string; scan: Scan | null; notice?: string };

/** Add a product by filming it: the label is read, the promise becomes the plan. Typing is optional. */
export function ScanProduct() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ at: "camera" });
  const [camError, setCamError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [claim, setClaim] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [custom, setCustom] = useState(false);
  // The default return window chosen in Settings.
  useEffect(() => {
    let d = 30;
    try {
      d = Number(localStorage.getItem("verdict:window") ?? "30") || 30;
    } catch {
      /* private mode */
    }
    const t = setTimeout(() => (setWindowDays(d), setCustom(!WINDOWS.includes(d))), 0);
    return () => clearTimeout(t);
  }, []);
  const today = useLocalToday() ?? "2026-11-05";
  const [bought, setBought] = useState("");
  const purchasedOn = bought || today;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (step.at !== "camera") return;
    let gone = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (gone) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => !gone && setCamError("No camera here. Import a photo of the product, or type it."));
    return () => {
      gone = true;
      stop();
    };
  }, [step.at, stop]);

  async function read(blob: Blob) {
    stop();
    const url = URL.createObjectURL(blob);
    setStep({ at: "reading", url, stage: 0 });
    const tick = setInterval(() => setStep((s) => (s.at === "reading" ? { ...s, stage: Math.min(READ_STEPS.length - 1, s.stage + 1) } : s)), 1100);
    try {
      const form = new FormData();
      form.set("photo", blob, "product.jpg");
      const res = await fetch("/api/product/scan", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) {
        setStep({ at: "result", url, scan: null, notice: j.notice ?? "Could not read this photo." });
        setEditing(true);
        return;
      }
      const scan = j as Scan;
      setName(scan.name);
      setClaim(scan.claim);
      setStep({ at: "result", url, scan });
      setEditing(!scan.claim && scan.concerns.length === 0);
      reportAction("product_scanned");
    } catch {
      setStep({ at: "result", url, scan: null, notice: "No connection. Type the product instead." });
      setEditing(true);
    } finally {
      clearInterval(tick);
    }
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    navigator.vibrate?.(12);
    c.toBlob((b) => b && void read(b), "image/jpeg", 0.88);
  }

  const scan = step.at === "result" ? step.scan : null;
  const concerns: SdAction[] = editing || !scan ? readClaim(claim).concerns : scan.concerns;
  const plan = trackingPlan(claim, purchasedOn, windowDays);
  const ready = (claim.trim().length > 8 || concerns.length > 0) && concerns.length > 0;

  async function start() {
    if (!ready) return;
    const product = newProduct(
      { name: name || scan?.name || "My product", brand: scan?.brand, claim: claim || scan?.claim || (scan?.actives?.length ? `No promise printed. Actives: ${scan.actives.join(", ")}.` : ""), purchasedOn, returnWindowDays: windowDays, concerns: editing ? undefined : scan?.concerns, promisedDays: editing ? undefined : scan?.promisedDays },
      `u-${Date.now().toString(36)}`,
    );
    saveUserProduct(product);
    if ("url" in step && step.url) await saveProductThumb(product.id, step.url);
    reportAction("add_product");
    toast({ title: "Tracking started", detail: `${product.name}: verdict by ${fmtDay(plan.decisionDate)}`, tone: "ok" });
    router.push(`/product?id=${product.id}`);
  }

  if (step.at === "camera") {
    return (
      <div className="vx-studio">
        <div className="vx-studio__view">
          <video ref={videoRef} playsInline muted className="is-on vx-rear" />
          <div className="vx-frame" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="vx-studio__top">
          <button type="button" className="vx-round vx-round--dark" onClick={() => (stop(), router.back())} aria-label="Close">
            <Icon name="close" />
          </button>
          <span className="vx-studio__chip">
            <b>Scan your product</b>
          </span>
        </div>
        <p className="vx-studio__hint" aria-live="polite">
          <span className="vx-dot" />
          {camError ?? "Front label in the frame, then tap"}
        </p>
        <div className="vx-studio__bar">
          <button type="button" className="vx-studio__side" onClick={() => fileRef.current?.click()}>
            <Icon name="doc" />
            Import
          </button>
          <button type="button" className="vx-studio__shutter" onClick={shoot} aria-label="Scan the label" disabled={!!camError}>
            <svg viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="34" className="vx-studio__ring" />
            </svg>
            <i />
          </button>
          <button
            type="button"
            className="vx-studio__side"
            onClick={() => {
              stop();
              setStep({ at: "result", scan: null });
              setEditing(true);
            }}
          >
            <Icon name="tag" />
            Type it
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
        </div>
      </div>
    );
  }

  return (
    <main className="vx-page vx-cap">
      <div className="vx-top">
        <button type="button" className="vx-round" onClick={() => (setStep({ at: "camera" }), setEditing(false))} aria-label="Scan again">
          <Icon name="back" />
        </button>
        <span className="vx-cap__chip">
          <b>New product</b>
        </span>
        <span style={{ width: 44 }} />
      </div>

      {step.at === "reading" && (
        <>
          <div className="vx-stage__photo is-scanning" style={{ marginTop: 12, aspectRatio: "4 / 3" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={step.url} alt="Your product" />
            <span className="vx-scan__line" aria-hidden />
            <span className="vx-scan__label">Reading</span>
          </div>
          <ol className="vx-reading" aria-live="polite">
            {READ_STEPS.map((s, i) => (
              <li key={s} className={i < step.stage ? "is-done" : i === step.stage ? "is-now" : ""}>
                <i />
                {s}
              </li>
            ))}
          </ol>
        </>
      )}

      {step.at === "result" && (
        <>
          <div className="vx-found">
            <div className="vx-found__media">
              {scan?.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- Open Beauty Facts image
                <img src={scan.image} alt="" />
              ) : step.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img src={step.url} alt="" />
              ) : (
                <Bottle hue={36} level={1} kind={bottleKind(name || "serum")} size={64} />
              )}
            </div>
            <div className="min-w-0">
              <p className="vx-eyebrow">{scan ? (scan.verifiedBy ? `Found · ${scan.verifiedBy}` : "Read from the label") : "Type the product"}</p>
              <h1 className="vx-id__name">{name || scan?.name || "New product"}</h1>
              {scan?.brand && <p className="vx-id__line">{scan.brand}</p>}
            </div>
          </div>
          {step.notice && <p className="vx-cap__note">{step.notice}</p>}

          {!editing && scan && (scan.claim || scan.concerns.length > 0) ? (
            <>
              {scan.claim ? <p className="vx-quote">&ldquo;{scan.claim}&rdquo;</p> : <p className="vx-quote" style={{ color: "var(--vx-ink-2)" }}>No promise printed on the pack.</p>}
              {scan.actives && scan.actives.length > 0 && (scan.basis === "actives" || scan.basis === "both") && (
                <p className="vx-callout">
                  {`${scan.basis === "actives" ? "Measured from its actives" : "Completed with its actives"}: ${scan.actives.join(", ")}.`}
                </p>
              )}
              <button type="button" className="vx-quiet" onClick={() => setEditing(true)}>
                <Icon name="tag" />
                Edit
              </button>
            </>
          ) : (
            <div className="vx-fields">
              <label>
                <span>Product</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on the box" autoComplete="off" />
              </label>
              <label>
                <span>What it promises</span>
                <textarea value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="e.g. Reduces redness in 14 days" rows={3} />
              </label>
            </div>
          )}

          <section className="vx-section" aria-labelledby="m-h">
            <div className="vx-section__head">
              <h2 id="m-h">Verdict will measure</h2>
              <span>{concerns.length ? plural(concerns.length, "concern") : "–"}</span>
            </div>
            <div className="vx-chips">
              {concerns.length ? (
                concerns.map((c) => (
                  <span key={c} className="vx-chip is-ok">
                    <Icon name="check" />
                    {concernDef(c).label}
                  </span>
                ))
              ) : (
                <span className="vx-chip is-bad">Name what it promises to start</span>
              )}
            </div>
          </section>

          <section className="vx-section" aria-labelledby="w-h">
            <div className="vx-section__head">
              <h2 id="w-h">Return window</h2>
              <span>{`bought ${fmtDay(purchasedOn)}`}</span>
            </div>
            <div className="vx-seg" role="radiogroup" aria-label="Return window">
              {WINDOWS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={!custom && windowDays === d} onClick={() => (setCustom(false), setWindowDays(d))}>
                  {`${d} days`}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)}>
                Custom
              </button>
            </div>
            {custom && (
              <div className="vx-stepper">
                <span>Days to return it</span>
                <div>
                  <button type="button" className="vx-round" aria-label="One day less" disabled={windowDays <= MIN_DAYS} onClick={() => setWindowDays((d) => Math.max(MIN_DAYS, d - 1))}>
                    <Icon name="minus" />
                  </button>
                  <b aria-live="polite">{windowDays}</b>
                  <button type="button" className="vx-round" aria-label="One day more" disabled={windowDays >= MAX_DAYS} onClick={() => setWindowDays((d) => Math.min(MAX_DAYS, d + 1))}>
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
            )}
            <label className="vx-date">
              <span>Bought on</span>
              {/* The visible date follows the app language; the native picker opens on top of it. */}
              <span className="vx-date__pick">
                <b>{fmtDay(purchasedOn)}</b>
                <input type="date" value={purchasedOn} max={today} onChange={(e) => setBought(e.target.value)} aria-label="Bought on" />
              </span>
            </label>
          </section>

          <div className="vx-cap__actions">
            <button type="button" className="vx-go vx-go--wide" disabled={!ready} onClick={start}>
              Start measuring
            </button>
            {ready && <p className="vx-cap__note" style={{ textAlign: "center" }}>{`Verdict by ${fmtDay(plan.decisionDate)}, before the return deadline.`}</p>}
          </div>
        </>
      )}
    </main>
  );
}
