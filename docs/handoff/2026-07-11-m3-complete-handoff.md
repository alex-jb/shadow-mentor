---
title: Shadow v3 milestone M3 complete — handoff briefing
author: Alex Ji
date: 2026-07-11
purpose: Hand this to another engineer, LLM instance, or reviewer so they can pick up Shadow v3 without needing the full session context.
---

# Context to hand someone else

You are helping ship **Shadow v3**, an OSS "evidence layer for AI agents" — the
repository at [alex-jb/shadow-mentor](https://github.com/alex-jb/shadow-mentor).
The current session (2026-07-10 → 2026-07-11) closed **milestone M3 (external
anchoring)** with all four sprints landed on `main`. The next work is a mix of
M2 (capture adapters), M5 (forensic replay demo), M6 (docs + launch), and two
launch-blockers.

Read this document before touching code. It is deliberately terse — pointers
to files and commits, not paraphrases.

---

## 1. What the product actually is (one sentence)

> A tamper-evident, hash-chained, cryptographically signed evidence bundle
> for AI-agent sessions, with optional external anchoring (RFC 3161 TSA and
> Sigstore Rekor) so bundles cannot be silently rewritten after the fact.

Read `docs/roadmap/SHADOW_V3_BRIEF.md` for the strategic brief. It defines
milestones M1–M6 and an appendix of launch-blocker hygiene items.

---

## 2. Repository shape

```
packages/attest-core/       ← zero-LLM-dep core primitives (JS ES modules)
  anchors.js                ← M3 all four sprints live here (~1100 lines)
  session.js                ← bundle spec, verifyBundle, TRUST_LEVELS wiring
  attestation*.js           ← legacy v2 attestation primitives, still used
  store-file.js             ← crash-recovery persistence
  index.js                  ← public API surface
bin/shadow-verify.mjs       ← CLI wrapping verifyBundle (M4)
verify.html                 ← static offline WebCrypto verifier (M4)
api/*.js                    ← Vercel serverless endpoints
test/*.test.js              ← node --test contract tests (1417 passing)
scripts/
  run-tests.mjs             ← cross-platform test runner (used by npm test)
  check-forbidden-phrases.mjs ← claims-lint (CI-enforced honesty)
  readme-stats.mjs          ← README stats block generator (drift-detection)
docs/
  THREAT_MODEL.md           ← §6 defines A1/A2/A3 adversaries + trust matrix
  AUTONOMOUS_SESSION_RULES.md ← rules the coding agent must follow
  roadmap/SHADOW_V3_BRIEF.md  ← THE brief; read this
  launch/v3.0.0/            ← Show HN draft + screencast script (M6 partial)
  STANDARDS_MAP.md          ← EU AI Act Art. 12(2) mapping (M6 partial)
  COMPARISON.md             ← Shadow vs LangSmith/Langfuse/Datadog (M6 partial)
CHANGELOG.md                ← per-sprint entries with commit SHAs
```

---

## 3. What is DONE (as of 2026-07-11, commit `d8aa7df`)

### M1 — Evidence bundle format + core
- **M1.1** Session evidence bundle spec + JSON Schema
- **M1.2** Persistent store + `recoverSession` for crash-recovery

### M3 — External anchoring (fully closed, 4 sprints, 2026-07-10 → 2026-07-11)

| Sprint | Commit | What shipped | Trust level unlocked |
|---|---|---|---|
| 1 | `13487cb` | RFC 3161 TSA client + structural verifier | `TIME_ANCHORED_STRUCTURAL` |
| 2 | `fbcf4d2` | CMS SignedData signature verification | `TIME_ANCHORED` (with asterisk) |
| 3 | `3b4f332` | Sigstore Rekor adapter + Merkle inclusion + SET | `LOG_ANCHORED_STRUCTURAL`, `LOG_ANCHORED` |
| 4 | `d8aa7df` | Configurable CA trust store for CMS chain | `TIME_ANCHORED` without asterisk |

Full trust ranking, computed by `trustLevelRank()` in
`packages/attest-core/anchors.js`:

```
SELF_SIGNED (0)
  < TIME_ANCHORED_STRUCTURAL (1)
  < LOG_ANCHORED_STRUCTURAL  (2)   ← public log accepted an entry
  < TIME_ANCHORED             (3)  ← TSA CMS sig verified
  < LOG_ANCHORED              (4)  ← Rekor inclusion + SET verified
```

Everything is **zero-dependency**. ASN.1 DER, RFC 9162 Merkle proof, RFC 8785–ish
canonical JSON, ECDSA SET verification are all implemented inline. This is
deliberate: the promise is that a bank can vendor `packages/attest-core/` and
audit it in a week without pulling a supply-chain graph.

### M4 — Verification UX (parallel to M3)
- `bin/shadow-verify.mjs` — CLI with `--json`, `--check-anchors {off,structural,full}`,
  and (sprint 4) `--ca-trust <path>`.
- `verify.html` — single-file WebCrypto verifier, no network, no build.
- `.github/actions/shadow-verify/` composite action for CI.

### Partial M6 assets (present on main but not yet the launch package)
- `docs/STANDARDS_MAP.md` — EU AI Act Art. 12(2) field-by-field mapping.
- `docs/COMPARISON.md` — Shadow vs debug observability vs runtime governance.
- `docs/launch/v3.0.0/show-hn-draft.md` and `screencast-script.md`.

---

## 4. What is NOT done — ordered by launch impact

The v3.0 tag targets **2026-08-02** (from the brief).

### 4.1 (Launch-blocker) M2.1 `@shadow/adapter-claude-code`

**The launch wedge.** From the brief §M2.1:

> Implement via Claude Code hooks (PreToolUse/PostToolUse/Stop etc.). One-command
> setup: `npx shadow-record init` writes the hook config; every subsequent Claude
> Code session auto-produces `~/.shadow/sessions/<id>.bundle`.

Nothing exists yet under `packages/adapter-claude-code/`. Read
[docs.claude.com](https://docs.claude.com) for the current hook shape BEFORE
coding — do not code from memory. Map:

- tool invocations → `tool_call` / `tool_result` events
- file edits → `file_write` with diff hash
- bash → `shell_exec` with command + exit code
- user prompts → `user_message` (payload hashed, content local-only by default)

Acceptance test: record a real Claude Code session that edits 3 files + runs
tests; verify the bundle; tamper with one recorded file-diff payload; verifier
pinpoints it.

### 4.2 (Launch-blocker) M2.2 `@shadow/adapter-otel`

Minimal OTLP/HTTP receiver or processor that consumes OpenTelemetry GenAI
semantic-convention spans and emits evidence events. This unlocks every
LangChain/LlamaIndex/agent-SDK app already instrumented with OTel as a
zero-code-change source.

### 4.3 (Launch-blocker) M5 Forensic replay demo

From the brief §M5:

> `demos/replay/`: 2D timeline of a real recorded Claude Code session — payload
> inspect, chain-status per event, then the XR chain-corridor rebound onto real
> bundle data. Tamper demo uses a *real* recorded session, not synthetic loans.

Feeds the IEEE VR paper. Currently `demos/offline-2026-07-16/` is the earlier
capstone-demo asset; no replay demo exists.

### 4.4 (Launch-blocker appendix #1) npm publish `--provenance`

Publish `shadow-attest-core` (and the adapters when they land) with
`npm publish --provenance` so tarballs carry a Sigstore-signed build
attestation. "The package that helps you prove what your agent did is itself
proven at build time." Forecloses the first supply-chain critique on HN.

Blocker: the npm publish workflow requires an `NPM_TOKEN` GitHub secret. Alex
has a note about this being unset since 2026-06-10; check
`docs/NPM_PUBLISH_FIX.md` (if present) or the workflow file for the current
state.

### 4.5 (Launch-blocker appendix #2) Verifier error format

Every verification error emitted by `shadow-attest-core`, `shadow-verify`
CLI, and `verify.html` should share this exact shape:

```
{ seq: <event index or null>, reason: <machine-readable code>, impact: <human sentence> }
```

The XR replay demo reads this verbatim for floating captions; `verify.html`
renders it in-report; the CLI prints all three fields. A drift test in
`test/verifier-error-format.test.js` (not yet created) pins the shape.

Current state: verify paths throw / return ad-hoc `reason` strings. Port them
to structured error objects.

### 4.6 (Not a launch-blocker but valuable) M2.3 Generic HTTP ingest

`POST /api/evidence/events` batch endpoint. A partial file exists at
`api/evidence-events.js` — audit it against the M2.3 spec.

---

## 5. Non-negotiable rules the coding agent must follow

Read `docs/AUTONOMOUS_SESSION_RULES.md` in full. Key ones:

- **Rule 1.** No outbound sends on Alex's behalf (email, Slack, PRs to third-
  party repos, tweets). Drafts only.
- **Rule 3.** Trust-level naming is honest. `check-forbidden-phrases.mjs`
  fails CI on specific banned patterns — grep that file for the full list.
  Categories include strict-evidentiary overclaims, invented regulatory-tier
  taxonomies, invented CFPB bulletin numbers, and Shadow-is-detection-not-
  prevention violations.
- **Rule 6.** Additive-only default. Do not remove shims, rename exported
  symbols, or change bundle wire format without explicit approval.
- **Rule 7.** Every commit passes four pre-commit gates:
  ```
  npm test                              # full suite green
  node scripts/check-forbidden-phrases.mjs  # claims-lint clean
  node scripts/readme-stats.mjs         # stats drift ≤ ±10 or --write
  git diff --stat                       # sanity-eyeball
  ```
- **Rule 8.** Fabrication is a bug. Do not invent RFC section numbers, CFPB
  bulletin numbers, competitor pricing, statistics, or venue deadlines. If
  you cite something, it must be verifiable.

**Sunset dates on time-boxed rules.** Some rules have explicit expiry — read
`docs/AUTONOMOUS_SESSION_RULES.md` for the authoritative list. As of this
handoff (2026-07-11):
- Rule 3 (Wednesday demo-path freeze) sunsets **2026-07-16 EOD NY**. After
  that date the frozen path list becomes editable without further ceremony.
- Rule 4 (back-compat shims) sunsets on the **v3.0.0 git tag**. After that
  point shim removal is still a breaking change but no longer categorically
  forbidden.

Rules without a sunset date are perpetual. If you find a rule that looks
time-boxed but lacks an explicit expiry, ask before acting; do not infer.

---

## 6. Design invariants (do not break)

1. **`packages/attest-core/` is zero-LLM-dep.** The transitive import graph
   is checked in `test/attest-core-contract.test.js` — a single anthropic /
   openai / google-genai import anywhere reachable from `index.js` fails CI.
2. **Bundle wire format is frozen at `bundle_version: 2` for v3.** New fields
   go through the `extensions` map or `external_anchors` array. Any change
   to the signed payload's field order or key set requires a schema bump.
3. **`external_anchors[]` is heterogeneous.** Each entry has `kind` +
   kind-specific fields. Adding a new kind (e.g. `"cosign"`, `"witness"`)
   should follow the sprint 3 shape: add a verifier function, wire into
   `verifyBundle` alongside the existing `rfc3161-tsa` and `rekor` branches,
   add a trust level to the enum + rank map.
4. **Trust levels are conservative.** When adding a new level, decide where
   it goes in the ranking; document in threat model; add a test for
   partial-failure fallback.

---

## 7. How to verify what shipped

**Baseline discipline.** Run the full suite at the START of your session to
establish a green baseline, and again at the END before signing off. Both
result lines go into the session debrief. The exact numbers matter: if you
start on 1417/1420 and end on 1420/1423 you added 3 tests; if you start on
1417/1420 and end on 1416/1420 you regressed one and need to explain why.
Do not paraphrase ("all green"); paste the actual `ℹ tests / pass / fail /
skipped` block.

```bash
git log --oneline -10                           # last 10 commits
gh run list --limit 5                           # last 5 CI runs
npm test 2>&1 | tail -10                        # start-of-session baseline; expect 1417/1420
node bin/shadow-verify.mjs --help               # CLI help incl. --check-anchors + --ca-trust
```

For a live end-to-end check of sprint 3:
```bash
SHADOW_TEST_LIVE_REKOR=1 node --test test/anchors-rekor.test.js
```

For sprint 2:
```bash
SHADOW_TEST_LIVE_TSA=1 node --test test/anchors-rfc3161.test.js
```

Both live tests submit to public services (rekor.sigstore.dev,
freetsa.org) — network required, no keys needed.

---

## 8. Suggested next-work order

If you were to open the repo cold and pick up, this is the order that
minimizes coordination cost and risk:

1. **Standardize verifier error format** (appendix #2). It is a plumbing
   change touching `session.js` verifyBundle, the CLI, and verify.html.
   Small blast radius, unlocks XR replay caption plumbing later.

2. **M2.1 `@shadow/adapter-claude-code`**. This is the launch wedge; without
   a working recorder, `verify.html` has nothing to verify. Start with a
   minimal PoC that only handles PostToolUse and Stop; grow it after the
   first end-to-end recording verifies clean.

3. **npm publish `--provenance` for `shadow-attest-core`**. Once (1) and
   (2) are in, tag `v3.0.0-rc1` and try a publish with provenance to
   validate the workflow before launch day.

4. **M5 replay demo**. 2D web timeline first, XR later. Uses the real
   recorded session from (2), tampers a file-write payload, shows the
   verifier turning red at the right event.

5. **M2.2 OTel adapter**. Second capture surface once the Claude Code one
   is stable.

6. **M6 launch prep** — README rewrite, tag `v3.0.0` on 2026-08-02, publish
   Show HN + Twitter thread. Assets already drafted at `docs/launch/v3.0.0/`.

---

## 9. Failure modes worth anticipating

- **Rekor pubkey rotation.** The sprint 3 API deliberately does NOT hard-code
  the Rekor pubkey. If sigstore rotates their key mid-launch, users who
  copy-pasted the `curl https://rekor.sigstore.dev/api/v1/log/publicKey` from
  the README need to re-fetch. Document this in the README; consider caching
  the current PEM in the repo with a "last verified YYYY-MM-DD" note.

- **CA revocation.** Sprint 4 explicitly does not do CRL/OCSP. A cert that is
  revoked but not yet expired will still validate. If a bank asks about this,
  the honest answer is "check revocation at seal time via OCSP responder;
  we don't do it at verify time because that would require network I/O in
  the verifier and we care about hermetic verifiability."

- **TSA cert-chain gaps.** Real TSAs often return only the leaf cert in the
  CMS token. If a bank's trust store contains only root CAs and no
  intermediates, the sprint 4 chain walker will report "no trusted issuer".
  Document that operators should include intermediates in the trust store.

- **Bundle wire-format drift.** The v2 schema is frozen but the `extensions`
  map is open. Any new consumer that reads `extensions` should be defensive.

---

## 10. If you get stuck

- Read `docs/AUTONOMOUS_SESSION_RULES.md` — most decision points are
  precedented.
- Read the last few commits: `git log --oneline -20` — commit messages are
  deliberately detailed and include honest-scope sections.
- The CI is the single source of truth. If tests pass locally + CI green,
  the change is landable. If either red, fix the underlying issue, don't
  bypass hooks (`--no-verify` is banned).

Good luck.
