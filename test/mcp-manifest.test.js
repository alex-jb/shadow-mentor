// v1.5.12 — MCP manifest SBOM contract tests.
// Guards: canonical tool list matches mcp/server.js, hashes are deterministic,
// endpoint returns shape a bank SIEM can consume.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildManifest } from "../api/mcp-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

test("buildManifest returns 11 tools (v2.2.0 adds shadow_banking_profile to the manifest)", () => {
  const m = buildManifest();
  assert.equal(m.tool_count, 11);
  assert.equal(m.tools.length, 11);
});

test("buildManifest tools include all 11 canonical Shadow MCP tools", () => {
  const m = buildManifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "shadow_banking_profile",
    "shadow_calibration",
    "shadow_disparity",
    "shadow_loan_council",
    "shadow_loan_council_typed",
    "shadow_recall",
    "shadow_risk_tools",
    "shadow_scenarios",
    "shadow_size_position",
    "shadow_traceability",
    "shadow_verify_attestation",
  ]);
});

test("buildManifest tool hashes are deterministic across two builds", () => {
  const m1 = buildManifest();
  const m2 = buildManifest();
  for (let i = 0; i < m1.tools.length; i++) {
    assert.equal(
      m1.tools[i].hash_sha256,
      m2.tools[i].hash_sha256,
      `tool ${m1.tools[i].name} hash should be deterministic`,
    );
  }
});

test("buildManifest tool hashes are 64-char hex", () => {
  const m = buildManifest();
  for (const tool of m.tools) {
    assert.match(tool.hash_sha256, /^[0-9a-f]{64}$/);
  }
});

test("buildManifest returns manifest_hash_sha256 in 64-char hex", () => {
  const m = buildManifest();
  assert.match(m.manifest_hash_sha256, /^[0-9a-f]{64}$/);
});

test("buildManifest exposes generated_at_utc as ISO 8601", () => {
  const m = buildManifest();
  const parsed = new Date(m.generated_at_utc);
  assert.equal(parsed.toString() !== "Invalid Date", true);
  assert.equal(m.generated_at_utc, parsed.toISOString());
});

test("buildManifest carries mcp_protocol_version", () => {
  const m = buildManifest();
  assert.ok(m.mcp_protocol_version, "mcp_protocol_version required");
  assert.match(m.mcp_protocol_version, /^\d{4}-\d{2}-\d{2}$/);
});

test("buildManifest tools include regulatoryScope + determinismClaim", () => {
  const m = buildManifest();
  for (const tool of m.tools) {
    assert.ok(Array.isArray(tool.regulatoryScope), `${tool.name} regulatoryScope`);
    assert.ok(tool.determinismClaim, `${tool.name} determinismClaim`);
    assert.equal(
      tool.determinismClaim,
      "no-llm-inside-tool",
      "Shadow's MCP tools never call an LLM inside the tool body",
    );
  }
});

test("manifest carries NO invented latency numbers (unmeasured p50/p95 removed 2026-07-29)", () => {
  // An SBOM designed for contract-pinning must not contain fabricated
  // measurements; latencyPercentiles were hardcoded, never measured.
  for (const tool of buildManifest().tools) {
    assert.ok(!("latencyPercentiles" in tool), `${tool.name} must not carry invented latency numbers`);
  }
});

test("canonical tool list in api/mcp-manifest.js includes shadow_verify_attestation (added v1.5.1)", () => {
  const m = buildManifest();
  const verify = m.tools.find((t) => t.name === "shadow_verify_attestation");
  assert.ok(verify, "shadow_verify_attestation should be in the manifest");
  assert.ok(
    verify.description.toLowerCase().includes("attestation") &&
      verify.description.toLowerCase().includes("verify"),
    "description should mention attestation + verify",
  );
});

test("manifest and mcp/server.js agree on the EXACT tool-name set (bidirectional)", () => {
  // One-way checks let the server grow a 11th/12th tool the manifest never
  // lists — exactly the silent drift the manifest_hash pitch promises to
  // prevent (shadow_banking_profile drifted unlisted until 2026-07-29).
  const src0 = readFileSync(join(REPO_ROOT, "mcp", "server.js"), "utf-8");
  const serverNames = new Set([...src0.matchAll(/name: "(shadow_[a-z_]+)"/g)].map((m) => m[1]));
  const manifestNames = new Set(buildManifest().tools.map((t2) => t2.name));
  assert.deepEqual(
    [...manifestNames].sort(),
    [...serverNames].sort(),
    "manifest tool set must equal mcp/server.js tool set exactly",
  );
});

test("mcp/server.js source contains every manifest tool name", () => {
  // Rough parity check — if mcp/server.js drops a tool, this test catches
  // the drift so the manifest stays honest.
  const src = readFileSync(join(REPO_ROOT, "mcp", "server.js"), "utf-8");
  const canonicalNames = [
    "shadow_loan_council",
    "shadow_risk_tools",
    "shadow_recall",
    "shadow_calibration",
    "shadow_scenarios",
    "shadow_traceability",
    "shadow_verify_attestation",
    "shadow_size_position",
  ];
  for (const name of canonicalNames) {
    assert.ok(
      src.includes(`name: "${name}"`),
      `mcp/server.js should define ${name}`,
    );
  }
});
