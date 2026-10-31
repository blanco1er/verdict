"use client";

/**
 * The user's saved looks, on this device only (IndexedDB). YouCam result links expire
 * after about two hours, so the image itself is copied here when the user saves it.
 */
export interface Saved {
  id: string;
  kind: string;
  title: string;
  createdAt: number;
  blob: Blob;
}

const DB = "verdict-gallery";
const STORE = "looks";
const EVENT = "verdict:gallery";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Fetches the image (through our proxy for YouCam links) and stores it. */
export async function saveLook(input: { url: string; kind: string; title: string }): Promise<Saved> {
  const src = /^https?:\/\//.test(input.url) && !input.url.startsWith(location.origin) ? `/api/image?u=${encodeURIComponent(input.url)}` : input.url;
  const res = await fetch(src);
  if (!res.ok) throw new Error("The image could not be copied");
  const item: Saved = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, kind: input.kind, title: input.title, createdAt: Date.now(), blob: await res.blob() };
  await tx("readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event(EVENT));
  return item;
}

export async function listLooks(): Promise<Saved[]> {
  try {
    const all = await tx<Saved[]>("readonly", (s) => s.getAll() as IDBRequest<Saved[]>);
    return all.filter((x) => x.kind !== "me" && x.kind !== "me-body").sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteLook(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event(EVENT));
}

export function onGalleryChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** iPhone share sheet (Save Image, Messages, Instagram…), or a plain download elsewhere. */
export async function shareLook(blob: Blob, title: string): Promise<void> {
  const file = new File([blob], `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "verdict"}.jpg`, { type: blob.type || "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${title} · Verdict` });
      return;
    } catch {
      return; // share sheet dismissed
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
