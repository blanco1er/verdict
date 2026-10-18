import { describe, expect, it } from "vitest";
import { YouCamClient } from "./client";
import { MockTransport } from "./mock";
import { TracingTransport } from "./tracing";

describe("TracingTransport", () => {
  it("records the documented pipeline without leaking the upload URL", async () => {
    const traced = new TracingTransport(new MockTransport({ pollsUntilDone: 1 }));
    const client = new YouCamClient({ transport: traced, sleep: async () => {}, pollIntervalMs: 1 });
    const fileId = await client.uploadImage({ bytes: new Uint8Array(1200), contentType: "image/jpeg", fileName: "day3.jpg" });
    const output = await client.analyzeSkin({ src_file_id: fileId }, ["redness", "pore"]);
    expect(output.find((o) => o.type === "redness")?.raw_score).toBeTypeOf("number");
    const seq = traced.steps.map((s) => `${s.method} ${s.path}`);
    expect(seq[0]).toBe("POST /s2s/v2.0/file");
    expect(seq[1]).toBe("PUT pre-signed upload URL");
    expect(seq[2]).toBe("POST /s2s/v2.0/task/skin-analysis");
    expect(traced.steps.at(-1)?.taskStatus).toBe("success");
    expect(JSON.stringify(traced.steps)).not.toContain("mock-upload.invalid");
  });
});
