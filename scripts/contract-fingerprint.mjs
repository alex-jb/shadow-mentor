// scripts/contract-fingerprint.mjs
// Single source of truth for the Shadow Lens session contract fingerprint. The fingerprint is
// a sha256 over the CANONICALIZED schema JSON (structure, not whitespace), so any change to the
// contract shape changes it — forcing a deliberate version bump + re-pin instead of silent
// drift between the schema, the TS/C# models, the fixture, the Flow adapter, and the HTTP API.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = join(ROOT, "apps/shadow-lens/contracts/shadow-lens-session.schema.json");

function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

export function contractFingerprint() {
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const version = schema?.properties?.contract_version?.const ?? "unknown";
  const hash = "sha256:" + createHash("sha256").update(canonical(schema)).digest("hex");
  return { version, hash };
}

// The artifacts that MUST agree on the contract_version string.
export const VERSION_SOURCES = [
  ["schema", "apps/shadow-lens/contracts/shadow-lens-session.schema.json", /"contract_version":\s*\{[^}]*"const":\s*"([^"]+)"/],
  ["validate.mjs", "apps/shadow-lens/contracts/validate.mjs", /CONTRACT_VERSION\s*=\s*"([^"]+)"/],
  ["types.ts", "apps/shadow-lens/contracts/types.ts", /CONTRACT_VERSION\s*=\s*"([^"]+)"/],
  ["ShadowLensSession.cs", "apps/shadow-lens/unity/Assets/ShadowLens/Contracts/ShadowLensSession.cs", /Version\s*=\s*"([^"]+)"/],
  ["fixture", "apps/shadow-lens/fixtures/example-session.json", /"contract_version":\s*"([^"]+)"/],
  ["flow", "apps/shadow-lens/flow/export-session.mjs", /generated_from:\s*"([^"]+)"/],
];

export function collectVersions() {
  return VERSION_SOURCES.map(([name, rel, re]) => {
    const m = readFileSync(join(ROOT, rel), "utf8").match(re);
    return { name, version: m?.[1] ?? null };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fp = contractFingerprint();
  console.log("contract_version:", fp.version);
  console.log("fingerprint:", fp.hash);
  for (const v of collectVersions()) console.log(`  ${v.version === fp.version ? "OK  " : "DRIFT"} ${v.name}: ${v.version}`);
}
