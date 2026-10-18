import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { DEMO_TODAY, demoItem } from "@/lib/demo/shelf";
import { ProductView } from "./product-view";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function ProductPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Product searchParams={searchParams} />
    </Suspense>
  );
}

async function Product({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "calming-serum";
  return <ProductView demo={demoItem(id) ?? null} id={id} demoToday={DEMO_TODAY} autoplay={sp.replay === "1"} />;
}
