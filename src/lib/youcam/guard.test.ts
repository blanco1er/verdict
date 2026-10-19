import { describe, expect, it } from "vitest";
import { LiveGate } from "./guard";

const clock = (iso: string) => {
  const d = { now: new Date(iso) };
  return { d, now: () => d.now };
};

describe("live gate (protects the 1,000 hackathon units)", () => {
  it("is closed unless public live is on", async () => {
    const g = new LiveGate({ publicLive: false, floor: 100, getBalance: async () => 900 });
    expect(await g.take("v_a", 9)).toEqual({ ok: false, reason: "public_live_off" });
  });

  it("lets a visitor run 3 live analyses a day, then falls back", async () => {
    const c = clock("2026-11-05T10:00:00Z");
    const g = new LiveGate({ publicLive: true, floor: 100, getBalance: async () => 900, now: c.now });
    const res = [];
    for (let i = 0; i < 4; i++) res.push((await g.take("v_a", 9)).ok);
    expect(res).toEqual([true, true, true, false]);
    expect(await g.status("v_a", 9)).toEqual({ ok: false, reason: "visitor_quota" });
    expect(await g.status("v_b", 9)).toEqual({ ok: true, left: 3 });
    c.d.now = new Date("2026-11-06T10:00:00Z");
    expect((await g.take("v_a", 9)).ok).toBe(true);
  });

  it("caps all visitors per day", async () => {
    const g = new LiveGate({ publicLive: true, floor: 0, getBalance: async () => 5000, now: () => new Date("2026-11-05T10:00:00Z") });
    let ok = 0;
    for (let i = 0; i < 30; i++) if ((await g.take(`v_${i % 10}`, 9)).ok) ok++;
    expect(ok).toBe(15);
    expect(await g.status("v_new", 9)).toEqual({ ok: false, reason: "daily_quota" });
  });

  it("never goes under the floor of the REAL balance, even across restarts", async () => {
    let balance = 118;
    const g = new LiveGate({ publicLive: true, floor: 100, getBalance: async () => balance, cacheMs: 0 });
    expect((await g.take("v_a", 9)).ok).toBe(true); // 118 - 9 = 109 >= 100
    balance = 108; // 108 - 9 = 99 < 100
    expect(await g.take("v_b", 9)).toEqual({ ok: false, reason: "unit_floor" });
    const restarted = new LiveGate({ publicLive: true, floor: 100, getBalance: async () => balance });
    expect(await restarted.take("v_c", 9)).toEqual({ ok: false, reason: "unit_floor" });
  });

  it("refuses when the balance cannot be read, and counts spent units in the cache", async () => {
    const down = new LiveGate({ publicLive: true, floor: 100, getBalance: async () => Promise.reject(new Error("network")) });
    expect(await down.take("v_a", 9)).toEqual({ ok: false, reason: "balance_unknown" });
    const g = new LiveGate({ publicLive: true, floor: 100, getBalance: async () => 112 });
    expect((await g.take("v_a", 9)).ok).toBe(true);
    g.spent(9); // cached balance is now 103
    expect(await g.take("v_b", 9)).toEqual({ ok: false, reason: "unit_floor" });
  });
});
