# Publishing shadow-attest-core to npm

Prerequisite: the operator (Alex) has the `NPM_TOKEN` GitHub secret set on
`alex-jb/shadow-mentor`. Without it the publish workflow will fail cleanly
at `npm publish` with an authentication error.

## One-time setup (Alex, ~5 minutes)

1. Log in to [npmjs.com](https://www.npmjs.com) with the account that will
   own `shadow-attest-core`.
2. Top-right avatar → **Access Tokens** → **Generate New Token** → choose
   **Granular Access Token**.
3. Configure:
   - **Token name**: `shadow-attest-core-publish-2026-07` (any name; date
     helps future rotation)
   - **Expiration**: 30–90 days. Rotation cadence beats long-lived tokens.
   - **Packages and scopes**:
     - Permission: **Read and write**
     - Packages: `shadow-attest-core`. If the package name is not yet
       taken, npm may reject the granular scope — in that case pick "All
       packages" for the first publish; downscope after v0.0.1 is live.
   - **Organizations**: none.
   - **IP allowlist**: empty.
4. Copy the token (starts with `npm_...`). It is shown only once.
5. On GitHub: repo → **Settings** → **Secrets and variables** → **Actions**
   → **New repository secret**.
   - Name: `NPM_TOKEN`
   - Value: paste the token.
6. Verify with `gh secret list --repo alex-jb/shadow-mentor` — you should
   see `NPM_TOKEN` listed.

## First publish (recommended path)

npm's Granular Access Tokens (the current default) require an OTP on every
publish. The workflow accepts a `otp` input for that. If you happen to have
a classic Automation token in `NPM_TOKEN`, the OTP is not needed — but npm
is sunsetting Automation tokens (Jan 2027 for direct publishing per the
banner on npmjs.com token pages).

```bash
# 1. Local dry-run to catch packaging mistakes before hitting the wire.
cd packages/attest-core
npm publish --dry-run
# Read the tarball contents. Confirm anchors.js is present.

# 2. Trigger the workflow manually with dry_run=true (no OTP needed).
gh workflow run publish-attest-core.yml -F dry_run=true
gh run watch # confirm green

# 3. Trigger real publish with a FRESH OTP.
#    Open your npm authenticator, copy the 6-digit code, fire within 15s
#    so the code stays valid through the workflow queue + test gate + publish.
gh workflow run publish-attest-core.yml -F dry_run=false -F otp=123456
gh run watch

# 4. Confirm on npmjs.com.
npm view shadow-attest-core
```

## Subsequent releases

The workflow also triggers on tags matching `attest-core-v*`:

```bash
# Bump packages/attest-core/package.json version (e.g. 2.0.0 → 2.0.1)
# Commit.
git tag attest-core-v2.0.1
git push origin attest-core-v2.0.1
# Workflow fires automatically; watch with `gh run watch`.
```

**Why the tag prefix is `attest-core-v*` and not `v*`:** the top-level
repo also tags `v*` for release milestones. Namespacing the publish
trigger prevents an accidental repo-wide `git tag v3.0.0` from firing
an npm publish as a side effect. Publishing is intentional.

## What the workflow guarantees

1. Full `npm test` suite green before publish.
2. Forbidden-phrases lint clean before publish.
3. Every file in `packages/attest-core/package.json` `files[]` array
   actually exists on disk (guards against the sprint-3 `anchors.js`
   omission bug that was caught 2026-07-11).
4. `npm publish --provenance` produces a Sigstore-signed build attestation
   on the tarball, discoverable via `npm view shadow-attest-core provenance`.
5. Post-publish, the workflow pulls the tarball back down and greps for
   `anchors.js`. If a future `files[]` regression drops it, the workflow
   fails after publish (still surfaces the bug loudly).

## When to rotate NPM_TOKEN

- On the token's expiration date.
- Immediately if the token is ever pasted into a chat, screenshot, or
  screen recording.
- Every 90 days on a calendar reminder even if not needed.

## Failure modes

- **401 Unauthorized on `npm publish`**: `NPM_TOKEN` is missing, expired,
  or scoped wrong. Re-run step 3 with a fresh token.
- **403 Forbidden on first publish**: package name may be taken. Confirm
  via `npm view shadow-attest-core`; rename in `packages/attest-core/package.json`
  if so (this happened once during v2.0.0-rc3 rename from `@shadow/attest-core`
  to `shadow-attest-core`).
- **Provenance signing fails**: ensure the workflow has `id-token: write`
  permission at the job level. Already set; do not remove.
- **`anchors.js` missing from tarball**: `files[]` regressed. Re-add and
  bump patch version. This is exactly what the post-publish grep guards
  against.
