// Static contract for verify.html (browser artifact, not rendered on the Node host). Guards the
// trust-critical structure: two separate modes, both languages, the honest self-trust boundary,
// and — critically — ZERO external network (no CDN script/link/font, no fetch to an external
// origin, no analytics/telemetry/upload, no eval). The verification LOGIC it inlines is proven by
// the host-tested mirrors (verify-bundle / verify-manifest / safe-json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = readFileSync(join(ROOT, "verify.html"), "utf8");

test("two separate modes exist and are not collapsed to one green state", () => {
  assert.match(H, /VERIFY EVIDENCE/);
  assert.match(H, /VERIFY THE VERIFIER/);
  assert.match(H, /验证证据/);
  assert.match(H, /验证验证器/);
  assert.match(H, /role="tablist"/);
});

test("both languages are embedded (offline single-file)", () => {
  assert.match(H, /"zh-CN"\s*:/, "zh-CN locale must be inlined");
  assert.match(H, /记录完整性/);
  assert.match(H, /Record Integrity/);
});

test("the honest self-trust boundary is present in both languages, not hidden", () => {
  assert.match(H, /ASSETS MATCH SIGNED MANIFEST/);
  assert.match(H, /资源与已签名清单一致/);
  assert.match(H, /INDEPENDENT COMPARISON NOT PERFORMED/);
  assert.match(H, /独立渠道核对尚未执行/);
  assert.match(H, /independent trusted channel/);
  assert.match(H, /独立可信渠道/);
  // must NOT claim self-verified = trusted
  assert.equal(/SELF[- ]VERIFIED\s*=\s*TRUSTED/i.test(H), false);
});

test("the limitations panel states what verification does NOT prove", () => {
  assert.match(H, /the analytical conclusion is correct/);
  assert.match(H, /分析结论一定正确/);
  assert.match(H, /Not judged by this verifier/);
});

test("ZERO external network: no CDN script/link, no external fetch, no analytics/telemetry/upload", () => {
  assert.equal(/<script[^>]+src\s*=/.test(H), false, "no external <script src>");
  assert.equal(/<link[^>]+href\s*=\s*["']https?:/.test(H), false, "no external stylesheet/font <link>");
  assert.equal(/fetch\(\s*["']https?:\/\//.test(H), false, "no fetch to an external origin");
  assert.equal(/googletagmanager|google-analytics|gtag\(|mixpanel|segment|sentry|posthog/i.test(H), false, "no analytics/telemetry SDK");
  assert.equal(/new WebSocket\(/.test(H), false, "no websocket");
  assert.equal(/\bXMLHttpRequest\b/.test(H), false, "no XHR");
  // no upload of the evidence
  assert.equal(/fetch\([^)]*method\s*:\s*["']POST/i.test(H), false, "no POST upload of evidence");
});

test("no eval / dynamic remote code; CSP present and connect-src limited to self", () => {
  assert.equal(/[^.\w]eval\s*\(/.test(H), false, "no eval");
  assert.equal(/new Function\s*\(/.test(H), false, "no Function constructor");
  assert.match(H, /Content-Security-Policy/);
  assert.match(H, /connect-src 'self'/);
  assert.match(H, /default-src 'none'/);
});

test("evidence rendering is escaped + language toggle updates the document language", () => {
  assert.match(H, /function escapeHtml/);
  assert.match(H, /function safeParse/);
  assert.match(H, /document\.documentElement\.lang\s*=/, "must set <html lang> on language switch");
  // real verifier logic is inlined (not a stub)
  assert.match(H, /crypto\.subtle\.verify/);
  assert.match(H, /batch_root/);
});

test("network transparency section reports zero external + no telemetry + local-only", () => {
  assert.match(H, /Network transparency|网络透明度/);
  assert.match(H, /net\.telemetry/);
  assert.match(H, /nothing uploaded|未上传任何内容/);
});
