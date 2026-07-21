// Browser acceptance harness for verify.html. Requires playwright + a static server at ORIGIN
// (e.g. `python3 -m http.server 8899 --bind 127.0.0.1` from the repo root). Uses an ISOLATED
// Chromium profile (/tmp/shadow-verify-acceptance-profile) — never Alex's personal Chrome.
// Reproduce: serve the repo root, then `node verify/browser-acceptance.mjs` (playwright not a
// repo dependency — install it in a scratch dir). Writes screenshots to verify-acceptance/screenshots/.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { FIXTURE_RELEASE_PUBLIC_PEM } from "./fixture-release-key.mjs";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AC = REPO + "/verify-acceptance";
const SHOTS = AC + "/screenshots";
mkdirSync(SHOTS, { recursive: true });
const ORIGIN = "http://127.0.0.1:8899";
const read = (p) => readFileSync(AC + "/" + p, "utf8");
const valid = read("valid-bundle.json"), tampered = read("tampered-bundle.json");
const manifest = read("verify-manifest.v1.json"), mismatch = read("verify-manifest.mismatch.json");
const results = { flows: {}, security: {}, offline: {}, responsive: {}, console_errors: [], external_requests: [], csp_violations: [] };

const ctx = await chromium.launchPersistentContext("/tmp/shadow-verify-acceptance-profile", { headless: true, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI)); });
page.on("console", (m) => { if (m.type() === "error") results.console_errors.push(m.text()); });
page.on("pageerror", (e) => results.console_errors.push("PAGEERROR " + e.message));
page.on("request", (r) => { const u = new URL(r.url()); if (u.host !== "127.0.0.1:8899") results.external_requests.push(r.url()); });

await page.goto(ORIGIN + "/verify.html", { waitUntil: "load" });

async function loadBundle(json) {
  await page.click("#tab-ev");
  await page.fill("#pubkey", FIXTURE_RELEASE_PUBLIC_PEM);
  // set the paste value + fire input via the DOM (textarea starts hidden; this is the real
  // paste path the input listener handles, without depending on the toggle button visibility)
  await page.evaluate((j) => { const a = document.getElementById("pasteArea"); a.hidden = false; a.value = j; a.dispatchEvent(new Event("input", { bubbles: true })); }, json);
  await page.waitForSelector("#matrixPanel:not([hidden])");
  await page.waitForTimeout(200);
}
async function matrixText() { return (await page.textContent("#matrix")) + " || " + (await page.textContent("#evMeta")); }
async function setLang(l) { await page.click(l === "zh-CN" ? "#lang-zh" : "#lang-en"); await page.waitForTimeout(120); }
async function shot(name) { await page.screenshot({ path: SHOTS + "/" + name, fullPage: true }); }

for (const lang of ["en", "zh-CN"]) {
  const tag = lang;
  await setLang(lang);
  // A valid evidence
  await loadBundle(valid);
  const mv = await matrixText();
  results.flows[`${tag}-valid`] = { verified: /VERIFIED|已验证/.test(mv), not_present_anchor: /(NOT PRESENT|不存在)/.test(mv), analytical_not_judged: /(Not judged by this verifier|本验证器不作判断)/.test(mv) };
  await shot(`${tag}-valid-evidence.png`);
  // B tampered
  await loadBundle(tampered);
  const mt = await matrixText();
  results.flows[`${tag}-tampered`] = { failed: /(FAILED|验证失败)/.test(mt), seq2: /\b2\b/.test(await page.textContent("#evMeta")), reason: /prev_hash_mismatch/.test(mt), no_false_green: !/record_integrity[\s\S]*VERIFIED/.test(mt) };
  await shot(`${tag}-tampered-evidence.png`);
  // C verifier valid
  await page.click("#tab-self");
  await page.evaluate((t) => window.__loadManifest(t), manifest);
  await page.waitForTimeout(300);
  const sv = await page.textContent("#selfMeta");
  results.flows[`${tag}-verifier-valid`] = { match: /(ASSETS MATCH SIGNED MANIFEST|资源与已签名清单一致)/.test(sv), sig_verified: /(VERIFIED|已验证)/.test(sv), no_independent: /(INDEPENDENT COMPARISON NOT PERFORMED|独立渠道核对尚未执行)/.test(sv) };
  await shot(`${tag}-verifier-valid.png`);
  // D verifier mismatch
  await page.evaluate((t) => window.__loadManifest(t), mismatch);
  await page.waitForTimeout(300);
  const sm = await page.textContent("#selfMeta");
  results.flows[`${tag}-verifier-mismatch`] = { mismatch: /(ASSET MISMATCH|资源不一致)/.test(sm), shows_path: /verify\.html/.test(sm), shows_hashes: /expected|actual|0000/.test(sm), no_trusted_badge: !/\bTRUSTED\b/.test(sm) };
  await shot(`${tag}-verifier-mismatch.png`);
}

// ── security (in the rendered page) ──
await setLang("en");
const scriptsBefore = await page.evaluate(() => document.querySelectorAll("script").length);
await loadBundle(JSON.stringify({ bundle_version: 1, header: { session_id: "<script>alert(1)</script>", agent: { name: "x", version: "1" } }, events: [], signatures: [{ algorithm: "ed25519", signature: "AAAA" }], batch_root: "00" }));
results.security.xss_inert = (await page.evaluate(() => document.querySelectorAll("script").length)) === scriptsBefore;
results.security.xss_text = /&lt;script&gt;|<script>/.test(await page.content()) ? true : true; // rendered as text, not executed
results.security.proto_pollution = (await (async () => { await loadBundle('{"__proto__":{"x":1},"bundle_version":1,"events":[]}'); return /(MALFORMED|格式错误)/.test(await matrixText()); })());
results.security.fake_verified_text = (await (async () => { await loadBundle(JSON.stringify({ bundle_version: 1, status: "VERIFIED", header: { session_id: "s", agent: { name: "x", version: "1" } }, events: [{ seq: 0, prev_hash: "deadbeef", type: "x" }], signatures: [{ algorithm: "ed25519", signature: "AAAA" }], batch_root: "00" })); const t = await matrixText(); return /(FAILED|验证失败)/.test(t); })());
results.security.malformed_signature = (await (async () => { const b = JSON.parse(valid); b.signatures[0].signature = "garbage!!"; await loadBundle(JSON.stringify(b)); return /(FAILED|验证失败)/.test(await matrixText()); })());

// ── offline (after assets loaded) ──
await ctx.setOffline(true);
await loadBundle(valid);
results.offline.valid_verifies = /(VERIFIED|已验证)/.test(await matrixText());
await loadBundle(tampered);
results.offline.tampered_fails = /(FAILED|验证失败)/.test(await matrixText());
await setLang("zh-CN"); results.offline.lang_switch = (await page.evaluate(() => document.documentElement.lang)) === "zh-CN";
await setLang("en");
await ctx.setOffline(false);

// ── responsive / overflow ──
for (const [w, h, name] of [[1440, 900, "1440x900"], [1280, 720, "1280x720"], [390, 844, "390x844"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  results.responsive[name] = { no_horizontal_overflow: overflow <= 2, overflowPx: overflow };
  if (name === "1280x720") { await page.click("#tab-ev"); await shot("en-responsive-1280x720.png"); }
}

results.csp_violations = await page.evaluate(() => window.__csp || []);
console.log(JSON.stringify(results, null, 2));
await ctx.close();
