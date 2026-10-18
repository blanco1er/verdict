"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, PageHeader, SectionTitle, fmtDay } from "@/components/ui";
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
  const plan = useMemo(() => trackingPlan(claim, bought, windowDays), [claim, bought, windowDays]);
  const ready = claim.trim().length > 8 && plan.tracked.length > 0;

  function start() {
    const product = newProduct({ name, claim, purchasedOn: bought, returnWindowDays: windowDays }, `u-${Date.now().toString(36)}`);
    saveUserProduct(product);
    router.push(`/product?id=${product.id}`);
  }

  return (
    <>
      <PageHeader back={{ href: "/", label: "Today" }} right={<span className="text-xs font-medium text-muted">Stays on this device</span>} />
      <section className="rise">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">Add a product</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">Paste what the product promises. Verdict tracks only those concerns, so every photo stays in the cheapest analysis tier.</p>
      </section>

      <Card>
        <label className="block">
          <span className="text-[13px] font-semibold">Product</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Barrier Repair Cream"
            className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[15px] outline-none transition focus:border-foreground focus:bg-surface"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-[13px] font-semibold">What it promises</span>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Paste the claim from the box or the product page"
            className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] leading-6 outline-none transition focus:border-foreground focus:bg-surface"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              type="button"
              onClick={() => {
                setName(ex.name);
                setClaim(ex.claim);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-medium transition hover:border-foreground/30"
            >
              {ex.name}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[13px] font-semibold">Bought on</span>
            <input
              type="date"
              value={bought}
              onChange={(e) => e.target.value && setBought(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface-2 px-3 text-[15px] outline-none focus:border-foreground"
            />
          </label>
          <fieldset>
            <legend className="text-[13px] font-semibold">Return window</legend>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1 ring-1 ring-line">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={windowDays === w}
                  onClick={() => setWindowDays(w)}
                  className={`h-10 rounded-xl text-[13px] font-semibold tabular-nums transition ${windowDays === w ? "bg-surface shadow-sm ring-1 ring-line" : "text-muted"}`}
                >
                  {w}d
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <div aria-live="polite">
      <Card>
        <SectionTitle aside={<span className="text-[12px] text-muted">rules · offline</span>}>Verdict will measure</SectionTitle>
        {claim.trim().length < 9 ? (
          <p className="mt-3 text-[14px] leading-6 text-muted">Start typing the claim, or tap an example above.</p>
        ) : plan.matches.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-mixed/10 px-3.5 py-3 text-[13.5px] leading-5 text-mixed">
            Nothing here is measurable on skin (scent, texture of the product, SPF…). Verdict won&apos;t spend units on it.
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {plan.matches.map((m, i) => (
                <li key={m.action} className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 ring-1 ring-line ${i < 4 ? "bg-surface-2" : "opacity-50"}`}>
                  <span className="text-[14.5px] font-semibold">{m.label}</span>
                  <span className="truncate text-[12.5px] text-muted">from “{m.evidence}”{i >= 4 ? " · not tracked" : ""}</span>
                </li>
              ))}
            </ul>
            {plan.dropped.length > 0 && <p className="mt-2 text-[12.5px] text-muted">Tracking the first 4 keeps each photo at {plan.unitsPerPhoto} units.</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={`${plan.photos}`} label="photos" />
              <Stat value={`${plan.unitsPerPhoto}`} label="units each" />
              <Stat value={fmtDay(plan.decisionDate)} label="verdict" />
            </dl>
            {plan.promiseExceedsWindow && (
              <p className="mt-3 rounded-2xl bg-mixed/10 px-3.5 py-3 text-[13px] leading-5 text-mixed">
                <b className="font-semibold">The brand promises {plan.promisedDays} days; the store gives {windowDays}.</b> Verdict will judge the early trend and tell you before you lose the right to return.
              </p>
            )}
          </>
        )}
      </Card>
      </div>

      <button
        type="button"
        disabled={!ready}
        onClick={start}
        className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background transition active:scale-[.98] disabled:opacity-40"
      >
        Start tracking
      </button>
      <p className="px-1 text-center text-[12px] leading-5 text-muted">
        Saved in this browser only. The live version adds an agent that reads product pages and checks the unit cost with the YouCam MCP tool <code className="font-mono">Get_Feature_Cost</code>.
      </p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3 ring-1 ring-line">
      <dd className="text-[18px] font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="text-[11.5px] text-muted">{label}</dt>
    </div>
  );
}
