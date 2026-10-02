// Supported operator package API: independent keys, signed declarations and
// byte-preserved evidence. All inputs are controlled synthetic data; no provider
// session, model invocation, network request or live OCR is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { createSession, sealSession, verifyBundle } from "../packages/attest-core/index.js";
import {
  assemblePackage,
  assembleOperatorPackage,
  OPERATOR_KEY_LABEL,
  MEMBER_PATHS,
  verifyPackageDir,
} from "../lib/portable-audit-package.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM, FIXTURE_RELEASE_PUBLIC_PEM } from "../verify/fixture-release-key.mjs";

const BUILT_AT = "2026-10-02T00:00:02.000Z";
const SESSION_ID = "synthetic-operator-api-no-provider";
const SOURCE = "synthetic:operator-declared-no-provider";

function ephemeralKey(type = "ed25519", options = {}) {
  const { privateKey, publicKey } = generateKeyPairSync(type, options);
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

function inputs() {
  const evidenceKey = ephemeralKey();
  const packageKey = ephemeralKey();
  const session = createSession({
    agent: { name: "synthetic-operator-api", version: "test-only" },
    models: [{ model_id: "unknown", provider: null }],
    environmentFingerprint: { os: "controlled-test", node_version: "controlled-test" },
    keyId: "synthetic-evidence-key", privateKey: evidenceKey.privatePem,
    sessionId: SESSION_ID, startedAtUtc: "2026-10-02T00:00:00.000Z",
  });
  const bundle = sealSession(session, { endedAtUtc: "2026-10-02T00:00:01.000Z" });
  // Deliberately non-canonical JSON formatting: parsing for validation must not
  // authorize rewriting, re-sealing or normalizing the original evidence bytes.
  const evidenceBytes = Buffer.from(JSON.stringify(bundle, null, 4) + "\r\n");
  return {
    narrative: structuredClone(BANKING_NARRATIVE),
    source: SOURCE,
    evidenceBytes,
    evidencePublicKeyPem: evidenceKey.publicPem,
    builtAt: BUILT_AT,
    buildCommit: "unknown",
    producerVersion: "test-only",
    packagePrivateKeyPem: packageKey.privatePem,
    packagePublicKeyPem: packageKey.publicPem,
  };
}

function nodeCanonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(nodeCanonicalize).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + nodeCanonicalize(value[key])).join(",") + "}";
}

const nodeHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const independentFingerprint = (pem) => nodeHash(createPublicKey(pem).export({ type: "spki", format: "der" }));

