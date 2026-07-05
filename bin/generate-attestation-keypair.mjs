#!/usr/bin/env node
// bin/generate-attestation-keypair.mjs
// ──────────────────────────────────────────────────────────────────
// Bootstrap CLI for Shadow's Ed25519 attestation keypair.
//
// Ships 2026-07-04 as v1.5.4. Kills the scary node -e one-liner in
// the deploy guide. Bank ops team runs one real command and gets:
//   - shadow-private.pem  (0600, kept on Shadow deployment ONLY)
//   - shadow-public.pem   (0644, distributed to bank auditors)
//   - a ready-to-paste block of env vars for the Vercel dashboard
//
// The private key is written with mode 0600 to prevent world-readable
// accidents on shared runners. The public key stays 0644 because it's
// meant to be shared.
//
// Usage
// -----
//     node bin/generate-attestation-keypair.mjs
//     node bin/generate-attestation-keypair.mjs --out ./keys/
//     node bin/generate-attestation-keypair.mjs --key-id prod-2026-Q3
//     node bin/generate-attestation-keypair.mjs --print-only
//
// Options
// -------
//     --out <dir>       Directory to write shadow-{private,public}.pem
//                       (default: current working directory)
//     --key-id <str>    Rotation tag stamped into every attestation.
//                       (default: v1). Recommend a rotation-aware name
//                       like "prod-2026-Q3" so a downstream auditor can
//                       tell WHEN this key was in use.
//     --print-only      Skip writing files; print PEM blocks to stdout.
//                       For quick evaluation / demo pipelines that keep
//                       keys in a secret manager rather than on disk.
//     --force           Overwrite existing shadow-private.pem / shadow-
//                       public.pem in --out. Default is to refuse if
//                       either file exists (safety against accidental
//                       key rotation via double-run).
//
// Exit codes
// ----------
//     0 — keypair generated + written (or printed)
//     1 — files already exist and --force not set
//     2 — argument / setup error
//
// After running
// -------------
// 1. Move shadow-private.pem to the Shadow deployment's secret store
//    (Vercel dashboard SHADOW_ATTESTATION_ED25519_PRIVATE_KEY variable,
//    or your KMS of choice). NEVER commit it. NEVER share it.
// 2. Distribute shadow-public.pem to bank auditors — they use it to
//    verify with bin/verify-attestation.mjs, the shadow_verify_attestation
//    MCP tool, or POST /api/verify-attestation.
// 3. Set the two env vars on the Shadow deployment (see printed block).
//
// Rotation cadence
// ----------------
// NIST SP 800-57 §5.2 recommends at least yearly. Every attestation
// carries the key_id in its payload so multiple keys can co-exist
// during a grace window — old records verify with the retired key,
// new records verify with the current one.

import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
`Usage:
  node bin/generate-attestation-keypair.mjs [options]

Options:
  --out <dir>       Directory to write shadow-{private,public}.pem (default: cwd)
  --key-id <str>    Rotation tag (default: v1). Recommend e.g. prod-2026-Q3
  --print-only      Skip files; print PEMs to stdout
  --force           Overwrite existing files (default: refuse)

Exit codes:
  0 — success
  1 — files exist and --force not set
  2 — argument error`);
  process.exit(msg ? 2 : 0);
}

function parseArgs(argv) {
  const opts = { out: process.cwd(), keyId: "v1", printOnly: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage();
    else if (a === "--out") opts.out = argv[++i] ?? usage("--out needs a value");
    else if (a === "--key-id") opts.keyId = argv[++i] ?? usage("--key-id needs a value");
    else if (a === "--print-only") opts.printOnly = true;
    else if (a === "--force") opts.force = true;
    else usage(`unknown flag ${a}`);
  }
  return opts;
}

export function generateKeypair() {
  return generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

export function envBlockFor(privatePem, keyId) {
  // A single, paste-friendly block. Vercel dashboard accepts multi-line
  // env values so the PEM's newlines survive verbatim. Same shape for
  // AWS Secrets Manager / GCP Secret Manager.
  return [
    "SHADOW_ATTESTATION_MODE=ed25519",
    `SHADOW_ATTESTATION_KEY_ID=${keyId}`,
    "SHADOW_ATTESTATION_ED25519_PRIVATE_KEY=" + JSON.stringify(privatePem),
  ].join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const { privateKey: privatePem, publicKey: publicPem } = generateKeypair();

  if (opts.printOnly) {
    process.stdout.write(publicPem);
    process.stdout.write(privatePem);
    process.stdout.write("\n# Ready-to-paste deployment env block:\n");
    process.stdout.write(envBlockFor(privatePem, opts.keyId));
    process.stdout.write("\n");
    return 0;
  }

  const outDir = resolve(opts.out);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const privPath = join(outDir, "shadow-private.pem");
  const pubPath = join(outDir, "shadow-public.pem");

  if (!opts.force && (existsSync(privPath) || existsSync(pubPath))) {
    console.error(
      `error: ${privPath} or ${pubPath} already exists.\n` +
      "Refusing to overwrite (this would rotate keys and invalidate every\n" +
      "prior attestation signature). Pass --force if that's truly what you want,\n" +
      "or pick a different --out directory."
    );
    return 1;
  }

  writeFileSync(privPath, privatePem, "utf8");
  chmodSync(privPath, 0o600);  // owner read/write only
  writeFileSync(pubPath, publicPem, "utf8");
  chmodSync(pubPath, 0o644);

  console.log(`✓ Generated Ed25519 keypair (key_id: ${opts.keyId})`);
  console.log("");
  console.log(`  Private key: ${privPath}   (mode 0600 — Shadow deployment ONLY)`);
  console.log(`  Public key:  ${pubPath}    (mode 0644 — share with bank auditors)`);
  console.log("");
  console.log("Next steps:");
  console.log("");
  console.log("1. Move shadow-private.pem to the Shadow deployment's secret store.");
  console.log("   NEVER commit it. NEVER share it. The private key is what stops");
  console.log("   a downstream from forging attestations.");
  console.log("");
  console.log("2. Distribute shadow-public.pem to bank auditors. They verify with:");
  console.log("     node bin/verify-attestation.mjs --response saved.json --public-key shadow-public.pem");
  console.log("");
  console.log("3. Set these env vars on the Shadow deployment (Vercel dashboard / KMS):");
  console.log("");
  console.log(envBlockFor(privatePem, opts.keyId));
  console.log("");
  console.log(`4. Rotate at least yearly per NIST SP 800-57 §5.2. The key_id "${opts.keyId}" is`);
  console.log("   stamped into every attestation so old records still verify with the retired");
  console.log("   key during a rotation window.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
