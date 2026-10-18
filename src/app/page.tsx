import Link from "next/link";
import { PageHeader, PrimaryLink, SecondaryLink, SectionTitle, StatusPill, Swatch, VerdictRing, fmtDay } from "@/components/ui";
import { ShelfRow } from "@/components/shelf-row";
import { UserShelf } from "@/components/user-shelf";
import { DEMO_SHELF, DEMO_TODAY, decidedOn } from "@/lib/demo/shelf";
import { concernDef } from "@/lib/tracking/concerns";
import { daysBetween } from "@/lib/tracking/model";
import { computeVerdict } from "@/lib/tracking/verdict";

export default function Today() {
  const [featured, ...rest] = DEMO_SHELF;
  const v = computeVerdict(featured.product, featured.captures, DEMO_TODAY);
  const decided = decidedOn(featured, DEMO_TODAY);
  const early = decided ? featured.product.returnWindowDays - decided.day : 0;
  return (
    <>
      <PageHeader />

      <section className="rise pt-2 lg:hidden">
        <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.035em]">
          Does it work? <span className="text-accent-ink">Know before the return window closes.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          Verdict measures only what the product promises, with YouCam AI Skin Analysis, and tells you keep or return before the deadline.
        </p>
      </section>

      <article className="card rise overflow-hidden" aria-labelledby="featured-name">
        <div className="flex items-start gap-3 p-5 pb-0">
          <Swatch hue={featured.hue} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-muted">{featured.product.brand} · {featured.retailer}</p>
            <h2 id="featured-name" className="truncate text-[18px] font-semibold tracking-tight">{featured.product.name}</h2>
          </div>
          <StatusPill status={v.status} />
        </div>
        <div className="flex items-center gap-5 p-5">
          <VerdictRing status={v.status} elapsedDays={daysBetween(featured.product.purchasedOn, DEMO_TODAY)} windowDays={featured.product.returnWindowDays} daysLeft={v.daysToDeadline} size={124} />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-snug tracking-tight">{v.headline}</p>
            {decided && (
              <p className="mt-2 text-[13px] leading-5 text-muted">
                Decided on day {decided.day}, <b className="font-semibold text-foreground">{early} days before the deadline</b>, from {v.usableCaptures} comparable photos.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {featured.product.concerns.map((c) => (
                <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-line">
                  {concernDef(c).label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link
          href={`/product?id=${featured.product.id}&replay=1`}
          className="flex items-center justify-between border-t border-line bg-surface-2 px-5 py-3.5 text-[14px] font-semibold transition hover:bg-background"
        >
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-[10px] text-background">▶</span>
            Replay the 30-day return window
          </span>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      </article>

      <div className="grid grid-cols-2 gap-3">
        <PrimaryLink href="/capture?id=calming-serum">Take a photo</PrimaryLink>
        <SecondaryLink href="/add">Add a product</SecondaryLink>
      </div>

      <SectionTitle aside={<span className="text-[12px] text-muted tabular-nums">Demo date · {fmtDay(DEMO_TODAY)}</span>}>Your shelf</SectionTitle>
      <ul className="flex flex-col gap-3">
        {rest.map((item) => (
          <ShelfRow key={item.product.id} item={item} today={DEMO_TODAY} />
        ))}
        <UserShelf />
      </ul>

      <p className="px-1 text-[12px] leading-5 text-muted">
        Cosmetic guidance, not medical advice. Photos need your consent, stay private and can be deleted anytime. Products and scores on this
        screen are synthetic demo data.
      </p>
    </>
  );
}
