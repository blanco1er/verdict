import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { VisitEvent } from "./core";

/**
 * Where visit events go. Three interchangeable stores:
 * - R2Store: one small object per event in a Cloudflare R2 bucket (S3 API). Works on any host,
 *   including serverless ones whose disk is read-only or wiped (Vercel, Render free).
 * - FileStore: one JSON line per event in <dir>/YYYY-MM-DD.jsonl (local runs, hosts with a disk).
 * - MemoryStore: tests.
 */
export interface VisitStore {
  readonly kind: string;
  append(evt: VisitEvent): Promise<void>;
  /** Events of one UTC day, oldest first. */
  day(day: string): Promise<VisitEvent[]>;
}

const MAX_DAY_BYTES = 20e6;

export class MemoryStore implements VisitStore {
  readonly kind = "memory";
  readonly events: VisitEvent[] = [];
  async append(evt: VisitEvent) {
    this.events.push(evt);
  }
  async day(day: string) {
    return this.events.filter((e) => e.t.startsWith(day));
  }
}

export class FileStore implements VisitStore {
  readonly kind = "file";
  constructor(private readonly dir: string) {}
  private file(day: string) {
    return path.join(this.dir, `${day}.jsonl`);
  }
  async append(evt: VisitEvent) {
    const f = this.file(evt.t.slice(0, 10));
    await mkdir(this.dir, { recursive: true });
    const size = await stat(f).then((s) => s.size, () => 0);
    if (size > MAX_DAY_BYTES) return; // a robot cannot fill the disk
    await appendFile(f, `${JSON.stringify(evt)}\n`, { mode: 0o600 });
  }
  async day(day: string) {
    const text = await readFile(this.file(day), "utf8").catch(() => "");
    return text
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as VisitEvent];
        } catch {
          return [];
        }
      });
  }
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
}

type Signer = { fetch(input: string, init?: RequestInit): Promise<Response> };

export class R2Store implements VisitStore {
  readonly kind = "r2";
  private signer: Promise<Signer> | undefined;
  constructor(
    private readonly cfg: R2Config,
    signer?: Signer,
  ) {
    if (signer) this.signer = Promise.resolve(signer);
  }
  private client(): Promise<Signer> {
    this.signer ??= import("aws4fetch").then(
      ({ AwsClient }) => new AwsClient({ accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey, service: "s3", region: "auto" }),
    );
    return this.signer;
  }
  private base() {
    return `https://${this.cfg.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(this.cfg.bucket)}`;
  }
  private prefixOf(day: string) {
    return `${this.cfg.prefix.replace(/\/+$/, "")}/${day}/`;
  }
  async append(evt: VisitEvent) {
    const key = `${this.prefixOf(evt.t.slice(0, 10))}${evt.t}-${randomBytes(3).toString("hex")}.json`;
    const res = await (await this.client()).fetch(`${this.base()}/${key.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(evt),
    });
    if (!res.ok) throw new Error(`R2 PUT ${res.status}`);
  }
  async day(day: string) {
    const c = await this.client();
    const keys: string[] = [];
    let token = "";
    for (let page = 0; page < 20; page++) {
      const qs = new URLSearchParams({ "list-type": "2", prefix: this.prefixOf(day), "max-keys": "1000" });
      if (token) qs.set("continuation-token", token);
      const res = await c.fetch(`${this.base()}?${qs}`);
      if (!res.ok) throw new Error(`R2 LIST ${res.status}`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, "&"));
      const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || !next) break;
      token = next[1].replace(/&amp;/g, "&");
    }
    const out: VisitEvent[] = [];
    // Small batches: the report reads a few hundred events at most.
    for (let i = 0; i < keys.length; i += 16) {
      const batch = await Promise.all(
        keys.slice(i, i + 16).map(async (k) => {
          const r = await c.fetch(`${this.base()}/${k.split("/").map(encodeURIComponent).join("/")}`);
          return r.ok ? ((await r.json().catch(() => null)) as VisitEvent | null) : null;
        }),
      );
      for (const e of batch) if (e) out.push(e);
    }
    return out.sort((a, b) => a.t.localeCompare(b.t));
  }
}

/** Chooses the store from the environment; null when logging is off or impossible. */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): VisitStore | null {
  if (env.VERDICT_VISITS === "off") return null;
  const r2: Partial<R2Config> = {
    accountId: env.VERDICT_R2_ACCOUNT_ID,
    accessKeyId: env.VERDICT_R2_ACCESS_KEY_ID,
    secretAccessKey: env.VERDICT_R2_SECRET_ACCESS_KEY,
    bucket: env.VERDICT_R2_BUCKET,
  };
  if (r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket) {
    return new R2Store({ ...(r2 as R2Config), prefix: env.VERDICT_R2_PREFIX || "verdict/visits" });
  }
  // Serverless hosts have no lasting disk: without R2, nothing would survive, so nothing is written.
  if (env.VERCEL) return null;
  return new FileStore(path.resolve(env.VERDICT_DATA || ".data", "visits"));
}
