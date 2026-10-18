import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { DEMO_SHELF, demoItem } from "@/lib/demo/shelf";
import { checkCapture } from "@/lib/tracking/quality";
import { publicLiveEnabled, youCamMode } from "@/lib/youcam/server";
import { CaptureFlow } from "./capture-flow";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function CapturePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Capture searchParams={searchParams} />
    </Suspense>
  );
}

async function Capture({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : DEMO_SHELF[0].product.id;
  const item = demoItem(id);
  const baseline = item?.captures.find((c) => checkCapture(c.quality).ok)?.quality ?? null;
  return (
    <CaptureFlow
      id={id}
      demo={item ? { name: item.product.name, concerns: item.product.concerns, hue: item.hue } : null}
      baseline={baseline}
      mode={youCamMode()}
      liveUploads={publicLiveEnabled()}
      choices={DEMO_SHELF.map((d) => ({ id: d.product.id, name: d.product.name }))}
    />
  );
}
