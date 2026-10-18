import Link from "next/link";
import { Icon, ProductGlyph } from "@/components/icons";
import { StatusLabel, plural } from "@/components/ui";
import type { DemoItem } from "@/lib/demo/shelf";
import type { IsoDay } from "@/lib/tracking/model";
import { computeVerdict } from "@/lib/tracking/verdict";

/** One product on the shelf: name, verdict (dot + word), days left, the story in one line. */
export function ShelfRow({ item, today }: { item: DemoItem; today: IsoDay }) {
  const v = computeVerdict(item.product, item.captures, today);
  const left = v.daysToDeadline >= 0 ? `${plural(v.daysToDeadline, "day")} to return` : "Window closed";
  return (
    <li>
      <Link href={`/product?id=${encodeURIComponent(item.product.id)}`} className="ui-row">
        <ProductGlyph name={item.product.name} />
        <span className="ui-row__body">
          <span className="ui-row__title">{item.product.name}</span>
          <span className="vd-row-meta">
            <StatusLabel status={v.status} />
            <span aria-hidden>·</span>
            <span>{left}</span>
          </span>
          <span className="vd-row-story">{item.story || v.headline}</span>
        </span>
        <Icon name="chevron" className="ui-icon ui-row__chevron" />
      </Link>
    </li>
  );
}
