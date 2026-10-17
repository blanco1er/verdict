import { skinAnalysisCost } from "./costs";
import { HD_ACTIONS, SD_ACTIONS, type SkinAction, type SkinAnalysisOutput } from "./types";
import type { Transport, TransportResponse } from "./transport";

/**
 * Mock transport that replays the response *shapes* documented by Perfect
 * Corp (examples copied from the official docs, values synthetic). No network,
 * no units. Used by default until the owner's API key exists.
 *
 * Scenario hooks (by file name of the upload):
 * - contains "noface"  -> task ends with error_no_face (no units charged)
 * - contains "dark"    -> task ends with error_lighting_dark
 */
export interface MockOptions {
  /** Number of GET polls answering "running" before "success". */
  pollsUntilDone?: number;
  /** Return 429 on every Nth request (0 = never). */
  rateLimitEvery?: number;
  /** Raw score (1..100) for an action on a given upload. */
  scoreFor?: (fileName: string, action: string) => number;
  /** Starting balance reported by GET /s2s/v1.0/client/credit. */
  startingUnits?: number;
}

interface MockFile {
  file_id: string;
  file_name: string;
  uploaded: boolean;
}

interface MockTask {
  kind: "skin-analysis" | "skin-simulation" | "look-vto";
  polls: number;
  fileName: string;
  actions: string[];
}

const KNOWN_ACTIONS: ReadonlySet<string> = new Set<string>([...SD_ACTIONS, ...HD_ACTIONS]);

/** FNV-1a: stable pseudo-random scores without Math.random(). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const defaultScore = (fileName: string, action: string) => 40 + (hash(`${fileName}:${action}`) % 4500) / 100;

/**
 * ui_score is documented as an upward-calibrated version of raw_score. This
 * linear fit approximates the doc examples (57.33 -> 68, 95.34 -> 92); it is
 * NOT the real calibration.
 */
export function mockUiScore(raw: number): number {
  return Math.max(1, Math.min(100, Math.round(raw * 0.6 + 35)));
}

export class MockTransport implements Transport {
  private files = new Map<string, MockFile>();
  private uploads = new Map<string, string>(); // upload url -> file_id
  private tasks = new Map<string, MockTask>();
  private requestCount = 0;
  private seq = 0;
  private charged = 0;
  readonly log: string[] = [];

  constructor(private readonly options: MockOptions = {}) {}

  get unitsCharged(): number {
    return this.charged;
  }

  async request(method: "GET" | "POST", path: string, body?: unknown): Promise<TransportResponse> {
    this.requestCount++;
    this.log.push(`${method} ${path}`);
    const every = this.options.rateLimitEvery ?? 0;
    if (every > 0 && this.requestCount % every === 0) {
      return { status: 429, body: { status: 429, error: "Too many requests" }, retryAfter: 1 };
    }
    const b = (body ?? {}) as Record<string, unknown>;

    if (method === "POST" && path === "/s2s/v2.0/file") return this.createFile(b);
    if (method === "GET" && path === "/s2s/v1.0/client/credit") {
      return {
        status: 200,
        body: {
          status: 200,
          results: [
            {
              id: 13105541279084536,
              type: "ApiPaygToken",
              amount: Math.floor((this.options.startingUnits ?? 1000) - this.charged),
              amount_dec: (this.options.startingUnits ?? 1000) - this.charged,
              expiry: 1793000000000,
            },
          ],
        },
      };
    }
    if (method === "GET" && path.startsWith("/s2s/v2.0/task/template/look-vto")) {
      return {
        status: 200,
        body: {
          status: 200,
          data: {
            templates: [
              { id: "good_template_001", thumb: "https://example.com/thumb1.jpg", title: "Berry Smooth", category_name: "Daily" },
              { id: "all_rosy_chic", thumb: "https://example.com/thumb2.jpg", title: "Rosy Chic", category_name: "Daily" },
            ],
            next_token: null,
          },
        },
      };
    }
    const run = path.match(/^\/s2s\/v2\.[01]\/task\/(skin-analysis|skin-simulation|look-vto)$/u);
    if (method === "POST" && run) return this.runTask(run[1] as MockTask["kind"], b);
    const status = path.match(/^\/s2s\/v2\.[01]\/task\/(skin-analysis|skin-simulation|look-vto)\/(.+)$/u);
    if (method === "GET" && status) return this.taskStatus(decodeURIComponent(status[2]));

    return { status: 404, body: { status: 404, error: `Mock has no route for ${method} ${path}` } };
  }

  async upload(url: string): Promise<number> {
    const fileId = this.uploads.get(url);
    if (fileId == null) return 403;
    this.files.get(fileId)!.uploaded = true;
    return 200;
  }

