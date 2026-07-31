#!/usr/bin/env node
// scripts/build-verify-mockup.mjs
// Design mockup for the thin-scope VERIFY screen (the trust hero + the examiner/
// skeptic surface). Self-contained: inlines the real sample bundle + pubkey and the
// SAME corrected verifier the demo uses (extracted from build-adverse-action-demo.mjs
// — no 4th verifier copy), so the four honest degrees actually fire in-browser.
// Radix Blue system per docs/APP_DESIGN_BRIEF_2026-07-30 §3; hallmark disciplines.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const R = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = resolve(R, "demos/adverse-action");
const bundle = readFileSync(resolve(D, "sample-bundle.json"), "utf8").trim();
const pubkey = readFileSync(resolve(D, "sample-bundle.pub.pem"), "utf8").trim();

// Reuse the corrected VERIFY_JS verbatim from the demo build (single source of truth).
const demoSrc = readFileSync(resolve(R, "scripts/build-adverse-action-demo.mjs"), "utf8");
const VERIFY_JS = demoSrc.match(/const VERIFY_JS = `([\s\S]*?)`;/)[1];

const OUT = resolve(D, "verify-mockup");

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow Verify — check a decision record yourself, offline</title>
<meta name="description" content="Drop a Shadow evidence bundle and verify it yourself — offline, no account. Green means the signature and hash-chain hold and the decision rebinds to what was signed; red names the exact step that was altered."/>
<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<style>
/* Design mockup — production intends Inter (UI) + JetBrains Mono (hashes/keys/IDs);
   offline-safe system fallbacks here. One accent (Radix Blue), hairlines not shadows,
   mono carries every machine-verifiable value, tabular figures on every number. */
:root{
  --bg:#FCFCFD; --surface:#FFF; --sunken:#F6F7F9;
  --border-subtle:#ECEDEF; --border:#DDE0E4; --border-strong:#C4C8CE;
  --t1:#14161A; --t2:#565C63; --t3:#878D95;
  --accent:#3E63DD; --accent-hover:#3452C4; --accent-bg:#EDF2FE;
  --ok:#1A7F37; --ok-bg:#E6F4EA; --fail:#B42318; --fail-bg:#FDECEA;
  --warn:#9A6700; --warn-bg:#FFF8E1; --neutral:#565C63; --neutral-bg:#F0F1F3;
  --radius:6px; --radius-sm:4px;
  --sans:-apple-system,"Inter","Segoe UI",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  --pop:0 1px 2px rgba(20,22,26,.06),0 8px 24px rgba(20,22,26,.10);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0C0D10; --surface:#141619; --sunken:#0F1013;
  --border-subtle:#1F2227; --border:#2A2E35; --border-strong:#3A3F47;
  --t1:#EBEDF0; --t2:#9AA1AB; --t3:#6B7178;
  --accent:#7B85E0; --accent-hover:#8B94E6; --accent-bg:#1A1D33;
  --ok:#3FB950; --ok-bg:#12261A; --fail:#F85149; --fail-bg:#2A1615;
  --warn:#D29922; --warn-bg:#26200E; --neutral:#9AA1AB; --neutral-bg:#1C1F24;
  --pop:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.5);
}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{overflow-x:clip}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);
  font-feature-settings:"tnum" 1,"cv05" 1;line-height:1.5;-webkit-font-smoothing:antialiased}
.tnum{font-variant-numeric:tabular-nums}
.mono{font-family:var(--mono);font-variant-ligatures:none}
.wrap{max-width:940px;margin:0 auto;padding:40px 24px 72px}
/* asymmetric header — not centered */
header{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--border-subtle);padding-bottom:18px;margin-bottom:26px}
.wordmark{font-size:15px;font-weight:640;letter-spacing:-.01em}
.wordmark b{color:var(--accent)}
.role{font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.lede{max-width:620px;margin-bottom:26px}
.lede h1{font-size:22px;font-weight:640;letter-spacing:-.015em;margin-bottom:8px}
.lede p{font-size:14px;color:var(--t2)}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:760px){.grid{grid-template-columns:minmax(0,1fr)}}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px}
.panel h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:12px}
.drop{border:1px dashed var(--border-strong);border-radius:var(--radius);background:var(--sunken);
  padding:22px 16px;text-align:center;color:var(--t2);font-size:13px}
