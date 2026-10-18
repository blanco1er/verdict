import { Card, PageHeader, SectionTitle } from "@/components/ui";

// SYNTHETIC rows: the merchant view aggregates anonymised verdicts per SKU.
const ROWS = [
  { sku: "Calming Serum 30 ml", promise: "Redness, pores · 14 days", tracking: 128, improved: 0.64, returned: 0.07, verdictDay: 16, overPromise: false },
  { sku: "Pore Refining Toner", promise: "Pores, texture · 2 weeks", tracking: 87, improved: 0.21, returned: 0.24, verdictDay: 28, overPromise: false },
  { sku: "Glow Vitamin C Drops", promise: "Radiance, dark spots · 4 weeks", tracking: 203, improved: 0.52, returned: 0.11, verdictDay: 22, overPromise: false },
  { sku: "Retinol Night Cream", promise: "Fine lines · 12 weeks", tracking: 61, improved: 0.18, returned: 0.15, verdictDay: 28, overPromise: true },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function MerchantPage() {
  const tracking = ROWS.reduce((s, r) => s + r.tracking, 0);
  const improved = ROWS.reduce((s, r) => s + r.improved * r.tracking, 0) / tracking;
  return (
    <>
      <PageHeader />
      <section className="rise">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-ink">For brands and retailers</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.03em]">Measured efficacy, per product</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">
          Anonymised verdicts from customers who tracked a product: did the promised concern measurably improve before the return deadline?
        </p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Kpi value={tracking.toLocaleString("en-US")} label="customers tracking" />
        <Kpi value={pct(improved)} label="saw the promise" />
        <Kpi value="2 days" label="verdict before deadline" />
      </div>

      <SectionTitle aside={<span className="text-[12px] text-muted">improved vs returned</span>}>By product</SectionTitle>
      <ul className="flex flex-col gap-3">
        {ROWS.map((r) => (
          <li key={r.sku}>
            <Card as="article" className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15.5px] font-semibold tracking-tight">{r.sku}</h2>
                <span className="text-[12px] text-muted tabular-nums">{r.tracking} tracking</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-muted">Promise: {r.promise}</p>
              <Bar label="Improved" value={r.improved} color="var(--keep)" />
              <Bar label="Returned" value={r.returned} color="var(--return)" />
              {r.overPromise ? (
                <p className="mt-3 rounded-xl bg-mixed/10 px-3 py-2 text-[12.5px] leading-5 text-mixed">
                  Promise (12 weeks) is longer than the 30-day return window: customers decide on an early trend.
                </p>
              ) : r.improved < 0.3 ? (
                <p className="mt-3 rounded-xl bg-return/10 px-3 py-2 text-[12.5px] leading-5 text-return">
                  Few customers see the promised change: review the claim before it drives more returns.
                </p>
              ) : (
                <p className="mt-3 text-[12.5px] leading-5 text-muted">Eligible for a &ldquo;Measured with YouCam AI Skin Analysis&rdquo; badge on reviews.</p>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <SectionTitle>Why it matters</SectionTitle>
        <ul className="mt-3 space-y-2 text-[14px] leading-6">
          <li>Returns are decided on day 29 by feel. Verdict gives the customer evidence on day 28, and the brand an efficacy score per SKU.</li>
          <li>Claims that over-promise show up in the data before they show up in the returns.</li>
          <li>Only aggregates are shared with the brand. Photos never leave the customer&apos;s account.</li>
        </ul>
      </Card>
      <p className="px-1 text-[12px] text-muted">All numbers on this screen are synthetic demo data.</p>
    </>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="card px-3 py-3.5 text-center">
      <div className="text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11.5px] leading-4 text-muted">{label}</div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-2.5 grid grid-cols-[68px_1fr_40px] items-center gap-2.5 text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full" style={{ width: pct(value), background: color }} />
      </span>
      <span className="text-right font-semibold tabular-nums">{pct(value)}</span>
    </div>
  );
}
