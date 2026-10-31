import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Sidebar, SidebarWithParams } from "@/components/chrome";
import { VisitBeacon } from "@/components/visit-beacon";
import { Dock } from "@/components/vx/dock";
import { I18nRuntime } from "@/components/vx/i18n-runtime";
import "./globals.css";
import "./vx.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Verdict: does it work before you can't return it?",
  description:
    "Verdict tracks only what a skincare product promises with YouCam AI Skin Analysis, and tells you keep or return before the return window closes.",
  applicationName: "Verdict",
  appleWebApp: { capable: true, title: "Verdict", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-ui-auto="off": React owns the DOM; the design-system motion module is
    // initialised per component (sheets, segmented controls), never globally.
    <html lang="en" data-ui-auto="off" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Language and theme before the first paint (Settings), with a safety reveal. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("verdict:lang");if(l==="fr"){document.documentElement.dataset.lang="fr";document.documentElement.lang="fr";setTimeout(function(){document.documentElement.classList.add("i18n-ready")},900)}var t=localStorage.getItem("verdict:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="ui-root vx-has-dock">
        <Suspense fallback={<Sidebar />}>
          <SidebarWithParams />
        </Suspense>
        <div className="vd-main">{children}</div>
        <Dock />
        <I18nRuntime />
        <Suspense fallback={null}>
          <VisitBeacon />
        </Suspense>
      </body>
    </html>
  );
}
