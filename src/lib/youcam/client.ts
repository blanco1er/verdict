import { LOOK_VTO_UNITS, skinAnalysisCost, skinSimulationCost } from "./costs";
import { UnitLedger } from "./ledger";
import type { Transport, TransportResponse } from "./transport";
import type {
  ApiErrorBody,
  CreateFileResponse,
  CreditResponse,
  EngineErrorCode,
  LookTemplatesResponse,
  LookVtoRequest,
  RunTaskResponse,
  SingleUrlStatusResponse,
  SkinAction,
  SkinAnalysisOutput,
  SkinAnalysisRequest,
  SkinAnalysisStatusResponse,
  SkinSimulationParams,
  TaskSource,
} from "./types";

export class YouCamApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const b = body as Partial<ApiErrorBody> | null;
    super(`YouCam API ${status}: ${b?.error ?? "error"}${b?.error_code ? ` (${b.error_code})` : ""}`);
    this.name = "YouCamApiError";
  }
}

/** A task that finished with task_status "error" (no units consumed). */
export class YouCamTaskError extends Error {
  constructor(
    readonly code: EngineErrorCode | string,
    readonly detail?: string,
  ) {
    super(`YouCam task error: ${code}${detail ? ` - ${detail}` : ""}`);
    this.name = "YouCamTaskError";
  }
}

export interface YouCamClientOptions {
  transport: Transport;
  /** Optional local unit guard. */
  ledger?: UnitLedger;
  sleep?: (ms: number) => Promise<void>;
  /** Docs suggest polling "every 10 seconds"; skin analysis is usually faster. */
  pollIntervalMs?: number;
  /** Give up polling after this long (task results stay queryable later). */
  maxPollMs?: number;
  /** Retries on HTTP 429 (250 req / 300 s per IP and per key). */
  maxRetries?: number;
  skinAnalysisVersion?: "v2.0" | "v2.1";
}