  private createFile(body: Record<string, unknown>): TransportResponse {
    const files = body.files as Array<{ content_type: string; file_name: string; file_size: number }> | undefined;
    if (!Array.isArray(files) || files.length === 0) {
      return { status: 400, body: { status: 400, error: "files is required", error_code: "InvalidParameters" } };
    }
    const out = files.map((f) => {
      if (f.file_size > 10 * 1024 * 1024) {
        throw new Error("exceed_max_filesize");
      }
      const file_id = `mockfile_${++this.seq}_${hash(f.file_name).toString(36)}`;
      const url = `https://mock-upload.invalid/ttl30/${file_id}`;
      this.files.set(file_id, { file_id, file_name: f.file_name, uploaded: false });
      this.uploads.set(url, file_id);
      return {
        content_type: f.content_type,
        file_name: f.file_name,
        file_id,
        requests: [
          { method: "PUT", url, headers: { "Content-Length": String(f.file_size), "Content-Type": f.content_type } },
        ],
      };
    });
    return { status: 200, body: { status: 200, data: { files: out } } };
  }

  private runTask(kind: MockTask["kind"], body: Record<string, unknown>): TransportResponse {
    let fileName = "";
    if (typeof body.src_file_id === "string") {
      const file = this.files.get(body.src_file_id);
      if (file == null || !file.uploaded) {
        // Docs: using a file_id whose bytes were never PUT yields 404/500.
        return { status: 404, body: { status: 404, error: "Not Found" } };
      }
      fileName = file.file_name;
    } else if (typeof body.src_file_url === "string") {
      fileName = body.src_file_url;
    } else {
      return { status: 400, body: { status: 400, error: "src_file_id or src_file_url is required", error_code: "InvalidParameters" } };
    }

    let actions: string[] = [];
    if (kind === "skin-analysis") {
      actions = Array.isArray(body.dst_actions) ? (body.dst_actions as string[]) : [];
      if (actions.length === 0) {
        return { status: 400, body: { status: 400, error: "dst_actions is required", error_code: "InvalidParameters" } };
      }
      const unknown = actions.find((a) => !KNOWN_ACTIONS.has(a));
      if (unknown != null) {
        return { status: 400, body: { status: 400, error: `Not available dst_action ${unknown}`, error_code: "InvalidParameters" } };
      }
      const hd = actions.filter((a) => a.startsWith("hd_")).length;
      if (hd !== 0 && hd !== actions.length) {
        return { status: 400, body: { status: 400, error: "cannot mix HD and SD dst_actions", error_code: "InvalidParameters" } };
      }
    }
    if (kind === "look-vto" && typeof body.template_id !== "string") {
      return { status: 400, body: { status: 400, error: "template_id is required", error_code: "InvalidParameters" } };
    }

    const task_id = `mocktask_${kind}_${++this.seq}`;
    this.tasks.set(task_id, { kind, polls: 0, fileName, actions });
    return { status: 200, body: { status: 200, data: { task_id } } };
  }

  private taskStatus(taskId: string): TransportResponse {
    const task = this.tasks.get(taskId);
    if (task == null) {
      return { status: 400, body: { status: 400, error: "Invalid task ID" } };
    }
    task.polls++;
    if (task.polls <= (this.options.pollsUntilDone ?? 2)) {
      return { status: 200, body: { status: 200, data: { task_status: "running" } } };
    }
    const forced = task.fileName.includes("noface")
      ? "error_no_face"
      : task.fileName.includes("dark")
        ? "error_lighting_dark"
        : null;
    if (forced != null) {
      return {
        status: 200,
        body: { status: 200, data: { task_status: "error", error: forced, error_message: `Mock: ${forced}` } },
      };
    }

    if (task.kind !== "skin-analysis") {
      return {
        status: 200,
        body: { status: 200, data: { task_status: "success", results: { url: `https://mock-result.invalid/${taskId}.jpg` } } },
      };
    }

    const scoreFor = this.options.scoreFor ?? defaultScore;
    const output: SkinAnalysisOutput[] = task.actions.map((type) => {
      const raw = Math.max(1, Math.min(100, scoreFor(task.fileName, type)));
      return {
        type,
        region: "whole",
        raw_score: Math.round(raw * 100) / 100,
        ui_score: mockUiScore(raw),
        mask_urls: [`https://mock-result.invalid/${taskId}/${type}_output.png`],
      };
    });
    const mean = output.reduce((s, o) => s + (o.raw_score ?? 0), 0) / output.length;
    output.push({ type: "all", score: Math.round(mean * 100) / 100 });
    this.charged += skinAnalysisCost(task.actions as SkinAction[]);
    return { status: 200, body: { status: 200, data: { task_status: "success", results: { output } } } };
  }
}

