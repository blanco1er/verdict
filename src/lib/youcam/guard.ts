import { VISITOR_LIMITS, VisitorQuota } from "../budget/plan";

/**
 * Decides whether one public visitor may spend real units right now.
 * Three locks, cheapest first:
 * 1. YOUCAM_PUBLIC_LIVE=1 (off by default);
 * 2. a per-visitor and per-day quota (in memory: per server instance);
 * 3. the REAL balance read from YouCam (free call, cached 20 s) must stay
 *    above YOUCAM_UNIT_FLOOR after this call. This one survives restarts and
 *    serverless instances, so the hackathon units can never be drained.
 * When a lock says no, the app runs the same pipeline in demo mode and says why.
 */
export type GateRefusal = "public_live_off" | "visitor_quota" | "daily_quota" | "unit_floor" | "balance_unknown";

export interface GateOptions {
  publicLive: boolean;
  floor: number;
  getBalance: () => Promise<number>;
  quota?: VisitorQuota;
  now?: () => Date;
  cacheMs?: number;
}

export class LiveGate {
  private readonly quota: VisitorQuota;
  private cached: { at: number; units: number } | undefined;

  constructor(private readonly o: GateOptions) {
    this.quota = o.quota ?? new VisitorQuota({ ...VISITOR_LIMITS, hardFloorUnits: o.floor });
  }

  private now() {
    return this.o.now?.() ?? new Date();
  }

  async balance(): Promise<number | null> {
    const t = this.now().getTime();
    if (this.cached && t - this.cached.at < (this.o.cacheMs ?? 20_000)) return this.cached.units;
    try {
      const units = await this.o.getBalance();
      this.cached = { at: t, units };
      return units;
    } catch {
      return null;
    }
  }

  /** Units just spent: keeps the cached balance honest until the next read. */
  spent(units: number) {
    if (this.cached) this.cached = { ...this.cached, units: this.cached.units - units };
  }

  /** Read-only preview for the UI (does not count). */
  async status(visitor: string, cost: number): Promise<{ ok: true; left: number } | { ok: false; reason: GateRefusal }> {
    if (!this.o.publicLive) return { ok: false, reason: "public_live_off" };
    const balance = await this.balance();
    if (balance == null) return { ok: false, reason: "balance_unknown" };
    if (balance - cost < this.o.floor) return { ok: false, reason: "unit_floor" };
    const left = this.quota.leftFor(visitor, this.now().toISOString().slice(0, 10));
    if (left.global <= 0) return { ok: false, reason: "daily_quota" };
    if (left.visitor <= 0) return { ok: false, reason: "visitor_quota" };
    return { ok: true, left: left.visitor };
  }

  /** Counts the call when allowed. */
  async take(visitor: string, cost: number): Promise<{ ok: true } | { ok: false; reason: GateRefusal }> {
    const s = await this.status(visitor, cost);
    if (!s.ok) return s;
    const balance = (await this.balance()) ?? 0;
    if (!this.quota.tryConsume(visitor, this.now().toISOString().slice(0, 10), balance)) return { ok: false, reason: "daily_quota" };
    return { ok: true };
  }
}

export const REFUSAL_TEXT: Record<GateRefusal, string> = {
  public_live_off: "Live analysis is off on this deployment, so this photo ran in demo mode.",
  visitor_quota: "You have used today's live analyses on this demo, so this photo ran in demo mode.",
  daily_quota: "Today's live analyses for all visitors are used up, so this photo ran in demo mode.",
  unit_floor: "The demo's YouCam unit reserve is reached, so this photo ran in demo mode.",
  balance_unknown: "YouCam's unit balance could not be checked, so this photo ran in demo mode.",
};
