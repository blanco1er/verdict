/**
 * Request/response shapes of the YouCam API (Perfect Corp), transcribed from
 * the official docs on 2026-10-17. Sources (see youcam/TECH.md for details):
 * - File API:        https://docs.perfectcorp.com/reference/file.md
 * - Skin Analysis:   https://docs.perfectcorp.com/reference/ai_skin_analysis.md
 * - Skin Simulation: https://docs.perfectcorp.com/reference/ai_skin_simulation.md
 * - Look VTO:        https://docs.perfectcorp.com/reference/ai_look_vto.md
 * - Units:           https://docs.perfectcorp.com/reference/unit_system.md
 */

export const YOUCAM_API_BASE = "https://yce-api-01.makeupar.com";

/* ------------------------------------------------------------------ File */

export interface FileSpec {
  /** MIME type, e.g. "image/jpeg" or "image/png". */
  content_type: string;
  file_name: string;
  /** Bytes. Images < 10 MB. */
  file_size: number;
}

/** POST /s2s/v2.0/file */
export interface CreateFileRequest {
  files: FileSpec[];
}

export interface UploadRequest {
  method: string; // "PUT"
  url: string; // pre-signed URL
  headers: Record<string, string>;
}

export interface CreateFileResponse {
  status: number;
  data: {
    files: Array<{
      content_type: string;
      file_name: string;
      file_id: string;
      requests: UploadRequest[];
    }>;
  };
}

/* ---------------------------------------------------------- AI task base */

/** Either an uploaded file id or a public image URL (BasicRunTaskV2). */
export type TaskSource = { src_file_id: string } | { src_file_url: string };

export interface RunTaskResponse {
  status: number;
  data: { task_id: string };
}

export type TaskStatus = "running" | "success" | "error";

export type EngineErrorCode =
  | "error_exceed_max_image_size"
  | "exceed_max_filesize"
  | "invalid_parameter"
  | "error_download_image"
  | "error_download_mask"
  | "error_decode_image"
  | "error_decode_mask"
  | "error_nsfw_content_detected"
  | "error_no_face"
  | "error_pose"
  | "error_face_parsing"
  | "error_inference"
  | "exceed_nsfw_retry_limits"
  | "error_upload"
  | "unknown_internal_error"
  // Skin-analysis specific photo errors (Skin Analysis "File Specs & Errors").
  | "error_below_min_image_size"
  | "error_src_face_too_small"
  | "error_src_face_out_of_bound"
  | "error_lighting_dark";

/** HTTP-level error body (400/401/429/500). */
export interface ApiErrorBody {
  status: number;
  error: string;
  error_code?: "InvalidParameters" | "CreditInsufficiency" | "InvalidStyleGroup" | "InvalidStyle" | "BadRequest" | string;
}

/* --------------------------------------------------------- Skin Analysis */

export const SD_ACTIONS = [
  "wrinkle",
  "pore",
  "texture",
  "acne",
  "oiliness",
  "radiance",
  "eye_bag",
  "age_spot",
  "dark_circle_v2",
  "droopy_upper_eyelid",
  "droopy_lower_eyelid",
  "firmness",
  "moisture",
  "redness",
  "tear_trough",
  "skin_type",
] as const;
export type SdAction = (typeof SD_ACTIONS)[number];

export const HD_ACTIONS = [
  "hd_wrinkle",
  "hd_pore",
  "hd_texture",
  "hd_acne",
  "hd_oiliness",
  "hd_radiance",
  "hd_eye_bag",
  "hd_age_spot",
  "hd_dark_circle",
  "hd_droopy_upper_eyelid",
  "hd_droopy_lower_eyelid",
  "hd_firmness",
  "hd_moisture",
  "hd_redness",
  "hd_tear_trough",
  "hd_skin_type",
] as const;
export type HdAction = (typeof HD_ACTIONS)[number];

export type SkinAction = SdAction | HdAction;

export interface SkinAnalysisMiniserverArgs {
  /** true: one blended .jpg; false (default): one .png mask per concern. */
  enable_mask_overlay?: boolean;
  enable_dark_background_hd_pore?: boolean;
  color_dark_background_hd_pore?: string;
  opacity_dark_background_hd_pore?: number;
  enable_dark_background_hd_wrinkle?: boolean;
  color_dark_background_hd_wrinkle?: string;
  opacity_dark_background_hd_wrinkle?: number;
}

/**
 * POST /s2s/v2.0/task/skin-analysis (v2.1 adds `pf_camera_kit`).
 * SD and HD actions cannot be mixed (400 "cannot mix HD and SD dst_actions").
 */
export type SkinAnalysisRequest = TaskSource & {
  dst_actions: SkinAction[];
  miniserver_args?: SkinAnalysisMiniserverArgs;
  /** Default "zip". "json" returns scores inline. */
  format?: "json" | "zip";
  /** v2.1 only. */
  pf_camera_kit?: boolean;
};

/** One entry of `data.results.output` when format = "json". */
export interface SkinAnalysisOutput {
  /** e.g. "redness", "hd_pore", or "all" for the overall score. */
  type: string;
  /** e.g. "whole", "forehead" (HD sub-regions). */
  region?: string;
  /** 1..100, model output. Higher = healthier-looking. */
  raw_score?: number;
  /** 1..100, calibrated upwards "as a psychological motivator". */
  ui_score?: number;
  /** Overall skin condition (type "all"). */
  score?: number;
  mask_urls?: string[];
}

/** GET /s2s/v2.0/task/skin-analysis/{task_id} */
export interface SkinAnalysisStatusResponse {
  status: number;
  data: {
    task_status: TaskStatus;
    error?: EngineErrorCode | null;
    error_message?: string;
    results?: { output: SkinAnalysisOutput[] } | { url: string };
  };
}

/* ------------------------------------------------------- Skin Simulation */

/** Intensities 0..1; at least one must be > 0. */
export interface SkinSimulationParams {
  wrinkle?: number;
  radiance?: number;
  oiliness?: number;
  acne?: number;
  eye_bags?: number;
  dark_circle?: number;
  spots?: number;
  pores?: number;
  texture?: number;
  redness?: number;
}

/** POST /s2s/v2.0/task/skin-simulation */
export type SkinSimulationRequest = TaskSource & SkinSimulationParams;

/** GET /s2s/v2.0/task/{feature}/{task_id} for single-image results. */
export interface SingleUrlStatusResponse {
  status: number;
  data: {
    task_status: TaskStatus;
    error?: EngineErrorCode | null;
    error_message?: string;
    /** Download URL valid for 2 hours. */
    results?: { url: string };
  };
}

/* -------------------------------------------------------------- Look VTO */

export interface LookTemplate {
  id: string;
  thumb: string;
  title: string;
  category_name: string;
}

/** GET /s2s/v2.0/task/template/look-vto?page_size=&starting_token= */
export interface LookTemplatesResponse {
  status: number;
  data: { templates: LookTemplate[]; next_token?: string | null };
}

/** POST /s2s/v2.0/task/look-vto */
export type LookVtoRequest = TaskSource & { template_id: string };

/* ------------------------------------------------------------------ Units */

/** GET /s2s/v1.0/client/credit (free; "processed real-time"). */
export interface CreditResponse {
  status: number;
  results: Array<{
    id: number;
    type: "ApiSubsToken" | "ApiPaygToken";
    /** Deprecated integer balance. */
    amount?: number;
    amount_dec: number;
    /** Unix ms. */
    expiry: number;
  }>;
}
