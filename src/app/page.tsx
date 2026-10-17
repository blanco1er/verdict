import Link from "next/link";
import { Card, SampleBadge, StatusPill } from "@/components/ui";
import { DEMO_AS_OF, DEMO_CAPTURES, DEMO_PRODUCT } from "@/lib/demo/fixture";
import { concernDef } from "@/lib/tracking/concerns";
import { computeVerdict } from "@/lib/tracking/verdict";

export default function Home() {
  const verdict = computeVerdict(DEMO_PRODUCT, DEMO_CAPTURES, DEMO_AS_OF);
  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Verdict</h1>
        <SampleBadge />
      </header>
      <p className="text-[15px] leading-6 text-muted">
        Your skin tells you if a product works, before the return window closes.
      </p>

      <Link href="/product" className="block">
        <Card className="transition-colors hover:border-foreground/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{DEMO_PRODUCT.brand}</p>
              <h2 className="mt-1 text-lg font-semibold">{DEMO_PRODUCT.name}</h2>
            </div>
            <StatusPill status={verdict.status} />
          </div>
          <p className="mt-3 text-sm leading-6">{verdict.headline}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DEMO_PRODUCT.concerns.map((c) => (
              <span key={c} className="rounded-full bg-background px-3 py-1 text-xs text-muted">
                {concernDef(c).label}
              </span>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat value={String(verdict.daysToDeadline)} label="days to return" />
            <Stat value={String(verdict.usableCaptures)} label="good photos" />
            <Stat value={verdict.nextCaptureOn?.slice(5) ?? "-"} label="next photo" />
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/capture" className="rounded-full bg-foreground px-4 py-3 text-center text-sm font-medium text-background">
          Take today&apos;s photo
        </Link>
        <button disabled className="rounded-full border border-line px-4 py-3 text-sm text-muted" title="Coming: scan or paste a product link">
          Add a product
        </button>
      </div>
      <p className="text-xs leading-5 text-muted">
        Cosmetic guidance, not medical advice. Photos stay private and can be deleted anytime.
      </p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-background px-2 py-3">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
