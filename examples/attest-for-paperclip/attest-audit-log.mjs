// examples/attest-for-paperclip/attest-audit-log.mjs
// ─────────────────────────────────────────────────────────────────────────────
// "Paperclip logs it. Shadow proves it."
//
// Reads an agent-workspace audit-log export (JSONL, one row per logged action)
// and seals it into a signed, hash-chained attest-core evidence bundle that an
// OUTSIDE party can verify — turning an append-only-as-a-DB-property log into
// an externally checkable proof. Unaffiliated community adapter: the row shape
// below mirrors Paperclip's documented audit surface (actor / action /
// run_id / payload / timestamp) but is ILLUSTRATIVE until wired to a real
// export; every original row is carried verbatim in the sealed payload, so
// nothing is lost in the mapping.
//
//   node attest-audit-log.mjs sample-paperclip-audit-log.jsonl \
//        [--key private.pem] [--out bundle.json]
//
// With no --key an EPHEMERAL Ed25519 keypair is generated and the public key
// is printed — fine for a demo, useless for production (generate a real pair
// with bin/generate-attestation-keypair.mjs and publish the public half).
// Verify with verify-audit-bundle.mjs in this directory.

import { readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { createSession, appendEvent, sealSession } from "../../packages/attest-core/session.js";

// Explicit, auditable mapping from audit-row kinds to attest-core EVENT_TYPES.
// Anything unrecognized maps to tool_call with the row preserved — fail-open
// on TYPE (so no row is dropped) but never on CONTENT (payload is sealed).
export const ROW_TYPE_MAP = Object.freeze({
  tool_call: "tool_call",
  tool_result: "tool_result",
  approval: "human_approval",
  hire_approval: "human_approval",
  budget_pause: "error",
  agent_message: "model_output",
  run_start: "session_start",
  run_end: "session_end",
});

export function mapRow(row) {
  const event_type = ROW_TYPE_MAP[row.kind] ?? "tool_call";
  const actor = row.actor === "human" ? "user" : row.actor === "system" ? "system" : "tool";
  const payload = { source: "paperclip-audit-log", original_row: row };
  if (event_type === "human_approval") payload.approved = row.decision === "approved";
  return { event_type, actor, payload };
}

export function attestAuditLog(rows, { privateKey, keyId, sessionId, startedAtUtc } = {}) {
  const s = createSession({
    agent: { name: "attest-for-paperclip", version: "0.1.0" },
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId: keyId ?? "paperclip-demo",
    privateKey,
    sessionId,
    startedAtUtc: startedAtUtc ?? rows[0]?.timestamp,
  });
  // run_start/run_end rows are represented by the session envelope itself.
  for (const row of rows) {
    if (row.kind === "run_start" || row.kind === "run_end") continue;
    appendEvent(s, mapRow(row));
  }
  return sealSession(s, { endedAtUtc: rows[rows.length - 1]?.timestamp });
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("usage: node attest-audit-log.mjs <audit-log.jsonl> [--key pem] [--out bundle.json]"); process.exit(2); }
  const keyPath = args.includes("--key") ? args[args.indexOf("--key") + 1] : null;
  const outPath = args.includes("--out") ? args[args.indexOf("--out") + 1] : "paperclip-audit-bundle.json";

  let privateKey, publicPem;
  if (keyPath) {
    privateKey = readFileSync(keyPath, "utf8");
  } else {
    const kp = generateKeyPairSync("ed25519");
    privateKey = kp.privateKey;
    publicPem = kp.publicKey.export({ type: "spki", format: "pem" });
    console.error("[demo] ephemeral keypair generated — public key:\n" + publicPem);
  }

  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const bundle = attestAuditLog(rows, { privateKey });
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  if (publicPem) writeFileSync(outPath + ".pub.pem", publicPem);
  console.log(`sealed ${rows.length} rows → ${outPath} (${bundle.events.length} events, hash-chained + Ed25519-signed)`);
  console.log(`verify: node verify-audit-bundle.mjs ${outPath} ${publicPem ? outPath + ".pub.pem" : "<public.pem>"}`);
}
