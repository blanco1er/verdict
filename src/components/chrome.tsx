"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "@/components/icons";
import { Bottle } from "@/components/vx/live";
import { bottleKind, windowLeft } from "@/components/vx/product-bits";
import { DEMO_SHELF, DEMO_TODAY } from "@/lib/demo/shelf";
import { computeVerdict } from "@/lib/tracking/verdict";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/history", label: "Products", icon: "products" },
  { href: "/capture", label: "Photo", icon: "camera" },
  { href: "/try", label: "Try", icon: "brush" },
  { href: "/merchant", label: "Brands", icon: "brands" },
];

function activeTab(path: string): string {
  if (path.startsWith("/phone")) return "/phone";
  if (path.startsWith("/capture")) return "/capture";
  if (path.startsWith("/history") || path.startsWith("/add")) return "/history";
  if (path.startsWith("/try")) return "/try";
  if (path.startsWith("/merchant")) return "/merchant";
  return "/";
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** iPhone: floating Liquid Glass tab bar with a sliding selection indicator. */
export function TabBar() {
  const path = usePathname();
  const current = activeTab(path);
  const tabs = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const [minimized, setMinimized] = useState(false);

  useIsoLayoutEffect(() => {
    const place = (animate: boolean) => {
      const el = tabs.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const ind = indicator.current;
      if (!el || !ind) return;
      ind.style.transition = animate ? "transform var(--dur-snappy) var(--ease-snappy), width var(--dur-snappy) var(--ease-snappy)" : "none";
      ind.style.width = `${el.offsetWidth}px`;
      ind.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    place(indicator.current?.style.width !== "");
    const ro = new ResizeObserver(() => place(false));
    if (tabs.current) ro.observe(tabs.current);
    return () => ro.disconnect();
  }, [current]);

  useEffect(() => {
    let last = window.scrollY;
    const typing = () => document.activeElement?.matches("input, textarea, select") ?? false;
    const onScroll = () => {
      const y = window.scrollY;
      // Scrolling to reveal a focused field (keyboard) is not a reading scroll: keep the bar in place.
      if (!typing()) setMinimized(y > last && y > 160);
      last = y;
    };
    const onFocusOut = () => setMinimized(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <nav aria-label="Main" className={`ui-tabbar no-print${minimized ? " is-minimized" : ""}`}>
      <div ref={tabs} className="ui-tabbar__tabs ui-glass">
        <span ref={indicator} className="ui-tabbar__indicator" aria-hidden />
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="ui-tabbar__item" aria-current={current === t.href ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** iPad (700–999 px): the same three tabs, centred in the navigation bar. */
export function TopTabs() {
  const current = activeTab(usePathname());
  return (
    <nav aria-label="Sections" className="ui-tabs-top ui-glass vd-nav__tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={current === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop (≥ 1000 px): floating glass sidebar with the shelf one click away. */
export function SidebarWithParams() {
  const id = useSearchParams().get("id") ?? undefined;
  return <Sidebar productId={id} />;
}

export function Sidebar({ productId }: { productId?: string }) {
  const path = usePathname();
  const current = activeTab(path);
  return (
    <aside className="ui-sidebar ui-glass vd-sidebar no-print" aria-label="Verdict">
      <div className="ui-sidebar__header">
        <Link href="/" className="vd-brand">
          <Logo size={28} />
          Verdict
        </Link>
      </div>
      <div className="ui-sidebar__scroll">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="ui-nav-item" aria-current={current === t.href && !/^\/(product|measured|privacy)/.test(path) ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
          </Link>
        ))}
        <p className="ui-sidebar__heading">Shelf</p>
        {DEMO_SHELF.map((item) => {
          const v = computeVerdict(item.product, item.captures, DEMO_TODAY);
          const href = `/product?id=${item.product.id}`;
          return (
            <Link key={item.product.id} href={href} className="ui-nav-item vd-sidebar__product" aria-current={path.startsWith("/product") && productId === item.product.id ? "page" : undefined}>
              <Bottle hue={item.hue} level={windowLeft(item, DEMO_TODAY)} kind={bottleKind(item.product.name)} size={26} status={v.status} />
              <span className="min-w-0 truncate">{item.product.name}</span>
              <span className="vx-dot" data-status={v.status} aria-label={v.status} />
            </Link>
          );
        })}
        <Link href="/add" className="ui-nav-item">
          <Icon name="plus" />
          Add a product
        </Link>
      </div>
      <div className="ui-sidebar__footer">
        <Link href="/phone" className="ui-nav-item" aria-current={current === "/phone" ? "page" : undefined}>
          <Icon name="phone" />
          Phone view
        </Link>
      </div>
    </aside>
  );
}

/**
 * Navigation bar: back button and actions in Liquid Glass, inline title that
 * appears once the large title scrolls under the bar, soft scroll-edge blur.
 */
export function NavBar({ title, back, trailing }: { title: string; back?: { href: string; label: string }; trailing?: ReactNode }) {
  const bar = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 2);
      const big = document.getElementById("vd-large-title");
      const barBottom = bar.current?.getBoundingClientRect().bottom ?? 52;
      setCollapsed(big ? big.getBoundingClientRect().bottom < barBottom : window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header ref={bar} className={`vd-nav no-print${scrolled ? " is-scrolled" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <div className="vd-nav__leading">
        {back && (
          <Link href={back.href} className="ui-icon-button ui-glass vd-glass-btn" aria-label={`Back to ${back.label}`} title={`Back to ${back.label}`}>
            <Icon name="back" />
          </Link>
        )}
      </div>
      <div className="flex min-w-0 justify-center">
        <TopTabs />
        <p className="vd-nav__title" aria-hidden>
          {title}
        </p>
      </div>
      <div className="vd-nav__trailing">{trailing}</div>
    </header>
  );
}

/** Hides the tab bar while the camera is open (immersive). */
export function useImmersive(on: boolean) {
  useEffect(() => {
    document.documentElement.classList.toggle("vd-immersive", on);
    return () => document.documentElement.classList.remove("vd-immersive");
  }, [on]);
}