.drop .cta{color:var(--accent);font-weight:600;cursor:pointer}
.controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.btn{font:inherit;font-size:13px;font-weight:560;height:32px;padding:0 13px;border-radius:var(--radius);
  border:1px solid var(--border);background:var(--surface);color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn:hover{border-color:var(--border-strong)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent-hover)}
.btn.ghost{background:transparent}
.hint{font-size:11.5px;color:var(--t3);margin-top:10px}
.hint b{color:var(--ok);font-weight:600}
/* result banner — the emotional peak. left rail + tint, one line + mono detail. */
.banner{border-radius:var(--radius);border:1px solid var(--border);border-left-width:3px;
  padding:12px 14px;margin-bottom:14px;display:none}
.banner.show{display:block}
.banner .head{font-size:14px;font-weight:620;display:flex;align-items:center;gap:8px}
.banner .sub{font-size:12px;margin-top:4px}
.banner.ok{background:var(--ok-bg);border-left-color:var(--ok)} .banner.ok .head{color:var(--ok)}
.banner.warn{background:var(--warn-bg);border-left-color:var(--warn)} .banner.warn .head{color:var(--warn)}
.banner.fail{background:var(--fail-bg);border-left-color:var(--fail)} .banner.fail .head{color:var(--fail)}
.banner.grey{background:var(--neutral-bg);border-left-color:var(--neutral)} .banner.grey .head{color:var(--neutral)}
.banner .sub, .banner .sub .mono{color:var(--t2)}
/* inspector — the badge is a door */
.inspector{margin-top:12px;border-top:1px solid var(--border-subtle);padding-top:12px;display:none}
.inspector.show{display:block}
.row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12.5px;border-bottom:1px solid var(--border-subtle)}
.row:last-child{border-bottom:0}
.row .k{color:var(--t3)} .row .v{color:var(--t1);text-align:right;min-width:0;overflow-wrap:anywhere}
.plain{font-size:11.5px;color:var(--t3);margin-top:2px}
.hashatom{cursor:copy;border-bottom:1px dotted var(--border-strong)}
.hashatom:hover{color:var(--accent)}
.diff{margin-top:10px;font-size:11.5px}
.diff .lbl{color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-size:10.5px;font-weight:600}
.diff .exp{color:var(--ok)} .diff .got{color:var(--fail)}
.recover{margin-top:10px;font-size:12px;color:var(--t2);background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px}
.recover b{color:var(--t1)}
.net{margin-top:20px;font-size:11.5px;color:var(--t3);display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:14px}
.net b{color:var(--ok)}
.limits{font-size:11.5px;color:var(--t3);margin-top:8px;line-height:1.6}
.foot{margin-top:26px;font-size:11.5px;color:var(--t3);line-height:1.6}
.foot a{color:var(--accent);text-decoration:none}
.critique{margin-top:20px;font-size:10.5px;color:var(--t3);font-family:var(--mono)}
</style></head>
<body>
<div class="wrap">
  <header>
    <span class="wordmark">🛡 <b>Shadow</b> Verify</span>
    <span class="role">independent · offline · no account</span>
  </header>

  <div class="lede">
    <h1>Check a decision record yourself.</h1>
    <p>Drop a Shadow evidence bundle. This page verifies the Ed25519 signature and the hash-chain, and rebinds the decision to what was signed — locally, in your browser. We can't see the result, and you don't have to trust us for it.</p>
  </div>

  <div class="grid">
    <div class="panel">
      <h2>Evidence bundle</h2>
      <div class="drop" id="drop">
        Drop a <span class="mono">bundle.json</span> here, or <span class="cta" id="browse">choose a file</span>.<br>
        <span style="font-size:11.5px;color:var(--t3)">A synthetic denied-loan bundle is already loaded so you can try it.</span>
      </div>
      <div class="controls">
        <button class="btn primary" id="verify">Verify — runs offline in your browser</button>
        <button class="btn ghost" id="tamper">Tamper: flip the verdict</button>
        <button class="btn ghost" id="rotate">Simulate a rotated key</button>
        <button class="btn ghost" id="malform">Drop a non-bundle</button>
        <button class="btn ghost" id="reset" style="display:none">Reset</button>
      </div>
      <div class="hint">The whole value is this button. <b>Nothing leaves this page</b> — the check uses only the file and the public key.</div>
    </div>

    <div class="panel">
      <h2>Result</h2>
      <div class="banner" id="banner">
        <div class="head" id="bhead"></div>
        <div class="sub" id="bsub"></div>
      </div>
      <div class="inspector" id="inspector"></div>
      <div id="idle" style="font-size:13px;color:var(--t3)">Press <b style="color:var(--t2)">Verify</b> to check the loaded record.</div>
    </div>
  </div>

  <div class="net">
    <span>External requests (expected: <b>0</b>)</span><span>Telemetry <b>disabled</b></span><span>Uploaded evidence <b>none — processed locally</b></span>
  </div>
  <div class="limits">
    <b style="color:var(--t2)">Verification proves</b> the record wasn't altered after signing — the signature, the chain, and that the shown decision rebinds to its hash.
    It does <b style="color:var(--t2)">not</b> prove the decision was correct, the source was truthful, or the workflow was lawful.
  </div>

  <div class="foot">
    Independent + open-source (MIT). Same verifier as the CLI a bank runs in its own CI (<span class="mono">npx shadow-verify bundle.json --public-key k.pem</span>) — verify entirely outside us. · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a>
  </div>
  <div class="critique">Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 — mockup for docs/APP_DESIGN_BRIEF §3 (Verify screen, thin scope)</div>
