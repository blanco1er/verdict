import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Sidebar, SidebarWithParams, TabBar } from "@/components/chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdict: does it work before you can't return it?",
  description:
    "Verdict tracks only what a skincare product promises with YouCam AI Skin Analysis, and tells you keep or return before the return window closes.",
  appleWebApp: { capable: true, title: "Verdict", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-ui-auto="off": React owns the DOM; the design-system motion module is
    // initialised per component (sheets, segmented controls), never globally.
    <html lang="en" data-ui-auto="off">
      <body className="ui-root">
        <Suspense fallback={<Sidebar />}>
          <SidebarWithParams />
        </Suspense>
        <div className="vd-main">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
