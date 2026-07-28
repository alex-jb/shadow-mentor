// Generate the offline Trust Capsule browser prototype. Self-contained (capsule model inlined from
// the generated tokens), no CDN. Shows the collapsed line + the expanded eight distinct dimensions.
// Deterministic. node scripts/generate-trust-capsule.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildTrustCapsule } from "../lib/trust-capsule.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The honest banking state: integrity verified, correctness NOT_EVALUATED, review recorded,
// approval absent, self-signed, external anchor NOT_EVALUATED.
const capsule = buildTrustCapsule({});

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shadow — Trust Capsule (prototype)</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font:14px/1.5 ui-sans-serif,system-ui,"PingFang SC",sans-serif; background:#0b0f16; color:#e8ecf2; padding:24px; }
  .badge { background:#961418; color:#fff; font-weight:800; padding:3px 10px; border-radius:4px; font-size:12px; }
  .capsule { max-width:520px; margin-top:16px; background:#111826; border:1px solid #202a3a; border-radius:12px; overflow:hidden; }
  .collapsed { display:flex; align-items:center; gap:10px; padding:14px 16px; cursor:pointer; }
  .brand { font-weight:800; letter-spacing:1px; }
  .dot { width:12px; height:12px; border-radius:50%; display:inline-block; }
  .dims { border-top:1px solid #202a3a; padding:6px 0; }
  .dim { display:flex; align-items:center; gap:12px; padding:9px 16px; }
  .dim .sw { width:16px; height:16px; border-radius:4px; border:1px solid rgba(255,255,255,.2); flex:0 0 auto; }
  .dim .l { flex:1; } .dim .k { font-weight:700; } .dim .zh { color:#c4cdd9; font-size:12px; }
  .dim .st { font-size:12px; color:#9aa6b5; text-align:right; }
  .dim .glyph { font-size:11px; color:#8a93a3; }
  .hint { color:#8a93a3; font-size:12px; margin-top:10px; }
</style>
<span class="badge">TRUST CAPSULE PROTOTYPE — NOT DEVICE VALIDATED</span>
<div class="capsule">
  <div class="collapsed" onclick="document.getElementById('d').hidden=!document.getElementById('d').hidden">
    <span class="dot" style="background:${capsule.collapsed.color}"></span>
    <span class="brand">${capsule.collapsed.brand}</span>
    <span>·</span>
    <span id="cl">${capsule.collapsed.label}</span>
    <span style="margin-left:auto;color:#8a93a3">▾ expand</span>
  </div>
  <div class="dims" id="d">${capsule.dimensions.map((x) => `
    <div class="dim">
      <span class="sw" style="background:${x.color}"></span>
      <div class="l"><div class="k">${x.text}</div><div class="zh">${x.label} · ${x.label_zh}</div>
        <div class="glyph">icon: ${x.icon} · shape: ${x.shape} · ${x.color}</div></div>
      <div class="st">${x.text_zh}</div>
    </div>`).join("")}</div>
</div>
<div class="hint">Each dimension is independent — integrity VERIFIED does not imply analytical correctness,
approval, or external anchoring. No single generic green check. Open verifier resolves to the offline
independent verifier. (This prototype does not modify the frozen verify.html.)</div>`;

mkdirSync(join(ROOT, "reports/spatial-ux-v11/trust-capsule"), { recursive: true });
writeFileSync(join(ROOT, "reports/spatial-ux-v11/trust-capsule/index.html"), html);
console.log("wrote reports/spatial-ux-v11/trust-capsule/index.html");
