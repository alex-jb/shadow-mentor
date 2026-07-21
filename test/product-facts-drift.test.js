// Product-facts drift guard: product-facts.json is the single source of truth.
// This test fails the moment a public surface (README / llms.txt / index.html /
// skills/README) drifts from it — the "6 vs 7 vs 11 tools" class of bug, the stale
// "intern mentor / 4 device clients / $982K ACV" narrative, or a regulatory
// mis-statement (SR 11-7 without its SR 26-2 supersession, EU AI Act Art. 14 wrongly
// "replaced" by GDPR Art. 22, or a "certified conformal" over-claim).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const FACTS = JSON.parse(read("product-facts.json"));

test("manifest is internally consistent (tool_count === mcp_tools.length)", () => {
  assert.equal(FACTS.tool_count, FACTS.mcp_tools.length);
  assert.equal(FACTS.council_voice_count, 5);
});

test("the real MCP server exposes exactly tool_count tools", () => {
  const server = read("mcp/server.js");
  const names = [...server.matchAll(/name:\s*"(shadow_[a-z_]+)"/g)].map((m) => m[1]);
  assert.equal(names.length, FACTS.tool_count, `server has ${names.length} tools, manifest says ${FACTS.tool_count}`);
  for (const t of FACTS.mcp_tools) assert.ok(names.includes(t), `manifest tool ${t} not registered in mcp/server.js`);
});

test("llms.txt carries the canonical positioning, not the retired product narrative", () => {
  const llms = read("llms.txt");
  assert.ok(llms.includes("evidence") && /audit/i.test(llms), "llms.txt must describe the evidence/audit layer");
  for (const dead of FACTS.retired_narrative_terms) {
    assert.ok(!llms.includes(dead), `llms.txt still contains retired narrative term: "${dead}"`);
  }
});

test("skills/README + llms.txt state the correct tool count, never 6 or 7", () => {
  for (const p of ["skills/README.md", "llms.txt"]) {
    const s = read(p);
    assert.ok(!/\b(exposes|expose)\s+6\s+tools\b/.test(s), `${p} still claims 6 tools`);
    assert.ok(!/\b(exposes|expose)\s+7\s+tools\b/.test(s), `${p} still claims 7 tools`);
  }
});

test("index.html no longer titles itself 'Intern Mentor'", () => {
  const html = read("index.html");
  assert.ok(!/Intern Mentor/i.test(html.match(/<title>[\s\S]*?<\/title>/i)?.[0] || ""), "index.html <title> still says Intern Mentor");
});

// ── regulatory-discipline corrections (Alex 2026-07-21) ──

test("SR 11-7 never appears as current guidance without its SR 26-2 supersession", () => {
  // Every surface that mentions SR 11-7 must also name SR 26-2 (alias discipline,
  // not deletion). Check the outward-facing / prompt surfaces.
  for (const p of ["llms.txt", "lib/prompts.js"]) {
    const s = read(p);
    if (s.includes("SR 11-7")) assert.ok(s.includes("SR 26-2"), `${p} mentions SR 11-7 but not SR 26-2 (supersession)`);
  }
});

test("EU AI Act Art. 14 and GDPR Art. 22 are both present and complementary (not replaced)", () => {
  const llms = read("llms.txt");
  assert.ok(/EU AI Act Article 14/.test(llms), "EU AI Act Article 14 must remain");
  assert.ok(/GDPR Article 22/.test(llms), "GDPR Article 22 must be present");
  // manifest encodes the complementary relationship, not replacement
  const current = FACTS.regulatory_references.current.map((r) => r.id);
  assert.ok(current.includes("EU AI Act Article 14"));
  assert.ok(current.includes("GDPR Article 22"));
});

test("no outward surface claims production-certified conformal / guaranteed correctness", () => {
  // product-facts.json is exempt — it intentionally *enumerates* these as forbidden_claims.
  for (const p of ["llms.txt", "README.md"]) {
    const s = read(p).toLowerCase();
    assert.ok(!s.includes("guaranteed 90% correctness"), `${p} over-claims conformal certification`);
    assert.ok(!s.includes("certified banking decision"), `${p} over-claims certification`);
  }
  // conformal must be labeled research/pilot in the manifest
  const conf = FACTS.pending_capabilities.find((c) => c.id === "conformal-abstention");
  assert.match(conf.status, /research/i);
});

test("head-directed focus is never described as eye tracking", () => {
  assert.ok(FACTS.forbidden_claims.includes("eye tracking"));
  const hd = FACTS.pending_capabilities.find((c) => c.id === "head-directed-focus");
  assert.ok(/NOT eye tracking/i.test(hd.note));
});
