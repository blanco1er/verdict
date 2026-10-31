import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LooksGallery } from "@/components/vx/looks";
import { TopBar } from "@/components/vx/top-bar";

export const metadata: Metadata = { title: "Your looks · Verdict" };

export default function GalleryPage() {
  return (
    <main className="vx-page">
      <TopBar
        title="Your looks"
        leading={
          <Link href="/" className="vx-round" aria-label="Back to Today">
            <Icon name="back" />
          </Link>
        }
      />
      <h1 className="vx-title">Your looks</h1>
      <p className="vx-sub">Saved on this phone. Tap one to see it full screen, share it or save it to Photos.</p>
      <LooksGallery />
    </main>
  );
}
