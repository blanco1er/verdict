import Link from "next/link";
import { Card, SampleBadge, Sparkline, StatusPill } from "@/components/ui";
import { DEMO_AS_OF, DEMO_CAPTURES, DEMO_PRODUCT } from "@/lib/demo/fixture";
import { concernDef } from "@/lib/tracking/concerns";
import { daysBetween } from "@/lib/tracking/model";
import { checkCapture } from "@/lib/tracking/quality";
import { computeVerdict } from "@/lib/tracking/verdict";

export default function ProductPage() {
  const product = DEMO_PRODUCT;
  const verdict = computeVerdict(product, DEMO_CAPTURES, DEMO_AS_OF);
  const baseline = DEMO_CAPTURES.find((c) => checkCapture(c.quality).ok)!;
  const usable = DEMO_CAPTURES.filter((c) => checkCapture(c.quality, baseline.quality).comparable);

  return (
    <>
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">
          ← Today
        </Link>
        <SampleBadge />
      </header>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
          <StatusPill status={verdict.status} />
        </div>
        <p className="mt-2 text-sm italic leading-6 text-muted">“{product.claim}”</p>
        <p className="mt-4 text-[15px] font-medium leading-6">{verdict.headline}</p>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Verdict due</dt>
          <dd className="text-right tabular-nums">{verdict.decisionDate}</dd>
          <dt className="text-muted">Return deadline</dt>
          <dd className="text-right tabular-nums">{verdict.deadline}</dd>
          <dt className="text-muted">Next photo</dt>
          <dd className="text-right tabular-nums">{verdict.nextCaptureOn ?? "-"}</dd>
        </dl>
        {verdict.reasons.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs leading-5 text-muted">
            {verdict.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
      </Card>

      {product.concerns.map((action) => {
        const trend = verdict.trends[action]!;
        const points = usable
          .filter((c) => c.scores[action])
          .map((c) => ({ day: daysBetween(baseline.takenOn, c.takenOn), value: c.scores[action]!.raw }));
        const last = usable.at(-1)?.scores[action];
        return (
          <Card key={action}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{concernDef(action).label}</h2>
              <span className="text-xs text-muted">
                {trend.direction === "insufficient"
                  ? "need more photos"
                  : `${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(1)} pts in ${trend.spanDays} d · ${trend.direction}`}
              </span>
            </div>
            <Sparkline points={points} improving={trend.direction === "improving"} />
            {last && <p className="text-xs text-muted">Latest score {last.ui}/100 (YouCam AI Skin Analysis)</p>}
          </Card>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <button disabled className="rounded-full border border-line px-4 py-3 text-sm text-muted" title="Skin Simulation (4 units)">
          See the promised result
        </button>
        <button disabled className="rounded-full border border-line px-4 py-3 text-sm text-muted" title="Signed PDF of the series">
          Export proof
        </button>
      </div>
    </>
  );
}
