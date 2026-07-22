# Diagnostic field dictionary (v6)

Three log domains, kept separate: **XREAL SDK LOGCAT** · **SHADOW STRUCTURED EVENTS** · **ANDROID SYSTEM LOGCAT**.

Shadow structured events include (evidence-free): app_version · commit · apk_sha256 · sdk_version ·
myglasses_version · glasses_model · eye_present · loader_phase · tracking_type · tracking_reason ·
input_action · permission_state · camera_state · story_id · scenario_id · semantic_hash ·
exception_summary · perf_summary.

Never included: raw camera frames · recognized-evidence text · secrets · API keys · unnecessary PII.
Run `redact-diagnostics.mjs` before sharing any structured export.
