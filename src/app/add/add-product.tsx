"use client";

import { reportAction } from "@/components/visit-beacon";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavBar } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { LargeTitle, fmtDay, plural } from "@/components/ui";
import { init, toast } from "@/design-system/motion.js";
import { saveUserProduct, useLocalToday } from "@/lib/demo/store";
import { newProduct, trackingPlan } from "@/lib/tracking/plan";

const EXAMPLES = [
  { name: "Barrier Repair Cream", claim: "Soothes sensitive skin and reduces redness in 14 days." },
  { name: "Vitamin C Drops", claim: "Brightens dull skin and fades dark spots in 4 weeks." },
  { name: "Retinal Serum", claim: "Visibly reduces fine lines and improves firmness in 12 weeks." },
];
const WINDOWS = [14, 30, 60, 90];

export function AddProduct() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [claim, setClaim] = useState("");
  const localToday = useLocalToday();
  const [boughtInput, setBought] = useState("");
  const bought = boughtInput || localToday || "2026-11-05";
  const [windowDays, setWindowDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const plan = useMemo(() => trackingPlan(claim, bought, windowDays), [claim, bought, windowDays]);
  const ready = claim.trim().length > 8 && plan.tracked.length > 0;
  const seg = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (seg.current) init(seg.current);
  }, []);

  function start() {
    if (!ready || saving) return;
    setSaving(true);
    const product = newProduct({ name, claim, purchasedOn: bought, returnWindowDays: windowDays }, `u-${Date.now().toString(36)}`);
    saveUserProduct(product);
    reportAction("add_product");
    toast({ title: "Tracking started", detail: `${product.name}: verdict due ${fmtDay(plan.decisionDate)}`, tone: "ok" });
    router.push(`/product?id=${product.id}`);
  }

  return (
    <>
      <NavBar title="New product" back={{ href: "/", label: "Today" }} />
      <main className="vd-page vd-page--narrow">
        <LargeTitle title="New product">
          <span>Stays in this browser</span>
          <DemoNote label="How it works" />
        </LargeTitle>

        <form
          className="vd-stack vd-form"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <section className="ui-list-section" aria-labelledby="f-h">
            <div className="ui-list__header">
              <strong id="f-h">What did you buy?</strong>
            </div>
            <div className="ui-list">
              <div className="vd-field-row">
                <label htmlFor="f-name">Product</label>
                <input
                  id="f-name"
                  className="vd-bare"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Name on the box"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              </div>
              <div className="vd-field-row">
                <label htmlFor="f-claim">What it promises</label>
                <textarea
                  id="f-claim"
                  className="vd-bare"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  maxLength={400}
                  rows={3}
                  placeholder="Paste the claim from the box or the product page"
                />
              </div>
            </div>
            <p className="ui-list__footer">Verdict tracks only what the claim names, so every photo stays in the cheapest analysis tier.</p>
          </section>

          <div>
            <p className="vd-footnote mb-2">Or start from an example</p>
            <div className="vd-examples">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  className="ui-button ui-button--tinted ui-button--lg"
                  aria-pressed={claim === ex.claim}
                  onClick={() => {
                    setName(ex.name);
                    setClaim(ex.claim);
                  }}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          <section className="ui-list-section" aria-labelledby="w-h">
            <div className="ui-list__header">
              <strong id="w-h">Return policy</strong>
            </div>
            <div className="ui-list">
              <div className="vd-field-row">
                <label htmlFor="f-bought">Bought on</label>
                <input id="f-bought" type="date" className="vd-bare" value={bought} onChange={(e) => e.target.value && setBought(e.target.value)} />
              </div>
              <div className="vd-field-row" ref={seg}>
                <span id="f-window" className="text-[length:var(--text-footnote)] font-medium text-label-secondary">
                  Return window
                </span>
                <div className="ui-segmented ui-segmented--lg mt-1" role="radiogroup" aria-labelledby="f-window">
                  <span className="ui-segmented__indicator" aria-hidden />
                  {WINDOWS.map((w) => (
                    <label key={w}>
                      <input type="radio" name="window" value={w} checked={windowDays === w} onChange={() => setWindowDays(w)} />
                      {w} days
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="ui-list-section" aria-labelledby="m-h" aria-live="polite">
            <div className="ui-list__header">
              <strong id="m-h">Verdict will measure</strong>
              <span>read on this device</span>
            </div>
            {claim.trim().length < 9 ? (
              <div className="ui-list">
                <div className="ui-row">
                  <span className="ui-row__body">
                    <span className="ui-row__subtitle">Type or paste the claim, or tap an example. The concerns appear here as you type.</span>
                  </span>
                </div>
              </div>
            ) : plan.matches.length === 0 ? (
              <div className="ui-banner ui-banner--warn">
                <Icon name="alert" />
                <div>
                  <strong>Nothing here is measurable on skin</strong>
                  <p>Scent, product texture or SPF cannot be measured in a photo. Verdict will not spend units on it.</p>
                </div>
              </div>
            ) : (
              <>
                <ul className="ui-list">
                  {plan.matches.map((m, i) => (
                    <li key={m.action}>
                      <div className="ui-row" style={i >= 4 ? { opacity: 0.5 } : undefined}>
                        <span className="ui-row__icon" style={{ background: "transparent", color: i < 4 ? "var(--status-ok)" : "var(--label-tertiary)" }} aria-hidden>
                          <Icon name={i < 4 ? "checkCircle" : "minus"} />
                        </span>
                        <span className="ui-row__body">
                          <span className="ui-row__title">{m.label}</span>
                          <span className="ui-row__subtitle">
                            from &ldquo;{m.evidence}&rdquo;{i >= 4 ? " · not tracked" : ""}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="vd-panel mt-3">
                  <div className="ui-stats vd-stats">
                    <div className="ui-stat">
                      <p className="ui-stat__label">Photos</p>
                      <p className="ui-stat__value">{plan.photos}</p>
                    </div>
                    <div className="ui-stat">
                      <p className="ui-stat__label">Each</p>
                      <p className="ui-stat__value">
                        {plan.unitsPerPhoto}
                        <small>units</small>
                      </p>
                    </div>
                    <div className="ui-stat">
                      <p className="ui-stat__label">Whole window</p>
                      <p className="ui-stat__value">
                        {plan.totalUnits}
                        <small>units</small>
                      </p>
                    </div>
                    <div className="ui-stat">
                      <p className="ui-stat__label">Verdict</p>
                      <p className="ui-stat__value">{fmtDay(plan.decisionDate)}</p>
                    </div>
                  </div>
                </div>
                <p className="ui-list__footer">
                  A photo every 2 days, then daily in the last 4 days. {plan.dropped.length > 0 ? "Only the first 4 concerns are tracked, to stay at 9 units a photo. " : ""}
                  The live version adds an agent that reads product pages and checks the price with the YouCam MCP tool Get_Feature_Cost.
                </p>
                {plan.promiseExceedsWindow && (
                  <div className="ui-banner ui-banner--warn mt-3">
                    <Icon name="alert" />
                    <div>
                      <strong>
                        The brand promises {plural(plan.promisedDays ?? 0, "day")}; the store gives {windowDays}.
                      </strong>
                      <p>Verdict will judge the early trend and tell you before you lose the right to return.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="vd-actions">
            <button type="submit" disabled={!ready || saving} className="ui-button ui-button--prominent ui-button--xl">
              {saving ? "Starting…" : "Start tracking"}
            </button>
            <p className="vd-footnote text-center">Saved in this browser only. You can delete it and its photos at any time.</p>
          </div>
        </form>
      </main>
    </>
  );
}
