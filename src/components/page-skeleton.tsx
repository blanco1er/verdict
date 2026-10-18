import { PageHeader } from "@/components/ui";

export function PageSkeleton() {
  return (
    <>
      <PageHeader />
      <div className="card p-5" aria-busy="true" aria-label="Loading">
        <div className="shimmer h-5 w-1/2 rounded-lg" />
        <div className="mt-5 flex items-center gap-5">
          <div className="shimmer h-32 w-32 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="shimmer h-4 rounded-lg" />
            <div className="shimmer h-4 w-3/4 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="card shimmer h-40" />
    </>
  );
}
