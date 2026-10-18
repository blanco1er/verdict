/**
 * SYNTHETIC merchant view: anonymised verdicts aggregated per SKU, across all
 * customers who tracked it (not the single demo shopper on the Today screen).
 * Every figure the Brands screen prints is derived here, so the summary
 * sentence, the stats band, the bars and the rows always agree.
 */
export interface MerchantRow {
  sku: string;
  promise: string;
  windowDays: number;
  tracking: number;
  improved: number;
  returned: number;
  /** Median day of the return window on which customers got their verdict. */
  medianVerdictDay: number;
  overPromise: boolean;
}

export const MERCHANT_ROWS: MerchantRow[] = [
  { sku: "Calming Serum 30 ml", promise: "Redness, pores · 14 days", windowDays: 30, tracking: 128, improved: 0.64, returned: 0.07, medianVerdictDay: 16, overPromise: false },
  { sku: "Pore Refining Toner", promise: "Pores, texture · 2 weeks", windowDays: 30, tracking: 87, improved: 0.21, returned: 0.24, medianVerdictDay: 28, overPromise: false },
  { sku: "Glow Vitamin C Drops", promise: "Radiance, dark spots · 4 weeks", windowDays: 30, tracking: 203, improved: 0.52, returned: 0.11, medianVerdictDay: 22, overPromise: false },
  { sku: "Retinol Night Cream", promise: "Fine lines · 12 weeks", windowDays: 30, tracking: 61, improved: 0.18, returned: 0.15, medianVerdictDay: 28, overPromise: true },
];

export const pct = (x: number) => Math.round(x * 100);

export function merchantSummary(rows: MerchantRow[] = MERCHANT_ROWS) {
  const tracking = rows.reduce((s, r) => s + r.tracking, 0);
  const improved = rows.reduce((s, r) => s + r.improved * r.tracking, 0) / tracking;
  const returned = rows.reduce((s, r) => s + r.returned * r.tracking, 0) / tracking;
  const worst = [...rows].sort((a, b) => b.returned - a.returned)[0];
  // Customer-weighted median of "days between verdict and return deadline".
  const leads = rows.map((r) => ({ lead: r.windowDays - r.medianVerdictDay, w: r.tracking })).sort((a, b) => a.lead - b.lead);
  let acc = 0;
  const medianLead = leads.find((l) => (acc += l.w) >= tracking / 2)!.lead;
  return { tracking, improved, returned, worst, medianLead, skus: rows.length };
}
