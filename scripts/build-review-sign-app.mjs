#!/usr/bin/env node
// scripts/build-review-sign-app.mjs
// The REAL working review-and-sign app (not a static mockup): the officer edits the notice
// prose, and on sign-off the page SEALS a real evidence bundle IN THE BROWSER (fresh Ed25519
// key, no server, nothing leaves the machine — Shadow's local-first thesis), then verifies the
// freshly-sealed bundle and offers it for download. The upstream council draft is deterministic
// (inlined at build time); everything from the officer's edit → seal → verify is real crypto.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewAdverseAction } from "../lib/adverse-action-review.js";
import { BROWSER_SEAL_JS } from "../packages/attest-core/seal-bundle.browser.mjs";
import { BROWSER_VERIFY_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

const R = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = resolve(R, "demos/adverse-action");
const application = JSON.parse(readFileSync(resolve(D, "sample-denied-application.json"), "utf8"));
const draft = reviewAdverseAction(application, { draft: true, nowIso: "2026-07-13T14:02:00.000Z" });
const DRAFT = {
  application,
  verdict: draft.verdict,
  codes: draft.adverseActionCodes.map((c) => (typeof c === "string" ? { code: c } : c)),
  notices: draft.notices.map((n) => ({ code: n.code, label: n.label || "", text: typeof n.notice === "string" ? n.notice : (n.notice && n.notice.text) || "" })),
  voices: (draft.council.voices || []).map((v) => ({ voice: v.voice || v.name, verdict: v.vote || v.verdict, rationale: v.rationale || "" })),
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cards = DRAFT.notices.map((n, i) => `
  <div class="rcard" data-code="${esc(n.code)}" data-i="${i}">
    <div class="rtop"><span class="code mono">${esc(n.code)}</span><span class="rlabel">${esc(n.label)}</span><span class="state grounded" data-state>grounded</span></div>
    <label class="nlbl">Principal reason — §1002.9(b)(2) notice text <span class="ai">AI-drafted · editable</span></label>
    <textarea class="notice" data-orig="${esc(n.text)}">${esc(n.text)}</textarea>
  </div>`).join("");

const OUT = resolve(D, "review-sign-app");
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow — review &amp; sign (working)</title>
<meta name="description" content="Edit the Reg B adverse-action notice and sign off — the record is sealed with real Ed25519 crypto in your browser, verified on the spot, and downloadable. Nothing leaves your machine."/>
<style>
:root{--bg:#FCFCFD;--surface:#FFF;--sunken:#F6F7F9;--border-subtle:#ECEDEF;--border:#DDE0E4;--border-strong:#C4C8CE;--t1:#14161A;--t2:#565C63;--t3:#878D95;--accent:#3E63DD;--accent-hover:#3452C4;--accent-bg:#EDF2FE;--ok:#1A7F37;--ok-bg:#E6F4EA;--fail:#B42318;--fail-bg:#FDECEA;--warn:#9A6700;--warn-bg:#FFF8E1;--radius:6px;--radius-sm:4px;--sans:-apple-system,"Inter","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;}
@media (prefers-color-scheme:dark){:root{--bg:#0C0D10;--surface:#141619;--sunken:#0F1013;--border-subtle:#1F2227;--border:#2A2E35;--border-strong:#3A3F47;--t1:#EBEDF0;--t2:#9AA1AB;--t3:#6B7178;--accent:#7B85E0;--accent-hover:#8B94E6;--accent-bg:#1A1D33;--ok:#3FB950;--ok-bg:#12261A;--fail:#F85149;--fail-bg:#2A1615;--warn:#D29922;--warn-bg:#26200E;}}
*{margin:0;padding:0;box-sizing:border-box}html,body{overflow-x:clip}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);line-height:1.5;-webkit-font-smoothing:antialiased}
.mono{font-family:var(--mono)}.tnum{font-variant-numeric:tabular-nums}
.wrap{max-width:1140px;margin:0 auto;padding:20px 22px 64px}
header{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:14px;margin-bottom:16px}
.wordmark{font-size:15px;font-weight:640}.wordmark b{color:var(--accent)}
.role{font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.live{margin-left:auto;font-size:11px;color:var(--ok);background:var(--ok-bg);border:1px solid var(--ok);border-radius:20px;padding:2px 9px;font-weight:600}
.band{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px}
.band .id{font-weight:640;font-size:15px}.band .id .mono{font-size:13px;color:var(--t2);font-weight:400}
.decision{font-size:12px;font-weight:640;color:var(--fail);background:var(--fail-bg);border:1px solid var(--fail);border-radius:var(--radius-sm);padding:2px 8px}
.sig{display:flex;gap:14px;margin-left:auto;font-size:12.5px;color:var(--t2)}.sig b{color:var(--t1)}
.clock{font-size:12px;font-weight:600;color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn);border-radius:20px;padding:2px 10px}
.steps{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;font-size:12px}
.step{display:flex;align-items:center;gap:6px;color:var(--t3);padding:4px 10px;border:1px solid var(--border-subtle);border-radius:20px}
.step .dot{width:7px;height:7px;border-radius:50%;background:var(--border-strong)}
.step.done{color:var(--ok)}.step.done .dot{background:var(--ok)}.step.active{color:var(--accent);border-color:var(--accent)}.step.active .dot{background:var(--accent)}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start}
@media (max-width:900px){.cols{grid-template-columns:minmax(0,1fr)}}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.panel h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:12px;display:flex;justify-content:space-between}
.detnote{font-size:11.5px;color:var(--t3);margin:-4px 0 14px;background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:7px 10px}.detnote b{color:var(--t2)}
.rcard{border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px}.rcard.edited{border-color:var(--accent)}
.rtop{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.code{font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-bg);border-radius:var(--radius-sm);padding:1px 7px}
.rlabel{font-size:13px;font-weight:560;flex:1;min-width:0}
.state{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;padding:1px 7px;border-radius:var(--radius-sm)}
.state.grounded{color:var(--ok);background:var(--ok-bg)}.state.edited{color:var(--accent);background:var(--accent-bg)}
.nlbl{display:block;font-size:11px;color:var(--t3);margin-bottom:5px}.nlbl .ai{color:var(--accent);margin-left:4px}
.notice{width:100%;min-height:80px;font:inherit;font-size:12.5px;color:var(--t1);background:var(--sunken);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;resize:vertical;line-height:1.5}
.notice:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
.actions{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:14px}
.btn{font:inherit;font-size:13px;font-weight:560;height:34px;padding:0 15px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);color:var(--t1);cursor:pointer}
.btn:hover{border-color:var(--border-strong)}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{background:var(--accent-hover)}.btn.primary:disabled{opacity:.5;cursor:not-allowed}
.btn.danger{color:var(--fail);border-color:var(--fail)}.btn.ghost{background:transparent}
.rail{position:sticky;top:18px;display:flex;flex-direction:column;gap:14px}
.banner{border-radius:var(--radius);border:1px solid var(--border);border-left-width:3px;padding:12px 14px}
.banner .h{font-size:13.5px;font-weight:620;display:flex;align-items:center;gap:7px}.banner .s{font-size:11.5px;margin-top:4px;color:var(--t2)}
.banner.idle{border-left-color:var(--border-strong)}.banner.idle .h{color:var(--t3)}
.banner.ok{background:var(--ok-bg);border-left-color:var(--ok)}.banner.ok .h{color:var(--ok)}
.banner.fail{background:var(--fail-bg);border-left-color:var(--fail)}.banner.fail .h{color:var(--fail)}
.banner.dispute{background:var(--warn-bg);border-left-color:var(--warn)}.banner.dispute .h{color:var(--warn)}
.rail h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:8px}
.railpanel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.kv{font-size:11.5px;color:var(--t2);word-break:break-all}.kv .mono{color:var(--t1)}.kv .row{padding:3px 0;border-bottom:1px solid var(--border-subtle)}.kv .row:last-child{border-bottom:0}
.foot{margin-top:22px;font-size:11px;color:var(--t3);line-height:1.6}.foot a{color:var(--accent);text-decoration:none}
</style></head>
<body><div class="wrap">
  <header><span class="wordmark">🛡 <b>Shadow</b></span><span class="role">review &amp; sign · adverse action</span><span class="live">● live · seals in your browser</span></header>

  <div class="band">
    <span class="id">Application <span class="mono">${esc(application.application_id)}</span></span>
    <span class="decision">DENIED</span><span class="clock">18 days to ECOA notice</span>
    <span class="sig tnum">FICO <b>${application.credit_score}</b> · DTI <b>${application.debt_to_income}</b> · LTV <b>${application.loan_to_value}</b> · model <b class="mono" style="font-weight:600">loan-council v1</b></span>
  </div>
  <div class="steps" id="steps">
    <span class="step done"><span class="dot"></span>Reasons cited</span>
    <span class="step active" data-step="notice"><span class="dot"></span>Notice drafted</span>
    <span class="step" data-step="signed"><span class="dot"></span>Signed off</span>
    <span class="step" data-step="ready"><span class="dot"></span>Examiner-ready</span>
  </div>

  <div class="cols">
    <div class="panel">
      <h2><span>Principal reasons · Reg B / ECOA §1002.9(b)(2)</span><span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">${DRAFT.notices.length} of ≤4</span></h2>
      <div class="detnote">The <b>DENIED</b> verdict is deterministic policy and is <b>not editable</b> — only the notice prose. When you sign off, the AI's original draft <b>and</b> your edited final are <b>both sealed</b>, so the change is part of the record.</div>
      ${cards}
      <div class="actions">
        <button class="btn primary" id="sign">Sign off &amp; seal the record</button>
        <button class="btn danger" id="dispute">Dispute / return to model team</button>
      </div>
    </div>

    <div class="rail">
      <div class="banner idle" id="banner"><div class="h" id="bh">◷ Not yet sealed</div><div class="s" id="bs">Edit the notices, then sign off. The record is sealed with Ed25519 + a hash-chain right here in your browser — this is the exact bytes your examiner re-verifies offline.</div></div>
      <div class="railpanel" id="proof" style="display:none">
        <h3>Sealed record</h3>
        <div class="kv" id="kv"></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn ghost" id="download">Download bundle</button>
          <button class="btn ghost" id="tamper">Tamper (demo)</button>
          <button class="btn ghost" id="reset">Reset</button>
        </div>
      </div>
    </div>
  </div>
  <div class="foot">Independent + open-source (MIT). Real Ed25519 seal in-browser · nothing uploaded. Re-verify the downloaded bundle offline: <span class="mono">npx shadow-verify bundle.json --public-key key.pem</span> or open <code>verify.html</code>. · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a></div>
