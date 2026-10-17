import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Verdict",
  description: "Know if a skincare product works before the return window closes. Powered by YouCam AI Skin Analysis.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf7",
};

const NAV = [
  { href: "/", label: "Today" },
  { href: "/capture", label: "Photo" },
  { href: "/merchant", label: "Merchant" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-24 pt-6">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/90 backdrop-blur">
          <ul className="mx-auto flex max-w-md justify-around px-4 py-3 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-full px-4 py-2 text-muted hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </body>
    </html>
  );
}
