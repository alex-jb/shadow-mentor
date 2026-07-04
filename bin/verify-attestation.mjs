#!/usr/bin/env node
// bin/verify-attestation.mjs
// ──────────────────────────────────────────────────────────────────
// Public verifier CLI for Shadow attestations.
//
// Ships 2026-07-04. Makes the Ed25519 attestation story TANGIBLE
// for procurement: bank auditor runs one command against a saved
// Shadow response + public key and gets a green ✓ or red ✗.
//
// Usage
// -----
//     node bin/verify-attestation.mjs \
//       --response ./saved-response.json \
//       --public-key ./bank-holds-this.pem
//
// Options
// -------
//     --response <path>       Path to a Shadow /api/deliberate or
//                             /api/loan-council response JSON
//     --public-key <path>     Path to the Ed25519 PEM public key.
//                             Optional if SHADOW_ATTESTATION_ED25519_PUBLIC_KEY
//                             is set OR mode is hmac (use --secret instead)
//     --secret <string>       HMAC secret (for hmac-sha256 mode ONLY —
//                             not recommended for procurement).
//                             Optional if SHADOW_ATTESTATION_SECRET is set.
//     --request <path>        Optional. If omitted, the verifier assumes
//                             the response contains a `_request` field
//                             (some Shadow deployments do). If neither
//                             works, verification fails cleanly.
//
// Exit codes
// ----------
//     0 = verified ok (auditor sees green ✓)
//     1 = verification failed (auditor sees red ✗ + specific reason)
//     2 = argument / setup error
//
// Example — procurement demo (5 seconds)
// --------------------------------------
//     # 1. Shadow makes a decision, saves the response
//     curl -X POST https://bank.example/api/loan-council \
//          -d '{"loan":{...}}' > decision.json
//
//     # 2. Bank auditor runs the verifier with the public key
//     node bin/verify-attestation.mjs \
//       --response decision.json \
//       --public-key bank-auditor.pub
//
//     # 3. Green ✓ if the response is authentic, red ✗ otherwise.

import { readFileSync } from "node:fs";
import { verifyAttestation, SIGNATURE_MODES } from "../lib/attestation.js";


function parseArgs(argv) {
  const args = { _positional: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._positional.push(a);
    }
  }
  return args;
}


function die(msg, code = 2) {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(code);
}


function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    die(`cannot read/parse ${path}: ${err.message}`);
  }
}


function readTextFile(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    die(`cannot read ${path}: ${err.message}`);
  }
}


function main() {
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    console.log(`
Shadow — public attestation verifier

Usage:
  node bin/verify-attestation.mjs --response <path> --public-key <path>
  node bin/verify-attestation.mjs --response <path> --secret <string>   # HMAC mode

Options:
  --response <path>       Path to a saved Shadow response JSON
  --public-key <path>     Path to the Ed25519 PEM public key
  --secret <string>       HMAC secret (for hmac-sha256 mode, dev only)
  --request <path>        Optional. Path to the ORIGINAL request JSON.
                          If omitted, verifier looks for response._request.
  --help                  Show this message

Exit codes:
  0 = attestation verified ✓
  1 = verification failed ✗
  2 = setup/argument error

Refs:
  RFC 8032 EdDSA (Ed25519 signing)
  arXiv:2603.14283 AEX Non-Intrusive Multi-Hop Attestation
  arXiv:2504.04715 Auditing Model Substitution in LLM APIs
`);
    process.exit(0);
  }

  if (!args.response) {
    die("--response is required. Use --help for usage.");
  }

  const responseFull = readJsonFile(args.response);
  const attestation = responseFull.attestation;
  if (!attestation) {
    die(`no 'attestation' field in ${args.response}. This response was ` +
        "not signed — a Shadow deployment on v1.4.0+ with SHADOW_ATTESTATION_MODE " +
        "set produces signed responses. See README § 'Ed25519 attestation'.");
  }

  // Reconstruct the response body MINUS the attestation for verification.
  // The attestation was built over the response WITHOUT itself embedded.
  const responseForVerify = { ...responseFull };
  delete responseForVerify.attestation;

  // Get the request. Try (in order): --request flag, response._request
  // field. Some Shadow deployments embed the request for self-auditing;
  // others require it to be persisted separately.
  let request;
  if (args.request) {
    request = readJsonFile(args.request);
  } else if (responseFull._request) {
    request = responseFull._request;
    // Also strip it from the response-for-verify since it wasn't in
    // the original signed body.
    delete responseForVerify._request;
  } else {
    die("no --request path AND response has no _request field. The verifier " +
        "needs the ORIGINAL request that Shadow signed. Persist it alongside " +
        "the response, or embed it as response._request at persist time.");
  }

  // Assemble key material based on mode. If the attestation mode is
  // ed25519 we require a public key; hmac requires a secret.
  const mode = attestation.mode ?? SIGNATURE_MODES.HMAC;
  const keys = {};

  if (mode === SIGNATURE_MODES.ED25519) {
    let publicKey = args["public-key"]
      ? readTextFile(args["public-key"])
      : process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY;
    if (!publicKey) {
      die("attestation mode is 'ed25519' but no --public-key provided AND " +
          "SHADOW_ATTESTATION_ED25519_PUBLIC_KEY env var is not set. " +
          "You need Shadow's Ed25519 public key to verify (bank counsel should " +
          "hold this; Shadow keeps the PRIVATE key).");
    }
    keys.publicKey = publicKey;
  } else if (mode === SIGNATURE_MODES.HMAC) {
    const secret = args.secret ?? process.env.SHADOW_ATTESTATION_SECRET;
    if (!secret) {
      die("attestation mode is 'hmac-sha256' but no --secret provided AND " +
          "SHADOW_ATTESTATION_SECRET env var is not set. " +
          "For procurement, we strongly recommend switching Shadow to " +
          "ed25519 mode so you don't need to share the signing secret " +
          "with the verifier — see README § 'Ed25519 attestation'.");
    }
    keys.secret = secret;
  } else {
    die(`unknown attestation mode '${mode}'. Verifier supports 'ed25519' and 'hmac-sha256'.`);
  }

  const result = verifyAttestation(attestation, request, responseForVerify, keys);

  if (result.ok) {
    process.stdout.write("✓ attestation verified\n");
    process.stdout.write(`  mode:            ${attestation.mode}\n`);
    process.stdout.write(`  model_id:        ${attestation.model_id}\n`);
    process.stdout.write(`  completed_at:    ${attestation.completed_at_utc}\n`);
    process.stdout.write(`  key_id:          ${attestation.key_id}\n`);
    process.stdout.write(`  request_hash:    ${attestation.request_commitment.slice(0, 16)}…\n`);
    process.stdout.write(`  output_hash:     ${attestation.output_commitment.slice(0, 16)}…\n`);
    if (attestation.previous_hash) {
      process.stdout.write(`  chain_prev:      ${attestation.previous_hash.slice(0, 16)}…\n`);
    }
    process.exit(0);
  } else {
    process.stderr.write(`✗ attestation FAILED to verify\n`);
    process.stderr.write(`  reason:  ${result.reason}\n`);
    process.stderr.write(`  checks:  ${JSON.stringify(result.checks)}\n`);
    process.exit(1);
  }
}


main();
