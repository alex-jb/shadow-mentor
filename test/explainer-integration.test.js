// Explainer docs/demo integration: the landing, the guided demo, and the non-frozen Verify companion
// embed the three explainers safely (sandboxed same-origin iframes, no autoplay, no external runtime),
// with the postMessage contract origin/type-allowlisted, bilingual, accessible, and honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EMBED_PROTOCOL, EXPLAINER_IDS, PARENT_TO_CHILD, CHILD_TO_PARENT, validateMessage } from "../demos/shadow-embed-protocol.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const LAND = read("demos/shadow-explainer-landing.html");
const GUIDED = read("demos/guided-shadow-demo.html");
const VERIFY = read("verify-explainers.html");
const ALL = [["landing", LAND], ["guided", GUIDED], ["verify-companion", VERIFY]];

test("the three explainers exist, in order, and their posters exist", () => {
  for (const p of ["apps/shadow-lens/explainers/audit-chain.html", "demos/animations/reason-code-attestation.html", "demos/animations/persona-deliberation.html"]) assert.ok(existsSync(join(ROOT, p)), p);
  for (const p of ["demos/posters/audit-chain.png", "demos/posters/reason-code.png", "demos/posters/persona-deliberation.png"]) assert.ok(existsSync(join(ROOT, p)), p);
  const order = [...LAND.matchAll(/"(audit-chain|reason-code|persona-deliberation)"/g)].map((m) => m[1]);
  assert.equal(order[0], "audit-chain");
  assert.ok(order.includes("reason-code") && order.includes("persona-deliberation"));
});

test("each surface labels itself a FIXTURE demonstration and never overclaims", () => {
  for (const [name, H] of ALL) {
    assert.ok(/FIXTURE|测试数据/.test(H), `${name} missing fixture label`);
    // strip negated disclaimers ("not a production banking system") before scanning for affirmative overclaims
    const s = H.replace(/not a production banking system|并非生产银行系统|不证明|does not|not device-validated|非设备验证/gi, "");
    assert.equal(/\bFULLY COMPLIANT\b|\bDEVICE VALIDATED\b|\bAI CORRECTNESS VERIFIED\b|>\s*PRODUCTION BANKING SYSTEM/i.test(s), false, `${name} overclaims`);
  }
});

test("landing has proves / does-not-prove for each explainer", () => {
  assert.match(LAND, /WHAT THIS PROVES/); assert.match(LAND, /WHAT THIS DOES NOT PROVE/);
  assert.match(LAND, /能证明什么/); assert.match(LAND, /不能证明什么/);
  assert.ok((LAND.match(/proves:/g) || []).length >= 3, "a proves line per explainer");
  assert.ok((LAND.match(/not:/g) || []).length >= 3, "a does-not-prove line per explainer");
});

