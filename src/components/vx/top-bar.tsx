"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Sticky glass bar: the page title fades in once the large title has scrolled away. */
export function TopBar({ title, leading, trailing }: { title: string; leading?: ReactNode; trailing?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 56);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`vx-top vx-top--bar${scrolled ? " is-scrolled" : ""}`}>
      <div className="vx-top__side">{leading}</div>
      <b className="vx-top__title" aria-hidden={!scrolled}>
        {title}
      </b>
      <div className="vx-top__side vx-top__side--end">{trailing}</div>
    </div>
  );
}
