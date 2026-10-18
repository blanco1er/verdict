import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BottomNav } from "@/components/nav";
import { Logo, SyntheticBadge } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Verdict: does it work before you can't return it?",
  description: "Verdict tracks only what a skincare product promises with YouCam AI Skin Analysis, and tells you keep or return before the return window closes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

const APIS = [
  { name: "AI Skin Analysis", detail: "Only the 1 to 4 concerns the product promises: 9 units per photo (SD tier). Trends on raw_score." },
  { name: "File API + task polling", detail: "POST /file, PUT to the pre-signed URL, POST /task, poll until success. Failed tasks cost nothing." },
  { name: "Skin Simulation", detail: "\"The promised result\" from your day-0 photo (4 units, cached)." },
  { name: "Look VTO", detail: "A shade-matched alternative when the verdict is return (2 units)." },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:px-10">
          <aside className="no-print hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:py-10">
            <Link href="/" className="flex items-center gap-3 text-[22px] font-semibold tracking-tight">
              <Logo size={34} />
              Verdict
            </Link>
            <h1 className="mt-8 max-w-md text-[44px] font-semibold leading-[1.02] tracking-[-0.04em]">
              Does it work? <span className="text-accent-ink">Know before the return window closes.</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-muted">
              Verdict reads what a skincare product promises, measures only those concerns in comparable daily photos with
              YouCam AI Skin Analysis, and tells you to keep it or send it back, two days before the deadline.
            </p>
            <ul className="mt-8 grid max-w-md gap-3">
              {APIS.map((a) => (
                <li key={a.name} className="flex gap-3 text-sm leading-6">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    <b className="font-semibold">{a.name}.</b> <span className="text-muted">{a.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-3 text-xs text-muted">
              <SyntheticBadge />
              <span>Demo mode: generated scores, documented YouCam response shapes.</span>
            </div>
          </aside>
          <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
            <main className="flex flex-1 flex-col gap-4 px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))] lg:pb-6 lg:pt-8">{children}</main>
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}
