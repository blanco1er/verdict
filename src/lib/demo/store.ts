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
}

const noopSubscribe = () => () => {};
const localToday = () => new Date().toLocaleDateString("en-CA");

/** The visitor's local calendar day; null during prerender (no clock on the server). */
export function useLocalToday(): string | null {
  return useSyncExternalStore(noopSubscribe, localToday, () => null);
}