</div>

<script>
const DRAFT=${JSON.stringify(DRAFT)};
// Each module is wrapped in its own IIFE — they share internal const helper names
// (cbytes/seedHash/signedShape/…), which would collide in one shared scope.
const { sealBundle } = (function(){ ${BROWSER_SEAL_JS} return { sealBundle }; })();
const { verifyBundle } = (function(){ ${BROWSER_VERIFY_JS} return { verifyBundle }; })();
const $=id=>document.getElementById(id);
let sealed=null, pub=null;
const trunc=h=>h?h.slice(0,12)+"…"+h.slice(-8):"—";
document.querySelectorAll(".notice").forEach(t=>t.addEventListener("input",()=>{
  const c=t.closest(".rcard");const was=t.value!==t.getAttribute("data-orig");
  c.classList.toggle("edited",was);const s=c.querySelector("[data-state]");s.textContent=was?"edited":"grounded";s.className="state "+(was?"edited":"grounded");
}));
function collect(){return [...document.querySelectorAll(".rcard")].map(c=>{
  const code=c.getAttribute("data-code");const t=c.querySelector(".notice");
  return {code, orig:t.getAttribute("data-orig"), final:t.value, edited:t.value!==t.getAttribute("data-orig")};});}
function step(n,cls){const el=document.querySelector('[data-step="'+n+'"]');if(el)el.className="step "+cls;}

