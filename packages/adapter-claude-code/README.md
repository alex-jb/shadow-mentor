# @shadow/adapter-claude-code

Claude Code hooks adapter for `shadow-attest-core`. Every session becomes a
signed, hash-chained evidence bundle you can hand to an auditor.

**Status**: v0.1.0-wip · design frozen 2026-07-12 · implementation weekend 2026-07-12/13 by Alex on live Claude Code CLI.

**Positioning**: *Same wire, opposite guarantee.* `claude-mem` is memory for
the agent (LLM-summarized, mutable, unsigned). Shadow is evidence for the
auditor (raw captured, Ed25519-signed, hash-chained, never rewritten).
Both hook the same Claude Code events. Different jobs.

---

## Design source

Grounded in **primary-source** research completed 2026-07-12 (not training
data). Canonical hooks reference now lives at:

- <https://code.claude.com/docs/en/hooks> (docs.claude.com 301-redirects here)
- <https://code.claude.com/docs/en/hooks-guide>
- <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>

**Ratchet moment**: Claude Code v2.1.205 (2026-07) added auto-mode rules
preventing tampering with session transcript files — Anthropic themselves
now treat this as an integrity surface. Shadow ships the receipt for the
integrity Anthropic quietly acknowledged.

Reference field format for common stdin JSON verified 2026-07-12 against
docs; if a future Anthropic update changes fields, `SHADOW_HOOK_SCHEMA_VERSION`
in the manifest bumps and tests pin the shape.

---

## What it captures

The adapter subscribes to **9 Claude Code hook events** and emits one signed
evidence event per hook:

| Claude event | Shadow event type | What we sign |
|---|---|---|
| `SessionStart` | `session_start` | source (startup/resume/clear/compact), model, session_title |
| `UserPromptSubmit` | `prompt` | prompt_id (v2.1.196+), SHA-256 of prompt text |
| `PreToolUse` | `tool_call` | tool_name, tool_input (JSON) |
| `PostToolUse` | `tool_result` | tool_name, SHA-256 of tool_output |
| `PostToolUseFailure` | `tool_error` | tool_name, error string |
| `SubagentStop` | `subagent_stop` | agent_type, agent_id, last_assistant_message |
| `Stop` | `turn_end` | last_assistant_message |
| `PreCompact` | `pre_compact` | compact reason (never blocks) |
| `SessionEnd` | `session_end` + seal | end_reason; triggers `sealSession()` |

**Turn correlation**: Every event carries `prompt_id` (UUID per user prompt,
present since v2.1.196). Downstream verifier can group
`prompt → tool_call* → tool_result* → turn_end` into a single reviewable
turn without heuristic clustering.

**Raw payload discipline**: Prompt text and tool_output are hashed at
capture time; the raw text is stored in the local payload store (not
transmitted) or optionally redacted per GDPR erasure pattern (null
payload_ref, keep payload_hash).

---

## Install

```bash
# One-command setup (planned; see roadmap below)
npx @shadow/adapter-claude-code init

# Or manual hook config in ~/.claude/settings.json:
{
  "hooks": {
    "SessionStart":      [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook SessionStart"}]}],
    "UserPromptSubmit":  [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook UserPromptSubmit"}]}],
    "PreToolUse":        [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook PreToolUse"}]}],
    "PostToolUse":       [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook PostToolUse"}]}],
    "PostToolUseFailure":[{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook PostToolUseFailure"}]}],
    "SubagentStop":      [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook SubagentStop"}]}],
    "Stop":              [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook Stop"}]}],
    "PreCompact":        [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook PreCompact"}]}],
    "SessionEnd":        [{"matcher": "*", "hooks": [{"type": "command", "command": "shadow-record hook SessionEnd"}]}]
  }
}
```

Every subsequent Claude Code session auto-produces
`~/.shadow/sessions/<session_id>.bundle` on `SessionEnd`. Verify with:

```bash
npx shadow-verify ~/.shadow/sessions/<id>.bundle \
  --public-key ~/.shadow/keys/public.pem
```

---

## Day-1 skeleton (Alex implements + tests weekend)

