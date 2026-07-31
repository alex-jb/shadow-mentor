#!/usr/bin/env node
// scripts/build-adverse-action-demo.mjs
// Generates the self-contained "see a verified adverse-action decision" worked
// example (demos/adverse-action/try/index.html) by inlining the sample application,
// the examiner report, the signed bundle, and the public key — plus the same
// WebCrypto verifyBundle the shipped verify.html uses. Runs offline, no network,
// no build framework. Regenerate after re-running bin/shadow-adverse-action.mjs.
//
//   node scripts/build-adverse-action-demo.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BROWSER_VERIFY_JS as VERIFY_JS } from "../packages/attest-core/verify-bundle.browser.mjs";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const R = (...p) => resolve(ROOT, ...p);
const D = R("demos", "adverse-action");

const application = readFileSync(resolve(D, "sample-denied-application.json"), "utf8").trim();
const report = readFileSync(resolve(D, "sample-report.md"), "utf8");
const bundle = readFileSync(resolve(D, "sample-bundle.json"), "utf8").trim();
const pubkey = readFileSync(resolve(D, "sample-bundle.pub.pem"), "utf8").trim();

// The browser verifier is the single shared source in packages/attest-core (imported above).

// naive markdown → HTML (headings, bold, list, paragraphs) — enough for the report.
const mdToHtml = (md) => md.split("\n").map((l) => {
  if (l.startsWith("### ")) return `<h4>${esc(l.slice(4))}</h4>`;
  if (l.startsWith("## ")) return `<h3>${esc(l.slice(3))}</h3>`;
  if (l.startsWith("# ")) return `<h2>${esc(l.slice(2))}</h2>`;
  if (l.startsWith("- ")) return `<li>${bold(esc(l.slice(2)))}</li>`;
  if (l.trim() === "") return "";
  return `<p>${bold(esc(l))}</p>`;
}).join("\n");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bold = (s) => s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*([^*]+)\*/g, "<em>$1</em>");

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow — a verified adverse-action decision</title>
<meta name="description" content="See one AI-denied loan turned into an examiner-ready Reg B / ECOA §1002.9(b)(2) adverse-action report bound into a signed, tamper-evident evidence bundle — and verify it yourself, offline, in your browser."/>
<style>
  :root{color-scheme:light dark;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;line-height:1.5;color:#17212b;background:#f6f8fa;padding:28px 18px 60px;}
  @media(prefers-color-scheme:dark){body{color:#dfe7ef;background:#0b0f15;}}
  .wrap{max-width:820px;margin:0 auto;}
  h1{font-size:24px;letter-spacing:-.3px;margin-bottom:4px;}
  .sub{color:#5b6b7a;font-size:14px;margin-bottom:20px;}
  .card{background:#fff;border:1px solid #dbe3ea;border-radius:12px;padding:18px 20px;margin:14px 0;}
  @media(prefers-color-scheme:dark){.card{background:#121824;border-color:#232f3d;}}
  .card h2{font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:#12766a;margin-bottom:8px;}
  pre{background:#0d1117;color:#c9d5e1;border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:12.5px;line-height:1.5;}
  code{font-family:ui-monospace,Menlo,monospace;background:rgba(120,140,160,.15);padding:0 4px;border-radius:3px;font-size:.92em;}
  .report h2{font-size:16px;color:inherit;text-transform:none;letter-spacing:0;margin:2px 0 6px;}
  .report h3{font-size:13px;color:#12766a;margin:14px 0 3px;}
  .report h4{font-size:13.5px;margin:12px 0 2px;}
  .report p{margin:5px 0;font-size:13.5px;} .report li{margin:3px 0 3px 18px;font-size:13.5px;}
  .btn{font:inherit;font-weight:600;font-size:15px;border:0;border-radius:9px;padding:12px 20px;cursor:pointer;margin:4px 8px 4px 0;}
  .btn.go{background:#12a594;color:#04120f;} .btn.tamper{background:transparent;color:#b45309;border:1px solid #d8a24a;}
  .btn.reset{background:transparent;color:#8a93a3;border:1px solid #33414f;}
  #status{margin-top:12px;font-weight:650;font-size:16px;padding:12px 14px;border-radius:9px;display:none;}
  #status.ok{display:block;background:#e3f5ee;color:#12766a;border:1px solid #b9e3d5;}
  #status.fail{display:block;background:#fde7e4;color:#b42318;border:1px solid #f3b7ad;}
  @media(prefers-color-scheme:dark){#status.ok{background:#0e2a22;} #status.fail{background:#2a1210;}}
  .foot{margin-top:22px;color:#7b8896;font-size:12px;line-height:1.7;}
  .hi{color:#12a594;} a{color:#3b82f6;}
</style></head>
<body><div class="wrap">
<h1>See a verified adverse-action decision</h1>
<div class="sub">One AI-denied loan → an examiner-ready Reg&nbsp;B / ECOA §1002.9(b)(2) report → a signed record you verify yourself, offline. Nothing is uploaded; this page runs entirely in your browser.</div>

<div class="card">
  <h2>1 · The AI-denied application (input)</h2>
  <pre id="app"></pre>
</div>

<div class="card report" id="report">
  <h2>2 · The examiner-ready adverse-action report (output)</h2>
</div>

<div class="card">
  <h2>3 · The signed evidence record — verify it yourself</h2>
  <p style="font-size:13.5px;margin-bottom:10px;color:#5b6b7a">The decision above is bound into an Ed25519-signed, hash-chained bundle. Verify it here — offline, no trust in Shadow — then tamper with it and watch it break.</p>
  <button class="btn go" id="verify">Verify the record</button>
  <button class="btn tamper" id="tamper">Tamper: flip the verdict</button>
  <button class="btn reset" id="reset" style="display:none">Reset</button>
  <div id="status"></div>
</div>

<div class="foot">
  Independent + open-source (MIT). Same WebCrypto verifier as <code>verify.html</code>; same CLI a bank runs in its own CI (<code>bin/shadow-verify.mjs</code>). Ephemeral demo signing key. <span class="hi">Verification proves the record wasn't altered — not that the underlying decision is correct.</span> · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a>
</div>
</div>

<script>
const APPLICATION=${application};
const PUBKEY=${JSON.stringify(pubkey)};
const CLEAN_BUNDLE=${bundle};
${VERIFY_JS}
document.getElementById("app").textContent=JSON.stringify(APPLICATION,null,2);
document.getElementById("report").insertAdjacentHTML("beforeend",\`${mdToHtml(report).replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`);

let working=JSON.parse(JSON.stringify(CLEAN_BUNDLE));
const statusEl=document.getElementById("status");
async function run(){
  const r=await verifyBundle(working,PUBKEY);
  if(r.ok){statusEl.className="ok";statusEl.textContent="✓ Record verified — signature + hash-chain intact (key "+(r.keyId||"?")+")."+(r.sourceResolution==="VERIFIED"?" The decision above rebinds to the signed hash — it is exactly what was sealed.":"");}
  else{statusEl.className="fail";statusEl.textContent="✗ Verification FAILED — "+r.reason+(r.seq!=null?" @ seq "+r.seq:"")+". The record was altered after signing; it can no longer be trusted.";}
  document.getElementById("reset").style.display=working===CLEAN_BUNDLE?"none":"inline-block";
}
document.getElementById("verify").onclick=run;
document.getElementById("tamper").onclick=async()=>{
  working=JSON.parse(JSON.stringify(CLEAN_BUNDLE));
  // The realistic attack: edit the human-readable verdict BLOCK→APPROVE and leave the
  // signature + hash-chain untouched. Only the payload→hash rebind catches it — the
  // whole point of a signed record that actually carries what it attests.
  const ev=working.events.find(e=>e.payload&&e.payload.kind==="council_verdict");
  if(ev)ev.payload.final_verdict="approve";
  await run();
  document.getElementById("reset").style.display="inline-block";
};
document.getElementById("reset").onclick=()=>{working=JSON.parse(JSON.stringify(CLEAN_BUNDLE));statusEl.style.display="none";statusEl.className="";document.getElementById("reset").style.display="none";};
</script>
</body></html>`;

mkdirSync(resolve(D, "try"), { recursive: true });
writeFileSync(resolve(D, "try", "index.html"), html);
console.log("[build] demos/adverse-action/try/index.html  (self-contained, offline, verifies in-browser)");
