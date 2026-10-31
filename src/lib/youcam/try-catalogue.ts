import raw from "./try-catalogue.json";
import type { TryKind, TryTemplate } from "./client";

/** YouCam catalogue snapshot (30 Oct 2026), curated: no costumes, no named people. */
export const TRY_SHELVES: Record<TryKind, { label: string; photo: string; filters: Array<{ label: string; categories: string[] }> }> = {
  look: {
    label: "Makeup",
    photo: "A selfie, face to the camera",
    filters: [
      { label: "Daily", categories: ["Daily", "Work"] },
      { label: "Evening", categories: ["Party", "Red Carpet"] },
      { label: "Runway", categories: ["Fashion Week", "Makeup Artist"] },
      { label: "Wedding", categories: ["Wedding"] },
      { label: "K-Beauty", categories: ["K-Pop", "Spring"] },
    ],
  },
  hair: {
    label: "Hair",
    photo: "A selfie with your hair visible",
    filters: [
      { label: "Women", categories: ["Female"] },
      { label: "Men", categories: ["Male"] },
    ],
  },
  outfit: {
    label: "Outfits",
    photo: "A full-body or half-body photo",
    filters: [
      { label: "Everyday", categories: ["Everyday", "Casual"] },
      { label: "Modern", categories: ["Modern", "Urban Classic"] },
      { label: "Summer", categories: ["Summer"] },
      { label: "Edgy", categories: ["Edgy"] },
      { label: "Him", categories: ["Masculine"] },
      { label: "Her", categories: ["Feminine"] },
      { label: "Wedding", categories: ["Wedding"] },
    ],
  },
};

/** Titles that name a brand or a real person never reach the screen. */
const BLOCKED = /dior|chanel|kendall|kusama|irina|julie|kardashian|taylor|celebrity/i;

const CATALOGUE = raw as Record<TryKind, Array<{ id: string; title: string; thumb: string; category: string }>>;

export function tryTemplates(kind: TryKind, filter: number): TryTemplate[] {
  const cats = new Set(TRY_SHELVES[kind].filters[filter]?.categories ?? []);
  return CATALOGUE[kind].filter((t) => cats.has(t.category) && !BLOCKED.test(t.title)).map((t) => ({ id: t.id, title: t.title, thumb: t.thumb, category_name: t.category }));
}

export function findTemplate(kind: TryKind, id: string): TryTemplate | undefined {
  const t = CATALOGUE[kind]?.find((x) => x.id === id);
  return t && { id: t.id, title: t.title, thumb: t.thumb, category_name: t.category };
}
