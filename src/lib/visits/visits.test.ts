import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contextOf,
  daysFrom,
  internalCookieValue,
  isInternal,
  makeEvent,
  maskText,
  normalizePath,
  productOf,
  refOf,
  uaInfo,
  visitorId,
} from "./core";
import { FileStore, MemoryStore, R2Store, storeFromEnv } from "./store";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

describe("visit log rules", () => {
  it("never keeps the address: a salted one-way id instead", () => {
    const a = visitorId("salt", "203.0.113.9", IPHONE);
    expect(a).toMatch(/^v_[0-9a-f]{16}$/);
    expect(a).toBe(visitorId("salt", "203.0.113.9", IPHONE));
    expect(a).not.toBe(visitorId("other-salt", "203.0.113.9", IPHONE));
    const ctx = contextOf(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": IPHONE }), "salt", "");
    expect(JSON.stringify(ctx)).not.toContain("203.0.113.9");
    expect(ctx).toMatchObject({ v: a, br: "Safari", os: "iOS", dev: "mobile" });
  });

  it("masks e-mails, numbers and secrets", () => {
    expect(maskText("mail me at judge@example.com or +33 6 12 34 56 78")).toBe("mail me at [email] or [number]");
    expect(maskText("card 4111 1111 1111 1111")).toBe("card [card]");
    expect(maskText("api key: sk-abc123")).toBe("api key: [hidden]");
    expect(maskText("x".repeat(300)).length).toBe(160);
  });

  it("keeps the referring site name only", () => {
    expect(refOf("https://devpost.com/software/verdict?ref=x", "verdict.app")).toBe("devpost.com");
    expect(refOf("https://www.youtube.com/watch?v=1", "verdict.app")).toBe("youtube.com");
    expect(refOf("https://verdict.app/product", "verdict.app")).toBe("self");
    expect(refOf("", "verdict.app")).toBe("direct");
  });

  it("flags robots and families", () => {
    expect(uaInfo("curl/8.7.1").bot).toBe(1);
    expect(uaInfo("").bot).toBe(1);
    expect(uaInfo(IPHONE).bot).toBeUndefined();
    expect(uaInfo("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toMatchObject({ br: "Chrome", os: "macOS", dev: "desktop" });
  });

  it("counts known pages only and never a free-form id", () => {
    expect(normalizePath("/product?id=calming-serum&replay=1")).toBe("/product");
    expect(normalizePath("/wp-admin")).toBeNull();
    expect(productOf("/product?id=calming-serum")).toBe("calming-serum");
    expect(productOf("/product?id=My Secret Cream")).toBe("user-product");
  });

  it("recognises the owner's devices by header or by the secret-link cookie", () => {
    const token = "t".repeat(64);
    expect(isInternal(new Headers({ "x-verdict-internal": "1" }), token)).toBe(true);
    expect(isInternal(new Headers({ cookie: `a=1; verdict_internal=${internalCookieValue(token)}` }), token)).toBe(true);
    expect(isInternal(new Headers({ cookie: "verdict_internal=forged" }), token)).toBe(false);
    expect(isInternal(new Headers({}), "")).toBe(false);
  });

  it("clips extra fields to primitives", () => {
    const e = makeEvent("analysis", { v: "v_1", br: "Safari", os: "iOS", dev: "mobile" }, { units: 9, outcome: "ok", nested: { a: 1 }, v: "spoof", ok: true });
    expect(e).toMatchObject({ e: "analysis", v: "v_1", units: 9, outcome: "ok", ok: 1 });
    expect(e.nested).toBe("[object Object]");
  });

  it("lists days from a start date", () => {
    expect(daysFrom("2026-10-30", new Date("2026-11-02T10:00:00Z"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("visit stores", () => {
  const evt = (t: string) => makeEvent("page", { v: "v_1", br: "Safari", os: "iOS", dev: "mobile" }, { path: "/" }, new Date(t));

  it("file store: one private JSON line per event, one file per day", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "verdict-visits-"));
    const s = new FileStore(dir);
    await s.append(evt("2026-10-21T08:00:00Z"));
    await s.append(evt("2026-10-21T09:00:00Z"));
    await s.append(evt("2026-10-22T09:00:00Z"));
    expect((await s.day("2026-10-21")).length).toBe(2);
    expect(readFileSync(path.join(dir, "2026-10-22.jsonl"), "utf8").trim().split("\n")).toHaveLength(1);
    expect(statSync(path.join(dir, "2026-10-21.jsonl")).mode & 0o777).toBe(0o600);
    expect(await s.day("2026-10-23")).toEqual([]);
  });

  it("R2 store: one object per event under a per-day prefix, read back through ListObjectsV2", async () => {
    const objects = new Map<string, string>();
    const signer = {
      async fetch(url: string, init?: RequestInit) {
        const u = new URL(url);
        const key = decodeURIComponent(u.pathname.replace(/^\/bucket\//, ""));
        if (init?.method === "PUT") {
          objects.set(key, String(init.body));
          return new Response(null, { status: 200 });
        }
        if (u.searchParams.get("list-type") === "2") {
          const prefix = u.searchParams.get("prefix")!;
          const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
          return new Response(`<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`);
        }
        return new Response(objects.get(key) ?? "", { status: objects.has(key) ? 200 : 404 });
      },
    };
    const s = new R2Store({ accountId: "acc", accessKeyId: "k", secretAccessKey: "s", bucket: "bucket", prefix: "verdict/visits" }, signer);
    await s.append(evt("2026-10-21T09:00:00Z"));
    await s.append(evt("2026-10-21T08:00:00Z"));
    await s.append(evt("2026-10-22T08:00:00Z"));
    expect([...objects.keys()].every((k) => /^verdict\/visits\/2026-10-2[12]\/2026-10-2[12]T[\d:.]+Z-[0-9a-f]{6}\.json$/.test(k))).toBe(true);
    const day = await s.day("2026-10-21");
    expect(day.map((e) => e.t)).toEqual(["2026-10-21T08:00:00.000Z", "2026-10-21T09:00:00.000Z"]);
  });

  it("chooses R2 when configured, nothing on a serverless host without it, a file otherwise", () => {
    expect(storeFromEnv({ VERDICT_VISITS: "off" })).toBeNull();
    expect(storeFromEnv({ VERCEL: "1" })).toBeNull();
    expect(storeFromEnv({})?.kind).toBe("file");
    expect(
      storeFromEnv({ VERDICT_R2_ACCOUNT_ID: "a", VERDICT_R2_ACCESS_KEY_ID: "b", VERDICT_R2_SECRET_ACCESS_KEY: "c", VERDICT_R2_BUCKET: "d" })?.kind,
    ).toBe("r2");
    expect(new MemoryStore().kind).toBe("memory");
  });
});
