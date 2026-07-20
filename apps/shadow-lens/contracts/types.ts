// apps/shadow-lens/contracts/types.ts
// TypeScript view of the Shadow Lens session contract (web/backend).
// Mirror of shadow-lens-session.schema.json + validate.mjs. Keep in sync with types.cs.

export const CONTRACT_VERSION = "shadow-lens-session/1.0" as const;

export type RuntimeMode = "UNITY_XREAL" | "WEBXR_AR" | "WEBXR_VR" | "SBS_STEREO" | "FLAT_HUD" | "MOCK";
export type Platform = "unity-xreal" | "webxr" | "browser-flat" | "mock-desktop";
export type TrackingMode = "6dof" | "3dof" | "none" | "unknown";
export type ValidationStatus = "source_bound" | "uncited" | "rejected";
export type Sha256 = `sha256:${string}`;

export interface BBoxNorm { x: number; y: number; w: number; h: number; }

export interface SourceMapEntry {
  source_id: string;
  page_or_frame?: number | string | null;
  level?: "block" | "line" | "element" | "symbol";
  text: string;
  normalized_text?: string | null;
  normalized_value?: number | string | boolean | null;
  bounding_box_normalized: BBoxNorm;      // AUTHORED BY OCR ONLY — never by the model
  corner_points_normalized?: number[][] | null;
  confidence: number;                     // 0..1
  language?: string | null;
  angle_deg?: number | null;
  parser?: string | null;
  parser_version?: string | null;
}

export interface Claim {
  claim_id: string;
  text: string;
  category?: string | null;
  severity?: "info" | "ok" | "warn" | "bad" | "critical" | null;
  confidence?: number | null;
  source_ids: string[];                   // MUST resolve to source_map; else 'rejected'
  produced_by: "model" | "tool" | "human" | "aggregator";
  evidence_event_sequences?: number[] | null;
  validation_status: ValidationStatus;
}

export interface DeviceInfo {
  platform: Platform;
  device_model?: string | null;
  glasses_model?: string | null;
  eye_attached?: boolean | null;
  sdk_version?: string | null;
  firmware_version?: string | null;
  runtime_mode: RuntimeMode;
  tracking_mode: TrackingMode;
  camera_mode: "xreal-eye" | "none" | "mock";
  reference_space?: string | null;
  app_commit?: string | null;
}

export interface CaptureInfo {
  capture_id: string;
  timestamp?: string | null;
  mime_type?: string | null;
  pixel_dimensions?: [number, number] | null;
  normalized_rotation?: number | null;
  capture_sha256: Sha256;
  privacy_status?: string | null;
  retention_status?: "no-store" | "short-ttl" | "retained" | null;
  capture_method: "xreal-eye-still" | "upload" | "paste" | "fixture" | "mock";
  frame_stability_score?: number | null;
  blur_score?: number | null;
  perspective_score?: number | null;
}

export interface Provenance {
  capture_hash: Sha256;
  source_map_hash: Sha256;
  ocr_engine?: string | null;
  ocr_version?: string | null;
  model_id?: string | null;
  prompt_hash?: string | null;
  reason_code_config_version?: string | null;
  app_commit?: string | null;
}

// Separate statuses — never collapsed into one green VERIFIED badge.
export interface Verification {
  record_integrity: "verified" | "failed" | "unknown";
  failed_seq?: number | null;
  failure_reason?: string | null;
  external_anchor?: "none" | "time_anchored_structural" | "time_anchored" | "log_anchored_structural" | "log_anchored" | "unknown";
  source_coverage_pct?: number | null;
  analysis_confidence?: number | null;
  human_review?: "approved" | "modified" | "rejected" | "pending" | "none";
  data_freshness_sec?: number | null;
}

export interface VoiceEvent {
  recognized_text: string;
  matched_intent: string;
  recognition_mode: "on_device" | "network" | "unknown";
  audio_retained: boolean;
  executed_action: string;
  source_ids?: string[];
}

export interface ShadowLensSession {
  contract_version: typeof CONTRACT_VERSION;
  session_id: string;
  build: { app_commit: string; unity_build_version?: string; web_build_version?: string; built_at_utc?: string };
  device: DeviceInfo;
  capture: CaptureInfo;
  document?: Record<string, unknown> | null;
  source_map: SourceMapEntry[];
  metrics?: Record<string, unknown>[] | null;
  claims: Claim[];
  risks?: Record<string, unknown>[] | null;
  scenarios?: Record<string, unknown>[] | null;
  reviewers?: Record<string, unknown>[] | null;
  decision?: Record<string, unknown> | null;
  provenance: Provenance;
  verification: Verification;
  spatial_scene?: Record<string, unknown> | null;
  voice_events?: VoiceEvent[] | null;
}
