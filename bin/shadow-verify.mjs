#!/usr/bin/env node
// bin/shadow-verify.mjs
//
// CLI companion to verify.html — verifies a Shadow evidence bundle against
// a supplied Ed25519 public key. Exit codes are CI-friendly:
//   0 — bundle verified
//   1 — verification failed (bad signature, chain break, tamper, wrong key)
//   2 — usage error (missing args / --help)
//   3 — I/O error (file not found, unreadable, parse error)
//
// Usage:
//   shadow-verify <bundle.json> --public-key <public.pem>
//   shadow-verify <bundle.json> --public-key <public.pem> --json
//
// The --json flag emits a single JSON line to stdout in place of the
// human-readable output. Non-zero exit codes match the same failure paths.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyBundle } from "shadow-attest-core/session";

const USAGE = `Usage: shadow-verify <bundle.json> --public-key <public.pem> [--json] [--check-anchors <mode>] [--ca-trust <path>]

Options:
  --public-key <path>      Path to the Ed25519 public key in PEM format (required).
  --json                   Emit a single-line JSON report instead of prose.
  --check-anchors <mode>   Verify bundle.external_anchors[]. Modes:
                             "structural" — messageImprint / body-hash match only;
                                            elevates trust to TIME_ANCHORED_STRUCTURAL
                                            or LOG_ANCHORED_STRUCTURAL
                             "full"       — also CMS SignedData / Rekor inclusion+SET
                                            verify; elevates to TIME_ANCHORED /
                                            LOG_ANCHORED on success
                           Omitted or "off" leaves trust at SELF_SIGNED (default).
  --ca-trust <path>        (Sprint 4) PEM file of trusted root CAs used to walk the
                           TSA cert chain from the CMS token. Without this, TIME_ANCHORED
                           implies "signature verifies against the embedded cert" but
                           the cert's authority is unproven. With this, the chain is
                           validated to a caller-supplied root.
  -h, --help               Print this message.

Exit codes:
  0  bundle verified
  1  verification failed
  2  usage error
  3  I/O or parse error`;

function parseArgs(argv) {
  const out = { bundle: null, publicKey: null, json: false, checkAnchors: false, caTrust: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { ...out, help: true };
    if (a === "--json") out.json = true;
    else if (a === "--public-key") out.publicKey = rest[++i];
    else if (a === "--ca-trust") out.caTrust = rest[++i];
    else if (a === "--check-anchors") {
      const mode = rest[++i];
      if (mode === "off" || mode === undefined) out.checkAnchors = false;
      else if (mode === "structural" || mode === "full") out.checkAnchors = mode;
      else return { ...out, error: `unknown --check-anchors mode "${mode}" (want off/structural/full)` };
    }
    else if (a.startsWith("--")) return { ...out, error: `unknown flag ${a}` };
    else if (!out.bundle) out.bundle = a;
    else return { ...out, error: `unexpected extra argument ${a}` };
  }
  return out;
}

// Split a PEM bundle file into individual PEM blocks. --ca-trust may point
// at a file with multiple concatenated CERTIFICATE blocks (system CA bundle
// pattern). Empty input returns [].
function splitPemBundle(text) {
  const blocks = [];
  const re = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[0]);
  return blocks;
}

function die(code, message, jsonMode) {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ ok: false, reason: message }) + "\n");
  } else {
    process.stderr.write(message + "\n");
  }
  process.exit(code);
}

const args = parseArgs(process.argv);

if (args.help) {
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}
if (args.error) die(2, args.error + "\n\n" + USAGE, false);
if (!args.bundle) die(2, "missing <bundle.json>\n\n" + USAGE, false);
if (!args.publicKey) die(2, "missing --public-key <public.pem>\n\n" + USAGE, false);

let bundle;
try {
  const raw = readFileSync(resolve(args.bundle), "utf8");
  bundle = JSON.parse(raw);
} catch (err) {
  die(3, `failed to read/parse bundle: ${err.message}`, args.json);
}

