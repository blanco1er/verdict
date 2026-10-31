"use client";

import { useSyncExternalStore } from "react";
import type { Capture, Product } from "../tracking/model";
import type { DemoItem } from "./shelf";

/**
 * Products the visitor adds in the demo live in this browser only
 * (localStorage). Nothing is sent to a server; "Delete" removes them.
 */
const KEY = "verdict.products.v1";

export interface StoredItem {
  product: Product;
  captures: Capture[];
}

export function loadUserItems(): DemoItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as StoredItem[]) : [];
    return list.map((s) => ({ ...s, retailer: "Added by you", price: "", story: "", hue: 18 }));
  } catch {
    return [];
  }
}

function save(list: StoredItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode: the demo still works for this page view */
  }
}

export function saveUserProduct(product: Product): void {
  const list = loadUserItems().map(({ product: p, captures }) => ({ product: p, captures }));
  save([...list.filter((s) => s.product.id !== product.id), { product, captures: [] }]);
}

export function addUserCapture(productId: string, capture: Capture): boolean {
  const list = loadUserItems().map(({ product, captures }) => ({ product, captures }));
  const item = list.find((s) => s.product.id === productId);
  if (!item) return false;
  item.captures = [...item.captures.filter((c) => c.takenOn !== capture.takenOn), capture];
  save(list);
  return true;
}

export function deleteUserProduct(productId: string): void {
  save(loadUserItems().filter((s) => s.product.id !== productId).map(({ product, captures }) => ({ product, captures })));
  try {
    window.localStorage.removeItem(THUMB + productId);
  } catch {
    /* nothing stored */
  }
}

const THUMB = "verdict:thumb:";

/** Keeps a small square of the scanned packshot, so the product shows as itself. */
export async function saveProductThumb(productId: string, src: string): Promise<void> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 240;
    canvas.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 240, 240);
    window.localStorage.setItem(THUMB + productId, canvas.toDataURL("image/jpeg", 0.82));
  } catch {
    /* the drawn bottle stays */
  }
}

export function readProductThumb(productId: string): string | null {
  try {
    return window.localStorage.getItem(THUMB + productId);
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};
const localToday = () => new Date().toLocaleDateString("en-CA");

/** The visitor's local calendar day; null during prerender (no clock on the server). */
export function useLocalToday(): string | null {
  return useSyncExternalStore(noopSubscribe, localToday, () => null);
}
