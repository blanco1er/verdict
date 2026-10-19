"use client";

import { reportAction } from "@/components/visit-beacon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { NavBar } from "@/components/chrome";
import { ChartLegend, ConcernChart } from "@/components/concern-chart";
import { Icon } from "@/components/icons";
import { Alert, DemoNote, Sheet } from "@/components/sheet";
import { LargeTitle, Row, STATUS, VerdictHero, WindowTrack, fmtDay, plural } from "@/components/ui";
import { toast } from "@/design-system/motion.js";
import { replay, type DemoItem } from "@/lib/demo/shelf";
import { decidedSentence, trackVerdictLabel, verdictSummary } from "@/lib/demo/summary";
import { deleteUserProduct, loadUserItems, useLocalToday } from "@/lib/demo/store";
import { concernDef, simulationFor } from "@/lib/tracking/concerns";
import { addDays, daysBetween, type IsoDay } from "@/lib/tracking/model";
import { computeVerdict, type VerdictStatus } from "@/lib/tracking/verdict";
import { LOOK_VTO_UNITS, skinAnalysisCost, skinSimulationCost } from "@/lib/youcam/costs";

const noop = () => () => {};

export function ProductView({ demo, id, demoToday, autoplay }: { demo: DemoItem | null; id: string; demoToday: IsoDay; autoplay: boolean }) {
  // Visitor-added products come from this browser's storage (client only).
  const userItem = useSyncExternalStore(
    noop,
    () => (demo ? null : JSON.stringify(loadUserItems().find((u) => u.product.id === id) ?? null)),
    () => null,
  );
  const item: DemoItem | null = demo ?? (userItem ? (JSON.parse(userItem) as DemoItem) : null);
  const localToday = useLocalToday();
  const today = demo ? demoToday : (localToday ?? demoToday);

  if (!item) {
    return (
      <>
        <NavBar title="Product" back={{ href: "/", label: "Today" }} />
        <main className="vd-page vd-page--narrow">
          <LargeTitle title="Not on this device" />
          <div className="vd-panel ui-empty">
            <span className="ui-empty__icon">
              <Icon name="phone" />
            </span>
            <h3>This product lives in another browser</h3>
            <p>Products you add are stored only in the browser you used. Add it again here, or open a product from the demo shelf.</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link href="/add" className="ui-button ui-button--prominent ui-button--lg">
                Add a product
              </Link>
              <Link href="/" className="ui-button ui-button--lg">
                Open the shelf
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }
  return <Tracked item={item} today={today} isDemo={demo != null} autoplay={autoplay} />;
}

function Tracked({ item, today, isDemo, autoplay }: { item: DemoItem; today: IsoDay; isDemo: boolean; autoplay: boolean }) {
  const { product, captures } = item;
  const win = product.returnWindowDays;
  const frames = useMemo(() => replay(item), [item]);
  const todayDay = Math.max(0, Math.min(win, daysBetween(product.purchasedOn, today)));
  const [day, setDay] = useState(autoplay ? 0 : todayDay);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setDay((d) => {
        if (d >= todayDay) {
          setPlaying(false);
          return todayDay;
        }
        return d + 1;
      });
    }, 150);
    return () => clearInterval(t);
  }, [playing, todayDay]);

  const asOf = addDays(product.purchasedOn, day);
  const v = computeVerdict(product, captures, asOf);
  const decisionDay = daysBetween(product.purchasedOn, v.decisionDate);
  // One source of truth for every date and count in the hero and the track (same as Today and Proof).
  const sum = verdictSummary(item, asOf);
  const sentence = decidedSentence(sum);
  const replaying = day !== todayDay;

  // The verdict moment: remember when the status flips while the user replays or scrubs.
  const [prevStatus, setPrevStatus] = useState<VerdictStatus>(v.status);
  const [changes, setChanges] = useState(0);
  if (prevStatus !== v.status) {
    setPrevStatus(v.status);
    setChanges((n) => n + 1);
  }
  useEffect(() => {
    if (changes > 0 && v.status === "keep" && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(14);
  }, [changes, v.status]);

  const meta = sentence ? (
    <>
      {sentence.lead}
      <b>{sentence.strong}</b>
      {sentence.tail}
    </>
  ) : v.status === "collecting" ? (
    <>
      {plural(sum.comparableSoFar, "comparable photo")} so far. Next photo {v.nextCaptureOn ? fmtDay(v.nextCaptureOn) : "today"}; verdict due{" "}
      <b>{fmtDay(sum.dueOn)}</b>.
    </>
  ) : null;

  async function share() {
    const url = window.location.href.split("&replay")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: `Verdict: ${product.name}`, text: `${STATUS[v.status].label}. ${v.headline}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", detail: "Opens this product on the demo shelf.", tone: "ok" });
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <>
      <NavBar
        title={product.name}
        back={{ href: "/", label: "Today" }}
        trailing={
          <button type="button" className="ui-icon-button ui-glass vd-glass-btn" onClick={share} aria-label="Share this verdict" title="Share">
            <Icon name="share" />
          </button>
        }
      />
      <main className="vd-page">
        <LargeTitle title={product.name}>
          <span>{[product.brand, item.retailer, item.price].filter(Boolean).join(" · ")}</span>
          {isDemo ? <DemoNote /> : <span>On this device</span>}
        </LargeTitle>

        <div className="vd-cols">
          <div className="vd-stack">
            <section className="vd-panel relative" aria-label="Verdict">
              {changes > 0 && v.status === "keep" && <span key={changes} className="vd-flash" aria-hidden />}
              <VerdictHero key={`${v.status}-${changes}`} status={v.status} headline={v.headline} meta={meta} changed={changes > 0} />
              <div className="px-5 pb-5">
                <WindowTrack
                  product={product}
                  frames={frames}
                  day={day}
                  todayDay={todayDay}
                  verdict={trackVerdictLabel(sum)}
                  input={
                    <>
                      <input
                        type="range"
                        className="vd-track__input no-print"
                        min={0}
                        max={todayDay}
                        value={day}
                        onChange={(e) => {
                          setPlaying(false);
                          setDay(Number(e.target.value));
                        }}
                        style={{ width: `${((todayDay + 1) / (win + 1)) * 100}%` }}
                        aria-label="Day of the return window"
                        aria-valuetext={`Day ${day}, ${fmtDay(asOf)}: ${STATUS[v.status].label}`}
                      />
                      <span className="vd-track__focus" aria-hidden />
                    </>
                  }
                />
                <div className="vd-replay no-print">
                  <p>
                    <b>{replaying ? `Day ${day}` : "Today"}</b> · {fmtDay(asOf)} · day {day} of {win}
                  </p>
                  <button
                    type="button"
                    className="ui-button ui-button--tinted ui-button--lg"
                    onClick={() => {
                      if (playing) return setPlaying(false);
                      reportAction("replay");
                      if (day >= todayDay) setDay(0);
                      setPlaying(true);
                    }}
                    aria-pressed={playing}
                  >
                    <Icon name={playing ? "pause" : "play"} filled={!playing} />
                    {playing ? "Pause" : day >= todayDay ? "Replay" : "Play"}
                  </button>
                </div>
              </div>
            </section>

            {v.status === "collecting" && (
              <Link href={`/capture?id=${encodeURIComponent(product.id)}`} className="ui-button ui-button--prominent ui-button--xl no-print">
                <Icon name="camera" />
                Take today&apos;s photo
              </Link>
            )}

            <section aria-labelledby="m-h">
              <div className="vd-section-title">
                <h2 id="m-h">Measurements</h2>
                <p>raw_score · higher is better</p>
              </div>
              <div className="vd-panel vd-panel--pad">
                {product.concerns.map((action, i) => (
                  <ConcernChart key={action} product={product} captures={captures} action={action} index={i} asOfDay={day} decisionDay={decisionDay} trend={v.trends[action]} />
                ))}
                <ChartLegend />
              </div>
              <p className="vd-footnote mt-2.5">
                YouCam also returns a display score, calibrated upward by design. Verdict shows it but decides on raw_score, with a least-squares
                trend and a noise floor.
              </p>
            </section>
          </div>

          <div className="vd-stack">
            <section className="ui-list-section" aria-labelledby="p-h">
              <div className="ui-list__header">
                <strong id="p-h">The promise</strong>
              </div>
              <ul className="ui-list vd-kv">
                <li>
                  <p className="vd-quote">&ldquo;{product.claim}&rdquo;</p>
                </li>
                <li>
                  <Row title="Tracked" detail={product.concerns.map((c) => concernDef(c).label).join(", ")} />
                </li>
                <li>
                  <Row title="Brand promise" detail={product.promisedDays ? plural(product.promisedDays, "day") : "No time stated"} />
                </li>
                <li>
                  <Row title="Return window" detail={plural(win, "day")} />
                </li>
                <li>
                  <Row title="Each photo" detail={`${skinAnalysisCost(product.concerns)} units`} />
                </li>
              </ul>
              <p className="ui-list__footer">
                {product.concerns.length} of 16 Skin Analysis concerns, read from the claim. Fewer concerns keep every photo in the 9-unit SD tier.
              </p>
            </section>

            {v.promiseExceedsWindow && (
              <div className="ui-banner ui-banner--warn" role="note">
                <Icon name="alert" />
                <div>
                  <strong>The promise is longer than the return window.</strong>
                  <p>
                    The brand says {plural(product.promisedDays ?? 0, "day")}, the store gives {win}. Verdict judges the early trend and tells you before
                    you lose the right to return.
                  </p>
                </div>
              </div>
            )}

            {v.reasons.length > 0 && (
              <section className="ui-list-section" aria-labelledby="w-h">
                <div className="ui-list__header">
                  <strong id="w-h">Why</strong>
                </div>
                <ul className="ui-list">
                  {v.reasons.map((r) => (
                    <li key={r}>
                      <Row icon="info" title={r} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <NextSteps item={item} status={v.status} isDemo={isDemo} />
          </div>
        </div>
      </main>
    </>
  );
}

function NextSteps({ item, status, isDemo }: { item: DemoItem; status: VerdictStatus; isDemo: boolean }) {
  const [sheet, setSheet] = useState<"sim" | "look" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const sim = simulationFor(item.product.concerns);
  const simKeys = Object.keys(sim);
  const simUnits = skinSimulationCost(Math.max(1, simKeys.length));
  const offerLook = status === "return" || status === "stop" || status === "mixed";
  const id = encodeURIComponent(item.product.id);
  const live = () =>
    toast({ title: "Needs a real photo", detail: "Demo products have no day-0 photo. Take a photo: with the live API, its result screen renders this. Nothing was sent.", tone: "info" });

  return (
    <section className="ui-list-section no-print" aria-labelledby="n-h">
      <div className="ui-list__header">
        <strong id="n-h">Next</strong>
      </div>
      <ul className="ui-list">
        {status !== "collecting" && (
          <li>
            <Row href={`/capture?id=${id}`} icon="camera" title="Take a photo" subtitle="Keeps the timeline going after the verdict" />
          </li>
        )}
        <li>
          <Row href={`/proof?id=${id}`} icon="doc" title="Proof for the store" subtitle="Every photo, its quality and its scores" />
        </li>
        <li>
          <Row onClick={() => (reportAction("sheet_promised"), setSheet("sim"))} icon="compare" title="See the promised result" subtitle={`YouCam Skin Simulation · ${simUnits} units`} />
        </li>
        {offerLook && (
          <li>
            <Row onClick={() => (reportAction("sheet_look"), setSheet("look"))} icon="brush" title="Try an alternative on your face" subtitle={`YouCam Look VTO · ${LOOK_VTO_UNITS} units`} />
          </li>
        )}
        {!isDemo && (
          <li>
            <Row onClick={() => setConfirm(true)} icon="trash" title="Delete product and photos" tone="destructive" chevron={false} />
          </li>
        )}
      </ul>

      <Sheet
        open={sheet === "sim"}
        onClose={() => setSheet(null)}
        title="Promised result"
        cancelLabel="Cancel"
        action={
          <button
            type="button"
            className="ui-button ui-button--prominent"
            onClick={() => {
              setSheet(null);
              live();
            }}
          >
            Render
          </button>
        }
      >
        <p className="vd-sheet-lead">
          Renders your day-0 photo with {simKeys.join(", ") || "the promised concerns"} at 50% intensity, so you know what &ldquo;working&rdquo;
          should look like before you judge it. Cached after the first render.
        </p>
        <ul className="ui-list vd-kv" style={{ background: "var(--bg-grouped-tertiary)" }}>
          <li>
            <Row title="API" detail="Skin Simulation" />
          </li>
          <li>
            <Row title="Cost" detail={`${simUnits} units, once`} />
          </li>
        </ul>
        <pre className="vd-code">{`POST /s2s/v2.0/task/skin-simulation\n{ src_file_id, ${Object.entries(sim)
          .map(([k, val]) => `${k}: ${val}`)
          .join(", ")} }`}</pre>
      </Sheet>

      <Sheet
        open={sheet === "look"}
        onClose={() => setSheet(null)}
        title="Try an alternative"
        cancelLabel="Cancel"
        action={
          <button
            type="button"
            className="ui-button ui-button--prominent"
            onClick={() => {
              setSheet(null);
              live();
            }}
          >
            Try on
          </button>
        }
      >
        <p className="vd-sheet-lead">
          Before you buy the next product, try an expert look from the YouCam template catalogue on your own photo. Nothing to return if it does not
          suit you.
        </p>
        <pre className="vd-code">{`GET  /s2s/v2.0/task/template/look-vto\nPOST /s2s/v2.0/task/look-vto  { src_file_id, template_id }`}</pre>
        <p className="vd-footnote mt-3">{LOOK_VTO_UNITS} units per try-on.</p>
      </Sheet>

      <Alert
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${item.product.name}?`}
        message="Its photos and scores are removed from this browser. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteUserProduct(item.product.id);
          toast({ title: "Product deleted", detail: "Its photos and scores were removed from this browser.", tone: "ok" });
          router.push("/");
        }}
      />
    </section>
  );
}
