// apps/shadow-lens/unity/Assets/ShadowLens/Contracts/ShadowLensSession.cs
// C# view of the Shadow Lens session contract for the Unity/XREAL client.
// Mirror of shadow-lens-session.schema.json + types.ts. [Serializable] so Unity's
// JsonUtility (or Newtonsoft) can round-trip it. Keep in sync with types.ts.
//
// Discipline carried into the client: the model NEVER authors bounding boxes — only the
// OCR SourceMapEntry carries geometry, and a Claim may only cite SourceIds that exist
// in the SourceMap (the backend rejects the rest before the client ever renders).

using System;
using System.Collections.Generic;

namespace ShadowLens.Contracts
{
    public static class Contract { public const string Version = "shadow-lens-session/1.0"; }

    [Serializable] public class BBoxNorm { public float x; public float y; public float w; public float h; }

    [Serializable]
    public class SourceMapEntry
    {
        public string source_id;
        public string level;                 // block | line | element | symbol
        public string text;
        public string normalized_text;
        public BBoxNorm bounding_box_normalized;   // OCR-authored ONLY
        public float confidence;             // 0..1
        public string language;
        public float angle_deg;
        public string parser;
        public string parser_version;
    }

    [Serializable]
    public class Claim
    {
        public string claim_id;
        public string text;
        public string category;
        public string severity;              // info|ok|warn|bad|critical
        public float confidence;
        public List<string> source_ids;      // must resolve to source_map, else 'rejected'
        public string produced_by;           // model|tool|human|aggregator
        public List<int> evidence_event_sequences;
        public string validation_status;     // source_bound | uncited | rejected
    }

    [Serializable]
    public class DeviceInfo
    {
        public string platform;              // unity-xreal | webxr | browser-flat | mock-desktop
        public string device_model;
        public string glasses_model;
        public bool eye_attached;
        public string sdk_version;
        public string firmware_version;
        public string runtime_mode;          // UNITY_XREAL | WEBXR_AR | ...
        public string tracking_mode;         // 6dof | 3dof | none | unknown
        public string camera_mode;           // xreal-eye | none | mock
        public string reference_space;
        public string app_commit;
    }

    [Serializable]
    public class CaptureInfo
    {
        public string capture_id;
        public string timestamp;
        public string mime_type;
        public int[] pixel_dimensions;
        public float normalized_rotation;
        public string capture_sha256;        // "sha256:<64hex>"
        public string privacy_status;
        public string retention_status;      // no-store | short-ttl | retained
        public string capture_method;        // xreal-eye-still | upload | paste | fixture | mock
        public float frame_stability_score;
        public float blur_score;
        public float perspective_score;
    }

    [Serializable]
    public class Provenance
    {
        public string capture_hash;
        public string source_map_hash;
        public string ocr_engine;
        public string ocr_version;
        public string model_id;
        public string prompt_hash;
        public string reason_code_config_version;
        public string app_commit;
    }

    [Serializable]
    public class Verification   // separate statuses — never one green VERIFIED badge
    {
        public string record_integrity;     // verified | failed | unknown
        public int failed_seq;
        public string failure_reason;
        public string external_anchor;
        public float source_coverage_pct;
        public float analysis_confidence;
        public string human_review;
        public float data_freshness_sec;
    }

    [Serializable]
    public class VoiceEvent
    {
        public string recognized_text;
        public string matched_intent;
        public string recognition_mode;     // on_device | network | unknown
        public bool audio_retained;
        public string executed_action;
        public List<string> source_ids;
    }

    [Serializable]
    public class ShadowLensSession
    {
        public string contract_version = Contract.Version;
        public string session_id;
        public DeviceInfo device;
        public CaptureInfo capture;
        public List<SourceMapEntry> source_map = new List<SourceMapEntry>();
        public List<Claim> claims = new List<Claim>();
        public Provenance provenance;
        public Verification verification;
        public List<VoiceEvent> voice_events = new List<VoiceEvent>();
    }
}
