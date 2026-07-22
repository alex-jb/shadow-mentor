# Spike B — OCR Benchmark (baidu/Unlimited-OCR)

Research-only. Unlimited-OCR was **NOT run** in-session and **NOT installed** — it requires an NVIDIA
CUDA GPU (tested CUDA 12.9, Hopper) + torch 2.10 + `trust_remote_code=True`, none of which exists in
this workstation (Apple M5 / Metal — no NVIDIA/CUDA). No private data was sent anywhere. 2026-07-22.

## Verified repo facts (real, via GitHub/HF API)
- `github.com/baidu/Unlimited-OCR`, commit `1ab6b46` (2026-07-21), **no releases/tags**, **17,047 stars**.
- License **MIT** (code); weights MIT on HF but built on **DeepSeek-OCR** — weights provenance not fully
  restated (treat as unverified).
- Python 100%; deps torch 2.10.0 / transformers 4.57.1 / PyMuPDF; inference via HF Transformers / vLLM
  (Docker CUDA) / SGLang (local HTTP server). No CPU/ARM path.
- **`trust_remote_code=True` is MANDATORY** (arbitrary Python executes on model load) — the central risk.
- Input: single image + multi-page PDF (PyMuPDF). Output: markdown "document parsing".
  **Bounding boxes / layout / source coordinates are NOT documented** — a core requirement gap for Shadow.
- Open issues include hallucination (#58), text looping (#55), long-doc quality collapse (#53),
  vLLM crash (#63).

## Why it does not fit Shadow's on-device evidence pipeline
Shadow's chain is: **camera frame → hash → OCR → bounding box → source-coordinate map → user confirm →
seal → verify**, on **Beam Pro (Android ARM64, no NVIDIA GPU)**, device-local for evidence integrity.
Unlimited-OCR breaks this on three axes:
1. **No device path** — CUDA/Hopper only; cannot go in the Beam Pro APK. Only usable as a **server** the
   glasses call over the network → camera frames leave the device → breaks device-local provenance.
2. **No documented coordinates** — Shadow *needs* `SourceEntry {X,Y,W,H}` (see
   `Core/IProviders.cs::SourceEntry`). Unlimited-OCR's own docs emphasize markdown text, not boxes.
3. **`trust_remote_code=True`** — an arbitrary-code-execution posture Shadow should not adopt in an
   evidence path.

## What CAN be stated in-session (real, no GPU needed)
- Shadow's OCR seam is `IOcrProvider.Recognize(frame) → IReadOnlyList<SourceEntry>` with an `EngineId`
  ("mlkit-text-recognition" | "mock"). The evidence pipeline already carries **OCR confidence as an
  engine score, not truth**, keeps the original auditable, and makes corrections a new event.
- Benchmark inputs are ready: the **sanitized product-quality banking fixtures**
  (`fixtures/product-quality-v5/*.json`) are deterministic + carry no private data → a safe benchmark
  corpus. No private document is ever pointed at any OCR.

## Benchmark protocol (for a CONTAINED server/workstation run, when a GPU host is authorized)
Add a comparison-only provider surface (do NOT put on device):
```
ShadowOcrProvider
├── AndroidDeviceOCR (ML Kit / device AAR) — the device baseline
├── CurrentAAR
└── UnlimitedOCRServerBenchmark (contained GPU host; sanitized fixtures only)
```
Measure per engine on the sanitized fixtures: character accuracy · table/multi-page structure ·
bounding boxes (if any) · **source-coordinate mapping** (the deciding requirement) · latency ·
GPU/memory cost · post-correction audit-chain integrity. Do NOT send private data. Do NOT integrate into
the Beam Pro APK.

## Verdict
**RESEARCH ONLY.** Study the long-horizon multi-page parsing idea; do NOT adopt the code or put it in the
on-device evidence path. It is GPU-bound, requires `trust_remote_code=True`, and (critically) does not
document the source coordinates Shadow's evidence chain depends on. If a server-side OCR is ever needed,
prefer a coordinate-emitting, `trust_remote_code`-free model behind an isolated, sanitized-data-only
benchmark provider — with a second explicit authorization.
