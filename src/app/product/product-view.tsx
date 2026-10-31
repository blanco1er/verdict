"use client";

import { reportAction } from "@/components/visit-beacon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { NavBar } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { Alert, DemoNote, Sheet } from "@/components/sheet";
import { LargeTitle, Row, STATUS, fmtDay, plural } from "@/components/ui";
import { Bottle, Spark, WindowRing } from "@/components/vx/live";
import { WORD, bottleKind, shortDay } from "@/components/vx/product-bits";
import { toast } from "@/design-system/motion.js";
import { replay, type DemoItem } from "@/lib/demo/shelf";
import { decidedSentence, verdictSummary } from "@/lib/demo/summary";
import { deleteUserProduct, loadUserItems, readProductThumb, useLocalToday } from "@/lib/demo/store";
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

const noThumbEvents = () => () => {};

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

  const [tab, setTab] = useState<"results" | "promise" | "next">("results");
  const thumb = useSyncExternalStore(noThumbEvents, () => (isDemo ? null : readProductThumb(item.product.id)), () => null);
  const left = Math.max(0, win - day);
  const photoDays = new Set(captures.filter((c) => c.takenOn <= asOf).map((c) => daysBetween(product.purchasedOn, c.takenOn)));

  return (
    <main className="vx-page">
      <div className="vx-top">
        <Link href="/" className="vx-round" aria-label="Back to Today" title="Today">
          <Icon name="back" />
        </Link>
        <div className="flex items-center gap-2">
          {isDemo && <DemoNote label="Demo" />}
          <button type="button" className="vx-round" onClick={share} aria-label="Share this verdict" title="Share">
            <Icon name="share" />
          </button>
        </div>
      </div>

      <div className="vx-id">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img className="vx-id__photo" src={thumb} alt="" />
        ) : (
          <Bottle hue={item.hue} level={1 - day / win} kind={bottleKind(product.name)} size={64} status={v.status} />
        )}
        <div className="vx-id__text">
          <h1 className="vx-id__name">{product.name}</h1>
          <p className="vx-id__line">{[product.brand, item.price, `bought ${shortDay(product.purchasedOn)}`].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div className="vx-verdict">
        <WindowRing day={day} total={win} decisionDay={sum.decided ? sum.decided.day : decisionDay} size={150}>
          <b>{left}</b>
          <span>days to return</span>
        </WindowRing>
        <div className="min-w-0" aria-live="polite">
          <p className="vx-verdict__word" data-status={v.status} key={`${v.status}-${changes}`}>
            <span className={`vx-dot${v.status === "collecting" ? " vx-dot--live" : ""}`} />
            {WORD[v.status]}
          </p>
          <p className="vx-verdict__line">
            {sum.decided ? (
              <>
                Decided {shortDay(sum.decided.on)} · <b>{plural(sum.decided.daysBeforeDeadline, "day")} early</b> · {plural(sum.decided.fromPhotos, "photo")}
              </>
            ) : v.status === "collecting" ? (
              <>
                {plural(sum.comparableSoFar, "photo")} so far · verdict by <b>{shortDay(sum.dueOn)}</b>
              </>
            ) : (
              v.headline
            )}
          </p>
        </div>
      </div>

      <div className="vx-window no-print">
        <div className="vx-window__bar" style={{ gridTemplateColumns: `repeat(${win + 1}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: win + 1 }, (_, d) => (
            <span
              key={d}
              className={[
                "vx-window__day",
                d <= day ? "is-past" : "",
                photoDays.has(d) && d <= day ? "is-photo" : "",
                sum.decided && d === sum.decided.day && d <= day ? "is-decision" : "",
              ].join(" ")}
            />
          ))}
        </div>
        <input
          type="range"
          className="vx-window__input"
          min={0}
          max={todayDay}
          value={day}
          onChange={(e) => {
            setPlaying(false);
            setDay(Number(e.target.value));
          }}
          aria-label="Day of the return window"
          aria-valuetext={`Day ${day}, ${fmtDay(asOf)}: ${STATUS[v.status].label}`}
        />
        <div className="vx-window__legend">
          <span>
            Bought <b>{shortDay(product.purchasedOn)}</b>
          </span>
          <button
            type="button"
            className="vx-quiet"
            onClick={() => {
              if (playing) return setPlaying(false);
              reportAction("replay");
              if (day >= todayDay) setDay(0);
              setPlaying(true);
            }}
            aria-pressed={playing}
          >
            <Icon name={playing ? "pause" : "play"} filled={!playing} />
            {playing ? `Day ${day}` : replaying ? "Play" : "Replay"}
          </button>
          <span>
            Return by <b>{shortDay(addDays(product.purchasedOn, win))}</b>
          </span>
        </div>
      </div>

      {v.status === "collecting" && (
        <Link href={`/capture?id=${encodeURIComponent(product.id)}`} className="vx-go vx-go--wide no-print" style={{ marginTop: 22 }}>
          <Icon name="camera" />
          Take today&apos;s photo
        </Link>
      )}

      <div className="vx-tabs" role="tablist" aria-label="Details">
        {(
          [
            ["results", "Results"],
            ["promise", "Promise"],
            ["next", "Next"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "results" && (
        <div role="tabpanel">
          {product.concerns.map((action) => {
            const t = v.trends[action];
            const values = captures.filter((c) => c.takenOn <= asOf && c.scores[action]).map((c) => c.scores[action]!.raw);
            const change = t ? t.change : 0;
            const word = !t || t.direction === "insufficient" ? "Too early" : t.direction === "improving" ? "Better" : t.direction === "worsening" ? "Worse" : "No change";
            return (
              <div className="vx-concern" key={`${action}-${values.length}`}>
                <span className="vx-concern__name">
                  {concernDef(action).label}
                  <small>{word}</small>
                </span>
                <Spark values={values} width={104} height={34} />
                <span className="vx-concern__delta">{t && t.direction !== "insufficient" ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "–"}</span>
              </div>
            );
          })}
          {v.reasons.length > 0 && (
            <ul className="vx-reasons">
              {v.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "promise" && (
        <div role="tabpanel">
          <p className="vx-quote">&ldquo;{product.claim}&rdquo;</p>
          <dl className="vx-kv">
            <div>
              <dt>Measured</dt>
              <dd>{product.concerns.map((c) => concernDef(c).label).join(", ")}</dd>
            </div>
            <div>
              <dt>Brand promise</dt>
              <dd>{product.promisedDays ? plural(product.promisedDays, "day") : "No time given"}</dd>
            </div>
            <div>
              <dt>Return window</dt>
              <dd>{plural(win, "day")}</dd>
            </div>
            <div>
              <dt>Each photo</dt>
              <dd>{skinAnalysisCost(product.concerns)} units</dd>
            </div>
          </dl>
          {v.promiseExceedsWindow && (
            <p className="vx-callout">
              The brand needs {product.promisedDays} days. The store gives {win}. Verdict reads the early trend so you can still return it.
            </p>
          )}
        </div>
      )}

      {tab === "next" && <NextSteps item={item} status={v.status} isDemo={isDemo} />}
    </main>
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
