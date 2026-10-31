"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { reportAction } from "@/components/visit-beacon";
import { toast } from "@/design-system/motion.js";
import { fitPhoto } from "@/lib/fit-photo";
import { deleteLook, saveLook, shareLook } from "@/lib/gallery";
import SAMPLE_TRYONS from "@/lib/live/sample-tryons.json";
import type { TryKind, TryTemplate } from "@/lib/youcam/client";
import { TRY_SHELVES, tryTemplates } from "@/lib/youcam/try-catalogue";

type Kind = TryKind;
const KINDS: Array<{ kind: Kind; label: string }> = [
  { kind: "look", label: "Makeup" },
  { kind: "hair", label: "Hair" },
  { kind: "outfit", label: "Outfits" },
];
// Largest side YouCam accepts per feature (File Specs & Errors, docs.perfectcorp.com): Look VTO
// "long side < 1920" but its error says height < 1080; hairstyles "long side <= 1024"; clothes 4096.
const MAX_SIDE: Record<Kind, number> = { look: 1024, hair: 1024, outfit: 1600 };
const READY = SAMPLE_TRYONS as Record<string, { kind: string; url: string }>;
const SAMPLE = "/sample/selfie.jpg";
const SAMPLE_BODY = "/sample/body.jpg";

type TryReply = { url?: string; notice?: string; error?: string; detail?: string };

/** The route answers JSON; a platform refusal (too large, timeout) does not, and is not a lost connection. */
async function readTry(res: Response): Promise<TryReply> {
  try {
    return (await res.json()) as TryReply;
  } catch {
    return { error: res.status === 413 ? "This photo is too large. Nothing was charged." : "This try-on did not work. Nothing was charged." };
  }
}

/**
 * Try: a mirror. Your photo, large; a strip of styles under it; tap one and the mirror
 * changes (YouCam Look VTO or Hairstyle). Hold the mirror to see yourself without it.
 */
