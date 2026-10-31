"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

const LEFT: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/history", label: "Products", icon: "products" },
];
const RIGHT: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/try", label: "Try", icon: "brush" },
  { href: "/merchant", label: "Brands", icon: "brands" },
];

function current(path: string): string {
  if (path.startsWith("/history") || path.startsWith("/product") || path.startsWith("/add")) return "/history";
  if (path.startsWith("/try")) return "/try";
  if (path.startsWith("/merchant")) return "/merchant";
  return "/";
}

/** Phone dock: four places and, in the middle, the one gesture of the app: the photo. */
export function Dock() {
  const path = usePathname();
  const here = current(path);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.body.classList.add("vx-has-dock");
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > last + 4 && y > 200);
      if (y < last - 4) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (path.startsWith("/capture") || path.startsWith("/phone")) return null;
  const tab = (t: (typeof LEFT)[number]) => (
    <Link key={t.href} href={t.href} aria-current={here === t.href ? "page" : undefined}>
      <Icon name={t.icon} />
      {t.label}
    </Link>
  );
  return (
    <nav className={`vx-dock no-print${hidden ? " is-hidden" : ""}`} aria-label="Main">
      {LEFT.map(tab)}
      <Link href="/capture" className="vx-shutter" aria-label="Take today's photo">
        <i />
      </Link>
      {RIGHT.map(tab)}
    </nav>
  );
}
