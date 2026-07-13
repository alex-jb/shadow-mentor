# Dogfood evidence

Signed evidence bundles produced by `@shadow/adapter-claude-code` (M2.1)
running against a real Claude Code session on Alex's laptop. Kept as
receipts that the adapter shipped and captured a live session.

## m2.1-first-success-13df92c7-2026-07-13.json

- **Session**: `13df92c7-5017-4466-947f-c108c451b0c6`
- **Wall-clock**: 2026-07-13 13:45:09 → 13:55:59 UTC (11 min)
- **Bundle size**: 30 KB
- **Format**: `shadow-evidence/v1`, `bundle_version: 1`
- **Signature**: Ed25519 over batch root; verify with
  `public-key-2026-07-13.pem`.

**Significance**: first end-to-end session recorded by the adapter
after the M2.1 refactor (commit `d139e63`) landed the JSONL store
contract fix + the `/bin/sh` PATH root-cause fix (absolute-path hook
command in `~/.claude/settings.json`). Before this, every hook silently
failed with `shadow-record: command not found`.

**Verify offline**:

```bash
npx shadow-verify docs/dogfood-evidence/m2.1-first-success-13df92c7-2026-07-13.json \
  --public-key docs/dogfood-evidence/public-key-2026-07-13.pem
```

**Known gap** (M2.2 candidate): `header.agent.version`,
`header.models[0].model_id`, `header.models[0].sampling_params_hash`
are all `unknown` / `null`. Claude Code's `SessionStart` stdin does not
carry model info; it lives in the file at `transcript_path`. The
adapter needs to read that transcript at SessionStart and pin the
model into the header — otherwise the attestation says "some agent, some
model" and an auditor can't tell which model produced the verdict.
Tracked separately.