let pubPem;
try {
  pubPem = readFileSync(resolve(args.publicKey), "utf8");
} catch (err) {
  die(3, `failed to read public key: ${err.message}`, args.json);
}

let caTrustStorePem;
if (args.caTrust) {
  try {
    const bundle = readFileSync(resolve(args.caTrust), "utf8");
    caTrustStorePem = splitPemBundle(bundle);
    if (caTrustStorePem.length === 0) {
      die(3, `--ca-trust file contains no CERTIFICATE blocks`, args.json);
    }
  } catch (err) {
    die(3, `failed to read --ca-trust file: ${err.message}`, args.json);
  }
}

const result = verifyBundle(bundle, {
  publicKey: pubPem,
  checkAnchors: args.checkAnchors,
  ...(caTrustStorePem ? { caTrustStorePem } : {}),
});

if (args.json) {
  const payload = {
    ok: result.ok,
    // M5 verifier-error-format port (2026-07-13): structured error triple.
    error: result.error ?? null,
    // Back-compat legacy fields — will be removed in v3.1.
    reason: result.reason ?? null,
    failedSeq: result.failedSeq ?? null,
    session_id: bundle?.header?.session_id ?? null,
    event_count: Array.isArray(bundle?.events) ? bundle.events.length : null,
    batch_root: bundle?.batch_root ?? null,
    key_id: bundle?.signatures?.[0]?.key_id ?? null,
    trust_level: result.trustLevel ?? null,
    anchors: result.anchors ?? null,
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (result.ok) {
  const events = bundle.events?.length ?? 0;
  const sessionId = bundle.header?.session_id ?? "(none)";
  const agent = bundle.header?.agent ?
    `${bundle.header.agent.name}@${bundle.header.agent.version}` : "(none)";
  const keyId = bundle.signatures?.[0]?.key_id ?? "(none)";
  const trust = result.trustLevel ?? "SELF_SIGNED";
  const trustNote = trust === "SELF_SIGNED"
    ? "chain intact + signature valid; operator could still have re-signed history"
    : trust === "TIME_ANCHORED_STRUCTURAL"
    ? "RFC 3161 anchor's messageImprint matches; TSA signature NOT verified (pass --check-anchors full to attempt)"
    : trust === "TIME_ANCHORED"
    ? "RFC 3161 anchor's TSA signature verifies; A2 operator-insider defeated for events after genTime"
    : trust === "LOG_ANCHORED_STRUCTURAL"
    ? "Sigstore Rekor entry body matches batch_root; inclusion proof + SET NOT verified (pass --check-anchors full to attempt)"
    : trust === "LOG_ANCHORED"
    ? "Sigstore Rekor inclusion proof + SET signature verify; publicly witnessed"
    : "";
  const anchorsLine = Array.isArray(result.anchors) && result.anchors.length > 0
    ? `  anchors    : ${result.anchors.length} (${result.anchors.map(a => `${a.kind}=${a.ok ? "ok" : "no"}`).join(", ")})\n`
    : "";
  process.stdout.write(
    `✓ Bundle verified\n` +
    `  session_id : ${sessionId}\n` +
    `  agent      : ${agent}\n` +
    `  events     : ${events}\n` +
    `  key_id     : ${keyId}\n` +
    `  batch_root : ${bundle.batch_root}\n` +
    `  trust      : ${trust}${trustNote ? ` — ${trustNote}` : ""}\n` +
    anchorsLine,
  );
  process.exit(0);
}

// M5 verifier-error-format port: render the {seq, reason, impact} triple.
// Falls back to legacy fields if a caller-supplied verifier returned the
// old shape.
const err = result.error ?? {
  seq: typeof result.failedSeq === "number" ? result.failedSeq : null,
  reason: result.reason ?? "unknown_failure",
  impact: "(no structured impact — legacy verifier return)",
};
const seqStr = err.seq === null || err.seq === undefined ? "—" : String(err.seq);
process.stderr.write(
  `✗ Verification failed\n` +
  `  seq    : ${seqStr}\n` +
  `  reason : ${err.reason}\n` +
  `  impact : ${err.impact}\n`,
);
process.exit(1);
