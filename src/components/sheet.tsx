"use client";

import Link from "next/link";
import { reportAction } from "@/components/visit-beacon";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { closeSheet, init, openSheet } from "@/design-system/motion.js";
import { Icon } from "@/components/icons";

/**
 * A modal <dialog> left open when its page is hidden or unmounted (a link inside it, Back)
 * keeps the whole document inert: nothing can be tapped any more. Close it first.
 */
function useModalRelease(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onLink = (e: MouseEvent) => {
      if ((e.target as Element).closest?.("a[href]") && d.open) d.close("navigate");
    };
    d.addEventListener("click", onLink);
    return () => {
      d.removeEventListener("click", onLink);
      if (d.open) d.close("navigate");
    };
  }, [ref]);
}

/**
 * Native <dialog> sheet from the design system: bottom sheet on iPhone (drag to
 * dismiss, velocity-aware spring), centred on desktop. Cancel left, action right.
 */
export function Sheet({
  open,
  onClose,
  title,
  cancelLabel = "Close",
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  cancelLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (wrap.current) init(wrap.current);
    const d = ref.current;
    const h = () => onCloseRef.current();
    d?.addEventListener("close", h);
    return () => d?.removeEventListener("close", h);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) openSheet(d);
    if (!open && d.open) closeSheet(d);
  }, [open]);
  useModalRelease(ref);
  return (
    <div ref={wrap}>
      <dialog ref={ref} className="ui-sheet" aria-labelledby={id}>
        <div className="ui-sheet__grabber" aria-hidden />
        <div className="ui-sheet__bar">
          <button type="button" className="ui-button ui-button--plain" onClick={() => closeSheet(ref.current, "cancel")}>
            {cancelLabel}
          </button>
          <h2 id={id} className="ui-sheet__title">
            {title}
          </h2>
          {action ?? <span />}
        </div>
        <div className="ui-sheet__body">{children}</div>
      </dialog>
    </div>
  );
}

/** Alert: a question, the concrete consequence, two equal buttons. */
export function Alert({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (wrap.current) init(wrap.current);
    const d = ref.current;
    const h = () => onCloseRef.current();
    d?.addEventListener("close", h);
    return () => d?.removeEventListener("close", h);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) openSheet(d);
    if (!open && d.open) closeSheet(d);
  }, [open]);
  useModalRelease(ref);
  return (
    <div ref={wrap}>
      <dialog ref={ref} className="ui-sheet ui-alert ui-glass" aria-labelledby={id} role="alertdialog">
        <div className="ui-sheet__body">
          <h2 id={id}>{title}</h2>
          <p>{message}</p>
        </div>
        <div className="ui-alert__actions">
          <button type="button" className="ui-button ui-button--lg" onClick={() => closeSheet(ref.current, "cancel")}>
            Cancel
          </button>
          <button
            type="button"
            className="ui-button ui-button--lg ui-button--destructive"
            onClick={() => {
              closeSheet(ref.current, "confirm");
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** "Synthetic data" note: quiet, tappable, explains exactly what is generated. */
export function DemoNote({ label = "Synthetic data" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="vd-demo-note" onClick={() => (reportAction("sheet_about"), setOpen(true))} aria-haspopup="dialog">
        <Icon name="info" />
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="About this demo">
        <p className="vd-sheet-lead">
          Products, photos and scores on these screens are generated for the demo. They follow the documented YouCam AI Skin Analysis response
          (raw_score and ui_score per concern), so the verdict engine runs exactly as it will on real photos.
        </p>
        <ul className="vd-sheet-list">
          <li>
            <Icon name="calendar" />
            The demo date is fixed to Thursday, November 5, 2026, so every visitor sees the same story.
          </li>
          <li>
            <Icon name="lock" />
            In demo mode your own photo never leaves this device. Only its size is sent, to simulate the upload.
          </li>
          <li>
            <Icon name="bolt" />
            With the live key, the same screens call YouCam AI Skin Analysis, Skin Simulation and Look VTO.
          </li>
          <li>
            <Icon name="info" />
            <span>
              Cosmetic guidance only, not medical advice. Anonymous usage is logged to improve the demo (<Link href="/privacy">Privacy</Link>).
            </span>
          </li>
        </ul>
      </Sheet>
    </>
  );
}
