import Link from "next/link";
import { NavBar } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { ShelfRow } from "@/components/shelf-row";
import { LargeTitle, Row, VerdictHero, WindowTrack, fmtDay, fmtLongDay, plural } from "@/components/ui";
import { UserShelf } from "@/components/user-shelf";
import { DEMO_SHELF, DEMO_TODAY, decidedOn, replay } from "@/lib/demo/shelf";
import { daysBetween } from "@/lib/tracking/model";
import { concernDef } from "@/lib/tracking/concerns";
import { computeVerdict } from "@/lib/tracking/verdict";

const APIS = [
  { icon: "face" as const, title: "AI Skin Analysis", detail: "Only the 1 to 4 concerns the product promises: 9 units per photo, SD tier. Trends use raw_score." },
  { icon: "bolt" as const, title: "File API and task polling", detail: "POST /file, PUT to the pre-signed URL, POST /task, poll until success. Failed tasks cost nothing." },
  { icon: "compare" as const, title: "Skin Simulation", detail: "The promised result, rendered from your day-0 photo. 4 units, cached." },
  { icon: "brush" as const, title: "Look VTO", detail: "An alternative to try on your own face when the verdict is return. 2 units." },
];

export default function Today() {
  const [featured, ...rest] = DEMO_SHELF;
  const v = computeVerdict(featured.product, featured.captures, DEMO_TODAY);
  const decided = decidedOn(featured, DEMO_TODAY);
  const early = decided ? featured.product.returnWindowDays - decided.day : 0;
  const todayDay = daysBetween(featured.product.purchasedOn, DEMO_TODAY);
  const frames = replay(featured, DEMO_TODAY);

  const verdicts = rest.map((item) => ({ item, v: computeVerdict(item.product, item.captures, DEMO_TODAY) }));
  const back = verdicts.find((x) => x.v.status === "return");
  const stop = verdicts.find((x) => x.v.status === "stop");
  const measuring = verdicts.find((x) => x.v.status === "collecting")?.item ?? featured;
  const measuringDay = daysBetween(measuring.product.purchasedOn, DEMO_TODAY);

  return (
    <>
      <NavBar
        title="Today"
        trailing={
          <Link href="/add" className="ui-icon-button vd-plus" aria-label="Add a product" title="Add a product">
            <Icon name="plus" />
          </Link>
        }
      />
      <main className="vd-page">
        <LargeTitle title="Today">
          <span>{fmtLongDay(DEMO_TODAY)}</span>
          <DemoNote />
        </LargeTitle>

        <div className="vd-cols">
          <div className="vd-stack">
            <p className="vd-summary">
              <strong className="is-keep">{featured.product.name} is working.</strong> Keep it: the verdict landed {plural(early, "day")} before the
              return deadline.
              {back && (
                <>
                  {" "}
                  {back.item.product.name} showed no change, <strong className="is-return">so it goes back by {fmtDay(back.v.deadline)}</strong>.
                </>
              )}
              {stop && <> {stop.item.product.name} is making redness worse.</>}
            </p>

            <section className="vd-panel overflow-hidden" aria-label="Featured verdict">
              <VerdictHero
                status={v.status}
                headline={v.headline}
                product={featured.product}
                subtitle={`${featured.retailer} · ${featured.price} · bought ${fmtDay(featured.product.purchasedOn)}`}
                href={`/product?id=${featured.product.id}`}
                compact
                meta={
                  decided && (
                    <>
                      Decided on day {decided.day}, <b>{plural(early, "day")} before the deadline</b>, from {plural(v.usableCaptures, "comparable photo")}.
                    </>
                  )
                }
              >
                <WindowTrack product={featured.product} frames={frames} day={todayDay} todayDay={todayDay} decisionDate={v.decisionDate} />
              </VerdictHero>
              <ul className="ui-list" style={{ borderRadius: 0, borderTop: "0.5px solid var(--separator)" }}>
                <li>
                  <Row href={`/product?id=${featured.product.id}&replay=1`} icon="play" title="Replay the 30-day window" subtitle="Watch Measuring turn into Keep it, day by day" tone="accent" />
                </li>
              </ul>
            </section>

            <section className="ui-list-section vd-shelf" aria-labelledby="shelf-h">
              <div className="ui-list__header">
                <strong id="shelf-h">Your shelf</strong>
                <span>{plural(rest.length + 1, "product")}</span>
              </div>
              <ul className="ui-list">
                {rest.map((item) => (
                  <ShelfRow key={item.product.id} item={item} today={DEMO_TODAY} />
                ))}
                <UserShelf />
                <li>
                  <Row href="/add" icon="plus" title="Add a product" subtitle="Paste its claim. Verdict prices the window before the first photo." tone="accent" />
                </li>
              </ul>
              <p className="ui-list__footer">One product per outcome: keep, return, stop, and still measuring. Products you add stay in this browser.</p>
            </section>
          </div>

          <div className="vd-stack">
            <section className="ui-list-section" aria-labelledby="how-h">
              <div className="ui-list__header">
                <strong id="how-h">How Verdict uses YouCam</strong>
              </div>
              <ul className="ui-list">
                {APIS.map((a) => (
                  <li key={a.title}>
                    <Row icon={a.icon} title={a.title} subtitle={a.detail} />
                  </li>
                ))}
              </ul>
              <p className="ui-list__footer">
                The API key never leaves the server. Every call is listed after each photo, with its unit cost.
              </p>
            </section>
            <section className="ui-list-section" aria-labelledby="next-h">
              <div className="ui-list__header">
                <strong id="next-h">Next photo</strong>
                <span>{fmtDay(DEMO_TODAY)}</span>
              </div>
              <ul className="ui-list">
                <li>
                  <Row
                    href={`/capture?id=${measuring.product.id}`}
                    icon="camera"
                    title="Take today's photo"
                    subtitle={`${measuring.product.name}: day ${measuringDay} of ${measuring.product.returnWindowDays}, ${measuring.product.concerns.map((c) => concernDef(c).label.toLowerCase()).join(", ")}`}
                  />
                </li>
              </ul>
              <p className="ui-list__footer">Same spot, same light as day 0. The photo is checked on this phone before any unit is spent.</p>
            </section>
            <p className="vd-footnote">
              Cosmetic guidance, not medical advice. Photos need your consent, stay private and can be deleted at any time.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
