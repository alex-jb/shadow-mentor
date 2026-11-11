// Offline composition check: a signed record and a scoped CI decision are distinct.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize } from "../../packages/attest-core/attestation.js";
import { appendEvent, createSession, sealSession, verifyBundle } from "../../packages/attest-core/session.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const files = ["plan.json", "expected.json", "jobs.json", "receipt.json", "report.json"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const hashes = path => Object.fromEntries(files.map(name => [name, sha256(readFileSync(join(path, name)))]));
const cases = [
  ["fresh_match", "ACCEPT", 0],
  ["fresh_mismatch", "REJECT", 1],
  ["old_receipt_attempt", "WITHHOLD", 2],
  ["tolerated_step_failure", "WITHHOLD", 2],
];
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const otherKey = generateKeyPairSync("ed25519").publicKey;

function python(script, ...args) {
  const result = spawnSync("python3", ["-B", join(here, script), ...args], { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

function review(path, decision, exit) {
  const result = python("review.py", path);
  assert.equal(result.status, exit, result.stderr);
  const verdict = JSON.parse(result.stdout);
  assert.equal(verdict.decision, decision);
  return { decision, reason: verdict.reason };
}

const work = mkdtempSync(join(tmpdir(), "shadow-ci-portable-"));
const rows = [];
let changed;
let wrongKey;
try {
  for (const [name, decision, exit] of cases) {
    const path = join(work, name);
    const generated = python("experiment.py", "--write-bundle", name, path);
    assert.equal(generated.status, 0, generated.stderr);
    const manifest = { schema: "shadow.ci-intake-portable-smoke.v1", files: hashes(path) };
    const session = createSession({
      agent: { name: "shadow-ci-portable-smoke", version: "1" },
      environmentFingerprint: { os: process.platform, node_version: process.version },
      keyId: "ephemeral-test-key",
      privateKey,
    });
    const event = appendEvent(session, { event_type: "tool_result", actor: "tool", payload: manifest });
    const signed = sealSession(session);
    assert.equal(verifyBundle(signed, { publicKey }).ok, true);
    assert.equal(signed.events[event.seq].payload_hash, sha256(canonicalize(manifest)));
    assert.deepEqual(manifest.files, hashes(path));
    rows.push({ case: name, signature_valid: true, files_match_manifest: true, review: review(path, decision, exit) });
    if (name === "fresh_match") {
      const result = verifyBundle(signed, { publicKey: otherKey });
      assert.equal(result.ok, false);
      wrongKey = { signature_valid: result.ok, reason: result.reason };
      // The manifest is unchanged and signed; the supplied report bytes are not.
      appendFileSync(join(path, "report.json"), "\n");
      assert.equal(verifyBundle(signed, { publicKey }).ok, true);
      assert.notEqual(manifest.files["report.json"], hashes(path)["report.json"]);
      changed = {
        signature_valid: true, files_match_manifest: false,
        review: review(path, "WITHHOLD", 2),
      };
      assert.equal(changed.review.reason, "REPORT_DIGEST_MISMATCH");
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(JSON.stringify({
  boundary: "Local fixtures and ephemeral test keys; no CI producer authentication, external anchors or new samples.",
  cases: rows,
  wrong_verification_key: wrongKey,
  report_changed_after_signing: changed,
}, null, 2));
