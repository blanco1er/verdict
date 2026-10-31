import type { Metadata } from "next";
import { TryView } from "./try-view";

export const metadata: Metadata = { title: "Try · Verdict" };

export default function TryPage() {
  return <TryView />;
}
