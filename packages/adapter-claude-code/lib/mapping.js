// packages/adapter-claude-code/lib/mapping.js
// ─────────────────────────────────────────────────────────────────
// Pure functions for mapping Claude Code hook stdin JSON to Shadow
// evidence events. Split out from bin/shadow-record.mjs so unit tests
// don't have to mock stdin, filesystem, or the file store.
//
// Hook contract source: https://code.claude.com/docs/en/hooks
// (verified 2026-07-12 — docs.claude.com now 301-redirects here).
// ─────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(String(s ?? "")).digest("hex");

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
  PostToolUse:        "tool_result",
  PostToolUseFailure: "tool_error",
  SubagentStop:       "subagent_stop",
  Stop:               "turn_end",
  PreCompact:         "pre_compact",
  SessionEnd:         "session_end",
});

/**
 * Determine the actor (user vs agent) for an event. Only user_message
 * events are attributed to "user"; everything else is "agent".
 *
 * @param {string} hookEventName
 * @returns {"user"|"agent"}
 */
export function actorFor(hookEventName) {
  return hookEventName === "UserPromptSubmit" ? "user" : "agent";
}

/**
 * Extract the Shadow event payload from Claude Code hook stdin JSON.
 * Hashes prompt text + tool_output at capture time; raw payload is
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
      return {
        prompt_id: s.prompt_id ?? null,
        tool: s.tool_name ?? null,
        tool_input: s.tool_input ?? null,
      };
    case "PostToolUse":
      return {
        prompt_id: s.prompt_id ?? null,
        tool: s.tool_name ?? null,
        output_sha256: sha256(String(s.tool_output ?? "")),
      };
    case "PostToolUseFailure":
      return {
        prompt_id: s.prompt_id ?? null,
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
