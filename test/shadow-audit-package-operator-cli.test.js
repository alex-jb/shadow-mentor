// The operator producer is exercised through real offline CLI subprocesses.
// Narrative and sealed evidence here are controlled reference inputs, not a
// provider session. Throwaway package signing keys never survive a test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, createHash, verify as cryptoVerify } from "node:crypto";
import {
  readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync,
  existsSync, readdirSync, lstatSync, statSync, symlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { verifyBundle } from "../packages/attest-core/index.js";
import { MEMBER_PATHS, PACKAGE_VERSION, verifyPackageDir } from "../lib/portable-audit-package.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const BUILT_AT = "2026-10-01T00:00:00.000Z";
const SOURCE = "operator:synthetic-cli-test-no-provider";
const PRIVATE_SENTINEL = "PRIVATE_INPUT_BYTES_MUST_NOT_BE_LOGGED";

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT, env: {}, encoding: "utf8", timeout: 5000,
  });
}

function walk(root, prefix = "") {
  const paths = [];
  for (const name of readdirSync(join(root, prefix)).sort()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (lstatSync(join(root, path)).isDirectory()) paths.push(...walk(root, path));
    else paths.push(path);
  }
  return paths;
}

function snapshot(root) {
  return new Map(walk(root).map((path) => [path, readFileSync(join(root, path))]));
}

function unchanged(root, before) {
  assert.deepEqual(walk(root), [...before.keys()], "input member list changed");
  for (const [path, bytes] of before) {
    assert.ok(bytes.equals(readFileSync(join(root, path))), `input bytes changed: ${path}`);
  }
}

function nodeCanonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(nodeCanonicalize).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) =>
    JSON.stringify(key) + ":" + nodeCanonicalize(value[key])).join(",") + "}";
}

function withInputs(callback) {
  const parent = mkdtempSync(join(tmpdir(), "shadow-operator-cli-"));
  try {
    const inputDir = join(parent, "inputs");
    mkdirSync(inputDir);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const paths = {
      "--narrative": join(inputDir, "narrative.json"),
      "--evidence": join(inputDir, "evidence.json"),
      "--evidence-public-key": join(inputDir, "evidence-public.pem"),
      "--package-private-key": join(inputDir, "package-private.pem"),
      "--package-public-key": join(inputDir, "package-public.pem"),
    };
    writeFileSync(paths["--narrative"], JSON.stringify(BANKING_NARRATIVE, null, 2) + "\n");
    writeFileSync(paths["--evidence"], readFileSync(join(ROOT, "docs/reference/banking-decision.bundle.json")));
    writeFileSync(paths["--evidence-public-key"], readFileSync(join(ROOT, "docs/reference/banking-decision.public.pem")));
    writeFileSync(paths["--package-private-key"], privatePem, { mode: 0o600 });
    writeFileSync(paths["--package-public-key"], publicPem);
    assert.equal(statSync(paths["--package-private-key"]).mode & 0o777, 0o600);
    const output = join(parent, "package");
    const args = (overrides = {}, extra = []) => {
      const values = {
        ...paths, "--source": SOURCE, "--built-at": BUILT_AT,
        "--build-commit": "unknown", "--output-dir": output, ...overrides,
      };
      return ["create-operator", ...Object.entries(values).flatMap(([flag, value]) =>
        value == null ? [] : [flag, value]), ...extra];
    };
    return callback({ parent, inputDir, paths, output, args, publicKey });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function noNewOutput(fixture, result) {
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(fixture.output), false);
  assert.equal(readdirSync(fixture.parent).some((path) => path.includes(".tmp-")), false);
  assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE KEY|PRIVATE_INPUT_BYTES_MUST_NOT_BE_LOGGED/);
}

