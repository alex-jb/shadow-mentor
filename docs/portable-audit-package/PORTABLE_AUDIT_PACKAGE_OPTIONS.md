# Portable audit package — execution path options

> Evaluated shape (from the task brief; **not** adopted blindly — see Responsibilities):
>
> ```
> shadow-portable-audit-package/1.0
> ├── manifest.json                          (NEW — signed root; reuse shadow-verify-manifest-v1 pattern)
> ├── presentation/shadow-flow-export.json   (EXISTS — bin/shadow-flow-export.mjs @213ebe66)
> ├── evidence/evidence-bundle.json          (EXISTS — sealSession / otel-to-bundle / acceptance generator)
> ├── attestation/attestation.json           (EXISTS — aex-attestation/v1; OPTIONAL member, distinct lineage)
> ├── verification/verification-result.json  (GENERATED VIEW — shadow-verify --json; derived, reproducible)
> └── provenance/runtime-manifest.json       (GENERATED VIEW — build_commit / versions / key provenance)
> ```

## Package responsibilities (determined)

- **Already exist:** presentation, evidence bundle, attestation, public-key PEMs, bilingual verification-report precedent, signed-manifest primitive.
- **Generated views:** `verification-result` (re-derivable via `shadow-verify`; shipped for convenience, hash-listed for transit integrity, **never evidence**) and `runtime-manifest` (build/version identity).
- **Signed:** exactly the canonical `manifest.json` (minus its own `signature` field); every member is bound through `assets[]{path, sha256}`. Presentation data is **bound through hashes, not signed directly** — signing the manifest that hashes it is equivalent in tamper-evidence and avoids inventing a second signing path for `shadow-flow-export/1.0` (whose contract forbids signature fields inside the artifact).
- **Outside the signature:** nothing — two-way completeness (all listed present + hash-match, no unlisted files) rejects both partial and padded packages.
- **Member cross-references:** manifest is the root; members are referenced by relative path + sha256 + declared role + declared schema version (`shadow-flow-export/1.0`, `shadow-evidence/v1`, `aex-attestation/v1`, …). The manifest also binds `package_id` (content-derived), `case_id`, and the case↔session mapping (new field — product decision).
- **Canonical ordering:** manifest members sorted by path; member bytes are whatever the deterministic producers emitted; `shadow-canon/1` for the manifest itself.
- **Compatibility:** `manifest_version: "shadow-portable-audit-package/1.0"` + per-member schema versions; unknown member roles/versions ⇒ explicit UNSUPPORTED state, never best-effort parsing.

## Options

### A · Extend the existing Flow export CLI (`bin/shadow-flow-export.mjs`)
- ✗ Violates that CLI's own contract: it is a single-artifact writer whose validator *forbids* signature/approval/trust keys and whose docs promise exactly one narrow job; packaging would smuggle evidence semantics into a presentation tool.
- ✗ Backward-compatibility risk to a shipped, test-pinned, Web-runner-gated interface (the web runner allowlists exactly this CLI @213ebe66 semantics).
- ✓ Zero new files. Everything else is negative. **Rejected.**

### B · Separate package CLI composing existing producers (`bin/shadow-package-audit.mjs`, name illustrative)
- ✓ Matches the repo's strongest convention: one thin CLI per job (`otel-to-bundle`, `evidence-packet`, `shadow-verify`, `shadow-flow-export`), each documenting exit codes and self-checking before writing.
- ✓ Zero duplication: calls `exportFlowContract` (or accepts an existing artifact), accepts an existing sealed bundle (never re-seals), invokes `verifyBundle` for the derived view, reuses `verify/verify-manifest.mjs` `buildManifest/signManifest/checkAssets` (extended with the two-way completeness rule + case/package binding fields under a new manifest version).
- ✓ Authority boundaries clean: producer contracts unchanged; verifier untouched; package layer owns only composition + manifest.
- ✓ Deterministic: all inputs deterministic or caller-pinned (`built_at` supplied, not wall-clock); testable like the flow-export CLI (spawn, bare env, byte-compare).
- ✓ Web/Flow consumption: Web imports the package (manifest+hash+signature checks are new Web work regardless of option); Flow keeps consuming the presentation member unchanged.
- ✓ Desktop/Tauri future: a CLI composes cleanly into a desktop shell exactly as the Web local runner already spawns Core CLIs.
- ~ Release risk: additive; a new bin + npm alias; no existing surface changes.

### C · Extend runOneShot to write the package
- ✗ runOneShot is the Lens **session** path (different lineage: `shadow-lens-session/1.0`, `exportFlowScenes` — not `shadow-flow-export/1.0`), is an HTTP handler, writes no files by design (per-request in-memory store), and its live mode needs `ANTHROPIC_API_KEY`.
- ✗ Would couple packaging to an API surface and to ephemeral demo signing. **Rejected** (a later increment may *feed* a session-lineage member into the package CLI).

### D · Add a package mode to the verifier
- ✗ Conflates producer and verifier — the verification boundary is the design's core asset ("is the evidence valid" must stay independent of "who produced it"). The verifier gains package *reading* eventually (verify a package), but must never *produce* packages. **Rejected as the packaging path.**

### E · Standalone packaging library + thin CLIs
- ~ The library already effectively exists: `verify/verify-manifest.mjs` (build/sign/verify manifest) + `canonicalize`. Creating a new `packages/package-core` now would either duplicate it or force a premature relocation refactor.
- ✓ Becomes the right refactor **later** if a second consumer (desktop/Tauri, Web build step) needs to link packaging directly rather than spawn the CLI.
- **Deferred, not rejected** — start as option B; extract the library when a second in-process consumer exists.

## Score summary (5 = best)

| Criterion | A | B | C | D | E |
|---|---|---|---|---|---|
| Duplication risk | 3 | **5** | 2 | 2 | 3 |
| Authority boundaries | 1 | **5** | 2 | 1 | 4 |
| Deterministic output | 4 | **5** | 2 | 3 | 5 |
| Testing | 3 | **5** | 2 | 3 | 4 |
| Signing correctness | 2 | **5** | 2 | 3 | 5 |
| Backward compatibility | 1 | **5** | 2 | 2 | 4 |
| Web consumption | 3 | **5** | 3 | 3 | 5 |
| Flow consumption | 4 | **5** | 2 | 3 | 5 |
| Desktop/Tauri future | 2 | **4** | 1 | 2 | 5 |
| Release risk | 2 | **5** | 1 | 2 | 3 |

**Selected: B.** See `PORTABLE_AUDIT_PACKAGE_RECOMMENDATION.md`.
