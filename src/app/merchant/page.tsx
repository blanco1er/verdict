import { NavBar } from "@/components/chrome";
import { ProductGlyph } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { LargeTitle } from "@/components/ui";

// SYNTHETIC rows: the merchant view aggregates anonymised verdicts per SKU.
const ROWS = [
  { sku: "Calming Serum 30 ml", promise: "Redness, pores · 14 days", tracking: 128, improved: 0.64, returned: 0.07, verdictDay: 16, overPromise: false },
  { sku: "Pore Refining Toner", promise: "Pores, texture · 2 weeks", tracking: 87, improved: 0.21, returned: 0.24, verdictDay: 28, overPromise: false },
  { sku: "Glow Vitamin C Drops", promise: "Radiance, dark spots · 4 weeks", tracking: 203, improved: 0.52, returned: 0.11, verdictDay: 22, overPromise: false },
  { sku: "Retinol Night Cream", promise: "Fine lines · 12 weeks", tracking: 61, improved: 0.18, returned: 0.15, verdictDay: 28, overPromise: true },
];

const pct = (x: number) => `${Math.round(x * 100)}`;

function standing(r: (typeof ROWS)[number]): { status: "keep" | "return" | "mixed"; label: string; note: string } {
  if (r.overPromise) return { status: "mixed", label: "Promise > window", note: "The claim takes 12 weeks; returns close at 30 days. Customers decide on an early trend." };
  if (r.improved < 0.3) return { status: "return", label: "Review the claim", note: "Few customers see the promised change: the claim is driving returns." };
  return { status: "keep", label: "Badge eligible", note: "Can show “Measured with YouCam AI Skin Analysis” on reviews." };
}

export default function MerchantPage() {
  const tracking = ROWS.reduce((s, r) => s + r.tracking, 0);
  const improved = ROWS.reduce((s, r) => s + r.improved * r.tracking, 0) / tracking;
  const returned = ROWS.reduce((s, r) => s + r.returned * r.tracking, 0) / tracking;
  const worst = [...ROWS].sort((a, b) => b.returned - a.returned)[0];
  const max = Math.max(...ROWS.map((r) => Math.max(r.improved, r.returned)));

  return (
    <>
      <NavBar title="Brands" />
      <main className="vd-page">
        <LargeTitle title="Brands">
          <span>Measured efficacy per product</span>
          <DemoNote />
        </LargeTitle>

        <div className="vd-stack">
          <p className="vd-summary">
            <strong>{tracking.toLocaleString("en-US")} customers</strong> are tracking {ROWS.length} products. {pct(improved)}% saw the promised change
            before their return deadline. <strong className="is-return">{worst.sku}</strong> is driving returns at {pct(worst.returned)}%.
          </p>

          <div className="vd-panel">
            <div className="ui-stats vd-stats">
              <div className="ui-stat">
                <p className="ui-stat__label">Customers tracking</p>
                <p className="ui-stat__value">{tracking.toLocaleString("en-US")}</p>
                <p className="ui-stat__delta">across {ROWS.length} SKUs</p>
              </div>
              <div className="ui-stat">
                <p className="ui-stat__label">Saw the promise</p>
                <p className="ui-stat__value">
                  {pct(improved)}
                  <small>%</small>
                </p>
                <p className="ui-stat__delta">measured, not self-reported</p>
              </div>
              <div className="ui-stat">
                <p className="ui-stat__label">Returned</p>
                <p className="ui-stat__value">
                  {pct(returned)}
                  <small>%</small>
                </p>
                <p className="ui-stat__delta">weighted by customers</p>
              </div>
              <div className="ui-stat">
                <p className="ui-stat__label">Verdict lead</p>
                <p className="ui-stat__value">
                  2<small>days</small>
                </p>
                <p className="ui-stat__delta">before the deadline</p>
              </div>
            </div>
          </div>

          <div className="vd-cols">
            <section aria-labelledby="b-h">
              <div className="vd-section-title">
                <h2 id="b-h">Improved vs returned</h2>
                <p>share of customers</p>
              </div>
              <div className="vd-panel vd-panel--pad">
                <div className="vd-bars" role="list">
                  {ROWS.map((r) => (
                    <div key={r.sku} className="vd-bars__row" role="listitem" aria-label={`${r.sku}: ${pct(r.improved)}% improved, ${pct(r.returned)}% returned`}>
                      <div className="vd-bars__name">
                        <b className="font-medium">{r.sku}</b>
                        <span>
                          {pct(r.improved)}% · {pct(r.returned)}%
                        </span>
                      </div>
                      <div className="vd-bars__bar" aria-hidden>
                        <span className="vd-bars__seg is-improved" style={{ width: `${(r.improved / max) * 100}%` }} />
                        <span className="vd-bars__seg is-returned" style={{ width: `${(r.returned / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <ul className="vd-legend">
                  <li>
                    <i className="is-c1" />
                    Promised concern improved
                  </li>
                  <li>
                    <i className="is-c2" />
                    Returned
                  </li>
                </ul>
              </div>
            </section>

            <section className="ui-list-section vd-shelf" aria-labelledby="p-h">
              <div className="ui-list__header">
                <strong id="p-h">By product</strong>
                <span>{ROWS.length} SKUs</span>
              </div>
              <ul className="ui-list">
                {ROWS.map((r) => {
                  const s = standing(r);
                  return (
                    <li key={r.sku}>
                      <div className="ui-row">
                        <ProductGlyph name={r.sku} />
                        <span className="ui-row__body">
                          <span className="ui-row__title">{r.sku}</span>
                          <span className="vd-row-meta">
                            <span className="vd-status" data-status={s.status}>
                              {s.label}
                            </span>
                          </span>
                          <span className="vd-row-meta">
                            {r.promise} · {r.tracking} tracking · verdict on day {r.verdictDay}
                          </span>
                          <span className="vd-row-story">{s.note}</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="ui-list-section" aria-labelledby="y-h">
            <div className="ui-list__header">
              <strong id="y-h">Why it matters</strong>
            </div>
            <ul className="ui-list">
              <li>
                <div className="ui-row">
                  <span className="ui-row__body">
                    <span className="ui-row__title">Returns are decided on day 29, by feel</span>
                    <span className="ui-row__subtitle">Verdict gives the customer evidence two days earlier, and the brand an efficacy score per SKU.</span>
                  </span>
                </div>
              </li>
              <li>
                <div className="ui-row">
                  <span className="ui-row__body">
                    <span className="ui-row__title">Over-promising shows up before the returns do</span>
                    <span className="ui-row__subtitle">A claim that takes 12 weeks cannot be judged in a 30-day window.</span>
                  </span>
                </div>
              </li>
              <li>
                <div className="ui-row">
                  <span className="ui-row__body">
                    <span className="ui-row__title">Brands see aggregates only</span>
                    <span className="ui-row__subtitle">Photos never leave the customer&apos;s account.</span>
                  </span>
                </div>
              </li>
            </ul>
            <p className="ui-list__footer">All numbers on this screen are synthetic demo data.</p>
          </section>
        </div>
      </main>
    </>
  );
}