test("create-operator signs a public-only 1.0 package with intact evidence and independently verifiable inner and outer signatures", () => withInputs((f) => {
  const before = snapshot(f.inputDir);
  const result = run(f.args({}, ["--json"]));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.manifest_version, PACKAGE_VERSION);
  assert.equal(summary.key_provenance, "operator");
  assert.equal(summary.case_id, BANKING_NARRATIVE.case_id);
  assert.equal(summary.evidence_session_id, "reference-banking-decision-2026-001");
  const expectedMembers = [
    MEMBER_PATHS.evidence, MEMBER_PATHS.evidenceKey, MEMBER_PATHS.packageKey,
    MEMBER_PATHS.manifest, MEMBER_PATHS.presentation, MEMBER_PATHS.provenance,
    MEMBER_PATHS.verification,
  ].sort();
  assert.deepEqual(walk(f.output), expectedMembers);
  assert.ok(readFileSync(join(f.output, MEMBER_PATHS.evidence)).equals(
    readFileSync(f.paths["--evidence"])), "existing evidence must not be re-sealed or reformatted");
  unchanged(f.inputDir, before);

  const manifest = JSON.parse(readFileSync(join(f.output, MEMBER_PATHS.manifest), "utf8"));
  assert.equal(manifest.source, SOURCE);
  assert.equal(manifest.built_at, BUILT_AT);
  assert.equal(manifest.signing.key_provenance, "operator");
  assert.match(manifest.signing.key_label, /OPERATOR/i);
  assert.match(manifest.signing.key_label, /IDENTITY.*UNVERIFIED/i);
  assert.equal(manifest.supersedes, undefined);
  const fingerprint = createHash("sha256").update(
    f.publicKey.export({ type: "spki", format: "der" })).digest("hex");
  assert.equal(manifest.signing.package_public_key_fingerprint_sha256, fingerprint);
  const { signature, ...unsigned } = manifest;
  assert.equal(cryptoVerify(null, Buffer.from(nodeCanonicalize(unsigned)), f.publicKey,
    Buffer.from(signature, "base64")), true, "independent Node outer signature check");
  const bundle = JSON.parse(readFileSync(join(f.output, MEMBER_PATHS.evidence), "utf8"));
  const publicPem = readFileSync(join(f.output, MEMBER_PATHS.evidenceKey), "utf8");
  assert.equal(verifyBundle(bundle, { publicKey: publicPem }).ok, true);
  const verified = verifyPackageDir(f.output);
  assert.equal(verified.ok, true);
  assert.equal(verified.key_provenance, "operator");
  assert.notEqual(verified.verdict, "VERIFIED_FIXTURE_KEY");
  const cliVerified = run(["verify", "--package", f.output, "--json"]);
  assert.equal(cliVerified.status, 0, cliVerified.stderr);
  assert.equal(JSON.parse(cliVerified.stdout).key_provenance, "operator");
  for (const path of walk(f.output)) {
    assert.doesNotMatch(readFileSync(join(f.output, path), "utf8"), /PRIVATE KEY/, path);
  }
  assert.doesNotMatch(result.stdout + result.stderr + cliVerified.stdout + cliVerified.stderr, /PRIVATE KEY/);
  assert.equal(readdirSync(f.parent).some((path) => path.includes(".tmp-")), false);
}));

test("create-operator is byte-deterministic for the same explicitly supplied inputs", () => withInputs((f) => {
  const other = join(f.parent, "second-package");
  const one = run(f.args());
  const two = run(f.args({ "--output-dir": other }));
  assert.equal(one.status, 0, one.stderr);
  assert.equal(two.status, 0, two.stderr);
  const before = snapshot(f.output);
  unchanged(other, before);
  assert.doesNotMatch(one.stdout + one.stderr + two.stdout + two.stderr, /PRIVATE KEY/);
}));

test("create-operator requires every explicit input and refuses fixture/provenance/supersession flags as usage errors", () => withInputs((f) => {
  const required = [
    ...Object.keys(f.paths), "--source", "--built-at", "--output-dir",
  ];
  for (const flag of required) {
    const result = run(f.args({ [flag]: null }));
    assert.equal(result.status, 2, `${flag}: ${result.stderr}`);
    assert.equal(result.stdout, "");
    assert.equal(existsSync(f.output), false);
  }
  for (const [flag, value] of [
    ["--fixture", "banking"], ["--key-provenance", "production"],
    ["--key-label", "TRUSTED SIGNER"], ["--supersedes", "prior-package"],
  ]) {
    const result = run(f.args({}, [flag, value]));
    assert.equal(result.status, 2, `${flag}: ${result.stderr}`);
    assert.equal(existsSync(f.output), false);
  }
  assert.equal(run(["create-operator", "--narrative"]).status, 2);
  assert.equal(run(f.args({}, ["--source", SOURCE])).status, 2);
  assert.equal(run(["create-operator", "--help"]).status, 0);
}));

test("create-operator refuses missing, malformed, wrong-type and mismatched signing keys without writing output or logging private bytes", () => {
  for (const variant of ["missing-private", "invalid-private", "wrong-type", "invalid-public", "mismatched-pair"]) {
    withInputs((f) => {
      let overrides = {};
      if (variant === "missing-private") overrides = { "--package-private-key": join(f.inputDir, "absent.pem") };
      if (variant === "invalid-private") writeFileSync(f.paths["--package-private-key"], PRIVATE_SENTINEL);
      if (variant === "wrong-type") {
        const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
        writeFileSync(f.paths["--package-private-key"], pair.privateKey.export({ type: "pkcs8", format: "pem" }));
        writeFileSync(f.paths["--package-public-key"], pair.publicKey.export({ type: "spki", format: "pem" }));
      }
      if (variant === "invalid-public") writeFileSync(f.paths["--package-public-key"], PRIVATE_SENTINEL);
      if (variant === "mismatched-pair") {
        const { publicKey } = generateKeyPairSync("ed25519");
        writeFileSync(f.paths["--package-public-key"], publicKey.export({ type: "spki", format: "pem" }));
      }
      const before = snapshot(f.inputDir);
      noNewOutput(f, run(f.args(overrides)));
      unchanged(f.inputDir, before);
    });
  }
});

