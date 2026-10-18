"use client";

import { useSyncExternalStore } from "react";
import { Logo, PageHeader, STATUS_STYLE, StatusPill, fmtDay } from "@/components/ui";
import { loadUserItems, useLocalToday } from "@/lib/demo/store";
import type { DemoItem } from "@/lib/demo/shelf";
import { concernDef } from "@/lib/tracking/concerns";
import type { IsoDay } from "@/lib/tracking/model";
import { checkCapture } from "@/lib/tracking/quality";
import { computeVerdict } from "@/lib/tracking/verdict";

const noop = () => () => {};

/** Printable evidence for a return (or a review): every photo, its quality, its scores. */
export function ProofView({ demo, id, demoToday }: { demo: DemoItem | null; id: string; demoToday: IsoDay }) {
  const userJson = useSyncExternalStore(noop, () => (demo ? "" : JSON.stringify(loadUserItems().find((u) => u.product.id === id) ?? null)), () => "");
  const localToday = useLocalToday();
  const item = demo ?? (userJson ? (JSON.parse(userJson) as DemoItem | null) : null);
  if (!item) return <PageHeader back={{ href: "/", label: "Today" }} />;
  const today = demo ? demoToday : (localToday ?? demoToday);
  const { product, captures } = item;
  const v = computeVerdict(product, captures, today);
  const seen = captures.filter((c) => c.takenOn <= today);
  const base = seen.find((c) => checkCapture(c.quality).ok);
  return (
    <>
      <div className="no-print">
        <PageHeader back={{ href: `/product?id=${encodeURIComponent(id)}`, label: product.name }} />
      </div>
      <article className="card rise p-6">
        <header className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Verdict report</p>
              <h1 className="text-[20px] font-semibold tracking-tight">{product.name}</h1>
            </div>
          </div>
          <StatusPill status={v.status} />
        </header>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-muted">Bought</dt>
          <dd className="text-right tabular-nums">{fmtDay(product.purchasedOn)}</dd>
          <dt className="text-muted">Return deadline</dt>
          <dd className="text-right tabular-nums">{fmtDay(v.deadline)}</dd>
          <dt className="text-muted">Tracked concerns</dt>
          <dd className="text-right">{product.concerns.map((c) => concernDef(c).label).join(", ")}</dd>
          <dt className="text-muted">Comparable photos</dt>
          <dd className="text-right tabular-nums">{v.usableCaptures} of {seen.length}</dd>
        </dl>
        <p className="mt-4 rounded-2xl px-4 py-3 text-[14.5px] font-semibold leading-6" style={{ background: `color-mix(in srgb, ${STATUS_STYLE[v.status].color} 10%, transparent)`, color: STATUS_STYLE[v.status].color }}>
          {v.headline}
        </p>
        <p className="mt-3 text-[13px] leading-5 text-muted">“{product.claim}”</p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-[12.5px] tabular-nums">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">Date</th>
                {product.concerns.map((c) => (
                  <th key={c} className="py-2 pr-2 font-semibold">{concernDef(c).label} <span className="normal-case">raw</span></th>
                ))}
                <th className="py-2 font-semibold">Photo</th>
              </tr>
            </thead>
            <tbody>
              {seen.map((c) => {
                const q = checkCapture(c.quality, base?.quality);
                return (
                  <tr key={c.id} className="border-b border-line/70">
                    <td className="py-2 pr-2">{fmtDay(c.takenOn)}</td>
                    {product.concerns.map((a) => (
                      <td key={a} className="py-2 pr-2">{c.scores[a]?.raw.toFixed(1) ?? "–"}</td>
                    ))}
                    <td className={`py-2 ${q.comparable ? "text-keep" : "text-mixed"}`}>{q.comparable ? "used" : "set aside"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="mt-5 text-[11.5px] leading-5 text-muted">
          Measured with YouCam AI Skin Analysis (SD). Trends use raw_score with a least-squares fit and a noise floor; photos with different
          lighting or framing are set aside. Cosmetic guidance, not medical advice.{demo ? " Synthetic demo data." : ""}
        </footer>
      </article>
      <button type="button" onClick={() => window.print()} className="no-print h-12 rounded-full bg-foreground text-[15px] font-semibold text-background">
        Save as PDF
      </button>
    </>
  );
}
