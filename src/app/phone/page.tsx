import type { Metadata } from "next";
import { NavBar } from "@/components/chrome";
import { DemoNote } from "@/components/sheet";
import { LargeTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Verdict on iPhone" };

/** For judges on a computer: the app at iPhone size, fully interactive. */
export default function PhonePage() {
  return (
    <>
      <NavBar title="Phone view" back={{ href: "/", label: "Today" }} />
      <main className="vd-page">
        <LargeTitle title="Phone view">
          <span>Verdict is built for iPhone. This frame runs the real app at 390 × 844.</span>
          <DemoNote />
        </LargeTitle>
        <p className="vd-phone-only vd-footnote mb-6">You are already on a phone: the steps below work in this window.</p>
        <div className="flex flex-wrap items-start gap-10">
          <div className="vd-phone-frame">
            <iframe src="/" title="Verdict at iPhone size" />
          </div>
          <ol className="ui-list max-w-sm" style={{ background: "var(--bg-grouped-secondary)", padding: "6px 0" }}>
            {[
              ["Open Calming Serum", "The verdict landed 17 days before the return deadline."],
              ["Replay the window", "Drag across the days, or tap Replay, and watch Measuring turn into Keep it."],
              ["Take a photo", "Consent, light check on the phone, then the YouCam calls with their unit cost."],
              ["Add a product", "Paste a claim: Verdict picks the concerns and prices the whole window first."],
              ["Brands", "Measured efficacy per SKU, and claims that drive returns."],
            ].map(([t, d], i) => (
              <li key={t} className="ui-row" style={{ alignItems: "flex-start" }}>
                <span className="ui-row__icon ui-num" aria-hidden>
                  {i + 1}
                </span>
                <span className="ui-row__body">
                  <span className="ui-row__title" style={{ fontWeight: 590 }}>
                    {t}
                  </span>
                  <span className="ui-row__subtitle">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </>
  );
}
