// test/attest-core-contract.test.js
// v2.0.0-rc3 contract tests for shadow-attest-core.
//
// Two invariants:
//   1. Every symbol the package's index.js re-exports resolves at runtime.
//   2. The transitive dependency tree of the entry file imports zero
//      LLM SDKs. This is the "attest-core has no council dependency"
//      claim expressed as code, so procurement reviewers can grep it.
//
// A third test proves the attest-core-only surface can sign and verify
// 100 synthetic external decisions (the T6 brief's acceptance criterion),
// with no dependency on any Shadow council or LLM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync } from "node:crypto";

import * as AttestCore from "../packages/attest-core/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PKG_PATH = join(REPO_ROOT, "packages", "attest-core", "package.json");
const ENTRY_PATH = join(REPO_ROOT, "packages", "attest-core", "index.js");


// ────────────────────────────────────────────────────────────────
// 1. Contract: every documented export resolves
// ────────────────────────────────────────────────────────────────

test("attest-core exports the documented symbols", () => {
  const expected = [
    "ATTESTATION_VERSION",
    "SIGNATURE_MODES",
    "buildAttestation",
    "verifyAttestation",
    "computeAttestationHash",
  ];
  for (const sym of expected) {
    assert.ok(sym in AttestCore, `missing export: ${sym}`);
    assert.ok(AttestCore[sym] !== undefined, `undefined export: ${sym}`);
  }
});

// The FULL export surface is frozen + tied to the version. Adding/removing an export
// must be intentional: update this list AND bump packages/attest-core/package.json in
// the SAME commit. This guard would have caught sealAndAnchor being added while the
// version stayed 2.1.0 (a silent SemVer drift on a published package).
test("attest-core export surface is frozen + versioned (drift must be intentional)", () => {
  const EXPECTED_EXPORTS = [
    "ATTESTATION_VERSION", "EVENT_TYPES", "SIGNATURE_MODES", "TRUST_LEVELS", "appendEvent",
    "buildAttestation", "buildRekorHashedrekordEntry", "buildTimestampRequest", "canonicalizeJson",
    "computeAttestationHash", "createFileStore", "createSession", "extractRekorPayloadHash",
    "listSessionFiles", "parseTimestampResponse", "recoverSession", "rekorLeafHash", "requestTimestamp",
    "sealAndAnchor", "sealPartialBundle", "sealSession", "submitRekorEntry", "trustLevelRank",
    "validateCmsCertChain", "verifyAttestation", "verifyBundle", "verifyCmsSignature",
    "verifyInclusionProof", "verifyRekorAnchor", "verifyRekorSet", "verifyRfc3161Anchor",
  ].sort();
  assert.deepEqual(Object.keys(AttestCore).sort(), EXPECTED_EXPORTS,
    "attest-core export surface changed — update EXPECTED_EXPORTS AND bump the package version");
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
  assert.equal(pkg.version, "2.2.0",
    "sealAndAnchor + Source-Map v1.1 landed after 2.1.0 was published — package is 2.2.0 (pending npm publish)");
});


// ────────────────────────────────────────────────────────────────
// 2. Contract: zero LLM SDK deps in the transitive import graph
// ────────────────────────────────────────────────────────────────

const LLM_SDK_MODULES = [
  "@anthropic-ai/sdk",
  "@anthropic-ai",
  "openai",
  "@openai",
  "@google/genai",
  "@google/generative-ai",
  "cohere-ai",
  "@mistralai",
  "replicate",
  "@huggingface",
];

const LLM_LOCAL_MODULES = [
  "provider-diversity",   // routing across LLM providers
  "confidence-weighted",  // council-verdict aggregation
  "council",              // any council module
  "persona",              // persona prompts
  "prompts",              // prompt registry
];

