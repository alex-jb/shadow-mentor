#!/usr/bin/env node
// Audits Shadow audio assets: sample rate, channels, duration, size, SHA-256, and a clipping/loudness
// heuristic via ffprobe/ffmpeg volumedetect. Writes a report; exits 1 if an asset clips hard. Fixture
// audio is desktop macOS say — labelled, never Beam Pro.
//   node tools/audit-shadow-audio.mjs [dir]
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

const dir = process.argv[2] || "media/voice-v7";
if (!existsSync(dir)) { console.log(`[audio-audit] dir ${dir} not present`); process.exit(0); }
const has = (c) => { try { execFileSync("which", [c], { stdio: "ignore" }); return true; } catch { return false; } };
const ffprobe = has("ffprobe"), ffmpeg = has("ffmpeg");

let clipped = 0;
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".wav"))) {
  const p = join(dir, f);
  const bytes = readFileSync(p);
  const sha = createHash("sha256").update(bytes).digest("hex");
  let sr = "?", ch = "?", dur = "?", maxVol = "?";
  if (ffprobe) {
    try {
      const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "default=nw=1", p], { encoding: "utf8" });
      sr = (out.match(/sample_rate=(\d+)/) || [])[1] || "?";
      ch = (out.match(/channels=(\d+)/) || [])[1] || "?";
      dur = (out.match(/duration=([\d.]+)/) || [])[1] || "?";
    } catch {}
  }
  if (ffmpeg) {
    try {
      const vd = execFileSync("ffmpeg", ["-i", p, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
      maxVol = (vd.match(/max_volume:\s*([-\d.]+) dB/) || [])[1] || "?";
      if (maxVol !== "?" && parseFloat(maxVol) >= 0) clipped++;
    } catch (e) { const s = String(e.stderr || ""); maxVol = (s.match(/max_volume:\s*([-\d.]+) dB/) || [])[1] || "?"; if (maxVol !== "?" && parseFloat(maxVol) >= 0) clipped++; }
  }
  rows.push({ file: f, sample_rate: sr, channels: ch, duration_s: dur, bytes: bytes.length, max_volume_db: maxVol, sha256: sha.slice(0, 16) });
}
console.log("file\tsr\tch\tdur\tbytes\tmaxdB\tsha16");
for (const r of rows) console.log(`${r.file}\t${r.sample_rate}\t${r.channels}\t${r.duration_s}\t${r.bytes}\t${r.max_volume_db}\t${r.sha256}`);
console.log(`[audio-audit] ${rows.length} assets, ${clipped} clipping (max_volume >= 0 dB)`);
process.exit(clipped > 0 ? 1 : 0);
