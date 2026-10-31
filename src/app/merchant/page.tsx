import type { Metadata } from "next";
import { DemoNote } from "@/components/sheet";
import { TopBar } from "@/components/vx/top-bar";
import { Bottle, CountUp } from "@/components/vx/live";
import { bottleKind } from "@/components/vx/product-bits";
import { MERCHANT_ROWS, merchantSummary, pct } from "@/lib/demo/merchant";

export const metadata: Metadata = { title: "Brands · Verdict" };

const ROWS = MERCHANT_ROWS;
const HUES = [36, 200, 28, 40];

function standing(r: (typeof ROWS)[number]): { status: "keep" | "return" | "mixed"; label: string } {
  if (r.overPromise) return { status: "mixed", label: "Promise longer than the window" };
  if (r.improved < 0.3) return { status: "return", label: "Claim drives returns" };
  return { status: "keep", label: "Badge eligible" };
}

export default function MerchantPage() {
  const { tracking, improved, returned, worst, medianLead } = merchantSummary();
  const max = Math.max(...ROWS.map((r) => Math.max(r.improved, r.returned)));
  return (
    <main className="vx-page">
      <TopBar title="Brands" trailing={<DemoNote label="Demo" />} />
      <h1 className="vx-title">Brands</h1>
      <p className="vx-sub">What customers measured, product by product.</p>

      <p className="vx-lede" style={{ marginTop: 18 }}>
        <b>{pct(improved)}%</b> saw the promised change before their return deadline. <b>{worst.sku}</b> drives {pct(worst.returned)}% of its sales
        back.
      </p>

      <div className="vx-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="vx-stat">
          <b>
            <CountUp value={tracking} />
          </b>
          <span>customers measuring</span>
        </div>
        <div className="vx-stat vx-stat--data">
          <b>
            <CountUp value={pct(improved)} suffix="%" />
          </b>
          <span>saw the promise</span>
        </div>
        <div className="vx-stat" style={{ borderTop: "0.5px solid var(--vx-line)", paddingLeft: 0, borderLeft: 0 }}>
          <b>
            <CountUp value={pct(returned)} suffix="%" />
          </b>
          <span>returned</span>
        </div>
        <div className="vx-stat" style={{ borderTop: "0.5px solid var(--vx-line)" }}>
          <b>
            <CountUp value={medianLead} suffix=" d" />
          </b>
          <span>earlier than the deadline</span>
        </div>
      </div>

      <section className="vx-section" aria-labelledby="b-h">
        <div className="vx-section__head">
          <h2 id="b-h">By product</h2>
          <span className="vx-legend">
            <i className="is-up" /> improved <i className="is-back" /> returned
          </span>
        </div>
        <ul className="vx-rows">
          {ROWS.map((r, i) => {
            const s = standing(r);
            return (
              <li key={r.sku} className="vx-brand">
                <Bottle hue={HUES[i % HUES.length]} level={1 - r.returned} kind={bottleKind(r.sku)} size={46} />
                <div className="vx-brand__body">
                  <div className="vx-brand__top">
                    <b>{r.sku}</b>
                    <span className="vx-num">
                      {pct(r.improved)}% · {pct(r.returned)}%
                    </span>
                  </div>
                  <div className="vx-brand__bars" aria-label={`${pct(r.improved)}% improved, ${pct(r.returned)}% returned`}>
                    <span className="is-up" style={{ width: `${(r.improved / max) * 100}%`, animationDelay: `${i * 90}ms` }} />
                    <span className="is-back" style={{ width: `${(r.returned / max) * 100}%`, animationDelay: `${i * 90 + 120}ms` }} />
                  </div>
                  <p className="vx-row__sub" data-status={s.status}>
                    <span className="vx-dot" />
                    {s.label} · {r.tracking} measuring · verdict on day {r.medianVerdictDay}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="vx-section" aria-labelledby="y-h">
        <div className="vx-section__head">
          <h2 id="y-h">Why brands want it</h2>
        </div>
        {[
          ["Evidence instead of a feeling", `Customers decide ${medianLead} days earlier, with measurements.`],
          ["Over-promising shows early", "A 12-week claim cannot be judged inside a 30-day window."],
          ["A badge that means something", "“Measured with YouCam AI Skin Analysis” on reviews."],
        ].map(([t, d]) => (
          <div className="vx-check" key={t}>
            <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden>
              <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
            </svg>
            <div>
              <b>{t}</b>
              <span>{d}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