test("create-operator refuses malformed or unverified evidence, wrong evidence key, malformed narrative and invalid timestamp without output", () => {
  for (const variant of ["malformed-evidence", "tampered-evidence", "wrong-evidence-key", "malformed-narrative", "invalid-timestamp"]) {
    withInputs((f) => {
      let overrides = {};
      if (variant === "malformed-evidence") writeFileSync(f.paths["--evidence"], "{ invalid JSON");
      if (variant === "tampered-evidence") {
        const bundle = JSON.parse(readFileSync(f.paths["--evidence"], "utf8"));
        bundle.events[1].actor = "synthetic-tamper";
        writeFileSync(f.paths["--evidence"], JSON.stringify(bundle));
      }
      if (variant === "wrong-evidence-key") {
        writeFileSync(f.paths["--evidence-public-key"], readFileSync(f.paths["--package-public-key"]));
      }
      if (variant === "malformed-narrative") writeFileSync(f.paths["--narrative"], "{ invalid JSON");
      if (variant === "invalid-timestamp") overrides = { "--built-at": "not-a-timestamp" };
      const before = snapshot(f.inputDir);
      noNewOutput(f, run(f.args(overrides)));
      unchanged(f.inputDir, before);
    });
  }
});

test("create-operator refuses output collisions and replaces only the selected safe output with --force", () => withInputs((f) => {
  mkdirSync(f.output);
  writeFileSync(join(f.output, "keep.txt"), "preexisting output");
  const inputs = snapshot(f.inputDir);
  const output = snapshot(f.output);
  const rejected = run(f.args());
  assert.equal(rejected.status, 3, rejected.stderr);
  unchanged(f.output, output);
  unchanged(f.inputDir, inputs);
  const forced = run(f.args({}, ["--force"]));
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(existsSync(join(f.output, "keep.txt")), false);
  assert.equal(verifyPackageDir(f.output).ok, true);
  unchanged(f.inputDir, inputs);
}));

test("--force refuses to replace any narrative, evidence or signing-key input or its parent output directory", () => {
  for (const flag of ["--narrative", "--evidence", "--evidence-public-key", "--package-private-key", "--package-public-key"]) {
    withInputs((f) => {
      mkdirSync(f.output);
      const protectedPath = join(f.output, flag.slice(2) + ".input");
      writeFileSync(protectedPath, readFileSync(f.paths[flag]), { mode: 0o600 });
      const before = snapshot(f.output);
      const inputBefore = snapshot(f.inputDir);
      const result = run(f.args({ [flag]: protectedPath }, ["--force"]));
      assert.equal(result.status, 3, `${flag}: ${result.stderr}`);
      unchanged(f.output, before);
      unchanged(f.inputDir, inputBefore);
      assert.equal(readdirSync(f.parent).some((path) => path.includes(".tmp-")), false);
    });
  }
  withInputs((f) => {
    const before = snapshot(f.parent);
    const ancestor = run(f.args({ "--output-dir": f.parent }, ["--force"]));
    assert.equal(ancestor.status, 3, ancestor.stderr);
    unchanged(f.parent, before);
    const sameInput = run(f.args({ "--output-dir": f.paths["--package-private-key"] }, ["--force"]));
    assert.equal(sameInput.status, 3, sameInput.stderr);
    unchanged(f.parent, before);
  });
});

test("--force cannot erase signing-key inputs through input or output symlink aliases", () => {
  withInputs((f) => {
    mkdirSync(f.output);
    const protectedKey = join(f.output, "original-private.pem");
    writeFileSync(protectedKey, readFileSync(f.paths["--package-private-key"]), { mode: 0o600 });
    const alias = join(f.inputDir, "private-alias.pem");
    symlinkSync(protectedKey, alias);
    const before = snapshot(f.parent);
    const result = run(f.args({ "--package-private-key": alias }, ["--force"]));
    assert.equal(result.status, 3, result.stderr);
    unchanged(f.parent, before);
    assert.equal(lstatSync(alias).isSymbolicLink(), true);
    assert.equal(readdirSync(f.parent).some((path) => path.includes(".tmp-")), false);
  });
  withInputs((f) => {
    symlinkSync(f.inputDir, f.output, "dir");
    const before = snapshot(f.inputDir);
    const result = run(f.args({}, ["--force"]));
    assert.equal(result.status, 3, result.stderr);
    assert.equal(lstatSync(f.output).isSymbolicLink(), true);
    unchanged(f.inputDir, before);
    assert.equal(readdirSync(f.parent).some((path) => path.includes(".tmp-")), false);
  });
});
