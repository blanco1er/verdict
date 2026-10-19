import type { Metadata } from "next";
import { NavBar } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { LargeTitle, Row, StatusLabel, fmtDay, plural } from "@/components/ui";
import { liveStats, localDay, positiveControl, realSeries, repeatability } from "@/lib/live/measured";
import { concernDef } from "@/lib/tracking/concerns";
import { daysBetween } from "@/lib/tracking/model";
import { TREND_DEFAULTS } from "@/lib/tracking/trend";
import { computeVerdict } from "@/lib/tracking/verdict";

export const metadata: Metadata = { title: "Measured with YouCam · Verdict" };

const fmt = (n: number, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function MeasuredPage() {
  const stats = liveStats();
  const rep = repeatability();
  const ctl = positiveControl();
  const real = realSeries();
  const today = stats.last ? localDay(stats.last) : null;
  const verdict = real && today ? computeVerdict(real.product, real.captures, today) : null;
  const day = real && today ? daysBetween(real.product.purchasedOn, today) : 0;
  const repN = rep[0]?.n ?? 0;
  const maxSd = rep.length ? Math.max(...rep.map((r) => r.sdRaw)) : 0;
  const gap = rep.length ? rep.reduce((s, r) => s + r.uiGap, 0) / rep.length : 0;
  const detected = ctl.filter((c) => c.detected);

  return (
    <>
      <NavBar title="Measured" back={{ href: "/", label: "Today" }} />
      <main className="vd-page">
        <LargeTitle title="Measured">
          <span>Real YouCam results on the maker&apos;s own skin</span>
          <span className="vd-real-note">
            <Icon name="checkCircle" />
            Real data
          </span>
        </LargeTitle>

        {stats.photos === 0 ? (
          <div className="vd-stack">
            <section className="vd-panel vd-panel--pad vd-empty" aria-labelledby="e-h">
              <Icon name="face" />
              <h2 id="e-h">The first live session is on its way</h2>
              <p>
                This page will show real YouCam AI Skin Analysis results: how much a score moves between photos taken a minute apart, whether a real
                change shows up above that noise, and an honest verdict on a real product. Until then, every other screen runs on synthetic data, labelled
                as such.
              </p>
            </section>
          </div>
        ) : (
          <div className="vd-stack">
            <p className="vd-summary">
              <strong>{plural(stats.photos, "real photo")}</strong> analysed by YouCam AI Skin Analysis
              {stats.first && stats.last && localDay(stats.first) !== localDay(stats.last)
                ? ` between ${fmtDay(localDay(stats.first))} and ${fmtDay(localDay(stats.last))}`
                : stats.first
                  ? ` on ${fmtDay(localDay(stats.first))}`
                  : ""}
              . These numbers decide how big a change must be before Verdict calls it a trend.
            </p>

            <div className="vd-panel">
              <div className="ui-stats vd-stats">
                <div className="ui-stat">
                  <p className="ui-stat__label">Real photos</p>
                  <p className="ui-stat__value">{stats.photos}</p>
                  <p className="ui-stat__delta">scores kept, photos not</p>
                </div>
                <div className="ui-stat">
                  <p className="ui-stat__label">Units spent</p>
                  <p className="ui-stat__value">{stats.units}</p>
                  <p className="ui-stat__delta">9 per photo, SD tier</p>
                </div>
                <div className="ui-stat">
                  <p className="ui-stat__label">Median task time</p>
                  <p className="ui-stat__value">
                    {stats.medianLatencyS != null ? fmt(stats.medianLatencyS) : "–"}
                    <small>s</small>
                  </p>
                  <p className="ui-stat__delta">upload to scores</p>
                </div>
                <div className="ui-stat">
                  <p className="ui-stat__label">Display vs raw</p>
                  <p className="ui-stat__value">
                    {rep.length ? `${gap >= 0 ? "+" : ""}${fmt(gap)}` : "–"}
                    <small>pts</small>
                  </p>
                  <p className="ui-stat__delta">why trends use raw_score</p>
                </div>
              </div>
            </div>

            <div className="vd-cols">
              {rep.length > 0 && (
                <section className="ui-list-section" aria-labelledby="r-h">
                  <div className="ui-list__header">
                    <strong id="r-h">Repeatability</strong>
                    <span>{plural(repN, "photo")}, one session</span>
                  </div>
                  <ul className="ui-list">
                    {rep.map((r) => (
                      <li key={r.concern}>
                        <Row
                          title={concernDef(r.concern).label}
                          subtitle={`raw ${fmt(r.minRaw)} to ${fmt(r.maxRaw)} · display score ${fmt(r.meanUi, 0)}`}
                          detail={
                            <span className="vd-num">
                              ±{fmt(r.sdRaw, 2)}
                              <small> σ</small>
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="ui-list__footer">
                    Same face, same light, a minute apart: any spread here is measurement noise. The verdict engine assumes σ = {TREND_DEFAULTS.noiseSigma} raw
                    points{" "}
                    {maxSd <= TREND_DEFAULTS.noiseSigma
                      ? `and the largest measured σ is ${fmt(maxSd, 2)}, so its floor is on the safe side.`
                      : `but the largest measured σ is ${fmt(maxSd, 2)}: that concern needs a larger change before Verdict trusts it.`}
                  </p>
                </section>
              )}

              {ctl.length > 0 && (
                <section className="ui-list-section" aria-labelledby="c-h">
                  <div className="ui-list__header">
                    <strong id="c-h">Does a real change show?</strong>
                    <span>{fmt(ctl[0].hours)} h apart</span>
                  </div>
                  <ul className="ui-list">
                    {ctl.map((c) => (
                      <li key={c.concern}>
                        <Row
                          title={concernDef(c.concern).label}
                          subtitle={`raw ${fmt(c.before)} → ${fmt(c.after)}${c.threshold != null ? ` · noise limit ±${fmt(c.threshold)}` : ""}`}
                          detail={
                            <span className="vd-status" data-status={c.detected ? "keep" : "collecting"}>
                              {c.detected == null ? `${c.delta >= 0 ? "+" : ""}${fmt(c.delta)}` : c.detected ? `${c.delta >= 0 ? "+" : ""}${fmt(c.delta)} detected` : "Within noise"}
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="ui-list__footer">
                    Same face photographed {fmt(ctl[0].hours)} hours apart with nothing applied in between: oil builds up during the day, so oiliness should
                    move.{" "}
                    {detected.length > 0
                      ? `${detected.map((c) => concernDef(c.concern).label).join(" and ")} moved beyond the noise limit.`
                      : "Nothing moved beyond the noise limit, and Verdict reports exactly that."}
                  </p>
                </section>
              )}
            </div>

            {real && verdict && (
              <section className="ui-list-section" aria-labelledby="s-h">
                <div className="ui-list__header">
                  <strong id="s-h">A real product, today</strong>
                  <span>
                    day {day} of {real.product.returnWindowDays}
                  </span>
                </div>
                <ul className="ui-list">
                  <li>
                    <div className="ui-row">
                      <span className="ui-row__body">
                        <span className="ui-row__title">{real.product.name}</span>
                        <span className="vd-row-meta">
                          <StatusLabel status={verdict.status} />
                        </span>
                        <span className="ui-row__subtitle">{verdict.headline}</span>
                        <span className="vd-row-story">
                          {plural(verdict.usableCaptures, "comparable photo")} · tracking {real.product.concerns.map((c) => concernDef(c).label.toLowerCase()).join(", ")} ·
                          verdict due {fmtDay(verdict.decisionDate)}
                        </span>
                      </span>
                    </div>
                  </li>
                </ul>
                <p className="ui-list__footer">
                  The honest state of a real series: too early to call. The 30-day story on the Today screen is synthetic, so a judge can see every verdict in
                  ten seconds.
                </p>
              </section>
            )}

            <section className="ui-list-section" aria-labelledby="h-h">
              <div className="ui-list__header">
                <strong id="h-h">How it was measured</strong>
              </div>
              <ul className="ui-list">
                <li>
                  <Row icon="face" title="YouCam AI Skin Analysis, SD tier" subtitle="POST /s2s/v2.0/task/skin-analysis, format json, 1 to 4 concerns: 9 units per photo." />
                </li>
                <li>
                  <Row icon="lock" title="Scores only" subtitle="The photos were analysed, then never stored here. Task ids are kept for audit." />
                </li>
                <li>
                  <Row icon="info" title="Cosmetic guidance" subtitle="Not medical advice. One person's skin: these are calibration numbers, not a study." />
                </li>
              </ul>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
