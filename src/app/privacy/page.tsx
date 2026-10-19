import type { Metadata } from "next";
import { NavBar } from "@/components/chrome";
import { LargeTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy · Verdict" };

const SECTIONS: Array<{ title: string; items: string[] }> = [
  {
    title: "Your photos",
    items: [
      "Demo mode: your photo never leaves your device. Only its size is sent, to simulate the upload.",
      "Live mode (only when this deployment allows it, and only with your consent): a camera photo is sent through our server to YouCam AI Skin Analysis for the concerns shown, then dropped. Verdict does not store it. YouCam's own retention applies to the file it receives.",
      "Products and scores you add stay in this browser (local storage). Delete them from the product screen at any time.",
    ],
  },
  {
    title: "Anonymous usage log",
    items: [
      "To learn whether the demo is used and where it is hard to follow, the server logs anonymous events: the page opened, the site you came from (its name only, for example devpost.com), how long the page stayed open, named actions (for example “replay”), whether an analysis ran in demo or live mode and its unit cost, and JavaScript errors.",
      "A visitor is a one-way, salted code made from your network address and browser. The address itself is never written.",
      "Never logged: photos, scores, anything you type, names, e-mail addresses, cookies of other sites.",
      "Read only by the developer, through a private token. No public page shows it. Kept until 31 March 2027 at the latest, then deleted.",
    ],
  },
  {
    title: "No tracking",
    items: ["No advertising, no third-party analytics, no tracking cookie. Cosmetic guidance only, not medical advice."],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <NavBar title="Privacy" back={{ href: "/", label: "Today" }} />
      <main className="vd-page vd-page--narrow">
        <LargeTitle title="Privacy">
          <span>What Verdict keeps, and what it never does</span>
        </LargeTitle>
        <div className="vd-stack">
          {SECTIONS.map((s) => (
            <section key={s.title} className="ui-list-section" aria-labelledby={`p-${s.title}`}>
              <div className="ui-list__header">
                <strong id={`p-${s.title}`}>{s.title}</strong>
              </div>
              <ul className="ui-list">
                {s.items.map((t) => (
                  <li key={t.slice(0, 40)}>
                    <div className="ui-row">
                      <span className="ui-row__body">
                        <span className="ui-row__subtitle vd-prose" style={{ color: "var(--label)" }}>
                          {t}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
