// Generates REAL comparison audio for Voice UX V2 using macOS `say` (desktop offline TTS). This is a
// DESKTOP FIXTURE provider — the audio is labelled macOS `say`, NEVER Beam Pro. It renders:
//   - "current": the naive baseline — the raw scenario status/IDs read flat, all at once (the problem
//                the audit found: UI/status text goes straight to Speak()).
//   - "v2": the planner's spoken segments with per-segment rate + pauses (evidence-first, no markdown).
// Output: media/voice-v7/*.wav + SHA256SUMS.txt + manifest.json. Run: node tools/generate-voice-samples.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "./compile-shadow-guided-story.mjs";
import { planUtterance } from "../lib/voice/shadow-speech-planner.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "media/voice-v7");
mkdirSync(OUT, { recursive: true });
const VOICE = { "en-US": "Samantha", "zh-CN": "Tingting" };
const sem = (id) => compile(JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8")), { target: "snapshot" }).semantic;

// naive "current": dump the scenario like UI/status text (IDs, underscores, all statuses, flat).
function currentText(s, scenarioId, locale) {
  const sc = s.scenarios.find((x) => x.id === scenarioId);
  const dims = Object.entries(sc.dimension_status).map(([k, v]) => `${k} ${v}`).join(", ");
  const ents = Object.entries(sc.entity_status).map(([k, v]) => `${k} ${v}`).join(", ");
  return locale === "zh-CN"
    ? `场景 ${sc.id}。信任维度 ${dims}。节点 ${ents}。首个失败 ${sc.first_failure || "无"}。`
    : `Scenario ${sc.id}. Trust dimensions ${dims}. Nodes ${ents}. First failure ${sc.first_failure || "none"}.`;
}

// v2: join planner segments into a `say` string with inline rate + silence commands.
function v2Say(utt) {
  return utt.spoken_segments.map((g) => {
    const wpm = Math.round(175 * g.rate_multiplier);
    return `[[rate ${wpm}]] [[slnc ${g.pause_before_ms}]] ${sanitizeForSay(g.text)} [[slnc ${g.pause_after_ms}]]`;
  }).join(" ");
}
// `say` inline command chars are [[ ]]; strip any stray brackets from text (defence).
function sanitizeForSay(t) { return String(t).replace(/[\[\]]/g, " ").replace(/\s+/g, " ").trim(); }

function render(name, locale, text) {
  const voice = VOICE[locale];
  const aiff = join(OUT, name + ".aiff"), wav = join(OUT, name + ".wav");
  execFileSync("say", ["-v", voice, "-o", aiff, text], { stdio: "ignore" });
  execFileSync("afconvert", [aiff, wav, "-d", "LEI16", "-f", "WAVE"], { stdio: "ignore" });
  rmSync(aiff, { force: true });
  const bytes = readFileSync(wav);
  const sha = createHash("sha256").update(bytes).digest("hex");
  let durationSec = null;
  try { durationSec = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", wav], { encoding: "utf8" }).trim()); } catch { /* optional */ }
  return { name, file: name + ".wav", provider: "macOS say (desktop fixture)", voice, locale, sha256: sha, bytes: bytes.length, durationSec, fixture_status: "FIXTURE-DESKTOP-SAY (not Beam Pro)" };
}

const manifest = [];
function add(name, locale, text, script, semanticSource) {
  const r = render(name, locale, text);
  r.script = script; r.semantic_source = semanticSource;
  manifest.push(r);
  console.log(`${name}: ${r.durationSec ?? "?"}s  ${r.sha256.slice(0, 12)}`);
}

const ac = sem("audit-chain"), pd = sem("persona-deliberation");
const enTamper = planUtterance(ac, "tamper_seq_3", { level: 2, locale: "en-US" });
const zhTamper = planUtterance(ac, "tamper_seq_3", { level: 2, locale: "zh-CN" });

add("en-current", "en-US", currentText(ac, "tamper_seq_3", "en-US"), "naive flat status dump", "audit-chain/tamper_seq_3");
add("en-v2", "en-US", v2Say(enTamper), enTamper.spoken_segments.map((g) => g.text).join(" "), "audit-chain/tamper_seq_3");
add("zh-current", "zh-CN", currentText(ac, "tamper_seq_3", "zh-CN"), "扁平状态直读", "audit-chain/tamper_seq_3");
add("zh-v2", "zh-CN", v2Say(zhTamper), zhTamper.spoken_segments.map((g) => g.text).join(" "), "audit-chain/tamper_seq_3");
add("verification-failure-v2", "en-US", v2Say(planUtterance(ac, "tamper_seq_3", { level: 3, locale: "en-US", quote: "revolving utilization 78% (policy pref <= 30%)" })), "level-3 with verbatim quote", "audit-chain/tamper_seq_3");
add("persona-disagreement-v2", "en-US", v2Say(planUtterance(pd, "disagreement", { level: 2, locale: "en-US", perspective: { id: "RO", label: { en: "Risk Officer", zh: "风险官" } } })), "persona disagreement", "persona/disagreement");
add("abstention-v2", "en-US", v2Say(planUtterance(pd, "abstain", { level: 2, locale: "en-US" })), "abstention preserved", "persona/abstain");
add("tracking-lost-v2", "en-US", "[[rate 165]] Tracking lost. [[slnc 380]] The guided story is preserved and shown flat. [[slnc 200]] Say recenter to retry.", "tracking-lost P0 safety line", "device/tracking_lost");

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(join(OUT, "SHA256SUMS.txt"), manifest.map((m) => `${m.sha256}  ${m.file}`).join("\n") + "\n");
console.log(`wrote ${manifest.length} wav + manifest + SHA256SUMS to media/voice-v7/`);
