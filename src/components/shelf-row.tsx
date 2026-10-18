import Link from "next/link";
import { StatusPill, Swatch } from "@/components/ui";
import type { DemoItem } from "@/lib/demo/shelf";
import { computeVerdict } from "@/lib/tracking/verdict";
import type { IsoDay } from "@/lib/tracking/model";

export function ShelfRow({ item, today }: { item: DemoItem; today: IsoDay }) {
  const v = computeVerdict(item.product, item.captures, today);
  return (
    <li>
      <Link
        href={`/product?id=${encodeURIComponent(item.product.id)}`}
        className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-foreground/15"
      >
        <Swatch hue={item.hue} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{item.product.name}</h3>
            <StatusPill status={v.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{item.story || v.headline}</p>
          <p className="mt-1.5 text-[12px] font-medium tabular-nums text-muted">
            {v.daysToDeadline >= 0 ? `${v.daysToDeadline} days to return` : "Return window closed"} · {v.usableCaptures} good photo{v.usableCaptures === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
    </li>
  );
}
