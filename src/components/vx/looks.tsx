"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { deleteLook, listLooks, onGalleryChange, shareLook, type Saved } from "@/lib/gallery";

type Shown = Saved & { url: string };

function useLooks(): Shown[] | null {
  const [items, setItems] = useState<Shown[] | null>(null);
  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    const load = () =>
      listLooks().then((all) => {
        if (!alive) return;
        urls.forEach((u) => URL.revokeObjectURL(u));
        const next = all.map((s) => ({ ...s, url: URL.createObjectURL(s.blob) }));
        urls = next.map((s) => s.url);
        setItems(next);
      });
    void load();
    const off = onGalleryChange(() => void load());
    return () => {
      alive = false;
      off();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  return items;
}

const KIND: Record<string, string> = { look: "Makeup", hair: "Hair", outfit: "Outfit" };

/** Full-screen view of one saved look: share (Photos, Messages…) or delete. */
function Viewer({ item, onClose }: { item: Shown; onClose: () => void }) {
  return (
    <div className="vx-viewer" role="dialog" aria-modal="true" aria-label={item.title}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local saved image */}
      <img src={item.url} alt={item.title} />
      <div className="vx-viewer__top">
        <button type="button" className="vx-round vx-round--dark" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="vx-viewer__bottom">
        <div>
          <b>{item.title}</b>
          <span>
            {KIND[item.kind] ?? "Look"} · {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="vx-round vx-round--dark" onClick={() => void shareLook(item.blob, item.title)} aria-label="Share or save to Photos">
            <Icon name="share" />
          </button>
          <button
            type="button"
            className="vx-round vx-round--dark"
            onClick={() => {
              void deleteLook(item.id);
              onClose();
            }}
            aria-label="Delete"
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Today: the last saved looks, one swipe away. */
export function LooksStrip() {
  const items = useLooks();
  const [open, setOpen] = useState<Shown | null>(null);
  if (items == null) return null;
  return (
    <section className="vx-section" aria-labelledby="looks-h">
      <div className="vx-section__head">
        <h2 id="looks-h">Your looks</h2>
        {items.length > 0 ? <Link href="/gallery">See all</Link> : <span>0</span>}
      </div>
      {items.length === 0 ? (
        <Link href="/try" className="vx-looks-empty">
          <span className="vx-looks-empty__art" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- sample try-on */}
            <img src="/sample/try/all_pink_perfect.jpg" alt="" />
          </span>
          <span>
            <b>Try a look on your face</b>
            <small>Makeup, hair, outfits. Save the ones you love here.</small>
          </span>
          <Icon name="chevron" />
        </Link>
      ) : (
        <ul className="vx-looks">
          {items.slice(0, 10).map((it) => (
            <li key={it.id}>
              <button type="button" onClick={() => setOpen(it)} aria-label={it.title}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local saved image */}
                <img src={it.url} alt="" />
                <span>{it.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <Viewer item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** The gallery page: every saved look in a grid. */
export function LooksGallery() {
  const items = useLooks();
  const [open, setOpen] = useState<Shown | null>(null);
  if (items == null) return null;
  if (items.length === 0)
    return (
      <div className="vx-section">
        <Link href="/try" className="vx-looks-empty">
          <span className="vx-looks-empty__art" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- sample try-on */}
            <img src="/sample/try/all_pink_perfect.jpg" alt="" />
          </span>
          <span>
            <b>Nothing saved yet</b>
            <small>Open Try, apply a style, tap the heart.</small>
          </span>
          <Icon name="chevron" />
        </Link>
      </div>
    );
  return (
    <>
      <ul className="vx-gallery">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => setOpen(it)} aria-label={it.title}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local saved image */}
              <img src={it.url} alt="" />
              <span>{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <Viewer item={open} onClose={() => setOpen(null)} />}
    </>
  );
}
