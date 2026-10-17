export interface TransportResponse {
  status: number;
  body: unknown;
  /** Seconds from a Retry-After header, when present. */
  retryAfter?: number;
}

export interface Transport {
  request(method: "GET" | "POST", path: string, body?: unknown): Promise<TransportResponse>;
  /** PUT raw bytes to a pre-signed upload URL (no Authorization header). */
  upload(url: string, headers: Record<string, string>, bytes: Uint8Array): Promise<number>;
}

export interface LiveTransportOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Real HTTP transport. Server-side only: the API key must never reach a
 * browser bundle (see src/lib/youcam/server.ts).
 */
export class LiveTransport implements Transport {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LiveTransportOptions) {
    if (typeof window !== "undefined") {
      throw new Error("LiveTransport must not run in the browser");
    }
    if (!options.apiKey) {
      throw new Error("YOUCAM_API_KEY is missing");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request(method: "GET" | "POST", path: string, body?: unknown): Promise<TransportResponse> {
    const res = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        // Exact format required by the docs: "Bearer" + one space + key.
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      parsed = { status: res.status, error: text };
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    return { status: res.status, body: parsed, retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined };
  }

  async upload(url: string, headers: Record<string, string>, bytes: Uint8Array): Promise<number> {
    const res = await this.fetchImpl(url, { method: "PUT", headers, body: bytes as BodyInit });
    return res.status;
  }
}
