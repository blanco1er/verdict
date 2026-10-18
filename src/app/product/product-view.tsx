"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Card, PageHeader, SectionTitle, STATUS_STYLE, StatusPill, Swatch, TimelineChart, VerdictRing, WindowBar, fmtDay } from "@/components/ui";
import { deleteUserProduct, loadUserItems, useLocalToday } from "@/lib/demo/store";
import { replay, type DemoItem } from "@/lib/demo/shelf";
import { concernDef, simulationFor } from "@/lib/tracking/concerns";
import { addDays, daysBetween, type IsoDay } from "@/lib/tracking/model";
import { computeVerdict } from "@/lib/tracking/verdict";
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
        <PageHeader back={{ href: "/", label: "Today" }} />
        <Card className="text-center">
          <p className="text-[17px] font-semibold">This product isn&apos;t on this device.</p>
          <p className="mt-2 text-sm leading-6 text-muted">Products you add stay in this browser only. Add it again, or open a demo product.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/add" className="rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background">Add a product</Link>
            <Link href="/" className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">Demo shelf</Link>
          </div>
        </Card>
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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setDay((d) => {
        if (d >= todayDay) {
          setPlaying(false);
          return todayDay;
        }
        return d + 1;
      });
    }, 140);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, todayDay]);

  const asOf = addDays(product.purchasedOn, day);
  const v = computeVerdict(product, captures, asOf);
  const firstFinal = frames.find((f) => f.status !== "collecting" && f.day <= todayDay);
  const replaying = day !== todayDay;

  return (
    <>
      <PageHeader back={{ href: "/", label: "Today" }} right={isDemo ? undefined : <span className="text-xs font-medium text-muted">On this device</span>} />

      <Card className="rise">
        <div className="flex items-start gap-3">
          <Swatch hue={item.hue} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-muted">{[product.brand, item.retailer, item.price].filter(Boolean).join(" · ")}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{product.name}</h1>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-5">
          <VerdictRing status={v.status} elapsedDays={day} windowDays={win} daysLeft={v.daysToDeadline} size={132} />
          <div className="min-w-0" aria-live="polite">
            <StatusPill status={v.status} />
            <p className="mt-2.5 text-[17px] font-semibold leading-snug tracking-tight">{v.headline}</p>
            <p className="mt-1.5 text-[12.5px] text-muted tabular-nums">
              {replaying ? `Replaying day ${day} of ${win}` : `Today · day ${day} of ${win}`} · <span className="whitespace-nowrap">{fmtDay(asOf)}</span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="no-print">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Day by day</h2>
          <button
            type="button"
            onClick={() => {
              if (playing) return setPlaying(false);
              if (day >= todayDay) setDay(0);
              setPlaying(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background transition active:scale-95"
          >
            <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
            {playing ? "Pause" : day >= todayDay ? "Replay" : "Play"}
          </button>
        </div>
        <div className="mt-4 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${frames.length}, minmax(0, 1fr))` }} aria-hidden>
          {frames.map((f) => (
            <button
              key={f.day}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setPlaying(false);
                setDay(Math.min(f.day, todayDay));
              }}
              className="h-6 rounded-[4px] transition-opacity"
              style={{
                background: f.day > todayDay ? "var(--line)" : STATUS_STYLE[f.status].color,
                opacity: f.day > todayDay ? 0.6 : f.day <= day ? 1 : 0.28,
                outline: f.day === day ? "2px solid var(--foreground)" : undefined,
                outlineOffset: 1,
              }}
              title={`Day ${f.day}: ${STATUS_STYLE[f.status].label}`}
            />
          ))}
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Day of the return window</span>
          <input
            type="range"
            min={0}
            max={todayDay}
            value={day}
            onChange={(e) => {
              setPlaying(false);
              setDay(Number(e.target.value));
            }}
            className="w-full"
          />
        </label>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">
          {firstFinal ? (
            <>
              The verdict became <b className="font-semibold text-foreground">{STATUS_STYLE[firstFinal.status].label.toLowerCase()}</b> on day {firstFinal.day},{" "}
              {win - firstFinal.day} days before the return deadline. Each day is recomputed from the photos available that day.
            </>
          ) : (
            <>Each day is recomputed from the photos available that day. The verdict is due {fmtDay(v.decisionDate)}, two days before the deadline.</>
          )}
        </p>
      </Card>

      <Card>
        <SectionTitle>The promise</SectionTitle>
        <p className="mt-3 text-[15px] leading-6">“{product.claim}”</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.concerns.map((c) => (
            <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-line">
              {concernDef(c).label}
            </span>
          ))}
          <span className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted">
            {product.concerns.length} of 16 Skin Analysis concerns · {skinAnalysisCost(product.concerns)} units per photo
          </span>
        </div>
        <div className="mt-5">
          <WindowBar product={product} today={asOf} decisionDate={v.decisionDate} />
        </div>
        {v.promiseExceedsWindow && (
          <p className="mt-4 rounded-2xl bg-mixed/10 px-3.5 py-3 text-[13px] leading-5 text-mixed">
            <b className="font-semibold">Promise longer than the return window.</b> The brand says {product.promisedDays} days, the store gives {win}. Verdict judges the early trend and tells you before you lose the right to return.
          </p>
        )}
      </Card>

      {product.concerns.map((action) => {
        const trend = v.trends[action];
        const last = captures.filter((c) => daysBetween(c.takenOn, asOf) >= 0 && c.scores[action]).at(-1)?.scores[action];
        return (
          <Card key={action}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[16px] font-semibold tracking-tight">{concernDef(action).label}</h2>
              <span className={`text-[12.5px] font-semibold tabular-nums ${trend?.direction === "improving" ? "text-keep" : trend?.direction === "worsening" ? "text-return" : "text-muted"}`}>
                {!trend || trend.direction === "insufficient"
                  ? "Needs 3 good photos"
                  : `${trend.change >= 0 ? "+" : "−"}${Math.abs(trend.change).toFixed(1)} pts in ${trend.spanDays} days · ${trend.direction}`}
              </span>
            </div>
            <div className="mt-3">
              <TimelineChart product={product} captures={captures} action={action} asOf={asOf} trend={trend} decisionDate={v.decisionDate} />
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              {last ? (
                <>
                  Latest YouCam score {last.ui}/100 (raw {last.raw.toFixed(1)}). The verdict uses <b className="font-semibold text-foreground">raw_score</b>: the display score is calibrated upward by design.
                </>
              ) : (
                "No photo yet. Take your day-0 photo to start the baseline."
              )}
            </p>
          </Card>
        );
      })}

      {v.reasons.length > 0 && (
        <Card>
          <SectionTitle>Why</SectionTitle>
          <ul className="mt-3 space-y-2 text-[14px] leading-6">
            {v.reasons.map((r) => (
              <li key={r} className="flex gap-2.5">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-subtle" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <NextSteps item={item} status={v.status} isDemo={isDemo} />
    </>
  );
}

function NextSteps({ item, status, isDemo }: { item: DemoItem; status: string; isDemo: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();
  const sim = simulationFor(item.product.concerns);
  const simActive = Object.keys(sim).length;
  const actions = [
    {
      id: "sim",
      title: "See the promised result",
      api: "YouCam AI Skin Simulation",
      units: skinSimulationCost(Math.max(1, simActive)),
      body: `Renders your day-0 photo with ${Object.keys(sim).join(", ") || "the promised concerns"} at 50% intensity, so you know what "working" should look like. Cached after the first render.`,
      call: `POST /s2s/v2.0/task/skin-simulation  { src_file_id, ${Object.entries(sim).map(([k, v]) => `${k}: ${v}`).join(", ")} }`,
    },
    ...(status === "return" || status === "stop" || status === "mixed"
      ? [
          {
            id: "look",
            title: "Try an alternative on your face",
            api: "YouCam Look VTO",
            units: LOOK_VTO_UNITS,
            body: "Before you buy the next product, try an expert look from the template catalogue on your own photo.",
            call: "GET /s2s/v2.0/task/template/look-vto → POST /s2s/v2.0/task/look-vto  { src_file_id, template_id }",
          },
        ]
      : []),
  ];
  return (
    <section className="no-print flex flex-col gap-3">
      <SectionTitle>Next</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/capture?id=${encodeURIComponent(item.product.id)}`}
          className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-4 text-[14px] font-semibold text-background transition active:scale-[.98]"
        >
          Take a photo
        </Link>
        <Link
          href={`/proof?id=${encodeURIComponent(item.product.id)}`}
          className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface px-4 text-[14px] font-semibold transition hover:border-foreground/25"
        >
          Proof for the store
        </Link>
      </div>
      {actions.map((a) => (
        <div key={a.id} className="card overflow-hidden">
          <button
            type="button"
            aria-expanded={open === a.id}
            onClick={() => setOpen(open === a.id ? null : a.id)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span>
              <span className="block text-[15px] font-semibold tracking-tight">{a.title}</span>
              <span className="text-[12.5px] text-muted">
                {a.api} · {a.units} units
              </span>
            </span>
            <span aria-hidden className={`text-muted transition-transform ${open === a.id ? "rotate-90" : ""}`}>›</span>
          </button>
          {open === a.id && (
            <div className="border-t border-line px-5 py-4 text-[13.5px] leading-6">
              <p>{a.body}</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-foreground px-3.5 py-3 font-mono text-[11.5px] leading-5 text-background">{a.call}</pre>
              <p className="mt-2.5 text-[12px] text-muted">Runs with the live API key. In this demo no units are spent.</p>
            </div>
          )}
        </div>
      ))}
      {!isDemo && (
        <button
          type="button"
          onClick={() => {
            deleteUserProduct(item.product.id);
            router.push("/");
          }}
          className="self-center rounded-full px-4 py-2 text-[13px] font-semibold text-return hover:bg-return/10"
        >
          Delete this product and its photos
        </button>
      )}
    </section>
  );
}