async function seal(decision, disputeNote){
  const n=collect();const now="2026-07-13T14:02:00.000Z";
  const events=[
    {event_type:"session_start",actor:"system",payload:{kind:"adverse_action_signoff",application_id:DRAFT.application.application_id}},
    {event_type:"user_message",actor:"user",payload:{kind:"credit_application",application:DRAFT.application}},
    {event_type:"model_output",actor:"model",payload:{kind:"council_verdict",final_verdict:DRAFT.verdict,adverse_action_codes:DRAFT.codes,voices:DRAFT.voices}},
    {event_type:"tool_result",actor:"tool",payload:{kind:"ai_drafted_notices",language:"en",notices:n.map(x=>({code:x.code,notice:{text:x.orig}}))}},
    {event_type:"tool_result",actor:"tool",payload:{kind:"officer_final_notices",language:"en",edited_codes:n.filter(x=>x.edited).map(x=>x.code),notices:n.map(x=>({code:x.code,notice:{text:x.final},edited:x.edited}))}},
    {event_type:"human_approval",actor:"user",payload:{kind:"sign_off",decision,officer:"j.doe (demo)",dispute_note:disputeNote||null,signed_at_utc:now}},
  ];
  const res=await sealBundle({agent:{name:"shadow-adverse-action",version:"1.0.0"},environmentFingerprint:{os:navigator.platform||"browser",node_version:"webcrypto"},keyId:"prod-2026-Q3 (demo)",startedAtUtc:now,events});
  sealed=res.bundle;pub=res.publicKeyPem;
  const v=await verifyBundle(sealed,pub);
  step("notice","done");step("signed","done");step("ready","done");
  $("proof").style.display="block";
  $("kv").innerHTML="<div class='row'>events <span class='mono'>"+sealed.events.length+"</span></div>"+
    "<div class='row'>batch root <span class='mono'>"+trunc(sealed.batch_root)+"</span></div>"+
    "<div class='row'>signed by <span class='mono'>"+sealed.signatures[0].key_id+"</span></div>"+
    "<div class='row'>source resolution <span class='mono' style='color:var(--ok)'>"+(v.sourceResolution||"?")+"</span></div>";
  const b=$("banner");
  if(decision==="disputed"){b.className="banner dispute";$("bh").textContent="⚑ Disputed — returned to model team (sealed)";$("bs").textContent="The verdict is immutable; your disagreement is now part of the signed record. A documented challenge is good exam evidence.";}
  else if(v.ok){b.className="banner ok";$("bh").textContent="✓ Signature valid · chain intact";$("bs").innerHTML="<span class='mono'>Ed25519 · sealed + verified in your browser</span> — the AI draft and your edits are both in the record.";}
  else{b.className="banner fail";$("bh").textContent="✕ Verify failed";$("bs").textContent=v.reason;}
  $("sign").disabled=true;$("sign").textContent="Sealed ✓";
}
$("sign").onclick=()=>seal("signed");
$("dispute").onclick=()=>{const note=prompt("Return to model team — state the disagreement (sealed as exam evidence):","AA04 (portfolio risk) not substantiated for this obligor mix.");if(note===null)return;seal("disputed",note);};
$("download").onclick=()=>{
  const blob=new Blob([JSON.stringify(sealed,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="adverse-action-"+DRAFT.application.application_id+".bundle.json";a.click();
  const pb=new Blob([pub],{type:"application/x-pem-file"});const a2=document.createElement("a");a2.href=URL.createObjectURL(pb);a2.download="adverse-action.pub.pem";a2.click();
};
$("tamper").onclick=async()=>{
  const t=JSON.parse(JSON.stringify(sealed));const ev=t.events.find(e=>e.payload&&e.payload.kind==="officer_final_notices");ev.payload.notices[0].notice={text:"APPROVED — congratulations."};
  const v=await verifyBundle(t,pub);const b=$("banner");b.className="banner fail";$("bh").textContent="✕ Verification FAILED — "+v.reason+(v.seq!=null?" @ seq "+v.seq:"");$("bs").textContent="Someone rewrote the sealed notice after sign-off. The record no longer verifies — that's the point.";
};
$("reset").onclick=()=>location.reload();
</script>
</body></html>`;
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "index.html"), html);
console.log("[build] demos/adverse-action/review-sign-app/index.html  (WORKING review-and-sign — real in-browser Ed25519 seal + verify + download)");
