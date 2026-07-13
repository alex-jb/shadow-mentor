// packages/adapter-claude-code/lib/transcript.js
// ─────────────────────────────────────────────────────────────────
// Read Claude Code's own transcript JSONL to enrich the Shadow session
// header with real values instead of "unknown".
//
// Motivation (M2.2, 2026-07-13): Claude Code's SessionStart / UserPromptSubmit
// stdin does NOT carry model_id or agent version. Both live in the
// transcript at `stdin.transcript_path`. Without reading it, the bundle
// header ends up with:
//   { agent: { version: "unknown" }, models: [{ model_id: "unknown" }] }
// which defeats attestation's core promise ("*this* verdict was produced
// by *that* model").
//
// The transcript schema (verified 2026-07-13 against a real
// ~/.claude/projects/*/*.jsonl):
//   - EVERY line: { version: "2.1.116", sessionId, cwd, gitBranch, ... }
//     — "version" is the Claude Code CLI version.
//   - Assistant messages: { type: "assistant", message: { model: "claude-opus-4-7", ... } }
//   - System / tool / user / attachment lines don't carry message.model.
//
// Non-throw discipline: enrichFromTranscript never throws. Bad path,
// missing file, unreadable line — return {agentVersion: null, modelId: null}
// so the caller falls back to "unknown" gracefully. The whole point is
// non-blocking hook capture.

import { existsSync, readFileSync } from "node:fs";

/**
 * Scan a Claude Code transcript JSONL and pull out the CLI version + the
 * most recent assistant message's model. Cheap read — early-exits once
 * both fields are known.
 *
 * @param {string} transcriptPath — stdin.transcript_path from the hook payload
 * @returns {{ agentVersion: string|null, modelId: string|null }}
 */
export function enrichFromTranscript(transcriptPath) {
  const empty = { agentVersion: null, modelId: null };
  if (!transcriptPath || typeof transcriptPath !== "string") return empty;
  if (!existsSync(transcriptPath)) return empty;

  let raw;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    return empty;
  }

  const lines = raw.split("\n");
  let agentVersion = null;
  let modelId = null;

  // Walk backwards so we pick the LATEST assistant message model — a
  // session that legitimately switched models mid-flight (e.g. via /model)
  // gets attributed to whichever model produced the sealed decisions,
  // not the first one seen.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      // Skip malformed lines — Claude Code sometimes writes partial
      // records during shutdown. Don't let one bad line kill the scan.
      continue;
    }
    if (!agentVersion && typeof obj.version === "string") {
      agentVersion = obj.version;
    }
    if (!modelId && obj.type === "assistant") {
      const m = obj.message && obj.message.model;
      if (typeof m === "string" && m.length > 0) modelId = m;
    }
    if (agentVersion && modelId) break;
  }

  return { agentVersion, modelId };
}
