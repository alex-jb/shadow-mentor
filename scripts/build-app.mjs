#!/usr/bin/env node
// scripts/build-app.mjs
// The cohesive thin-scope app on ONE page (same origin, so the record flows through): the
// officer edits + signs off (real in-browser Ed25519 seal), and the SAME sealed bundle flows
// into the Export step — download the raw bundle or a self-contained examiner-pack.html the
// examiner opens to read the notices AND verify offline. No server, nothing leaves the machine.
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
  application, verdict: draft.verdict,
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

const OUT = resolve(D, "app");
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow — adverse-action verification (working app)</title>
<meta name="description" content="Review an AI-denied credit decision, edit the Reg B notice, sign off (real in-browser Ed25519 seal), and export a self-contained examiner pack — offline, no account, nothing leaves your machine."/>
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
.flowsteps{display:flex;gap:8px;margin-bottom:16px;font-size:12.5px;align-items:center}
.fs{display:flex;align-items:center;gap:7px;color:var(--t3);font-weight:560}
.fs .n{width:20px;height:20px;border-radius:50%;border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.fs.active{color:var(--accent)}.fs.active .n{border-color:var(--accent);color:var(--accent)}
.fs.done{color:var(--ok)}.fs.done .n{border-color:var(--ok);color:var(--ok)}
.fsarrow{color:var(--border-strong)}
.band{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px}
.band .id{font-weight:640;font-size:15px}.band .id .mono{font-size:13px;color:var(--t2);font-weight:400}
.decision{font-size:12px;font-weight:640;color:var(--fail);background:var(--fail-bg);border:1px solid var(--fail);border-radius:var(--radius-sm);padding:2px 8px}
.sig{display:flex;gap:14px;margin-left:auto;font-size:12.5px;color:var(--t2)}.sig b{color:var(--t1)}
.clock{font-size:12px;font-weight:600;color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn);border-radius:20px;padding:2px 10px}
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
.export{display:none;margin-top:18px}.export.show{display:block}
.art{display:flex;align-items:center;gap:13px;padding:11px 0;border-bottom:1px solid var(--border-subtle)}.art:last-child{border-bottom:0}
.ic{flex:0 0 34px;width:34px;height:34px;border-radius:var(--radius-sm);background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:var(--mono)}
.art .m{flex:1;min-width:0}.art .t{font-size:13.5px;font-weight:560}.art .d{font-size:11.5px;color:var(--t3);margin-top:1px}
.verifybox{background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px 14px;font-size:12.5px;color:var(--t2);margin-top:12px}.verifybox .cmd{display:block;font-family:var(--mono);font-size:12px;color:var(--t1);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 11px;margin:8px 0;overflow-x:auto}
.foot{margin-top:22px;font-size:11px;color:var(--t3);line-height:1.6}.foot a{color:var(--accent);text-decoration:none}
</style></head>
<body><div class="wrap">
  <header><span class="wordmark">🛡 <b>Shadow</b></span><span class="role">adverse-action verification</span><span class="live">● live · everything runs in your browser</span></header>
  <div class="flowsteps"><span class="fs active" id="fs1"><span class="n">1</span>Review &amp; sign</span><span class="fsarrow">→</span><span class="fs" id="fs2"><span class="n">2</span>Export the pack</span></div>

  <div class="band">
    <span class="id">Application <span class="mono">${esc(application.application_id)}</span></span>
    <span class="decision">DENIED</span><span class="clock">18 days to ECOA notice</span>
    <span class="sig tnum">FICO <b>${application.credit_score}</b> · DTI <b>${application.debt_to_income}</b> · LTV <b>${application.loan_to_value}</b> · model <b class="mono" style="font-weight:600">loan-council v1</b></span>
  </div>

  <div class="cols">
    <div>
      <div class="panel">
        <h2><span>Principal reasons · Reg B / ECOA §1002.9(b)(2)</span><span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">${DRAFT.notices.length} of ≤4</span></h2>
        <div class="detnote">The <b>DENIED</b> verdict is deterministic policy and is <b>not editable</b> — only the notice prose. On sign-off, the AI's original draft <b>and</b> your edited final are <b>both sealed</b>.</div>
        ${cards}
        <div class="actions">
          <button class="btn primary" id="sign">Sign off &amp; seal</button>
          <button class="btn danger" id="dispute">Dispute / return to model team</button>
        </div>
      </div>

      <div class="panel export" id="export">
        <h2><span>Export the examiner pack</span><span style="color:var(--ok);text-transform:none;letter-spacing:0;font-weight:600">● sealed</span></h2>
        <div class="art"><div class="ic">HTML</div><div class="m"><div class="t">Examiner pack (self-contained)</div><div class="d">One file your examiner opens: the §1002.9(b)(2) notices + a "Verify this record" button that checks the signature offline. No install, no account.</div></div><button class="btn primary" id="pack">Download</button></div>
        <div class="art"><div class="ic">JSON</div><div class="m"><div class="t">Signed evidence bundle + public key</div><div class="d">The raw record + <span class="mono">.pub.pem</span> — for CI / <span class="mono">npx shadow-verify</span>.</div></div><button class="btn" id="raw">Download</button></div>
        <div class="verifybox">Your examiner opens the pack and clicks <b>Verify this record</b> — re-checks the Ed25519 signature + hash-chain, offline, in their browser. Or:<span class="cmd">npx shadow-verify bundle.json --public-key key.pem</span>Green ⇒ intact; red ⇒ names the exact altered step.</div>
      </div>
    </div>

    <div class="rail">
      <div class="banner idle" id="banner"><div class="h" id="bh">◷ Not yet sealed</div><div class="s" id="bs">Edit the notices, then sign off. The record is sealed with real Ed25519 + a hash-chain right here — the exact bytes your examiner re-verifies offline.</div></div>
      <div class="railpanel" id="proof" style="display:none"><h3>Sealed record</h3><div class="kv" id="kv"></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn ghost" id="tamper">Tamper (demo)</button><button class="btn ghost" id="reset">Reset</button></div></div>
    </div>
  </div>
  <div class="foot">Independent + open-source (MIT). Real Ed25519 seal + verify in-browser · nothing uploaded. · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a></div>