```ts
// bin/shadow-record.mjs — SKETCH ONLY; do not ship until tested on live Claude Code session
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createSession, appendEvent, sealSession, createFileStore }
  from "shadow-attest-core";

const SHADOW_DIR = process.env.SHADOW_DIR ?? join(process.env.HOME, ".shadow");
const KEY_ID    = process.env.SHADOW_KEY_ID ?? "claude-code-local";
const PRIV_PEM  = readFileSync(join(SHADOW_DIR, "keys", "private.pem"), "utf8");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

async function main() {
  const [, , cmd, eventName] = process.argv;
  if (cmd !== "hook") process.exit(0); // never block on unknown args

  const stdin = JSON.parse(readFileSync(0, "utf8"));
  const sessionDir = join(SHADOW_DIR, "sessions", stdin.session_id);
  mkdirSync(sessionDir, { recursive: true });

  // Session state persisted across hook invocations via file store.
  const store = createFileStore(sessionDir);
  let session = store.load() ?? createSession({
    agent: { name: "claude-code", version: process.env.CLAUDE_CODE_VERSION ?? "unknown" },
    models: [{ model_id: stdin.model ?? "unknown", provider: "anthropic" }],
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId: KEY_ID,
    privateKey: PRIV_PEM,
  });

  const event = {
    event_type: mapEvent(eventName),
    actor: eventName === "UserPromptSubmit" ? "user" : "agent",
    payload: extractPayload(eventName, stdin),
  };

  appendEvent(session, event);

  if (eventName === "SessionEnd") {
    const bundle = sealSession(session);
    writeFileSync(join(sessionDir, "bundle.json"), JSON.stringify(bundle, null, 2));
    store.clear();
  } else {
    store.save(session);
  }

  process.exit(0); // ALWAYS 0 on day 1 — never block a bank engineer on a signer bug
}

function mapEvent(name) {
  return {
    SessionStart:      "session_start",
    UserPromptSubmit:  "prompt",
    PreToolUse:        "tool_call",
    PostToolUse:       "tool_result",
    PostToolUseFailure:"tool_error",
    SubagentStop:      "subagent_stop",
    Stop:              "turn_end",
    PreCompact:        "pre_compact",
    SessionEnd:        "session_end",
  }[name];
}

function extractPayload(name, s) {
  switch (name) {
    case "SessionStart":     return { source: s.source, model: s.model, title: s.session_title };
    case "UserPromptSubmit": return { prompt_id: s.prompt_id, prompt_sha256: sha256(s.prompt ?? "") };
    case "PreToolUse":       return { prompt_id: s.prompt_id, tool: s.tool_name, tool_input: s.tool_input };
    case "PostToolUse":      return { prompt_id: s.prompt_id, tool: s.tool_name, output_sha256: sha256(String(s.tool_output ?? "")) };
    case "PostToolUseFailure":return { prompt_id: s.prompt_id, tool: s.tool_name, error: s.error };
    case "SubagentStop":     return { agent_type: s.agent_type, agent_id: s.agent_id, last: s.last_assistant_message };
    case "Stop":             return { prompt_id: s.prompt_id, last: s.last_assistant_message };
    case "PreCompact":       return {};
    case "SessionEnd":       return { end_reason: s.end_reason };
    default:                 return {};
  }
}

main().catch((err) => {
  // Rule: never block on adapter failure. Log locally, exit 0.
  try { appendFileSync(join(SHADOW_DIR, "adapter-errors.log"), `${new Date().toISOString()} ${err.stack}\n`); } catch {}
  process.exit(0);
});
```

---

## Acceptance test (per Shadow v3 brief M2.1)

1. Record a real Claude Code session that edits 3 files + runs tests.
2. Verify the bundle with `shadow-verify` — expect `SELF_SIGNED` trust level.
3. Tamper with one recorded `tool_result` payload — verifier pinpoints
   the exact `failedSeq`.
4. Confirm bundle contains ≥ 40 events (typical session), ≥ 3
   `tool_call`/`tool_result` pairs, exactly 1 `session_start` + 1
   `session_end`.

---

## Roadmap

- [ ] **v0.1.0 (weekend 2026-07-12/13)** — day-1 skeleton lands, single-session end-to-end
- [ ] **v0.2.0** — `npx @shadow/adapter-claude-code init` writes the settings.json config automatically
- [ ] **v0.3.0** — `SHADOW_ENFORCE=1` block-mode (rejects tool calls when signer fails). Off by default.
- [ ] **v0.4.0** — Optional TSA anchoring at seal time (`SHADOW_TSA_URL`)
- [ ] **v0.5.0** — Optional Sigstore Rekor submission at seal time (`SHADOW_REKOR_URL` + `SHADOW_REKOR_PUBKEY`)
- [ ] **v1.0.0** — Publish to npm as `@shadow/adapter-claude-code` alongside `shadow-attest-core@2.1.0`

---

## Non-goals

Explicitly OUT of scope for this adapter (per Shadow v3 brief §Explicitly out of scope):

- Runtime blocking / approval gates. Adapter records; it does not police.
- Memory retrieval / context injection. That's `claude-mem`'s job. We are
  orthogonal.
- Semantic summarization of captured events. Every mutation between
  capture and signing destroys evidence-grade provenance — the wedge
  claude-mem falls into.
- Cloud storage. Local files only. Zero telemetry, same discipline as
  `shadow-attest-core`.

---

## Things Alex verified 2026-07-12 that this design depends on

- Anthropic Claude Code hooks now documented at code.claude.com (docs.claude.com
  redirects). URL is live returning current spec.
- `~/.claude/settings.json` is the correct config file location.
- `transcript_path` in hook stdin points at
  `.claude/projects/<encoded-cwd>/<session-uuid>.jsonl` — an append-only
  JSONL of the conversation (source of truth we could optionally
  cross-check event count against).
- Hook timeout defaults: 600s for `command` type. Adapter must return in
  well under that (target: < 100ms per hook invocation).
- Exit-code semantics: 0 = success, 2 = blocking error. Day-1 adapter
  always exits 0.
- v2.1.196+ carries `prompt_id` UUID for turn correlation.

Things Alex flagged as NOT YET VERIFIED (test on live session before shipping):

- Whether `transcript_path` JSONL schema is stable across Sonnet 4 → 5.
- Whether `prompt_id` is guaranteed monotonic within a session (docs say
  "UUID identifying the user prompt" — treat as opaque).
- Whether the adapter's `Stop`/`SessionEnd` hooks are called even when
  the user Ctrl-C's out of a session — edge case worth exercising.
