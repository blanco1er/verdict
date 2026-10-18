// Types for the shared design-system motion module (copied verbatim from
// Challenges-automne-2026/design-system/motion.js on 18 Oct 2026).
export type SpringPreset = "smooth" | "snappy" | "bouncy" | "quick";
export interface SpringOptions {
  preset?: SpringPreset;
  duration?: number;
  bounce?: number;
  velocity?: number;
  delay?: number;
  fill?: FillMode;
  composite?: CompositeOperation;
}
export function init(scope?: Document | Element | null): void;
export function spring(el: Element | null | undefined, keyframes: Keyframe[] | PropertyIndexedKeyframes, opts?: SpringPreset | SpringOptions): Animation | null;
export function springEasing(duration?: number, bounce?: number, velocity?: number): { easing: string; duration: number };
export function springValueTo(o: {
  from: number;
  to: number;
  velocity?: number;
  duration?: number;
  bounce?: number;
  onUpdate?: (v: number) => void;
  onDone?: () => void;
}): { stop(): void };
export function toast(o: {
  title: string;
  detail?: string;
  tone?: "ok" | "critical" | "info";
  action?: { label: string; onClick?: () => void };
  duration?: number;
}): { dismiss(): void };
export function openSheet(dialog: HTMLDialogElement | string | null): void;
export function closeSheet(dialog: HTMLDialogElement | string | null, returnValue?: string): void;
export function prefersReducedMotion(): boolean;
declare const UI: Record<string, unknown>;
export default UI;