</div>

<script>
const DRAFT=${JSON.stringify(DRAFT)};
const VERIFY_SRC=${JSON.stringify(BROWSER_VERIFY_JS)};
const { sealBundle } = (function(){ ${BROWSER_SEAL_JS} return { sealBundle }; })();
const { verifyBundle } = new Function(VERIFY_SRC + "\\n return { verifyBundle };")();
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const trunc=h=>h?h.slice(0,12)+"…"+h.slice(-8):"—";
let sealed=null, pub=null;
function dl(name,text,type){const b=new Blob([text],{type:type||"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();}
document.querySelectorAll(".notice").forEach(t=>t.addEventListener("input",()=>{const c=t.closest(".rcard");const w=t.value!==t.getAttribute("data-orig");c.classList.toggle("edited",w);const s=c.querySelector("[data-state]");s.textContent=w?"edited":"grounded";s.className="state "+(w?"edited":"grounded");}));
function collect(){return [...document.querySelectorAll(".rcard")].map(c=>{const t=c.querySelector(".notice");return {code:c.getAttribute("data-code"),orig:t.getAttribute("data-orig"),final:t.value,edited:t.value!==t.getAttribute("data-orig")};});}

async function seal(decision,disputeNote){
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
  $("fs1").className="fs done";$("fs2").className="fs active";
  $("proof").style.display="block";
  $("kv").innerHTML="<div class='row'>events <span class='mono'>"+sealed.events.length+"</span></div><div class='row'>batch root <span class='mono'>"+trunc(sealed.batch_root)+"</span></div><div class='row'>signed by <span class='mono'>"+sealed.signatures[0].key_id+"</span></div><div class='row'>source resolution <span class='mono' style='color:var(--ok)'>"+(v.sourceResolution||"?")+"</span></div>";
  const b=$("banner");
  if(decision==="disputed"){b.className="banner dispute";$("bh").textContent="⚑ Disputed — returned (sealed)";$("bs").textContent="The verdict is immutable; your disagreement is now part of the signed record.";}
  else if(v.ok){b.className="banner ok";$("bh").textContent="✓ Signature valid · chain intact";$("bs").innerHTML="<span class='mono'>Ed25519 · sealed + verified in your browser</span> — now export it below.";}
  else{b.className="banner fail";$("bh").textContent="✕ Verify failed";$("bs").textContent=v.reason;}
  $("sign").disabled=true;$("sign").textContent="Sealed ✓";
  $("export").classList.add("show");$("export").scrollIntoView({behavior:"smooth",block:"nearest"});
}
$("sign").onclick=()=>seal("signed");
$("dispute").onclick=()=>{const note=prompt("Return to model team — state the disagreement (sealed as exam evidence):","AA04 (portfolio risk) not substantiated for this obligor mix.");if(note===null)return;seal("disputed",note);};
$("tamper").onclick=async()=>{const t=JSON.parse(JSON.stringify(sealed));t.events.find(e=>e.payload&&e.payload.kind==="officer_final_notices").payload.notices[0].notice={text:"APPROVED"};const v=await verifyBundle(t,pub);const b=$("banner");b.className="banner fail";$("bh").textContent="✕ Verification FAILED — "+v.reason+(v.seq!=null?" @ seq "+v.seq:"");$("bs").textContent="Someone rewrote the sealed notice after sign-off. It no longer verifies — that's the point.";};
$("reset").onclick=()=>location.reload();
$("raw").onclick=()=>{dl("adverse-action-"+sealed.header.session_id.slice(0,8)+".bundle.json",JSON.stringify(sealed,null,2),"application/json");dl("adverse-action.pub.pem",pub,"application/x-pem-file");};
function buildPack(){
  const fe=sealed.events.find(e=>e.payload&&e.payload.kind==="officer_final_notices");
  const notes=fe.payload.notices.map(x=>({code:x.code,text:(x.notice&&x.notice.text)||"",edited:!!x.edited}));
  const noticeHtml=notes.map(n=>"<div class='rc'><div class='code'>"+escapeHtml(n.code)+(n.edited?" · officer-edited":"")+"</div><pre>"+escapeHtml(n.text)+"</pre></div>").join("");
  return "<!doctype html><html lang='en'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/><title>Adverse-action record — verify offline</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;color:#14161A;background:#fff;line-height:1.5}h1{font-size:20px;margin-bottom:4px}.sub{color:#565C63;font-size:13px;margin-bottom:20px}.rc{border:1px solid #DDE0E4;border-radius:6px;padding:12px;margin:10px 0}.code{font-family:ui-monospace,monospace;font-size:12px;color:#3E63DD;font-weight:600;margin-bottom:6px}pre{white-space:pre-wrap;font:inherit;font-size:13px;margin:0}button{font:inherit;font-weight:600;font-size:15px;border:0;border-radius:8px;padding:12px 20px;background:#3E63DD;color:#fff;cursor:pointer;margin:16px 0}#st{font-weight:650;font-size:15px;padding:12px 14px;border-radius:8px;display:none;margin-top:8px}#st.ok{display:block;background:#E6F4EA;color:#1A7F37}#st.bad{display:block;background:#FDECEA;color:#B42318}.foot{margin-top:24px;color:#878D95;font-size:11.5px;line-height:1.6}code{font-family:ui-monospace,monospace;background:#F6F7F9;padding:1px 5px;border-radius:3px}</style></head><body>"+
    "<h1>Adverse-action record — Application "+escapeHtml(DRAFT.application.application_id)+"</h1><div class='sub'>Reg B / ECOA §1002.9(b)(2) principal reasons. Verify below — offline, no account, no trust in the sender.</div>"+noticeHtml+
    "<button id='v'>Verify this record</button><div id='st'></div><div class='foot'>Contains the signed evidence bundle + public key. Verification runs entirely in your browser. Also: <code>npx shadow-verify bundle.json --public-key key.pem</code>. github.com/alex-jb/shadow-mentor</div>"+
    "<script>var BUNDLE="+JSON.stringify(sealed)+";var PUB="+JSON.stringify(pub)+";var verifyBundle=(function(){"+VERIFY_SRC+" return verifyBundle;})();document.getElementById('v').onclick=async function(){var v=await verifyBundle(JSON.parse(JSON.stringify(BUNDLE)),PUB);var s=document.getElementById('st');if(v.ok){s.className='ok';s.textContent='\\u2713 Verified \\u2014 signature + hash-chain intact'+(v.sourceResolution==='VERIFIED'?', and the decision above rebinds to the signed hash.':'.');}else{s.className='bad';s.textContent='\\u2717 Verification FAILED \\u2014 '+v.reason+(v.seq!=null?' at step '+v.seq:'')+'. Altered after signing.';}};<\\/script></body></html>";
}
$("pack").onclick=()=>dl("examiner-pack-"+DRAFT.application.application_id+".html",buildPack(),"text/html");
</script>
</body></html>`;
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "index.html"), html);
console.log("[build] demos/adverse-action/app/index.html  (cohesive single-page app — review+sign → export, same origin, real crypto)");