type Feature = "skin-analysis" | "skin-simulation" | "look-vto" | "hair-transfer" | "cloth";

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class YouCamClient {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly maxPollMs: number;
  private readonly maxRetries: number;
  private readonly saVersion: "v2.0" | "v2.1";
  private tmp = 0;

  constructor(private readonly options: YouCamClientOptions) {
    this.sleep = options.sleep ?? defaultSleep;
    this.pollIntervalMs = options.pollIntervalMs ?? 3000;
    this.maxPollMs = options.maxPollMs ?? 120_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.saVersion = options.skinAnalysisVersion ?? "v2.0";
  }

  get ledger(): UnitLedger | undefined {
    return this.options.ledger;
  }

  /* ------------------------------------------------------------- files */

  /** File API + PUT to the pre-signed URL. Returns the file_id. */
  async uploadImage(input: { bytes: Uint8Array; contentType: "image/jpeg" | "image/png"; fileName: string }): Promise<string> {
    if (input.bytes.byteLength >= 10 * 1024 * 1024) {
      throw new Error("Images must be < 10 MB");
    }
    const created = (await this.call("POST", "/s2s/v2.0/file", {
      files: [{ content_type: input.contentType, file_name: input.fileName, file_size: input.bytes.byteLength }],
    })) as CreateFileResponse;
    const file = created.data.files[0];
    const put = file.requests[0];
    const status = await this.options.transport.upload(put.url, put.headers, input.bytes);
    if (status < 200 || status >= 300) {
      // Without this PUT the task would later fail with 404/500.
      throw new YouCamApiError(status, { status, error: "Upload to pre-signed URL failed" });
    }
    return file.file_id;
  }

  /* ----------------------------------------------------- skin analysis */

  async runSkinAnalysis(request: SkinAnalysisRequest): Promise<string> {
    const cost = skinAnalysisCost(request.dst_actions);
    return this.runPaid("skin-analysis", `/s2s/${this.saVersion}/task/skin-analysis`, { format: "json", ...request }, cost);
  }

  async getSkinAnalysis(taskId: string): Promise<SkinAnalysisStatusResponse> {
    return (await this.call("GET", `/s2s/${this.saVersion}/task/skin-analysis/${encodeURIComponent(taskId)}`)) as SkinAnalysisStatusResponse;
  }

  /** Polls until success and returns `results.output` (format "json"). */
  async waitForSkinAnalysis(taskId: string): Promise<SkinAnalysisOutput[]> {
    const done = await this.poll(taskId, () => this.getSkinAnalysis(taskId));
    const results = done.data.results;
    if (results == null || !("output" in results)) {
      throw new Error('Expected format "json" results with an output array');
    }
    return results.output;
  }

  async analyzeSkin(source: TaskSource, actions: SkinAction[]): Promise<SkinAnalysisOutput[]> {
    const taskId = await this.runSkinAnalysis({ ...source, dst_actions: actions, format: "json" });
    // The live API also returns technical entries (e.g. "resize_image"): keep only what was asked.
    const asked = new Set<string>([...actions, "all"]);
    return (await this.waitForSkinAnalysis(taskId)).filter((o) => asked.has(o.type));
  }

  /* --------------------------------------------------- skin simulation */

  async runSkinSimulation(source: TaskSource, params: SkinSimulationParams): Promise<string> {
    const active = Object.values(params).filter((v) => typeof v === "number" && v > 0).length;
    const cost = skinSimulationCost(active);
    return this.runPaid("skin-simulation", "/s2s/v2.0/task/skin-simulation", { ...source, ...params }, cost);
  }

  /** Returns the result image URL (valid 2 hours: copy it to storage). */
  async waitForSkinSimulation(taskId: string): Promise<string> {
    const done = await this.poll(taskId, async () =>
      (await this.call("GET", `/s2s/v2.0/task/skin-simulation/${encodeURIComponent(taskId)}`)) as SingleUrlStatusResponse,
    );
    return done.data.results!.url;
  }

  /* ------------------------------------------------------------ look VTO */

  async listLookTemplates(pageSize = 20, startingToken?: string): Promise<LookTemplatesResponse["data"]> {
    const qs = new URLSearchParams({ page_size: String(pageSize) });
    if (startingToken) qs.set("starting_token", startingToken);
    const res = (await this.call("GET", `/s2s/v2.0/task/template/look-vto?${qs}`)) as LookTemplatesResponse;
    return res.data;
  }

  async runLookVto(request: LookVtoRequest): Promise<string> {
    return this.runPaid("look-vto", "/s2s/v2.0/task/look-vto", request, LOOK_VTO_UNITS);
  }

  async waitForLookVto(taskId: string): Promise<string> {
    const done = await this.poll(taskId, async () =>
      (await this.call("GET", `/s2s/v2.0/task/look-vto/${encodeURIComponent(taskId)}`)) as SingleUrlStatusResponse,
    );
    return done.data.results!.url;
  }

  /* ------------------------------------------------- template try-ons */

  /**
   * Try-on from a YouCam catalogue template (Try tab): a makeup look, a hairstyle
   * or an outfit applied to the user's photo. Returns the task id.
   */
  async runTryOn(kind: TryKind, source: TaskSource, template: { id: string; thumb: string }): Promise<string> {
    const t = TRY_ON[kind];
    // Clothes take the catalogue image as the garment reference; looks and hair take the template id.
    const ref = kind === "outfit" ? { ref_file_url: template.thumb } : { template_id: template.id };
    return this.runPaid(t.feature, t.path, { ...source, ...ref, ...t.extra }, t.units);
  }

  /** Try-on with the user's own reference: a garment photo (outfit) or a haircut photo (hair). */
  async runTryOnWithRef(kind: Exclude<TryKind, "look">, source: TaskSource, refFileId: string): Promise<string> {
    const t = TRY_ON[kind];
    return this.runPaid(t.feature, t.path, { ...source, ref_file_id: refFileId, ...t.extra }, t.units);
  }

  /** Polls a try-on task; returns the result image URL (valid about 2 hours). */
  async waitForTryOn(kind: TryKind, taskId: string): Promise<string> {
    const t = TRY_ON[kind];
    const done = await this.poll(taskId, async () => (await this.call("GET", `${t.path}/${encodeURIComponent(taskId)}`)) as SingleUrlStatusResponse);
    return done.data.results!.url;
  }

  /** Free: one page of a try-on catalogue. */
  async listTemplates(kind: TryKind, pageSize = 20, startingToken?: string): Promise<{ templates: TryTemplate[]; next_token?: string }> {
    const qs = new URLSearchParams({ page_size: String(pageSize) });
    if (startingToken) qs.set("starting_token", startingToken);
    const res = (await this.call("GET", `${TRY_ON[kind].catalogue}?${qs}`)) as { data: { templates: TryTemplate[]; next_token?: string } };
    return res.data;
  }

  /* --------------------------------------------------------------- units */

  /** Free balance check. Returns total remaining units. */
  async getRemainingUnits(): Promise<number> {
    const res = (await this.call("GET", "/s2s/v1.0/client/credit")) as CreditResponse;
    return res.results.reduce((sum, r) => sum + (r.amount_dec ?? r.amount ?? 0), 0);
  }

  /* ------------------------------------------------------------ internals */

  private async runPaid(feature: Feature, path: string, body: unknown, units: number): Promise<string> {
    const ledger = this.options.ledger;
    const tmpKey = `pending:${feature}:${++this.tmp}`;
    ledger?.reserve(tmpKey, units);
    try {
      const res = (await this.call("POST", path, body)) as RunTaskResponse;
      ledger?.rekey(tmpKey, res.data.task_id);
      return res.data.task_id;
    } catch (error) {
      ledger?.refund(tmpKey);
      throw error;
    }
  }

  private async poll<T extends { data: { task_status: string; error?: string | null; error_message?: string } }>(
    taskId: string,
    fetchStatus: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    let waited = 0;
    for (;;) {
      const res = await fetchStatus();
      const status = res.data.task_status;
      if (status === "success") {
        this.options.ledger?.confirm(taskId);
        return res;
      }
      if (status === "error") {
        this.options.ledger?.refund(taskId);
        throw new YouCamTaskError(res.data.error ?? "unknown_internal_error", res.data.error_message);
      }
      // Counted on both clocks so tests with a fake sleep terminate too.
      if (waited >= this.maxPollMs || Date.now() - started >= this.maxPollMs) {
        throw new Error(`Task ${taskId} still running after ${this.maxPollMs} ms (query it again later)`);
      }
      await this.sleep(this.pollIntervalMs);
      waited += this.pollIntervalMs;
    }
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let attempt = 0;
    for (;;) {
      const res: TransportResponse = await this.options.transport.request(method, path, body);
      if (res.status === 429 && attempt < this.maxRetries) {
        const backoff = res.retryAfter != null ? res.retryAfter * 1000 : 1000 * 2 ** attempt;
        attempt++;
        await this.sleep(backoff);
        continue;
      }
      if (res.status >= 400) {
        throw new YouCamApiError(res.status, res.body);
      }
      return res.body;
    }
  }
}

export type TryKind = "look" | "hair" | "outfit";
export interface TryTemplate {
  id: string;
  title: string;
  thumb: string;
  category_name?: string;
}

/** Endpoints and unit costs (docs.perfectcorp.com, checked 30 Oct 2026). */
export const TRY_ON: Record<TryKind, { feature: Feature; path: string; catalogue: string; units: number; extra?: Record<string, string> }> = {
  look: { feature: "look-vto", path: "/s2s/v2.0/task/look-vto", catalogue: "/s2s/v2.0/task/template/look-vto", units: 2 },
  hair: { feature: "hair-transfer", path: "/s2s/v2.1/task/hair-transfer", catalogue: "/s2s/v2.1/task/template/hair-transfer", units: 2 },
  outfit: { feature: "cloth", path: "/s2s/v2.0/task/cloth-v4", catalogue: "/s2s/v2.0/task/template/cloth", units: 2, extra: { garment_category: "full_body" } },
};
