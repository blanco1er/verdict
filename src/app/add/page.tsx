import type { Metadata } from "next";
import { ScanProduct } from "./scan-product";

export const metadata: Metadata = { title: "Add a product · Verdict" };

export default function AddPage() {
  return <ScanProduct />;
}