</div>

<script>
const PUBKEY=${JSON.stringify(pubkey)};
const CLEAN=${bundle};
${VERIFY_JS}

const $=id=>document.getElementById(id);
let working=JSON.parse(JSON.stringify(CLEAN));
let mode="clean"; // clean | tamper | rotate | malform
const trunc=h=>h?h.slice(0,10)+"…"+h.slice(-6):"—";
async function keyFingerprint(pem){
  // sha256 of the SPKI DER, shown as short hex groups (Keybase-style, out-of-band comparable)
  try{const der=pemToSpki(pem);const d=await crypto.subtle.digest("SHA-256",der);
    const hex=[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
    return hex.slice(0,16).replace(/(.{4})/g,"$1 ").trim();}catch(e){return "unavailable";}
}
function hashAtom(full){const s=document.createElement("span");s.className="mono hashatom";s.textContent=trunc(full);
  s.title="click to copy";s.onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(full);s.textContent="copied ✓";setTimeout(()=>s.textContent=trunc(full),900);};return s;}
function set(cls,head,subHtml){const b=$("banner");$("idle").style.display="none";
  b.className="banner show "+cls;$("bhead").textContent=head;$("bsub").innerHTML=subHtml;}
function inspector(rows){const box=$("inspector");box.className="inspector show";box.innerHTML="";
  rows.forEach(([k,v,plain])=>{const r=document.createElement("div");r.className="row";
    const kk=document.createElement("span");kk.className="k";kk.textContent=k;
    const vv=document.createElement("span");vv.className="v";
    if(v instanceof Node)vv.appendChild(v);else vv.innerHTML=v;
    r.appendChild(kk);r.appendChild(vv);box.appendChild(r);
    if(plain){const p=document.createElement("div");p.className="plain";p.textContent=plain;box.appendChild(p);}});}
function clearInspector(){const box=$("inspector");box.className="inspector";box.innerHTML="";}

