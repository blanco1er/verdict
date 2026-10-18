"use client";

import { useSyncExternalStore } from "react";
import { ShelfRow } from "@/components/shelf-row";
import { loadUserItems, useLocalToday } from "@/lib/demo/store";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
let cache = "";
let parsed: ReturnType<typeof loadUserItems> = [];
function snapshot() {
  const items = loadUserItems();
  const key = JSON.stringify(items);
  if (key !== cache) {
    cache = key;
    parsed = items;
  }
  return parsed;
}
const empty: ReturnType<typeof loadUserItems> = [];

/** Products the visitor added: they live on the real calendar, in this browser only. */
export function UserShelf() {
  const items = useSyncExternalStore(subscribe, snapshot, () => empty);
  const today = useLocalToday();
  if (!today || items.length === 0) return null;
  return (
    <>
      {items.map((item) => (
        <ShelfRow key={item.product.id} item={item} today={today} />
      ))}
    </>
  );
}

export function useUserItemCount(): number {
  return useSyncExternalStore(subscribe, snapshot, () => empty).length;
}
