// The XREAL+Voice runtime bridge (C#) must map device events to voice behavior per the documented
// contract. Parsed from source so the mapping can't silently drift: tracking-lost is a P0 safety line,
// device-validation-pending never speaks "validated", and the bridge honors the capability guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRIDGE = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceRuntimeBridge.cs"), "utf8");
const PHRASES = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceStablePhrases.cs"), "utf8");

test("bridge maps tracking Lost→TrackingLost and Limited→TrackingLimited", () => {
  assert.match(BRIDGE, /case ShadowTrackingHealth\.Lost:[\s\S]{0,120}TrackingLost/);
  assert.match(BRIDGE, /case ShadowTrackingHealth\.Limited:[\s\S]{0,120}TrackingLimited/);
});

test("tracking-lost is a P0 safety line (interrupts lower-priority narration)", () => {
  assert.match(PHRASES, /TrackingLost[\s\S]{0,200}VoicePriority\.P0/);
});

test("device-validation-pending phrase never says 'validated'", () => {
  const m = PHRASES.match(/DeviceValidationPending[\s\S]{0,400}?One\(/);
  const block = PHRASES.slice(PHRASES.indexOf("DeviceValidationPending"), PHRASES.indexOf("DeviceValidationPending") + 400);
  assert.equal(/validated/i.test(block), false, "the pending phrase must not claim validation");
});

test("bridge gates a DEVICE claim behind the DEVICE_VALIDATED capability", () => {
  assert.match(BRIDGE, /MayClaimDeviceValidated[\s\S]{0,160}ShadowCapability\.DEVICE_VALIDATED/);
});

test("app-pause discards obsolete narration; language-change clears old locale", () => {
  assert.match(BRIDGE, /OnAppPause[\s\S]{0,120}OnPause/);
  assert.match(BRIDGE, /OnLanguageChanged[\s\S]{0,160}ClearLocaleExcept/);
});
