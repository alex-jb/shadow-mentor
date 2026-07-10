// packages/attest-core/store-file.js
// ─────────────────────────────────────────────────────────────────
// Default file-based append store for evidence-bundle sessions.
//
// Layout: one JSONL file per session at `${dir}/${sessionId}.jsonl`.
// Every session write (header, event, seal) is one line. On process
// crash, the file contains whatever events made it to fsync — recovery
// picks up from there.
//
// This is the reference implementation. Custom stores backed by
// DynamoDB / Kafka / append-only S3 / a signer daemon UNIX socket
// implement the same {appendLine, readLines} shape.

import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Create a file-backed evidence store. Writes are synchronous appendFileSync
 * calls so a process crash after a successful `appendEvent` return leaves
 * the event on disk. The trade-off is throughput; for very high-fanout
 * sessions the caller should batch on top or use a specialized adapter.
 *
 * @param {object} params
 * @param {string} params.path — file path for this session's JSONL log
 * @returns {{appendLine(text: string): void, readLines(): string[]}}
 */
export function createFileStore(params) {
  const { path } = params ?? {};
  if (!path || typeof path !== "string") {
    throw new Error("createFileStore: path required");
  }

  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return {
    appendLine(text) {
      if (typeof text !== "string") throw new Error("appendLine: text must be string");
      // The trailing newline is intentional; JSONL readers expect it.
      appendFileSync(path, text + "\n", "utf8");
    },
    readLines() {
      if (!existsSync(path)) return [];
      const raw = readFileSync(path, "utf8");
      // Trim trailing newline before split so we don't emit a spurious "".
      return raw.replace(/\n$/, "").split("\n");
    },
    // Introspection helper — the path is public so recovery tooling can
    // point directly at the file if it already knows the session id.
    _path: path,
  };
}

/**
 * List all session IDs present in a session directory. Recovery tooling
 * uses this to find orphan bundles after a process restart.
 */
export function listSessionFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({ path: join(dir, f), sessionId: f.replace(/\.jsonl$/, "") }));
}
