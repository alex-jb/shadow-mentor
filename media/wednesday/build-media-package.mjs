// Assemble the Wednesday media package: narration scripts, MEDIA_INVENTORY.json, SHA256SUMS.txt,
// README. Deterministic. Run: node media/wednesday/build-media-package.mjs  (from repo root)
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MED = join(ROOT, "media/wednesday");
const SRC_COMMIT = "browser-acceptance 9e0385c (verifier) / capture branch";
mkdirSync(join(MED, "narration"), { recursive: true });
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
function duration(p) { try { return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", p]).toString().trim()); } catch { return null; } }
const w = (rel, s) => writeFileSync(join(MED, rel), s);

// ── narration (honest labels: distinguish integrity vs analytical confidence, fixture vs live, mock vs device) ──
w("narration/full-demo.en.md", `# Full browser demo — narration (EN)

Labels to keep distinct throughout: EVIDENCE INTEGRITY (proven) vs ANALYTICAL CONFIDENCE (not judged) · FIXTURE MODEL (not live) · DESKTOP/BROWSER (not device).

1. This is Shadow Verify, running fully local — no network, no upload.
2. I load a valid evidence bundle. Six *independent* checks: record integrity, signature, hash chain, profile — all VERIFIED; external anchor NOT PRESENT because none was supplied.
3. Note the last row: analytical correctness is *not judged by this verifier*. A green signature proves the record wasn't altered — not that the decision was right.
4. The limitations panel says exactly what verification does and does not prove.
5. Now a tampered bundle: it FAILS, at the exact failed sequence, with the downstream events flagged. Unrelated checks do not turn green.
6. Switch to "Verify the verifier". I load a fixture-signed release manifest. The manifest signature verifies, the assets match — but it still says INDEPENDENT COMPARISON NOT PERFORMED, because you must compare the fingerprint against an independent channel yourself. This is a FIXTURE release key, not production.
7. A tampered manifest shows ASSET MISMATCH with the exact expected and actual hashes — no generic "trusted" badge.
8. Everything works in Simplified Chinese too; the evidence values never change with language.
`);
w("narration/full-demo.zh-CN.md", `# 完整浏览器演示 — 讲解稿（中文）

全程区分：证据完整性（已证明） vs 分析正确性（不判断） · 测试模型（非实时） · 桌面/浏览器（非设备）。

1. 这是 Shadow 验证器，完全本地运行——无网络、不上传。
2. 加载一个有效证据包。六项**独立**检查：记录完整性、数字签名、哈希链、配置档全部已验证；外部锚定因未提供而"不存在"。
3. 注意最后一行：分析正确性"本验证器不作判断"。绿色签名只证明记录未被篡改，不证明决策正确。
4. 限制面板明确写出验证能证明与不能证明什么。
5. 换被篡改的证据包：验证失败，定位到确切失败序号，并标出受影响的下游事件。无关检查不会变绿。
6. 切到"验证验证器"。加载一份测试签名的发布清单。清单签名通过、资源一致——但仍显示"独立渠道核对尚未执行"，因为你必须自己用独立渠道核对指纹。这是测试发布密钥，非生产。
7. 被篡改的清单显示"资源不一致"及确切的期望/实际哈希——没有笼统的"可信"徽章。
8. 简体中文下同样工作；证据数值不随语言改变。
`);
w("narration/short-demo.en.md", `# Short browser demo — narration (EN, ~60s)
Valid evidence → six independent VERIFIED statuses (analytical correctness NOT judged) → tampered evidence FAILS at the exact sequence → Verify the verifier: assets match a FIXTURE-signed manifest, independent comparison not performed → Simplified Chinese, same evidence values.
`);
w("narration/short-demo.zh-CN.md", `# 短版浏览器演示 — 讲解稿（中文，~60s）
有效证据 → 六项独立"已验证"（分析正确性不判断） → 被篡改证据在确切序号失败 → 验证验证器：资源与测试签名清单一致，独立核对尚未执行 → 简体中文，证据数值不变。
`);
const srt = (cues) => cues.map((c, i) => `${i + 1}\n${c[0]} --> ${c[1]}\n${c[2]}\n`).join("\n");
w("narration/full-demo.en.srt", srt([
  ["00:00:00,000", "00:00:12,000", "Shadow Verify — fully local, no network, no upload."],
  ["00:00:12,000", "00:00:30,000", "Valid bundle: record integrity, signature, hash chain, profile all VERIFIED."],
  ["00:00:30,000", "00:00:41,000", "Analytical correctness is NOT judged — a signature proves integrity, not correctness."],
  ["00:00:41,000", "00:00:52,000", "Limitations: what verification does and does not prove."],
  ["00:00:52,000", "00:01:07,000", "Tampered bundle FAILS at the exact sequence; downstream flagged; no false green."],
  ["00:01:07,000", "00:01:23,000", "Verify the verifier: FIXTURE-signed manifest — assets match, but INDEPENDENT COMPARISON NOT PERFORMED."],
  ["00:01:23,000", "00:01:37,000", "Tampered manifest: ASSET MISMATCH with expected/actual hashes — no generic trusted badge."],
  ["00:01:37,000", "00:01:53,000", "Simplified Chinese: same evidence values, localized UI only."],
]));
w("narration/full-demo.zh-CN.srt", srt([
  ["00:00:00,000", "00:00:12,000", "Shadow 验证器——完全本地，无网络，不上传。"],
  ["00:00:12,000", "00:00:30,000", "有效证据包：记录完整性、签名、哈希链、配置档全部已验证。"],
  ["00:00:30,000", "00:00:41,000", "分析正确性不判断——签名只证明完整性，不证明正确。"],
  ["00:00:41,000", "00:00:52,000", "限制面板：验证能证明与不能证明什么。"],
  ["00:00:52,000", "00:01:07,000", "被篡改证据在确切序号失败；下游被标记；无关状态不变绿。"],
  ["00:01:07,000", "00:01:23,000", "验证验证器：测试签名清单——资源一致，但独立渠道核对尚未执行。"],
  ["00:01:23,000", "00:01:37,000", "被篡改清单：资源不一致，显示期望/实际哈希——无笼统可信徽章。"],
  ["00:01:37,000", "00:01:53,000", "简体中文：证据数值不变，仅界面语言本地化。"],
]));

// ── inventory + sums over all media files ──
function walk(dir) { const out = []; for (const n of readdirSync(dir)) { const p = join(dir, n); const s = statSync(p); if (s.isDirectory()) out.push(...walk(p)); else out.push(p); } return out; }
const files = walk(MED).filter((p) => !p.endsWith("build-media-package.mjs"));
const VID = { "shadow-verify-full-demo": { locale: "en+zh-CN", status: "BROWSER-RENDERED / FIXTURE" }, "shadow-verify-short-demo": { locale: "en+zh-CN", status: "BROWSER-RENDERED / FIXTURE" } };
const inv = files.map((p) => {
  const rel = relative(MED, p); const ext = p.split(".").pop();
  const base = rel.split("/").pop().replace(/\.[^.]+$/, "");
  const isVid = ext === "webm" || ext === "mp4";
  return {
    path: "media/wednesday/" + rel, sha256: sha256(p), bytes: statSync(p).size,
    duration_s: isVid ? duration(p) : null, resolution: isVid || ext === "png" ? "1280x720 (doc image 1440x900)" : null,
    source_commit: SRC_COMMIT, capture_tool: isVid || ext === "png" ? "playwright chromium 149.0.7827.55" : "authored",
    locale: VID[base]?.locale ?? (rel.includes("zh") ? "zh-CN" : "en"),
    status: VID[base]?.status ?? (ext === "png" ? "BROWSER-RENDERED / FIXTURE" : "authored"),
  };
});
w("MEDIA_INVENTORY.json", JSON.stringify({ generated_note: "deterministic; regenerate with build-media-package.mjs", browser: "MEDIA GENERATED", unity: "CAPTURE HARNESS READY (video needs Unity Recorder + one click)", files: inv }, null, 2) + "\n");
w("SHA256SUMS.txt", files.map((p) => `${sha256(p)}  ${relative(MED, p)}`).sort().join("\n") + "\n");

w("README.md", `# media/wednesday

Wednesday demo media. **Browser: MEDIA GENERATED. Unity: CAPTURE HARNESS READY** (video needs the
Unity Recorder package + Alex's one click; screenshots via the Editor menu).

- \`browser/shadow-verify-full-demo.{webm,mp4}\` — ~113s, 1280x720, EN+中文, Chromium 149, FIXTURE-signed.
- \`browser/shadow-verify-short-demo.{webm,mp4}\` — ~64s fast fallback.
- \`browser/screenshots/\` — 01–09 (EN+中文 valid/tampered/verifier-valid/verifier-mismatch + limitations) + a 1440x900 doc image. (10-claim-graph / 11-ingest-audit are NOT in verify.html — those are Unity/artifact features, intentionally not captured here.)
- \`unity/\` — run \`Shadow Lens → Capture Wednesday Demo Media\` in the Unity editor (screenshots via built-in ScreenCapture; add \`com.unity.recorder\` for video).
- \`narration/\` — EN + 中文 scripts + SRT. Silent clean video + narration script is acceptable; no synthetic voice generated.

Regenerate this package: \`node media/wednesday/build-media-package.mjs\`. Verify: \`shasum -a 256 -c SHA256SUMS.txt\` (from media/wednesday).
All videos are BROWSER-RENDERED / FIXTURE-signed — NOT device-validated, NOT production-signed.
`);
console.log("media package built:", files.length, "files");