async function run(){
  clearInspector();
  if(mode==="malform"){
    set("grey","● Not a verifiable Shadow record",
      "This file isn't a signed Shadow evidence bundle (missing <span class='mono'>bundle_version</span> / <span class='mono'>events</span>). Nothing to accuse — check you dropped the right file.");
    $("reset").style.display="inline-block";return;
  }
  const r=await verifyBundle(working,PUBKEY);
  const fp=await keyFingerprint(PUBKEY);
  if(!r.ok){
    set("fail","✕ Verification failed",
      "<span class='mono'>"+r.reason+(r.seq!=null?" @ seq "+r.seq:"")+"</span> — the record was altered after signing.");
    const box=$("inspector");box.className="inspector show";
    box.innerHTML="<div class='diff'><div class='lbl'>at seq "+(r.seq)+" — the decision below no longer hashes to what was signed</div>"+
      "<div class='mono exp'>signed&nbsp;&nbsp;&nbsp;"+trunc(working.events[r.seq]&&working.events[r.seq].payload_hash)+"</div>"+
      "<div class='mono got'>recomputed  (edited plaintext) — mismatch</div></div>"+
      "<div class='recover'><b>Next step.</b> Re-ingest this decision from your system of record, flag it for review, or export this failure — a detected tamper is itself defensible evidence.</div>";
    $("reset").style.display="inline-block";return;
  }
  if(mode==="rotate"){
    set("warn","⚠ Signature valid — signing key unconfirmed",
      "The chain and signature hold, but this bundle was signed with a key whose fingerprint doesn't match the one you pinned for this lender. Confirm the key rotated (not substituted) before you rely on it.");
    inspector([
      ["signed by key", "<span class='mono'>prod-2026-Q2</span>"],
      ["you pinned", "<span class='mono'>prod-2026-Q3</span>", "fingerprints differ — verify the rotation out-of-band"],
    ]);
    $("reset").style.display="inline-block";return;
  }
  // clean → the full green with source_resolution VERIFIED
  const verified = r.sourceResolution==="VERIFIED";
  set("ok","✓ Signature valid · chain intact",
    "<span class='mono'>Ed25519 · key "+(r.keyId||"?")+" · verified just now, in your browser</span>"+
    (verified?" — the decision rebinds to the signed hash.":""));
  inspector([
    ["source resolution", verified?"<span style='color:var(--ok);font-weight:600'>VERIFIED</span>":"NOT_PRESENT",
      verified?"every event's plaintext rebinds to its signed hash — you're verifying the content you can see":"content is hash-only"],
    ["key fingerprint", "<span class='mono'>"+fp+"</span>", "compare out-of-band against the lender's published key"],
    ["batch root", hashAtom(r.batchRoot)],
    ["algorithm", "Ed25519 signature over a SHA-256 hash chain"],
  ]);
  $("reset").style.display="inline-block";
}

$("verify").onclick=()=>{mode="clean";working=JSON.parse(JSON.stringify(CLEAN));run();};
$("tamper").onclick=()=>{mode="tamper";working=JSON.parse(JSON.stringify(CLEAN));
  const ev=working.events.find(e=>e.payload&&e.payload.kind==="council_verdict");if(ev)ev.payload.final_verdict="approve";run();};
$("rotate").onclick=()=>{mode="rotate";working=JSON.parse(JSON.stringify(CLEAN));run();};
$("malform").onclick=()=>{mode="malform";working={not:"a bundle"};run();};
$("reset").onclick=()=>{mode="clean";working=JSON.parse(JSON.stringify(CLEAN));
  $("banner").className="banner";clearInspector();$("idle").style.display="block";$("reset").style.display="none";};
$("browse").onclick=()=>alert("Mockup: file picker wires to the same verifier. A dropped bundle replaces the loaded one.");
</script>
</body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "index.html"), html);
console.log("[build] demos/adverse-action/verify-mockup/index.html  (Verify screen mockup — Radix Blue, four honest degrees, reuses the corrected verifier)");
