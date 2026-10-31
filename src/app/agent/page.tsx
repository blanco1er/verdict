import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { concernDef, readClaim } from "@/lib/tracking/concerns";
import { LOOK_VTO_UNITS, skinAnalysisCost, skinSimulationCost } from "@/lib/youcam/costs";
import { LiveStatus } from "./live-status";

export const metadata: Metadata = { title: "Agent · Verdict" };

const CLAIM = "Calming serum that visibly reduces redness and refines pores in 14 days.";

export default function Agent() {
  const reading = readClaim(CLAIM);
  const perPhoto = skinAnalysisCost(reading.concerns);
  const photos = 15;
  return (
    <main className="vx-page">
      <div className="vx-top">
        <Link href="/" className="vx-round" aria-label="Back to Today">
          <Icon name="back" />
        </Link>
      </div>
      <h1 className="vx-title">How it works</h1>
      <p className="vx-sub">Every YouCam call Verdict makes, in order, with what it costs.</p>
      <LiveStatus />

      <section className="vx-section" aria-labelledby="read-h">
        <div className="vx-section__head">
          <h2 id="read-h">1 · Read the promise</h2>
          <span>0 units</span>
        </div>
        <ol className="vx-console">
          <li>
            <span>IN</span>
            <span>
              <b>&ldquo;{CLAIM}&rdquo;</b>
            </span>
            <em />
          </li>
          <li>
            <span>OUT</span>
            <span>
              <b>{reading.concerns.map((c) => concernDef(c).label.toLowerCase()).join(", ")}</b> · promised in {reading.promisedDays} days
              <small>Only the concerns the brand promises are measured: 1 to 4 of the 16, so every photo stays in the cheapest tier.</small>
            </span>
            <em className="is-data">{perPhoto} u/photo</em>
          </li>
          <li>
            <span>PLAN</span>
            <span>
              <b>
                {photos} photos × {perPhoto} units
              </b>
              <small>The whole return window is priced before the first photo.</small>
            </span>
            <em className="is-data">{photos * perPhoto} u</em>
          </li>
        </ol>
      </section>

      <section className="vx-section" aria-labelledby="photo-h">
        <div className="vx-section__head">
          <h2 id="photo-h">2 · Measure one photo</h2>
          <span>{perPhoto} units</span>
        </div>
        <ol className="vx-console">
          <li>
            <span>CHECK</span>
            <span>
              <b>light · face size · angle · lighting vs day 0</b>
              <small>On the phone, before any upload. A blocked photo costs nothing.</small>
            </span>
            <em>0 u</em>
          </li>
          <li>
            <span>POST</span>
            <span>
              <b>/s2s/v2.0/file</b>
              <small>Declares the photo, returns a pre-signed upload URL.</small>
            </span>
            <em>200</em>
          </li>
          <li>
            <span>PUT</span>
            <span>
              <b>pre-signed upload URL</b>
              <small>Never logged in full.</small>
            </span>
            <em>200</em>
          </li>
          <li>
            <span>POST</span>
            <span>
              <b>/s2s/v2.0/task/skin-analysis</b>
              <small>AI Skin Analysis, SD, only the promised concerns.</small>
            </span>
            <em className="is-data">{perPhoto} u</em>
          </li>
          <li>
            <span>GET</span>
            <span>
              <b>/s2s/v2.0/task/skin-analysis/{"{task_id}"}</b>
              <small>Polled until success. A failed task is not charged.</small>
            </span>
            <em>success</em>
          </li>
          <li>
            <span>TREND</span>
            <span>
              <b>least squares on raw_score, noise floor</b>
              <small>ui_score is shown, never trended: it is calibrated upward by design.</small>
            </span>
            <em>0 u</em>
          </li>
        </ol>
      </section>

      <section className="vx-section" aria-labelledby="after-h">
        <div className="vx-section__head">
          <h2 id="after-h">3 · After the verdict</h2>
        </div>
        <ol className="vx-console">
          <li>
            <span>POST</span>
            <span>
              <b>/s2s/v2.0/task/skin-simulation</b>
              <small>The promised result on your day-0 photo, so you know what &ldquo;working&rdquo; should look like.</small>
            </span>
            <em className="is-data">{skinSimulationCost(reading.concerns.length)} u</em>
          </li>
          <li>
            <span>POST</span>
            <span>
              <b>/s2s/v2.0/task/look-vto</b>
              <small>When the verdict is return: try an alternative on your own face before buying again.</small>
            </span>
            <em className="is-data">{LOOK_VTO_UNITS} u</em>
          </li>
        </ol>
      </section>

      <section className="vx-section" aria-labelledby="guard-h">
        <div className="vx-section__head">
          <h2 id="guard-h">Guardrails</h2>
        </div>
        {[
          ["The key stays on the server", "The browser never sees it; every call goes through /api/youcam."],
          ["Units are capped", "A total cap, a floor kept for the owner, and a few real analyses per visitor."],
          ["Consent first", "No photo leaves the phone without consent. Demo photos never leave it."],
          ["Your photos, your call", "Delete a product and its photos at any time."],
        ].map(([t, d]) => (
          <div className="vx-check" key={t}>
            <Icon name="check" />
            <div>
              <b>{t}</b>
              <span>{d}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="vx-section" aria-labelledby="proof-h">
        <div className="vx-section__head">
          <h2 id="proof-h">Proof</h2>
        </div>
        <ul className="vx-rows">
          <li>
            <Link href="/measured" className="vx-row">
              <span className="vx-row__body">
                <span className="vx-row__title">Real measurements</span>
                <span className="vx-row__sub">Live YouCam results on a real face</span>
              </span>
              <Icon name="chevron" />
            </Link>
          </li>
          <li>
            <Link href="/proof?id=calming-serum" className="vx-row">
              <span className="vx-row__body">
                <span className="vx-row__title">Proof for the store</span>
                <span className="vx-row__sub">Every photo, its quality and its scores</span>
              </span>
              <Icon name="chevron" />
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
