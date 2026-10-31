import Link from "next/link";
import { Icon } from "@/components/icons";
import { Bottle } from "@/components/vx/live";
import { WORD, bottleKind, windowLeft } from "@/components/vx/product-bits";
import type { DemoItem } from "@/lib/demo/shelf";
import type { IsoDay } from "@/lib/tracking/model";
import { computeVerdict } from "@/lib/tracking/verdict";

/** One product: its bottle (liquid = window still open), the verdict in two words, days left. */
export function ShelfRow({ item, today }: { item: DemoItem; today: IsoDay }) {
  const v = computeVerdict(item.product, item.captures, today);
  return (
    <li>
      <Link href={`/product?id=${encodeURIComponent(item.product.id)}`} className="vx-row">
        <Bottle hue={item.hue} level={windowLeft(item, today)} kind={bottleKind(item.product.name)} size={44} status={v.status} />
        <span className="vx-row__body">
          <span className="vx-row__title">{item.product.name}</span>
          <span className="vx-row__sub" data-status={v.status}>
            <span className="vx-dot" />
            {WORD[v.status]}
          </span>
        </span>
        <span className="vx-row__end">
          <b>{Math.max(0, v.daysToDeadline)} d</b>
          <small>to return</small>
        </span>
        <Icon name="chevron" />
      </Link>
    </li>
  );
}