export function TryView() {
  const [kind, setKind] = useState<Kind>("look");
  const [filter, setFilter] = useState(0);
  const [photo, setPhoto] = useState<{ url: string; file: File | null }>({ url: SAMPLE, file: null });
  const [picked, setPicked] = useState<TryTemplate | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [sweep, setSweep] = useState(0);
  const [clean, setClean] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liked, setLiked] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<TryTemplate | null>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pressRef = useRef<{ timer: number; long: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);
  const isSample = photo.file == null;
  const baseUrl = isSample ? (kind === "outfit" ? SAMPLE_BODY : SAMPLE) : photo.url;

  // Styles: on the sample, the ones already applied come first.
  const items = useMemo(() => {
    const all = tryTemplates(kind, filter);
    if (!isSample) return all;
    return [...all.filter((t) => READY[t.id]), ...all.filter((t) => !READY[t.id])];
  }, [kind, filter, isSample]);

  // The mirror never opens empty on the sample: start on a finished look.
  useEffect(() => {
    if (!isSample || picked) return;
    const first = [0, 1, 2, 3, 4, 5, 6].flatMap((f) => tryTemplates(kind, f)).find((t) => READY[t.id]);
    if (first) {
      const t = setTimeout(() => setPicked(first), 0);
      return () => clearTimeout(t);
    }
  }, [isSample, picked, kind]);

  const key = picked ? `${baseUrl}|${picked.id}` : "";
  const shown = picked ? (isSample && READY[picked.id] ? READY[picked.id].url : results[key]) : undefined;

  async function choose(t: TryTemplate, own?: { url: string; file: File }) {
    // On the example, a style that is not ready asks for the user's own photo first.
    if (!own && isSample && !READY[t.id]) {
      setAsk(t);
      return;
    }
    setPicked(t);
    setNote(null);
    setSweep((n) => n + 1);
    reportAction("try_pick");
    if (!own && isSample && READY[t.id]) return;
    const url = own?.url ?? baseUrl;
    const file = own?.file ?? photo.file;
    const k = `${url}|${t.id}`;
    if (results[k] || !file) return;
    setBusy(t.id);
    try {
      const base = file;
      const form = new FormData();
      form.set("kind", kind);
      form.set("template", t.id);
      form.set("photo", await fitPhoto(base, MAX_SIDE[kind]));
      const res = await fetch("/api/youcam/try", { method: "POST", body: form });
      const j = await readTry(res);
      const url = j.url;
      if (url) setResults((r) => ({ ...r, [k]: url }));
      else setNote(j.notice ?? (j.detail ? `${j.error}. ${j.detail}` : (j.error ?? "This try-on did not work. No units were charged.")));
    } catch {
      setNote("No connection. Nothing was charged.");
    } finally {
      setBusy(null);
    }
  }

  /** A photo chosen from the "Try it on you" sheet: it becomes the mirror, then the style is applied. */
  function applyPhotoFor(f: File) {
    const t = ask;
    setAsk(null);
    const own = { url: URL.createObjectURL(f), file: f };
    setPhoto(own);
    if (t) void choose(t, own);
  }

  /** The user's own garment or haircut photo, applied to the photo in the mirror. */
  async function tryOwn(ref: File) {
    const t: TryTemplate = { id: `own-${ref.name}-${ref.size}`, title: kind === "outfit" ? "Your item" : "Your haircut", thumb: URL.createObjectURL(ref) };
    setPicked(t);
    setNote(null);
    setSweep((n) => n + 1);
    reportAction("try_own");
    const k = `${baseUrl}|${t.id}`;
    setBusy(t.id);
    try {
      const base = photo.file ?? new File([await (await fetch(baseUrl)).blob()], "photo.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.set("kind", kind);
      form.set("photo", await fitPhoto(base, MAX_SIDE[kind]));
      form.set("ref", await fitPhoto(ref, MAX_SIDE[kind]));
      const res = await fetch("/api/youcam/try", { method: "POST", body: form });
      const j = await readTry(res);
      const url = j.url;
      if (url) {
        setResults((r) => ({ ...r, [k]: url }));
      } else setNote(j.notice ?? (j.detail ? `${j.error}. ${j.detail}` : (j.error ?? "This try-on did not work. No units were charged.")));
    } catch {
      setNote("No connection. Nothing was charged.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    document.body.classList.toggle("vx-clean", clean || !!ask);
    return () => document.body.classList.remove("vx-clean");
  }, [clean, ask]);

  // Tap: hide everything to see the photo alone. Hold: compare with the photo without the style.
  function pressStart() {
    const p = { timer: 0, long: false };
    p.timer = window.setTimeout(() => {
      p.long = true;
      setHolding(true);
    }, 220);
    pressRef.current = p;
  }
  function pressEnd() {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.long) setHolding(false);
    else setClean((c) => !c);
  }

  /** The heart: saves the look to the gallery (filled, stays filled); a second tap removes it. */
  async function toggleLike() {
    if (!shown || !picked || saving) return;
    const k = `${baseUrl}|${picked.id}`;
    const id = liked[k];
    navigator.vibrate?.(10);
    if (id) {
      setLiked((l) => {
        const n = { ...l };
        delete n[k];
        return n;
      });
      void deleteLook(id);
      return;
    }
    setLiked((l) => ({ ...l, [k]: "pending" }));
    setSaving(true);
    try {
      const item = await saveLook({ url: shown, kind, title: picked.title });
      setLiked((l) => ({ ...l, [k]: item.id }));
      reportAction("look_save");
    } catch {
      setLiked((l) => {
        const n = { ...l };
        delete n[k];
        return n;
      });
      toast({ title: "Could not save", detail: "Try again in a moment.", tone: "info" });
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const src = holding || !shown ? baseUrl : shown;
    try {
      const res = await fetch(/^https?:\/\//.test(src) && !src.startsWith(location.origin) ? `/api/image?u=${encodeURIComponent(src)}` : src);
      reportAction("look_share");
      await shareLook(await res.blob(), picked?.title ?? "Verdict");
    } catch {
      toast({ title: "Could not share", detail: "Try again in a moment.", tone: "info" });
    }
  }

  return (
    <main className={`vx-try${clean ? " is-clean" : ""}`}>
      <div
        className={`vx-mirror${busy ? " is-busy" : ""}${kind === "outfit" ? " is-body" : ""}`}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- blurred fill behind the photo */}
        <img src={shown && !holding ? shown : baseUrl} alt="" aria-hidden className="vx-mirror__bg" />
        {/* eslint-disable-next-line @next/next/no-img-element -- the user's photo or the sample */}
        <img src={baseUrl} alt="Your photo" className="vx-mirror__base" />
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element -- YouCam result
          <img key={shown} src={shown} alt={picked ? `${picked.title} on your photo` : ""} className={`vx-mirror__look${holding ? " is-hidden" : ""}`} />
        )}
        <span key={sweep} className="vx-mirror__sweep" aria-hidden />
      </div>

      {clean && (
        <button type="button" className="vx-try__download" onClick={() => void share()} aria-label="Download this photo">
          <Icon name="download" />
        </button>
      )}

      {shown && (
        <div className="vx-try__actions">
          <button
            key={`${baseUrl}|${picked?.id}|${liked[`${baseUrl}|${picked?.id}`] ? 1 : 0}`}
            type="button"
            className={`vx-round vx-round--dark vx-heart${liked[`${baseUrl}|${picked?.id}`] ? " is-liked" : ""}`}
            onClick={() => void toggleLike()}
            aria-pressed={!!liked[`${baseUrl}|${picked?.id}`]}
            aria-label={liked[`${baseUrl}|${picked?.id}`] ? "Saved to your looks. Tap to remove" : "Save to your looks"}
          >
            <Icon name="heart" />
          </button>
          <button type="button" className="vx-round vx-round--dark" onClick={() => void share()} aria-label="Share or save to Photos" title="Share">
            <Icon name="share" />
          </button>
        </div>
      )}

      <div className="vx-try__top">
        <div className="vx-mirror__kinds" role="tablist" aria-label="What to try">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="tab"
              aria-selected={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setFilter(0);
                setPicked(null);
                setNote(null);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vx-try__bottom">
        <div className="vx-try__caption">
          <div>
            <b>{busy ? "Applying…" : holding ? "Without" : (picked?.title ?? "Pick a style")}</b>
            <span>
              {note ?? (isSample ? "On the example · try it on yourself" : shown && !holding ? "Your photo · hold to compare" : "Your photo · pick a style")}
              {!isSample && (
                <button type="button" className="vx-back-example" onClick={() => (setPhoto({ url: SAMPLE, file: null }), setPicked(null), setNote(null))}>
                  Back to the example
                </button>
              )}
            </span>
          </div>
          <button type="button" className={`vx-you${isSample ? "" : " has-photo"}`} onClick={() => (isSample ? setAsk({ id: "", title: "", thumb: "" }) : fileRef.current?.click())} aria-label={isSample ? "Use my photo" : "Change my photo"}>
            <span className="vx-you__ring">
              {isSample ? (
                <Icon name="camera" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- the user's photo
                <img src={photo.url} alt="" />
              )}
              <i>
                <Icon name="plus" />
              </i>
            </span>
            <span className="vx-you__label">{isSample ? "You" : "Change"}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPhoto({ url: URL.createObjectURL(f), file: f });
              setPicked(null);
              setNote(kind === "outfit" ? "Tap an outfit: a full-body photo works best (2 units)." : "Tap a style: YouCam applies it to your photo (2 units).");
            }}
          />
        </div>
        <div className="vx-filters vx-filters--dark" role="tablist" aria-label="Style">
          {TRY_SHELVES[kind].filters.map((f, i) => (
            <button key={f.label} type="button" role="tab" aria-selected={filter === i} onClick={() => setFilter(i)}>
              {f.label}
            </button>
          ))}
        </div>
        <ul className="vx-strip vx-strip--dark" aria-label="Styles">
          {kind !== "look" && (
            <li>
              <button type="button" onClick={() => refRef.current?.click()} aria-pressed={!!picked?.id.startsWith("own-")}>
                <span className="vx-strip__thumb">
                  {picked?.id.startsWith("own-") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the user's own reference photo
                    <img src={picked.thumb} alt="" />
                  ) : (
                    <span className="vx-strip__own">
                      <Icon name="plus" />
                    </span>
                  )}
                  {busy?.startsWith("own-") && <i className="vx-strip__spin" />}
                </span>
                <span className="vx-strip__name">{kind === "outfit" ? "Your item" : "Your cut"}</span>
              </button>
              <input
                ref={refRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void tryOwn(f);
                  e.target.value = "";
                }}
              />
            </li>
          )}
          {items.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => void choose(t)} aria-pressed={picked?.id === t.id} className={isSample && READY[t.id] ? "is-ready" : ""}>
                <span className="vx-strip__thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouCam catalogue thumbnail or sample result */}
                  <img src={isSample && READY[t.id] ? READY[t.id].url : t.thumb} alt="" loading="lazy" />
                  {busy === t.id && <i className="vx-strip__spin" />}
                </span>
                <span className="vx-strip__name">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {ask && (
        <div className="vx-overlay" onClick={() => setAsk(null)}>
          <div className="vx-sheet vx-ask" role="dialog" aria-modal="true" aria-labelledby="ask-h" onClick={(e) => e.stopPropagation()}>
            <span className="vx-sheet__grab" aria-hidden />
            <div className="vx-ask__head">
              {ask.thumb && (
                // eslint-disable-next-line @next/next/no-img-element -- YouCam catalogue thumbnail
                <img src={ask.thumb} alt="" />
              )}
              <div>
                <h2 id="ask-h">{ask.title ? `Try ${ask.title} on you` : kind === "outfit" ? "Try outfits on you" : "Try styles on your face"}</h2>
                <p>{kind === "outfit" ? "Head to toe, standing straight, arms a little away from the body." : "Face the light, your whole face and hair in view."}</p>
              </div>
            </div>
            <button type="button" className="vx-go vx-go--wide" onClick={() => selfieRef.current?.click()}>
              <Icon name="camera" />
              {kind === "outfit" ? "Take a full-body photo" : "Take a selfie"}
            </button>
            <button type="button" className="vx-ask__alt" onClick={() => libraryRef.current?.click()}>
              Choose a photo
            </button>
            <input
              ref={selfieRef}
              type="file"
              accept="image/*"
              capture={kind === "outfit" ? "environment" : "user"}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) applyPhotoFor(f);
                e.target.value = "";
              }}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) applyPhotoFor(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