function materialize(t, assembled) {
  const directory = mkdtempSync(join(tmpdir(), "shadow-operator-api-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [path, bytes] of assembled.files) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), bytes);
  }
  return directory;
}

function expectInputFailure(input, inspect = () => {}) {
  assert.throws(() => assembleOperatorPackage(input), (error) => {
    assert.equal(error.code, "INPUT");
    inspect(error);
    return true;
  });
}

test("operator API produces v1.0 with independently verifying outer and inner signatures, fingerprints and declarations", (t) => {
  const input = inputs();
  const assembled = assembleOperatorPackage(input);
  const manifest = assembled.manifest;
  assert.equal(manifest.manifest_version, "shadow-portable-audit-package/1.0");
  assert.equal(manifest.signing.profile, "ed25519");
  assert.equal(manifest.signing.key_provenance, "operator");
  assert.equal(manifest.signing.key_label, OPERATOR_KEY_LABEL);
  assert.equal(OPERATOR_KEY_LABEL, "OPERATOR PROVIDED KEY — identity and authority unverified");
  assert.equal(manifest.source, SOURCE);
  assert.equal(manifest.built_at, BUILT_AT);
  assert.deepEqual(manifest.bindings, { case_id: BANKING_NARRATIVE.case_id, evidence_session_id: SESSION_ID });
  assert.equal(manifest.signing.package_public_key_fingerprint_sha256, independentFingerprint(input.packagePublicKeyPem));
  assert.equal(manifest.signing.evidence_public_key_fingerprint_sha256, independentFingerprint(input.evidencePublicKeyPem));
  assert.notEqual(manifest.signing.package_public_key_fingerprint_sha256, manifest.signing.evidence_public_key_fingerprint_sha256);
  const { signature, ...unsigned } = manifest;
  assert.equal(edVerify(null, Buffer.from(nodeCanonicalize(unsigned)), input.packagePublicKeyPem, Buffer.from(signature, "base64")), true);
  assert.equal(edVerify(null, Buffer.from(nodeCanonicalize(unsigned)), input.evidencePublicKeyPem, Buffer.from(signature, "base64")), false);
  const evidence = JSON.parse(assembled.files.get(MEMBER_PATHS.evidence).toString());
  assert.equal(verifyBundle(evidence, { publicKey: input.evidencePublicKeyPem }).ok, true);
  assert.equal(verifyBundle(evidence, { publicKey: input.packagePublicKeyPem }).ok, false);
  const directory = materialize(t, assembled);
  const checked = verifyPackageDir(directory);
  assert.equal(checked.ok, true);
  assert.equal(checked.verdict, "VERIFIED");
  assert.equal(checked.key_provenance, "operator");
  assert.deepEqual(checked.failures, []);
  assert.ok(checked.checks.every((check) => check.ok));
  assert.match(checked.boundary, /tamper-evidence only/);
  assert.match(checked.boundary, /never analytical or business correctness/);
  assert.equal(verifyPackageDir(directory, { publicKeyPem: input.packagePublicKeyPem }).ok, true);
  const wrongExternalKey = verifyPackageDir(directory, { publicKeyPem: input.evidencePublicKeyPem });
  assert.equal(wrongExternalKey.ok, false);
  assert.ok(wrongExternalKey.failures.some((failure) => failure.code === "KEY_FINGERPRINT_MISMATCH"));
});

test("operator provenance limits and original fixture presentation remain hash-bound, with public keys only", (t) => {
  const input = inputs();
  const assembled = assembleOperatorPackage(input);
  const provenanceBytes = assembled.files.get(MEMBER_PATHS.provenance);
  const provenance = JSON.parse(provenanceBytes.toString());
  assert.equal(provenance.source, SOURCE);
  assert.equal(provenance.key_provenance, "operator");
  assert.deepEqual(provenance.operator_limits, {
    signer_identity: "UNVERIFIED",
    source: "OPERATOR_DECLARED",
    provider_origin: "UNVERIFIED",
    capture_completeness: "UNVERIFIED",
    business_approval: "NOT_INFERRED",
  });
  const asset = assembled.manifest.assets.find((member) => member.path === MEMBER_PATHS.provenance);
  assert.equal(asset.sha256, nodeHash(provenanceBytes));
  assert.equal(asset.byte_size, provenanceBytes.length);
  const fixture = assemblePackage({ ...input, source: "fixture:banking", packagePrivateKeyPem: FIXTURE_RELEASE_PRIVATE_PEM, packagePublicKeyPem: FIXTURE_RELEASE_PUBLIC_PEM });
  assert.deepEqual(assembled.files.get(MEMBER_PATHS.presentation), fixture.files.get(MEMBER_PATHS.presentation));
  assert.ok(assembled.manifest.capability_boundary.includes("TAMPER_EVIDENCE_ONLY"));
  assert.ok(assembled.manifest.capability_boundary.includes("SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS"));
  for (const [path, bytes] of assembled.files) {
    assert.ok(!bytes.toString().includes("PRIVATE KEY"), path);
    assert.ok(!bytes.toString().includes(input.packagePrivateKeyPem), path);
  }
  const directory = materialize(t, assembled);
  provenance.operator_limits.provider_origin = "AUTHENTICATED";
  writeFileSync(join(directory, MEMBER_PATHS.provenance), JSON.stringify(provenance));
  const changed = verifyPackageDir(directory);
  assert.equal(changed.ok, false);
  assert.ok(changed.failures.some((failure) => failure.code === "TAMPERED"));
});

test("operator assembly preserves exact evidence bytes and leaves caller narrative and options unchanged", () => {
  const input = inputs();
  const evidenceBefore = Buffer.from(input.evidenceBytes);
  const narrativeBefore = JSON.stringify(input.narrative);
  const optionsBefore = { ...input };
  assert.equal(Object.isFrozen(input.narrative), false);
  const assembled = assembleOperatorPackage(input);
  assert.deepEqual(assembled.files.get(MEMBER_PATHS.evidence), evidenceBefore);
  assert.deepEqual(input.evidenceBytes, evidenceBefore);
  assert.equal(JSON.stringify(input.narrative), narrativeBefore);
  assert.equal(Object.isFrozen(input.narrative), false);
  assert.equal(Object.isFrozen(input.narrative.decision), false);
  assert.deepEqual(input, optionsBefore);
  const typedArrayAssembly = assembleOperatorPackage({ ...input, evidenceBytes: new Uint8Array(evidenceBefore) });
  assert.deepEqual(typedArrayAssembly.files.get(MEMBER_PATHS.evidence), evidenceBefore);
  // Mutable caller bytes cannot retroactively change the assembled package.
  input.evidenceBytes[0] = 0;
  assert.deepEqual(assembled.files.get(MEMBER_PATHS.evidence), evidenceBefore);
});

test("operator assembly remains byte-deterministic for the same explicit inputs", () => {
  const input = inputs();
  const first = assembleOperatorPackage(input);
  const second = assembleOperatorPackage(input);
  assert.deepEqual([...first.files.keys()], [...second.files.keys()]);
  for (const [path, bytes] of first.files) assert.deepEqual(bytes, second.files.get(path), path);
});

test("operator API rejects mismatched outer key pairs without returning an assembled package", () => {
  const input = inputs();
  const other = ephemeralKey();
  expectInputFailure({ ...input, packagePublicKeyPem: other.publicPem });
  expectInputFailure({ ...input, packagePublicKeyPem: input.evidencePublicKeyPem });
});

test("operator API rejects RSA, malformed keys and a public-only signing key with content-free input failures", () => {
  const input = inputs();
  const rsa = ephemeralKey("rsa", { modulusLength: 2048 });
  expectInputFailure({ ...input, packagePrivateKeyPem: rsa.privatePem, packagePublicKeyPem: rsa.publicPem });
  const sentinel = "PRIVATE_KEY_CONTENT_MUST_NOT_BE_ECHOED";
  expectInputFailure({ ...input, packagePrivateKeyPem: sentinel }, (error) => assert.ok(!error.message.includes(sentinel)));
  expectInputFailure({ ...input, packagePublicKeyPem: sentinel }, (error) => assert.ok(!error.message.includes(sentinel)));
  expectInputFailure({ ...input, packagePrivateKeyPem: input.packagePublicKeyPem });
  const certificateLabel = input.packagePublicKeyPem.replaceAll("PUBLIC KEY", "CERTIFICATE");
  expectInputFailure({ ...input, packagePublicKeyPem: certificateLabel }, (error) => {
    assert.ok(!error.message.includes(certificateLabel));
  });
  expectInputFailure({ ...input, packagePublicKeyPem: input.packagePublicKeyPem + input.packagePublicKeyPem });
});

test("operator API cannot promote the publicly committed fixture signing key to an operator key", () => {
  const input = inputs();
  expectInputFailure({ ...input, packagePrivateKeyPem: FIXTURE_RELEASE_PRIVATE_PEM, packagePublicKeyPem: FIXTURE_RELEASE_PUBLIC_PEM });
});

test("operator API rejects provenance, label and supersession overrides beyond the v1.0 operator profile", () => {
  const input = inputs();
  expectInputFailure({ ...input, keyProvenance: "production" });
  expectInputFailure({ ...input, keyProvenance: "fixture" });
  expectInputFailure({ ...input, keyLabel: "AUTHENTICATED PRODUCTION SIGNER" });
  expectInputFailure({ ...input, supersedes: { predecessorPackageId: "a".repeat(64) } });
});

test("operator API requires an explicit bounded source declaration and valid build timestamp", () => {
  const input = inputs();
  for (const source of [undefined, null, "", " ", 12, "x".repeat(1025), "source\nclaimed"]) {
    expectInputFailure({ ...input, source });
  }
  for (const builtAt of [undefined, null, "", "not-a-timestamp", 12]) {
    expectInputFailure({ ...input, builtAt });
  }
});

test("operator API rejects wrong inner evidence keys and tampered evidence before packaging", () => {
  const input = inputs();
  expectInputFailure({ ...input, evidencePublicKeyPem: input.packagePublicKeyPem });
  const certificateLabel = input.evidencePublicKeyPem.replaceAll("PUBLIC KEY", "CERTIFICATE");
  expectInputFailure({ ...input, evidencePublicKeyPem: certificateLabel }, (error) => {
    assert.ok(!error.message.includes(certificateLabel));
  });
  expectInputFailure({ ...input, evidencePublicKeyPem: input.packagePrivateKeyPem }, (error) => {
    assert.ok(!error.message.includes(input.packagePrivateKeyPem));
  });
  for (const evidenceBytes of [undefined, null, Buffer.alloc(0), new Uint8Array(0)]) {
    expectInputFailure({ ...input, evidenceBytes });
  }
  const originalBytes = Buffer.from(input.evidenceBytes);
  const bundle = JSON.parse(input.evidenceBytes.toString());
  bundle.events[0].actor = "synthetic-tamper";
  expectInputFailure({ ...input, evidenceBytes: Buffer.from(JSON.stringify(bundle)) });
  assert.deepEqual(input.evidenceBytes, originalBytes);
});

test("operator API rejects invalid UTF-8 evidence even when replacement decoding would preserve a valid signature", () => {
  const input = inputs();
  const bundle = JSON.parse(input.evidenceBytes.toString());
  // payload_ref is mutable and outside the signed shape. This isolates a
  // decoding disagreement instead of accidentally making the signature fail.
  const marker = "INVALID_UTF8_UNSIGNED_REFERENCE";
  bundle.events[0].payload_ref = marker;
  const bytes = Buffer.from(JSON.stringify(bundle));
  const index = bytes.indexOf(marker);
  assert.ok(index > 0);
  const invalidUtf8 = Buffer.concat([
    bytes.subarray(0, index), Buffer.from([0xff]), bytes.subarray(index + marker.length),
  ]);
  assert.equal(verifyBundle(JSON.parse(invalidUtf8.toString()), { publicKey: input.evidencePublicKeyPem }).ok, true);
  expectInputFailure({ ...input, evidenceBytes: invalidUtf8 });
});

test("operator API malformed evidence and attestation errors never echo sensitive input fragments", () => {
  const input = inputs();
  const sentinel = "Q_PRIVATE_MEDICAL_INPUT";
  const malformed = Buffer.from(`{"${sentinel}": "unterminated`);
  for (const field of ["evidenceBytes", "attestationBytes"]) {
    expectInputFailure({ ...input, [field]: malformed }, (error) => {
      assert.ok(!error.message.includes(sentinel));
      assert.ok(!error.message.includes("Q_PRIVATE"));
      assert.ok(!String(error.stack).includes(sentinel));
    });
  }
});

test("operator API permits explicitly reusing a matching key for inner and outer signatures without implying identity trust", (t) => {
  const input = inputs();
  const shared = ephemeralKey();
  const session = createSession({
    agent: { name: "synthetic-shared-key", version: "test-only" },
    environmentFingerprint: { os: "controlled-test", node_version: "controlled-test" },
    keyId: "synthetic-shared-key", privateKey: shared.privatePem,
    sessionId: SESSION_ID, startedAtUtc: "2026-10-02T00:00:00.000Z",
  });
  const bundle = sealSession(session, { endedAtUtc: "2026-10-02T00:00:01.000Z" });
  const assembled = assembleOperatorPackage({
    ...input,
    evidenceBytes: Buffer.from(JSON.stringify(bundle)), evidencePublicKeyPem: shared.publicPem,
    packagePrivateKeyPem: shared.privatePem, packagePublicKeyPem: shared.publicPem,
  });
  const checked = verifyPackageDir(materialize(t, assembled));
  assert.equal(checked.ok, true);
  const provenance = JSON.parse(assembled.files.get(MEMBER_PATHS.provenance).toString());
  assert.equal(provenance.operator_limits.signer_identity, "UNVERIFIED");
});
