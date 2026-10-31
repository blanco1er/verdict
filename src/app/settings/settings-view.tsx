"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { LANG_EVENT, readLang } from "@/components/vx/i18n-runtime";
import { TopBar } from "@/components/vx/top-bar";
import { LANG_KEY } from "@/lib/i18n";

export const THEME_KEY = "verdict:theme";
export const WINDOW_KEY = "verdict:window";

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/** One row of choices, flat (a segmented control). */
function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="vx-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function SettingsView() {
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [win, setWin] = useState("30");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setLang(readLang());
      setTheme(read(THEME_KEY, "system") as "system" | "light" | "dark");
      setWin(read(WINDOW_KEY, "30"));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function pickLang(l: "en" | "fr") {
    setLang(l);
    write(LANG_KEY, l);
    document.documentElement.dataset.lang = l;
    window.dispatchEvent(new Event(LANG_EVENT));
  }
  function pickTheme(t: "system" | "light" | "dark") {
    setTheme(t);
    write(THEME_KEY, t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = t;
  }
  async function wipe() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("verdict") && k !== LANG_KEY && k !== THEME_KEY && k !== WINDOW_KEY)
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* nothing stored */
    }
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase("verdict-gallery");
      r.onsuccess = r.onerror = r.onblocked = () => resolve();
    });
    window.dispatchEvent(new Event("storage"));
    setConfirm(false);
    setDone(true);
  }

  return (
    <main className="vx-page">
      <TopBar
        title="Settings"
        leading={
          <Link href="/" className="vx-round" aria-label="Back to Today">
            <Icon name="back" />
          </Link>
        }
      />
      <h1 className="vx-title">Settings</h1>

      <section className="vx-section" aria-labelledby="s-lang">
        <div className="vx-section__head">
          <h2 id="s-lang">Language</h2>
        </div>
        <Choice
          label="Language"
          value={lang}
          onChange={pickLang}
          options={[
            ["en", "English"],
            ["fr", "Français"],
          ]}
        />
      </section>

      <section className="vx-section" aria-labelledby="s-theme">
        <div className="vx-section__head">
          <h2 id="s-theme">Appearance</h2>
        </div>
        <Choice
          label="Appearance"
          value={theme}
          onChange={pickTheme}
          options={[
            ["system", "Automatic"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
        />
      </section>

      <section className="vx-section" aria-labelledby="s-win">
        <div className="vx-section__head">
          <h2 id="s-win">Default return window</h2>
        </div>
        <Choice
          label="Default return window"
          value={win}
          onChange={(v) => (setWin(v), write(WINDOW_KEY, v))}
          options={[
            ["14", "14 days"],
            ["30", "30 days"],
            ["60", "60 days"],
            ["90", "90 days"],
          ]}
        />
        <p className="vx-cap__note">Used when you add a product.</p>
      </section>

      <section className="vx-section" aria-labelledby="s-data">
        <div className="vx-section__head">
          <h2 id="s-data">Your data</h2>
        </div>
        <p className="vx-cap__note" style={{ marginTop: 10 }}>
          Everything stays on this phone.
        </p>
        {done ? (
          <p className="vx-row__sub" style={{ marginTop: 12 }}>
            <Icon name="check" /> Deleted from this phone
          </p>
        ) : (
          <button type="button" className="vx-danger" onClick={() => setConfirm(true)}>
            <Icon name="trash" />
            Delete my products, photos and looks
          </button>
        )}
      </section>

      <section className="vx-section" aria-labelledby="s-about">
        <div className="vx-section__head">
          <h2 id="s-about">About</h2>
        </div>
        <ul className="vx-rows">
          {[
            ["/agent", "How it works"],
            ["/privacy", "Privacy"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="vx-row" style={{ minHeight: 54 }}>
                <span className="vx-row__body">
                  <span className="vx-row__title">{label}</span>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="vx-foot" style={{ borderTop: 0 }}>
          Verdict · Powered by YouCam AI Skin Analysis
        </p>
      </section>

      {confirm && (
        <div className="vx-overlay" onClick={() => setConfirm(false)}>
          <div className="vx-sheet" role="alertdialog" aria-modal="true" aria-labelledby="wipe-h" onClick={(e) => e.stopPropagation()}>
            <span className="vx-sheet__grab" aria-hidden />
            <h2 id="wipe-h">Delete everything?</h2>
            <p>Your products, their photos and your saved looks are removed from this phone.</p>
            <button type="button" className="vx-danger vx-danger--solid" onClick={() => void wipe()}>
              Delete
            </button>
            <button type="button" className="vx-ask__alt" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
