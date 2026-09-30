// packages/adapter-claude-code/lib/mapping.js
// ─────────────────────────────────────────────────────────────────
// Pure functions for mapping Claude Code hook stdin JSON to Shadow
// evidence events. Split out from bin/shadow-record.mjs so unit tests
// don't have to mock stdin, filesystem, or the file store.
//
// Hook contract source: https://code.claude.com/docs/en/hooks
// (permission input contracts re-verified 2026-09-30).
// ─────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { canonicalize } from "shadow-attest-core";

const sha256 = (s) => createHash("sha256").update(String(s ?? "")).digest("hex");

function outputHash(s) {
  return Object.hasOwn(s, "tool_response")
    ? sha256(canonicalize(s.tool_response))
    : sha256(String(s.tool_output ?? ""));
}

/**
 * Map a Claude Code hook event name to a Shadow evidence event type.
 * Returns null for unknown / unsupported events so the caller can no-op.
 *
 * @param {string} hookEventName
 * @returns {string|null}
 */
export function mapEvent(hookEventName) {
  return EVENT_MAP[hookEventName] ?? null;
}

const EVENT_MAP = Object.freeze({
  SessionStart:       "session_start",
  UserPromptSubmit:   "prompt",
  PreToolUse:         "tool_call",
  PermissionRequest:  "tool_call",
  PermissionDenied:   "tool_error",
  PostToolUse:        "tool_result",
  PostToolUseFailure: "tool_error",
  SubagentStop:       "subagent_stop",
  Stop:               "turn_end",
  PreCompact:         "pre_compact",
  SessionEnd:         "session_end",
});

/**
 * Permission hooks report a runtime state, not a human approval.
 *
 * @param {string} hookEventName
 * @returns {"user"|"agent"|"system"}
 */
export function actorFor(hookEventName) {
  if (hookEventName === "PermissionRequest" || hookEventName === "PermissionDenied") return "system";
  return hookEventName === "UserPromptSubmit" ? "user" : "agent";
}

const TOOL_PHASES = Object.freeze({
  PreToolUse: "TOOL_ATTEMPT",
  PermissionRequest: "PERMISSION_REQUEST",
  PermissionDenied: "PERMISSION_DENIAL",
  PostToolUse: "TOOL_RESULT",
  PostToolUseFailure: "TOOL_FAILURE",
});

/**
 * Safe audit projection carried in the signed event extensions. The
 * generic session API stores payload hashes, not payload contents, so
 * correlation and evidence state must be retained separately.
 *
 * Native hook INPUTS do not contain an allow decision. In particular,
 * permission_suggestions and another hook's hookSpecificOutput are not
 * evidence this observer can treat as an applied permission decision.
 * PermissionDenied is a provider-reported auto-mode denial, not proof a
 * human denied the action or that a classifier produced a verdict.
 */
export function extractToolMetadata(hookEventName, stdin) {
  const phase = TOOL_PHASES[hookEventName];
  if (!phase) return null;
  const s = stdin ?? {};
  const denialHook = hookEventName === "PermissionDenied";
  // The documented denial hook is auto-only. Contradictory input is not
  // safe evidence of that runtime decision; retain its observed phase.
  const denial = denialHook && (s.permission_mode == null || s.permission_mode === "auto");
  const observedString = (value) => typeof value === "string" && value.length > 0 ? value : null;
  const metadata = {
    provider_hook: hookEventName,
    phase,
    tool_use_id: hookEventName === "PermissionRequest" ? null : observedString(s.tool_use_id),
    tool: observedString(s.tool_name),
    permission_mode: observedString(s.permission_mode),
    permission_decision: denial ? "DENIED" : "UNKNOWN",
    permission_evidence: denial ? "PROVIDER_DENIAL_HOOK" : "NOT_OBSERVED",
    decision_source: denial ? "CLAUDE_CODE_AUTO_MODE" : null,
    denial_reason_sha256: denialHook && typeof s.reason === "string" ? sha256(s.reason) : null,
  };
  if (hookEventName === "PostToolUse") {
    const nativeOutput = Object.hasOwn(s, "tool_response");
    metadata.output_source = nativeOutput ? "tool_response" : Object.hasOwn(s, "tool_output") ? "tool_output" : null;
    metadata.output_hash_encoding = nativeOutput ? "CANONICAL_JSON" : metadata.output_source ? "UTF8_STRING" : "MISSING";
    metadata.output_sha256 = metadata.output_source ? outputHash(s) : null;
  }
  return metadata;
}

/**
 * Extract the Shadow event payload from Claude Code hook stdin JSON.
 * Hashes prompt text + tool response at capture time; raw payload is
 * intentionally NOT stored in the event to keep bundle size small
 * (payloads live in the separate payload store per bundle spec).
 *
 * @param {string} hookEventName
 * @param {object} stdin
 * @returns {object}
 */
export function extractPayload(hookEventName, stdin) {
  const s = stdin ?? {};
  switch (hookEventName) {
    case "SessionStart":
      return {
        source: s.source ?? null,
        model: s.model ?? null,
        title: s.session_title ?? null,
      };
    case "UserPromptSubmit":
      return {
        prompt_id: s.prompt_id ?? null,
        prompt_sha256: sha256(s.prompt ?? ""),
      };
    case "PreToolUse":
    case "PermissionRequest":
      return {
        prompt_id: s.prompt_id ?? null,
        tool_use_id: hookEventName === "PermissionRequest" ? null : s.tool_use_id ?? null,
        tool: s.tool_name ?? null,
        tool_input: s.tool_input ?? null,
      };
    case "PermissionDenied":
      return {
        prompt_id: s.prompt_id ?? null,
        tool_use_id: s.tool_use_id ?? null,
        tool: s.tool_name ?? null,
        tool_input: s.tool_input ?? null,
        reason_sha256: typeof s.reason === "string" ? sha256(s.reason) : null,
      };
    case "PostToolUse":
      return {
        prompt_id: s.prompt_id ?? null,
        tool_use_id: s.tool_use_id ?? null,
        tool: s.tool_name ?? null,
        // Native tool_response is JSON: canonicalize objects instead of
        // String(object), which would collapse distinct outputs to the
        // same "[object Object]" hash. Preserve legacy tool_output hashes.
        output_sha256: outputHash(s),
      };
    case "PostToolUseFailure":
      return {
        prompt_id: s.prompt_id ?? null,
        tool_use_id: s.tool_use_id ?? null,
        tool: s.tool_name ?? null,
        error: s.error ?? null,
      };
    case "SubagentStop":
      return {
        agent_type: s.agent_type ?? null,
        agent_id: s.agent_id ?? null,
        last: s.last_assistant_message ?? null,
      };
    case "Stop":
      return {
        prompt_id: s.prompt_id ?? null,
        last: s.last_assistant_message ?? null,
      };
    case "PreCompact":
      return {};
    case "SessionEnd":
      return { end_reason: s.end_reason ?? null };
    default:
      return {};
  }
}
