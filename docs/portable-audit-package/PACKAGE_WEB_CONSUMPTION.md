# Package Web consumption model (design intent — no Web changes in this task)

> Ground truth about today's Web app (`shadow-web-audit-room` @ 6809bcf): **zero
> cryptography** (no WebCrypto, no hashing in the browser bundle), **zero persistence**
> (no IndexedDB/localStorage — all React in-memory), import pipeline =
> size gate → `JSON.parse` → `validateFlowExport` → `adaptFlowExport` →
> `validateWebAuditCase`, with 9 distinguished failure stages and the
> `导入并适配成功。` success state. Browser package verification is therefore **new
> surface**; `verify.html` in the Core repo (offline WebCrypto Ed25519, bilingual) is
> the reference implementation to draw on.

## Import flow (future)

1. **Package import** — user selects the package (delivery form is an open product
   decision: directory of files vs single-envelope JSON; the browser-friendly path is
   a single-envelope variant or multi-file selection; size caps extend the existing
   1 MB per-member discipline).
2. **Manifest validation** — parse `manifest.json`; gate on
   `manifest_version = shadow-portable-audit-package/1.0`; structural checks; then
   Ed25519 signature check over `canonicalize(manifest minus signature)` with the
   embedded/known public key (WebCrypto — new code, verify.html precedent).
3. **Member hash validation** — sha256 every member; enforce **two-way completeness**
   (all listed present + matching; no unlisted members).
4. **Signature verification** — bundle-level: run the browser equivalent of
   `verifyBundle` (chain + batch_root + signature) or clearly label "bundle not
   re-verified in browser" if that increment lands later. Key-provenance label
   (`fixture | operator | production`) is always displayed.
5. **Display presentation data** — feed the presentation member through the
   **existing, unchanged** flow-import pipeline; source attribution becomes
   "imported signed package" alongside the existing bundled/imported states.
6. **Display independently derived verification state** — the browser's own
   verification outcome renders **separately** from the shipped
   `verification/verification-result.json`; if they disagree, show the
   disagreement (never silently prefer either). Valid signature ≠ correct decision
   stays a fixed on-screen boundary.
7. **Retain original immutable package** — in memory for the session; offer
   re-download/passthrough of the untouched bytes. The Web app never mutates signed
   contents (adapter output is a derived view, exactly like today).
8. **Local storage** — keep today's default: nothing persisted. If persistence is
   ever added: safe metadata only (package_id, case_id, schema versions, verdict,
   key fingerprint); never member bytes, payload contents, `identity_ref`, reviewer
   identities/rationales.

## Display states (all first-class, bilingual like the existing 9 import stages)

- `TAMPERED` — member hash mismatch or manifest signature failure
- `INCOMPLETE` — listed member missing (partial package)
- `UNEXPECTED_MEMBER` — unlisted file present (padded package)
- `UNSUPPORTED` — unknown manifest/member schema version or role
- `UNVERIFIABLE` — no usable public key / algorithm unsupported in browser
- `VERIFIED_FIXTURE_KEY` — verifies, but key provenance is fixture/demo (visually distinct from operator/production)
- `VERIFIER_DISAGREEMENT` — local outcome ≠ shipped verification-result
- plus the existing adapter-stage failures for the presentation member

## Actions that create a NEW package/version (never in-place mutation)

Human Review · Override · Approval · Rejection · reseal/sign · key rotation — each
produces a new `package_id` with a `supersedes: <prior package_id>` reference in the
new manifest, generated **Core-side**. The browser never signs, never holds a private
key, and never edits a signed member; at most it exports an *unsigned* review-intent
artifact for Core to ingest.

## Boundaries restated

Web import success of a package proves neither Flow vendor import nor native Shadow
Lens behavior; physical capability claims can never ride a package
(`FORBIDDEN_PHYSICAL_CLAIMS` stays hard-error); a missing First Failure stays
missing — the adapter's honest-absence rules apply to the presentation member
unchanged.
