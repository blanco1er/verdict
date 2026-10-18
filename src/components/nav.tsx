"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today", icon: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" },
  { href: "/capture", label: "Photo", icon: "M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" },
  { href: "/add", label: "Add", icon: "M12 5v14M5 12h14" },
  { href: "/merchant", label: "Merchant", icon: "M4 19V9m5.3 10V5m5.4 14v-7M20 19v-4" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:sticky lg:bottom-4 lg:mx-auto lg:mt-6 lg:w-full lg:max-w-md lg:rounded-full lg:border lg:shadow-[0_14px_36px_-22px_rgba(18,19,22,.35)]">
      <ul className="mx-auto flex max-w-md justify-around px-2 py-1.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" || path.startsWith("/product") || path.startsWith("/proof") : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${active ? "text-foreground" : "text-muted hover:text-foreground"}`}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
