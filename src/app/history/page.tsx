import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ShelfRow } from "@/components/shelf-row";
import { UserShelf } from "@/components/user-shelf";
import { TopBar } from "@/components/vx/top-bar";
import { DEMO_SHELF, DEMO_TODAY } from "@/lib/demo/shelf";

export const metadata: Metadata = { title: "Products · Verdict" };

export default function Products() {
  return (
    <main className="vx-page">
      <TopBar
        title="Products"
        trailing={
          <Link href="/add" className="vx-round" aria-label="Track a product" title="Track a product">
            <Icon name="plus" />
          </Link>
        }
      />
      <h1 className="vx-title">Products</h1>
      <p className="vx-sub">Everything you are measuring, with the days left to return it.</p>

      <section className="vx-section" aria-labelledby="mine-h">
        <div className="vx-section__head">
          <h2 id="mine-h">On this phone</h2>
        </div>
        <ul className="vx-rows">
          <UserShelf />
        </ul>
        <div style={{ marginTop: 16 }}>
          <Link href="/add" className="vx-go vx-go--wide">
            <Icon name="plus" />
            Track a product
          </Link>
        </div>
      </section>

      <section className="vx-section" aria-labelledby="demo-h">
        <div className="vx-section__head">
          <h2 id="demo-h">Demo shelf</h2>
          <span>{DEMO_SHELF.length}</span>
        </div>
        <ul className="vx-rows">
          {DEMO_SHELF.map((item) => (
            <ShelfRow key={item.product.id} item={item} today={DEMO_TODAY} />
          ))}
        </ul>
      </section>
    </main>
  );
}
