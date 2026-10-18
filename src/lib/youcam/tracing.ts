import type { Transport, TransportResponse } from "./transport";

export interface TraceStep {
  method: "GET" | "POST" | "PUT";
  /** API path, or "pre-signed upload URL" for the PUT (never logged in full). */
  path: string;
  status: number;
  ms: number;
  /** task_status for polls, when present. */
  taskStatus?: string;
}

/**
 * Wraps a transport and records every request (method, path, status, timing)
 * so the UI can show the real YouCam pipeline: File API -> PUT -> task -> poll.
 * Never records headers, bodies or the pre-signed URL.
 */
export class TracingTransport implements Transport {
  readonly steps: TraceStep[] = [];

  constructor(private readonly inner: Transport) {}

  async request(method: "GET" | "POST", path: string, body?: unknown): Promise<TransportResponse> {
    const t0 = Date.now();
    const res = await this.inner.request(method, path, body);
    const data = (res.body as { data?: { task_status?: string } } | null)?.data;
    this.steps.push({ method, path: path.split("?")[0], status: res.status, ms: Date.now() - t0, taskStatus: data?.task_status });
    return res;
  }

  async upload(url: string, headers: Record<string, string>, bytes: Uint8Array): Promise<number> {
    const t0 = Date.now();
    const status = await this.inner.upload(url, headers, bytes);
    this.steps.push({ method: "PUT", path: "pre-signed upload URL", status, ms: Date.now() - t0 });
    return status;
  }
}
