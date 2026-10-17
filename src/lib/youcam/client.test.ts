import { describe, expect, it } from "vitest";
import { YouCamApiError, YouCamClient, YouCamTaskError } from "./client";
import { UnitBudgetExceeded, UnitLedger } from "./ledger";
import { MockTransport } from "./mock";
import { LiveTransport } from "./transport";

const noSleep = async () => {};
const jpeg = new Uint8Array(200_000);

function setup(opts: ConstructorParameters<typeof MockTransport>[0] = {}, cap = 100) {
  const transport = new MockTransport(opts);
  const ledger = new UnitLedger(cap);
  const client = new YouCamClient({ transport, ledger, sleep: noSleep, pollIntervalMs: 10 });
  return { transport, ledger, client };
}

describe("YouCamClient in mock mode", () => {
  it("runs the documented flow: file -> PUT -> task -> poll -> json output", async () => {
    const { client, ledger, transport } = setup({ pollsUntilDone: 2 });
    const fileId = await client.uploadImage({ bytes: jpeg, contentType: "image/jpeg", fileName: "day1.jpg" });
    expect(fileId).toMatch(/^mockfile_/);
    const output = await client.analyzeSkin({ src_file_id: fileId }, ["redness", "pore"]);
    const types = output.map((o) => o.type);
    expect(types).toEqual(["redness", "pore", "all"]);
    for (const o of output.filter((x) => x.type !== "all")) {
      expect(o.raw_score).toBeGreaterThanOrEqual(1);
      expect(o.ui_score).toBeLessThanOrEqual(100);
      expect(o.mask_urls?.length).toBe(1);
    }
    expect(ledger.spent).toBe(9);
    expect(ledger.pending).toBe(0);
    expect(transport.unitsCharged).toBe(9);
    expect(transport.log.filter((l) => l.startsWith("GET")).length).toBe(3); // 2x running + success
  });

  it("refunds units when the task ends in error (docs: errors cost nothing)", async () => {
    const { client, ledger } = setup();
    const fileId = await client.uploadImage({ bytes: jpeg, contentType: "image/jpeg", fileName: "noface.jpg" });
    await expect(client.analyzeSkin({ src_file_id: fileId }, ["redness"])).rejects.toMatchObject({
      name: "YouCamTaskError",
      code: "error_no_face",
    });
    expect(ledger.spent).toBe(0);
    expect(ledger.pending).toBe(0);
  });

  it("retries on 429 with backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    const transport = new MockTransport({ rateLimitEvery: 2, pollsUntilDone: 0 });
    const client = new YouCamClient({ transport, sleep: async (ms) => void sleeps.push(ms), pollIntervalMs: 10 });
    const fileId = await client.uploadImage({ bytes: jpeg, contentType: "image/jpeg", fileName: "a.jpg" });
    const out = await client.analyzeSkin({ src_file_id: fileId }, ["acne"]);
    expect(out[0].type).toBe("acne");
    expect(sleeps).toContain(1000); // Retry-After: 1 s
  });

  it("surfaces documented 400 errors and refunds the reservation", async () => {
    const { client, ledger } = setup();
    await expect(
      client.runSkinAnalysis({ src_file_url: "https://example.com/selfie.jpg", dst_actions: ["redness", "hd_pore"] }),
    ).rejects.toThrow("cannot mix HD and SD");
    // Reached the API with a valid list but an unuploaded file id -> 404.
    await expect(client.runSkinAnalysis({ src_file_id: "never-uploaded", dst_actions: ["redness"] })).rejects.toBeInstanceOf(
      YouCamApiError,
    );
    expect(ledger.pending).toBe(0);
  });

  it("refuses to start a task that would exceed the local unit cap", async () => {
    const { client, transport } = setup({}, 10);
    await client.analyzeSkin({ src_file_url: "https://example.com/a.jpg" }, ["redness"]); // 9
    await expect(client.runSkinAnalysis({ src_file_url: "https://example.com/b.jpg", dst_actions: ["pore"] })).rejects.toBeInstanceOf(
      UnitBudgetExceeded,
    );
    expect(transport.log.filter((l) => l.startsWith("POST /s2s/v2.0/task")).length).toBe(1);
  });

  it("supports skin simulation, look templates, look VTO and balance", async () => {
    const { client, ledger } = setup({ pollsUntilDone: 1 });
    const simId = await client.runSkinSimulation({ src_file_url: "https://example.com/a.jpg" }, { redness: 0.6, pores: 0.4 });
    expect(await client.waitForSkinSimulation(simId)).toMatch(/^https:\/\//);
    const { templates } = await client.listLookTemplates();
    expect(templates[0]).toMatchObject({ id: "good_template_001", title: "Berry Smooth" });
    const lookId = await client.runLookVto({ src_file_url: "https://example.com/a.jpg", template_id: templates[0].id });
    expect(await client.waitForLookVto(lookId)).toMatch(/\.jpg$/);
    expect(ledger.spent).toBe(4 + 2);
    expect(await client.getRemainingUnits()).toBe(1000);
  });

  it("gives up polling after maxPollMs without throwing a task error", async () => {
    const transport = new MockTransport({ pollsUntilDone: 1000 });
    const client = new YouCamClient({ transport, sleep: noSleep, pollIntervalMs: 1000, maxPollMs: 5000 });
    const id = await client.runSkinAnalysis({ src_file_url: "https://example.com/a.jpg", dst_actions: ["redness"] });
    await expect(client.waitForSkinAnalysis(id)).rejects.toThrow(/still running/);
    await expect(client.waitForSkinAnalysis(id)).rejects.not.toBeInstanceOf(YouCamTaskError);
  });

  it("live transport refuses to start without a key", () => {
    expect(() => new LiveTransport({ apiKey: "", baseUrl: "https://example.com" })).toThrow("YOUCAM_API_KEY");
  });

  it("live transport sends the exact Bearer header (fake fetch, no network)", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ status: 200, data: { task_id: "t1" } }), { status: 200 });
    }) as unknown as typeof fetch;
    const t = new LiveTransport({ apiKey: "test-key", baseUrl: "https://yce-api-01.makeupar.com", fetchImpl: fakeFetch });
    const res = await t.request("POST", "/s2s/v2.0/task/skin-analysis", { dst_actions: ["redness"] });
    expect(res.status).toBe(200);
    expect(seen[0].url).toBe("https://yce-api-01.makeupar.com/s2s/v2.0/task/skin-analysis");
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });
});
