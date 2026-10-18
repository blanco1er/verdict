import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { DEMO_TODAY, demoItem } from "@/lib/demo/shelf";
import { ProofView } from "./proof-view";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function ProofPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Proof searchParams={searchParams} />
    </Suspense>
  );
}

async function Proof({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "calming-serum";
  return <ProofView demo={demoItem(id) ?? null} id={id} demoToday={DEMO_TODAY} />;
}
