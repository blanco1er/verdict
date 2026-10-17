import { Card, SampleBadge } from "@/components/ui";

// SAMPLE rows only: the merchant view aggregates anonymized verdicts per SKU.
const ROWS = [
  { sku: "Calming Serum 30 ml", tracking: 128, promise: "Redness", measured: 0.64, returns: 0.07 },
  { sku: "Pore Refining Toner", tracking: 87, promise: "Pores", measured: 0.31, returns: 0.19 },
  { sku: "Glow Vitamin C Drops", tracking: 203, promise: "Radiance", measured: 0.52, returns: 0.11 },
];

export default function MerchantPage() {
  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Measured efficacy</h1>
        <SampleBadge />
      </header>
      <p className="text-sm leading-6 text-muted">
        Share of customers whose promised concern measurably improved before the return deadline.
      </p>
      {ROWS.map((r) => (
        <Card key={r.sku}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{r.sku}</h2>
            <span className="text-xs text-muted">{r.tracking} tracking</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-keep" style={{ width: `${Math.round(r.measured * 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>
              {r.promise}: {Math.round(r.measured * 100)}% improved
            </span>
            <span>{Math.round(r.returns * 100)}% returned</span>
          </div>
        </Card>
      ))}
    </>
  );
}
