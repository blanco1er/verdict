"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { NavBar } from "@/components/chrome";
import { Icon, Logo } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { LargeTitle, STATUS, StatusLabel, fmtDay } from "@/components/ui";
import { toast } from "@/design-system/motion.js";
import type { DemoItem } from "@/lib/demo/shelf";
import { loadUserItems, useLocalToday } from "@/lib/demo/store";
import { concernDef } from "@/lib/tracking/concerns";
import type { IsoDay } from "@/lib/tracking/model";
import { checkCapture } from "@/lib/tracking/quality";
import { computeVerdict } from "@/lib/tracking/verdict";
import { verdictSummary } from "@/lib/demo/summary";

const noop = () => () => {};

/** Printable evidence for a return (or a review): every photo, its quality, its scores. */
export function ProofView({ demo, id, demoToday }: { demo: DemoItem | null; id: string; demoToday: IsoDay }) {
  const userJson = useSyncExternalStore(noop, () => (demo ? "" : JSON.stringify(loadUserItems().find((u) => u.product.id === id) ?? null)), () => "");
  const localToday = useLocalToday();
  const item = demo ?? (userJson ? (JSON.parse(userJson) as DemoItem | null) : null);
  if (!item) {
    return (
      <>
        <NavBar title="Proof" back={{ href: "/", label: "Today" }} />
        <main className="vd-page vd-page--narrow">
          <LargeTitle title="Proof" />
          <div className="vd-panel ui-empty">
            <span className="ui-empty__icon">
              <Icon name="doc" />
            </span>
            <h3>No product to report on</h3>
            <p>This product is not stored in this browser. Open one from the shelf to see its report.</p>
            <Link href="/" className="ui-button ui-button--prominent ui-button--lg">
              Open the shelf
            </Link>
          </div>
        </main>
      </>
    );
  }
  const today = demo ? demoToday : (localToday ?? demoToday);
  const { product, captures } = item;
  const v = computeVerdict(product, captures, today);
  const sum = verdictSummary(item, today);
  const seen = captures.filter((c) => c.takenOn <= today);
  const base = seen.find((c) => checkCapture(c.quality).ok);

  async function share() {
    const text = `${product.name}: ${STATUS[v.status].label}. ${v.headline} Measured with YouCam AI Skin Analysis, ${sum.decided ? `decided ${fmtDay(sum.decided.on)} from ${sum.decided.fromPhotos}` : sum.comparableSoFar} comparable photos.`;
    try {
      if (navigator.share) return void (await navigator.share({ title: `Verdict report: ${product.name}`, text, url: window.location.href }));
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      toast({ title: "Report summary copied", detail: "Paste it into the store's return form.", tone: "ok" });
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <>
      <NavBar
        title="Proof"
        back={{ href: `/product?id=${encodeURIComponent(id)}`, label: product.name }}
        trailing={
          <button type="button" className="ui-icon-button ui-glass vd-glass-btn" onClick={share} aria-label="Share the report" title="Share">
            <Icon name="share" />
          </button>
        }
      />
      <main className="vd-page vd-page--narrow">
        <LargeTitle title="Proof">
          <span>{product.name}</span>
          {demo && <DemoNote />}
        </LargeTitle>

        <div className="vd-stack">
          <article className="vd-panel vd-report">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Logo size={32} />
                <div>
                  <h2>Verdict report</h2>
                  <p className="m-0 text-[length:var(--text-footnote)] text-label-secondary">Generated {fmtDay(today)}</p>
                </div>
              </div>
              <StatusLabel status={v.status} />
            </header>
            <dl>
              <dt>Product</dt>
              <dd>{product.name}</dd>
              <dt>Bought</dt>
              <dd>{fmtDay(product.purchasedOn)}</dd>
              <dt>Return deadline</dt>
              <dd>{fmtDay(v.deadline)}</dd>
              <dt>Tracked</dt>
              <dd>{product.concerns.map((c) => concernDef(c).label).join(", ")}</dd>
              <dt>{sum.decided ? "Decided" : "Verdict due"}</dt>
              <dd>{sum.decided ? `${fmtDay(sum.decided.on)} (day ${sum.decided.day})` : fmtDay(sum.dueOn)}</dd>
              {sum.decided && (
                <>
                  <dt>Ahead of the deadline</dt>
                  <dd>{sum.decided.daysBeforeDeadline} days</dd>
                  <dt>Decided from</dt>
                  <dd>{sum.decided.fromPhotos} comparable photos</dd>
                </>
              )}
              <dt>Comparable photos so far</dt>
              <dd>
                {sum.comparableSoFar} of {sum.photosSoFar}
              </dd>
            </dl>
            <p className="vd-verdict__line mt-4" data-status={v.status} style={{ color: "var(--_ct)" }}>
              {v.headline}
            </p>
            <p className="mt-2 mb-4 text-[length:var(--text-subhead)] text-label-secondary">&ldquo;{product.claim}&rdquo;</p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {product.concerns.map((c) => (
                      <th key={c} className="num">
                        {concernDef(c).label} raw
                      </th>
                    ))}
                    <th>Photo</th>
                  </tr>
                </thead>
                <tbody>
                  {seen.map((c) => {
                    const q = checkCapture(c.quality, base?.quality);
                    return (
                      <tr key={c.id}>
                        <td>{fmtDay(c.takenOn)}</td>
                        {product.concerns.map((a) => (
                          <td key={a} className="num">
                            {c.scores[a]?.raw.toFixed(1) ?? "–"}
                          </td>
                        ))}
                        <td>
                          <span className="vd-status" data-status={q.comparable ? "keep" : "mixed"}>
                            {q.comparable ? "Used" : "Set aside"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer>
              Measured with YouCam AI Skin Analysis (SD). Trends use raw_score with a least-squares fit and a noise floor; photos with different
              lighting or framing are set aside. Cosmetic guidance, not medical advice.{demo ? " Synthetic demo data." : ""}
            </footer>
          </article>

          <div className="vd-actions vd-actions--row no-print">
            <button type="button" onClick={() => window.print()} className="ui-button ui-button--prominent ui-button--xl">
              <Icon name="doc" />
              Save as PDF
            </button>
            <button type="button" onClick={share} className="ui-button ui-button--xl">
              <Icon name="share" />
              Share summary
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
