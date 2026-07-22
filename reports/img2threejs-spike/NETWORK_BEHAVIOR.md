# img2threejs — network behavior

Read-only scan of the cloned tool (`experiments/img2threejs/tool/`), not run.

- **No network client in the tool code:** a repo-wide grep for `requests.` / `urllib.request` /
  `http.client` / `openai` / `anthropic` / `api_key` / `trust_remote_code` / `fetch(` / `axios`
  found **no real calls** (the only file-name matches were incidental, not network calls).
- **No third-party Python deps** (stdlib only) → no transitive network surface at generation time.
- **No external URLs emitted** by the factory generator (`forge/stage3_build/*.py`).
- **No telemetry** documented or found.
- The vision/self-correction loop uses the **host agent's** capabilities, not a bundled network call —
  so any LLM traffic is the host's, not the tool's.
- **Runtime output = plain Three.js code, zero network, zero runtime deps** → mobile/offline-safe.

**Conclusion:** the tool is offline/local at generation and its output has no runtime network
dependency — compatible with Shadow's offline posture. The props in this spike make zero network
requests (verified in browser acceptance).
