import Link from "next/link";
import { Icon, Logo } from "@/components/icons";
import { DemoNote } from "@/components/sheet";
import { fmtLongDay } from "@/components/ui";
import { UserShelf } from "@/components/user-shelf";
import { LooksStrip } from "@/components/vx/looks";
import { Bottle, CountUp } from "@/components/vx/live";
import { WORD, bottleKind, shortDay, windowLeft } from "@/components/vx/product-bits";
import { DEMO_SHELF, DEMO_TODAY } from "@/lib/demo/shelf";
import { verdictSummary } from "@/lib/demo/summary";
import { daysBetween } from "@/lib/tracking/model";
import { concernDef } from "@/lib/tracking/concerns";
import { computeVerdict, type Verdict } from "@/lib/tracking/verdict";
import type { DemoItem } from "@/lib/demo/shelf";

/** The reason, in a few words. */
function reason(item: DemoItem, v: Verdict): string {
  const labels = (dir: string) =>
    item.product.concerns.filter((c) => v.trends[c]?.direction === dir).map((c) => concernDef(c).label.toLowerCase());
  const list = (l: string[]) => l.join(" and ").replace(/^./, (c) => c.toUpperCase());
  if (v.status === "keep") return `${list(labels("improving")) || "Better"} better`;
  if (v.status === "stop") return `${list(labels("worsening")) || "Skin"} getting worse`;
  if (v.status === "return") return "No measurable change";
  if (v.status === "collecting") return `Day ${daysBetween(item.product.purchasedOn, DEMO_TODAY)} of ${item.product.returnWindowDays}`;
  return v.headline;
}

export default function Today() {
  const items = DEMO_SHELF.map((item) => ({ item, v: computeVerdict(item.product, item.captures, DEMO_TODAY) }));
  const [featured, ...rest] = items;
  const sum = verdictSummary(featured.item, DEMO_TODAY);
  const early = sum.decided?.daysBeforeDeadline ?? 0;
  const measuring = rest.find((x) => x.v.status === "collecting") ?? featured;
  const mDay = daysBetween(measuring.item.product.purchasedOn, DEMO_TODAY);
  const photos = items.reduce((n, x) => n + x.item.captures.filter((c) => c.takenOn <= DEMO_TODAY).length, 0);

  return (
    <main className="vx-page">
      <div className="vx-top">
        <Link href="/" className="vx-wordmark" aria-label="Verdict">
          <Logo size={26} />
          Verdict
        </Link>
        <div className="flex items-center gap-2">
          <DemoNote label="Demo" />
          <Link href="/settings" className="vx-round" aria-label="Settings" title="Settings">
            <Icon name="settings" />
          </Link>
        </div>
      </div>

      <p className="vx-eyebrow" style={{ marginTop: 18 }}>
        {fmtLongDay(DEMO_TODAY)} · {items.length} products
      </p>
      <h1 className="vx-h1">
        Is your skincare working? <span style={{ color: "var(--vx-ink-3)" }}>Know before you can&apos;t return it.</span>
      </h1>

      <section className="vx-shelf" aria-label="Your shelf">
        <div className="vx-shelf__glow" aria-hidden />
        <div className="vx-shelf__sweep" aria-hidden />
        <div className="vx-shelf__stage">
          {items.map(({ item, v }, i) => {
            const left = Math.max(0, v.daysToDeadline);
            return (
              <Link
                key={item.product.id}
                href={`/product?id=${item.product.id}`}
                className={`vx-slot${i === 0 ? " is-featured" : ""}`}
                aria-label={`${item.product.name}: ${WORD[v.status]}, ${left} days left to return`}
              >
                <Bottle hue={item.hue} level={windowLeft(item, DEMO_TODAY)} kind={bottleKind(item.product.name)} size={i === 0 ? 112 : 96} status={v.status} />
                <span className="vx-slot__label" data-status={v.status}>
                  <b>
                    <span className={`vx-dot${v.status === "collecting" ? " vx-dot--live" : ""}`} />
                    {v.status === "collecting" ? `Day ${daysBetween(item.product.purchasedOn, DEMO_TODAY)}` : WORD[v.status]}
                  </b>
                  <small>{left} d left</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="vx-stats">
        <div className="vx-stat vx-stat--data">
          <b>
            <CountUp value={early} />
          </b>
          <span>days before the deadline</span>
        </div>
        <div className="vx-stat">
          <b>
            <CountUp value={photos} />
          </b>
          <span>photos measured</span>
        </div>
        <div className="vx-stat">
          <b>
            <CountUp value={items.length} />
          </b>
          <span>products tracked</span>
        </div>
      </div>

      <section className="vx-section" aria-labelledby="verdicts-h">
        <div className="vx-section__head">
          <h2 id="verdicts-h">Today&apos;s verdicts</h2>
          <span>{items.length}</span>
        </div>
        <ul className="vx-rows">
          {items.map(({ item, v }) => (
            <li key={item.product.id}>
              <Link href={`/product?id=${item.product.id}`} className="vx-row">
                <Bottle hue={item.hue} level={windowLeft(item, DEMO_TODAY)} kind={bottleKind(item.product.name)} size={44} status={v.status} />
                <span className="vx-row__body">
                  <span className="vx-row__title">{item.product.name}</span>
                  <span className="vx-row__sub" data-status={v.status}>
                    <span className="vx-dot" />
                    <b className="vx-row__word">{WORD[v.status]}</b> · {reason(item, v)}
                  </span>
                </span>
                <span className="vx-row__end">
                  <b>{Math.max(0, v.daysToDeadline)} d</b>
                  <small>to return</small>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
          <UserShelf />
        </ul>
      </section>

      <section className="vx-section" aria-labelledby="next-h">
        <div className="vx-section__head">
          <h2 id="next-h">Today&apos;s photo</h2>
          <span>{shortDay(DEMO_TODAY)}</span>
        </div>
        <Link href={`/capture?id=${measuring.item.product.id}`} className="vx-next" aria-label={`Take today's photo for ${measuring.item.product.name}`}>
          <span className="vx-next__face" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- sample selfie */}
            <img src="/sample/selfie.jpg" alt="" />
            <i />
          </span>
          <span className="vx-row__body">
            <span className="vx-row__title">{measuring.item.product.name}</span>
            <span className="vx-row__sub">
              Day {mDay} of {measuring.item.product.returnWindowDays} · {measuring.item.product.concerns.map((c) => concernDef(c).label.toLowerCase()).join(", ")}
            </span>
          </span>
          <span className="vx-next__cam" aria-hidden>
            <Icon name="camera" />
          </span>
        </Link>
      </section>

      <LooksStrip />

      <p className="vx-foot">
        Cosmetic guidance, not medical advice. · <Link href="/agent">How it works</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