test("no autoplay, no external URL/CDN/analytics/telemetry in any surface", () => {
  for (const [name, H] of ALL) {
    assert.equal(/autoplay|setInterval\([^,]*,\s*0\s*\)/i.test(H) && !/no auto-advance|no autoplay|不自动/i.test(H) ? /autoplay/i.test(H) : false, false, `${name} autoplay`);
    // actual external references only (not the honest "no CDN / no analytics" disclaimer prose)
    assert.equal(/(src|href)\s*=\s*["']https?:\/\/(?!127\.0\.0\.1)|unpkg\.com|jsdelivr\.net|cdnjs\.|googleapis\.com|google-analytics\.com|gtag\s*\(|mixpanel\.|segment\.(io|com)|sentry\.io/i.test(H), false, `${name} external/analytics`);
    assert.equal(/[^.\w]eval\s*\(|new Function\s*\(/.test(H), false, `${name} eval`);
  }
});

test("iframes are sandboxed, titled, lazy, same-origin, without top-nav/popups/forms", () => {
  for (const [name, H] of ALL) {
    const iframes = [...H.matchAll(/setAttribute\("sandbox",\s*"([^"]*)"\)|sandbox="([^"]*)"/g)].map((m) => m[1] || m[2]);
    assert.ok(iframes.length >= 1, `${name} has a sandboxed iframe`);
    for (const s of iframes) {
      assert.ok(/allow-scripts/.test(s), `${name} sandbox has allow-scripts`);
      assert.equal(/allow-top-navigation|allow-popups|allow-forms|allow-same-origin/.test(s), false, `${name} unsafe sandbox: ${s}`);
    }
    assert.match(H, /\.title\s*=|title="/, `${name} iframe title`);
    assert.match(H, /loading\s*=\s*"lazy"|\.loading\s*=\s*"lazy"/, `${name} lazy`);
  }
});

test("postMessage contract: allowlisted protocol/ids/types; origin + source + payload validated", () => {
  assert.equal(EMBED_PROTOCOL, "shadow-explainer-embed-v1");
  const origin = "http://127.0.0.1:8080";
  const good = { origin, source: {}, data: { protocol: EMBED_PROTOCOL, explainer_id: "audit-chain", message_type: "READY", payload: { step: 0 } } };
  assert.equal(validateMessage(good, { allowedOrigins: [origin], expectedSource: good.source }).ok, true);
  // rejects: bad origin, bad source, bad protocol, unknown explainer, non-allowlisted type, unsafe payload
  assert.equal(validateMessage({ ...good, origin: "https://evil.example" }, { allowedOrigins: [origin] }).reason, "bad-origin");
  assert.equal(validateMessage(good, { allowedOrigins: [origin], expectedSource: {} }).reason, "bad-source");
  assert.equal(validateMessage({ origin, data: { protocol: "x", explainer_id: "audit-chain", message_type: "READY" } }, { allowedOrigins: [origin] }).reason, "bad-protocol");
  assert.equal(validateMessage({ origin, data: { protocol: EMBED_PROTOCOL, explainer_id: "ghost", message_type: "READY" } }, { allowedOrigins: [origin] }).reason, "unknown-explainer");
  assert.equal(validateMessage({ origin, data: { protocol: EMBED_PROTOCOL, explainer_id: "audit-chain", message_type: "EVAL_NOW" } }, { allowedOrigins: [origin] }).reason, "type-not-allowlisted");
  assert.equal(validateMessage({ origin, data: { protocol: EMBED_PROTOCOL, explainer_id: "audit-chain", message_type: "READY", payload: { x: "<script>alert(1)</script>" } } }, { allowedOrigins: [origin] }).reason, "unsafe-payload");
  assert.equal(validateMessage({ origin, data: { protocol: EMBED_PROTOCOL, explainer_id: "audit-chain", message_type: "READY", payload: "javascript:alert(1)" } }, { allowedOrigins: [origin] }).reason, "unsafe-payload");
  // the allowlists are the documented ones
  assert.ok(PARENT_TO_CHILD.includes("PLAY") && CHILD_TO_PARENT.includes("COMPLETED"));
  assert.deepEqual(EXPLAINER_IDS, ["audit-chain", "reason-code", "persona-deliberation"]);
});

test("the landing message handler never acts on an unvalidated payload (no innerHTML/eval from message)", () => {
  // the handler must call validateMessage and return early on !ok, never touching innerHTML/eval with data
  assert.match(LAND, /validateMessage\(event/);
  assert.match(LAND, /if\s*\(!v\.ok\)\s*return/);
  assert.equal(/event\.data[\s\S]{0,80}(innerHTML|eval|Function)/.test(LAND), false, "no direct use of message data in a sink");
});

test("bilingual + accessibility: EN/zh parity, skip link, Esc close, focus return, aria", () => {
  for (const [name, H] of ALL) {
    assert.ok(/lang-en|LANG\s*=\s*"en"/.test(H) && /中文/.test(H), `${name} bilingual`);
    assert.match(H, /document\.documentElement\.lang\s*=/, `${name} sets <html lang>`);
  }
  assert.match(LAND, /class="skip"/); assert.match(LAND, /Escape[\s\S]{0,40}closeDemo/); assert.match(LAND, /opener\.focus\(\)/);
  assert.match(LAND, /aria-live/);
  assert.match(VERIFY, /role="tablist"/); assert.match(VERIFY, /aria-selected/);
});

test("network transparency stated; frozen verifier referenced read-only (not overwritten)", () => {
  assert.match(LAND, /External requests: 0|外部请求:\s*0/);
  assert.match(VERIFY, /src="verify\.html"/, "verify companion embeds the real verifier by reference");
  // the surfaces that touch the verifier/package state it is not modified
  for (const [name, H] of [["landing", LAND], ["verify-companion", VERIFY]]) assert.match(H, /frozen[\s\S]{0,60}not modified|不修改冻结|冻结验证器包未改|frozen verifier package unmodified/i, `${name} states frozen-not-modified`);
});
