// The Unity Voice V2 mirror (ShadowVoiceContract.cs) must carry the SAME closed vocabularies + forbidden
// filler as the Node reference (lib/voice/shadow-spoken-utterance.mjs). Parsed from source so the two
// can never silently diverge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LOCALES, ROLES, SEGMENT_ROLES, PROSODY_PROFILES, FORBIDDEN_FILLER } from "../lib/voice/shadow-spoken-utterance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CS = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/ShadowVoiceContract.cs"), "utf8");

function csArray(name) {
  const m = CS.match(new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}`, "m"));
  assert.ok(m, `C# ${name} not found`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

test("Unity ShadowVoiceContract mirrors the Node locale/role/segment-role/prosody sets", () => {
  assert.deepEqual(csArray("Locales"), [...LOCALES]);
  assert.deepEqual(csArray("Roles"), [...ROLES]);
  assert.deepEqual(csArray("SegmentRoles"), [...SEGMENT_ROLES]);
  assert.deepEqual(csArray("ProsodyProfiles"), [...PROSODY_PROFILES]);
});

test("Unity forbidden-filler list matches the Node list exactly", () => {
  assert.deepEqual(csArray("ForbiddenFiller"), [...FORBIDDEN_FILLER]);
});