function isLlmModule(spec) {
  const low = spec.toLowerCase();
  for (const bad of LLM_SDK_MODULES) if (low.startsWith(bad)) return { kind: "llm_sdk", match: bad };
  for (const bad of LLM_LOCAL_MODULES) if (low.includes("/" + bad) || low.endsWith("/" + bad) || low.includes(bad + "-") || low.includes(bad + ".")) {
    return { kind: "llm_local", match: bad };
  }
  return null;
}

function extractImports(source) {
  const imports = [];
  const staticRe = /^\s*import(?:\s+[\w*\{\},\s]+\s+from)?\s+["']([^"']+)["']/gm;
  let m;
  while ((m = staticRe.exec(source)) !== null) imports.push(m[1]);
  const dynRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynRe.exec(source)) !== null) imports.push(m[1]);
  return imports;
}

function walkDeps(entryFile, seen = new Set(), hits = []) {
  const abs = pathResolve(entryFile);
  if (seen.has(abs)) return hits;
  seen.add(abs);
  if (!existsSync(abs) || !statSync(abs).isFile()) return hits;
  const src = readFileSync(abs, "utf-8");
  const imps = extractImports(src);
  for (const imp of imps) {
    const llm = isLlmModule(imp);
    if (llm) hits.push({ from: abs, imported: imp, ...llm });
    // Only recurse into relative local imports
    if (imp.startsWith(".")) {
      const resolved = pathResolve(dirname(abs), imp);
      const candidates = [resolved, resolved + ".js", resolved + ".mjs", resolved + "/index.js"];
      for (const c of candidates) {
        if (existsSync(c) && statSync(c).isFile()) {
          walkDeps(c, seen, hits);
          break;
        }
      }
    }
  }
  return hits;
}

test("attest-core transitive import graph has zero LLM SDK deps", () => {
  const hits = walkDeps(ENTRY_PATH);
  assert.deepEqual(
    hits,
    [],
    "attest-core imports a module that looks like an LLM SDK or council-layer artifact. attest-core must be a pure crypto + chain primitive. Offending imports:\n" +
      hits.map((h) => `  ${h.from}\n    → ${h.imported}  (${h.kind}: ${h.match})`).join("\n"),
  );
});


// ────────────────────────────────────────────────────────────────
// 3. Contract: package.json exports match documented surface
// ────────────────────────────────────────────────────────────────

test("attest-core package.json exports the documented sub-entries", () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  assert.equal(pkg.name, "shadow-attest-core");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.main, "index.js");
  for (const p of [".", "./attestation", "./batch", "./chain", "./verify-chain"]) {
    assert.ok(p in pkg.exports, `package.json exports missing: ${p}`);
  }
});


// ────────────────────────────────────────────────────────────────
// 4. Acceptance: 100 synthetic external decisions attest + verify
// ────────────────────────────────────────────────────────────────

test("acceptance: attest + verify 100 synthetic external decisions with only attest-core", () => {
  const {
    buildAttestation,
    verifyAttestation,
    SIGNATURE_MODES,
  } = AttestCore;

  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  let previousHash = null;
  for (let i = 0; i < 100; i++) {
    // Synthetic external decision (could be from a bank LOS, a credit
    // model, a human underwriter, or any non-Shadow producer).
    const decisionPayload = {
      decision_id: `ext-${String(i).padStart(4, "0")}`,
      verdict: ["approve", "escalate", "block", "refuse_to_serve"][i % 4],
      reason_codes: i % 2 === 0 ? ["AA01"] : ["AA02", "AA04"],
      producer: "synthetic-external",
      idx: i,
    };
    const request = { decision_index: i };

    const att = buildAttestation({
      request,
      response: decisionPayload,
      modelId: "external-producer",
      mode: SIGNATURE_MODES.ED25519,
      privateKey,
      previousHash,
    });

    const v = verifyAttestation(att, request, decisionPayload, { publicKey });
    assert.equal(v.ok, true, `decision ${i} verification failed: ${v.reason}`);

    // Compute this attestation's own hash to link the next one.
    const attHash = createHash("sha256")
      .update(JSON.stringify(att))
      .digest("hex");
    previousHash = attHash;
  }
});
