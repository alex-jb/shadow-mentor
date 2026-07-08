// test/skill-evals-contract.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the evals.json contract shipped 2026-07-08 for Shadow v1.5.18.
// Every skill directory under skills/shadow-* MUST ship evals.json
// with trigger.positive[] + trigger.negative[] + expectations[].
//
// Adopted from addyosmani/agent-skills evals framework. Ensures the
// skill catalog stays procurement-defensible: routing correctness +
// regulatory-string assertions surface at CI time, not in Claude
// Desktop after a bank installs the wrong voice.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILLS_ROOT = resolve(__dirname, "..", "skills");

function loadSkills() {
  const entries = readdirSync(SKILLS_ROOT);
  const skills = [];
  for (const name of entries) {
    if (!name.startsWith("shadow-")) continue;
    const dir = join(SKILLS_ROOT, name);
    const s = statSync(dir);
    if (!s.isDirectory()) continue;
    skills.push({
      name,
      dir,
      skill_md: join(dir, "SKILL.md"),
      evals_json: join(dir, "evals.json"),
    });
  }
  return skills;
}

const SKILLS = loadSkills();

test("at least 9 shadow-* skill directories exist", () => {
  assert.ok(SKILLS.length >= 9, `found ${SKILLS.length}`);
});


// ═══════════════════════════════════════════════════════════════
// Presence + JSON validity per skill
// ═══════════════════════════════════════════════════════════════

for (const skill of SKILLS) {
  test(`${skill.name}: SKILL.md exists`, () => {
    assert.ok(existsSync(skill.skill_md));
  });

  test(`${skill.name}: evals.json exists (v1.5.18+ requirement)`, () => {
    assert.ok(existsSync(skill.evals_json), `${skill.evals_json} missing`);
  });

  test(`${skill.name}: evals.json is valid JSON`, () => {
    const raw = readFileSync(skill.evals_json, "utf8");
    assert.doesNotThrow(() => JSON.parse(raw));
  });
}


// ═══════════════════════════════════════════════════════════════
// evals.json contract shape per skill
// ═══════════════════════════════════════════════════════════════

for (const skill of SKILLS) {
  test(`${skill.name}: evals.json has required top-level fields`, () => {
    const evals = JSON.parse(readFileSync(skill.evals_json, "utf8"));
    assert.equal(evals.skill, skill.name, `evals.skill should match directory name`);
    assert.ok(evals.version, "version field required");
    assert.ok(evals.trigger, "trigger field required");
    assert.ok(Array.isArray(evals.trigger.positive), "trigger.positive must be array");
    assert.ok(Array.isArray(evals.trigger.negative), "trigger.negative must be array");
    assert.ok(Array.isArray(evals.expectations), "expectations must be array");
  });

  test(`${skill.name}: trigger.positive has at least 3 entries`, () => {
    const evals = JSON.parse(readFileSync(skill.evals_json, "utf8"));
    assert.ok(
      evals.trigger.positive.length >= 3,
      `only ${evals.trigger.positive.length} positive triggers`
    );
    for (const t of evals.trigger.positive) {
      assert.ok(typeof t.prompt === "string" && t.prompt.length > 10, "trigger prompt too short");
      assert.ok(typeof t.reason === "string", "trigger reason required");
    }
  });

  test(`${skill.name}: trigger.negative has at least 3 entries`, () => {
    const evals = JSON.parse(readFileSync(skill.evals_json, "utf8"));
    assert.ok(
      evals.trigger.negative.length >= 3,
      `only ${evals.trigger.negative.length} negative triggers — cross-persona routing risk`
    );
    for (const t of evals.trigger.negative) {
      assert.ok(typeof t.prompt === "string" && t.prompt.length > 10, "trigger prompt too short");
      // owner is optional (null allowed for "no other skill owns this")
      assert.ok("owner" in t || t.reason, "negative trigger needs owner or reason");
    }
  });

  test(`${skill.name}: expectations has at least 2 entries`, () => {
    const evals = JSON.parse(readFileSync(skill.evals_json, "utf8"));
    assert.ok(
      evals.expectations.length >= 2,
      `only ${evals.expectations.length} expectations`
    );
    for (const e of evals.expectations) {
      assert.ok(e.when, "expectation.when required");
      assert.ok(e.reason, "expectation.reason required");
      const hasContent =
        e.must_contain ||
        e.must_not_contain ||
        Array.isArray(e.must_contain_any) ||
        Array.isArray(e.must_contain_all) ||
        Array.isArray(e.must_not_contain_any);
      assert.ok(hasContent, `expectation "${e.when}" needs at least one must_contain* rule`);
    }
  });
}


// ═══════════════════════════════════════════════════════════════
// Cross-persona routing collision check
// ═══════════════════════════════════════════════════════════════

test("negative triggers name only registered skill names as owners", () => {
  const knownSkills = new Set(SKILLS.map((s) => s.name));
  for (const skill of SKILLS) {
    const evals = JSON.parse(readFileSync(skill.evals_json, "utf8"));
    for (const t of evals.trigger.negative) {
      if (t.owner === null || t.owner === undefined) continue;
      assert.ok(
        knownSkills.has(t.owner),
        `${skill.name} negative trigger names owner "${t.owner}" which is not a shipped skill`,
      );
    }
  }
});

test("compliance-officer excludes AML flag scenarios (BSA §5318(g)(2) routing invariant)", () => {
  const evals = JSON.parse(
    readFileSync(
      join(SKILLS_ROOT, "shadow-compliance-officer", "evals.json"),
      "utf8"
    )
  );
  const routesToAML = evals.trigger.negative.some(
    (t) => t.owner === "shadow-aml-kyc-investigator"
  );
  assert.ok(
    routesToAML,
    "compliance-officer MUST have a negative trigger routing AML-flag prompts to aml-kyc-investigator"
  );
});

test("size-position refuses direction queries (named invariant #1)", () => {
  const evals = JSON.parse(
    readFileSync(
      join(SKILLS_ROOT, "shadow-size-position", "evals.json"),
      "utf8"
    )
  );
  const refusesDirection = evals.trigger.negative.some(
    (t) => /buy or sell|is .* a buy|predict .* price/i.test(t.prompt)
  );
  assert.ok(refusesDirection, "size-position must refuse direction queries");
});
