#!/usr/bin/env node
// scripts/build-export-app.mjs
// The REAL working Export screen: takes a signed-off bundle and produces the examiner pack —
// most importantly a SELF-CONTAINED examiner-pack.html that embeds the bundle + public key +
// the WebCrypto verifier + the rendered notices, so the examiner opens ONE file and can both
// READ the adverse-action notices AND verify the record offline, no account, no CLI. Also
// downloads the raw bundle.json + public key. Everything is generated in-browser from a real
// sealed bundle (built here via sealAdverseAction).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { sealAdverseAction } from "../lib/adverse-action-review.js";
import { BROWSER_VERIFY_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

const R = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = resolve(R, "demos/adverse-action");
const application = JSON.parse(readFileSync(resolve(D, "sample-denied-application.json"), "utf8"));
const { privateKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "pem" });
const sealedRes = sealAdverseAction(application, {
  privateKey: priv, keyId: "prod-2026-Q3 (demo)", officer: "j.doe (demo)", nowIso: "2026-07-13T14:02:00.000Z",
  editedNotices: { AA01: "This notice is being provided to you because your application for credit was not approved.\n\nThe principal reason for this decision is:\nYour credit score of 648 is below our standard approval threshold. You may reapply after 90 days once your score improves." },
});
const BUNDLE = sealedRes.bundle;
const PUB = sealedRes.publicKeyPem;
// notices to show = the officer's final (edited) versions sealed in the bundle
const finalEvent = BUNDLE.events.find((e) => e.payload && e.payload.kind === "officer_final_notices");
const NOTICES = finalEvent.payload.notices.map((n) => ({ code: n.code, text: (n.notice && n.notice.text) || "", edited: !!n.edited }));
const APP_ID = application.application_id;

const OUT = resolve(D, "export-app");
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow — export the examiner pack (working)</title>
<meta name="description" content="Turn a signed-off adverse-action record into an examiner pack: a self-contained HTML file your examiner opens to read the notices AND verify the record offline, no account."/>
<style>
:root{--bg:#FCFCFD;--surface:#FFF;--sunken:#F6F7F9;--border-subtle:#ECEDEF;--border:#DDE0E4;--border-strong:#C4C8CE;--t1:#14161A;--t2:#565C63;--t3:#878D95;--accent:#3E63DD;--accent-hover:#3452C4;--accent-bg:#EDF2FE;--ok:#1A7F37;--ok-bg:#E6F4EA;--fail:#B42318;--fail-bg:#FDECEA;--warn:#9A6700;--warn-bg:#FFF8E1;--radius:6px;--radius-sm:4px;--sans:-apple-system,"Inter","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;}
@media (prefers-color-scheme:dark){:root{--bg:#0C0D10;--surface:#141619;--sunken:#0F1013;--border-subtle:#1F2227;--border:#2A2E35;--border-strong:#3A3F47;--t1:#EBEDF0;--t2:#9AA1AB;--t3:#6B7178;--accent:#7B85E0;--accent-hover:#8B94E6;--accent-bg:#1A1D33;--ok:#3FB950;--ok-bg:#12261A;--fail:#F85149;--fail-bg:#2A1615;--warn:#D29922;--warn-bg:#26200E;}}
*{margin:0;padding:0;box-sizing:border-box}html,body{overflow-x:clip}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);line-height:1.5;-webkit-font-smoothing:antialiased}
.mono{font-family:var(--mono)}
.wrap{max-width:760px;margin:0 auto;padding:24px 22px 64px}
header{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:14px;margin-bottom:18px}
.wordmark{font-size:15px;font-weight:640}.wordmark b{color:var(--accent)}
.role{font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.live{margin-left:auto;font-size:11px;color:var(--ok);background:var(--ok-bg);border:1px solid var(--ok);border-radius:20px;padding:2px 9px;font-weight:600}
.lede h1{font-size:21px;font-weight:640;letter-spacing:-.015em;margin-bottom:6px}
.lede p{font-size:13.5px;color:var(--t2);margin-bottom:8px}
.sealed{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ok);background:var(--ok-bg);border:1px solid var(--ok);border-radius:20px;padding:2px 11px;margin-bottom:20px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px}
.panel h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:12px}
.art{display:flex;align-items:center;gap:13px;padding:11px 0;border-bottom:1px solid var(--border-subtle)}.art:last-child{border-bottom:0}
.ic{flex:0 0 34px;width:34px;height:34px;border-radius:var(--radius-sm);background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:var(--mono)}
.art .m{flex:1;min-width:0}.art .t{font-size:13.5px;font-weight:560}.art .d{font-size:11.5px;color:var(--t3);margin-top:1px}
.btn{font:inherit;font-size:12.5px;font-weight:560;height:30px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--t1);cursor:pointer}.btn:hover{border-color:var(--border-strong)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;height:34px;font-size:13px}.btn.primary:hover{background:var(--accent-hover)}
.pack{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center}
.verifyline{font-size:12px;margin-left:auto}
.banner{border-radius:var(--radius-sm);border:1px solid var(--border);border-left-width:3px;padding:9px 12px;margin-top:12px;display:none;font-size:12.5px}
.banner.show{display:block}.banner.ok{background:var(--ok-bg);border-left-color:var(--ok);color:var(--ok)}.banner.fail{background:var(--fail-bg);border-left-color:var(--fail);color:var(--fail)}
.verify{background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px 14px;font-size:12.5px;color:var(--t2)}
.verify .cmd{display:block;font-family:var(--mono);font-size:12px;color:var(--t1);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 11px;margin:8px 0;overflow-x:auto}
.foot{margin-top:22px;font-size:11px;color:var(--t3);line-height:1.6}.foot a{color:var(--accent);text-decoration:none}
</style></head>
<body><div class="wrap">
  <header><span class="wordmark">🛡 <b>Shadow</b></span><span class="role">export · examiner pack</span><span class="live">● live · builds the pack in your browser</span></header>
  <div class="lede"><h1>Hand your examiner the record.</h1><p>One self-contained file they open with no account — it shows the notices and lets them verify the signed record offline. Nothing here leaves your machine.</p></div>
  <span class="sealed">● Sealed &amp; signed off · Application <span class="mono" style="margin-left:4px">${APP_ID}</span> · key <span class="mono" style="margin-left:4px">prod-2026-Q3 (demo)</span></span>

  <div class="panel">
    <h2>The examiner pack</h2>
    <div class="art"><div class="ic">HTML</div><div class="m"><div class="t">Examiner pack (self-contained)</div><div class="d">Opens in any browser: the §1002.9(b)(2) notices + a "Verify this record" button that checks the signature offline. No install, no account.</div></div><button class="btn primary" id="pack">Download</button></div>
    <div class="art"><div class="ic">JSON</div><div class="m"><div class="t">Signed evidence bundle + public key</div><div class="d">The raw Ed25519-signed, hash-chained record + <span class="mono">.pub.pem</span> — for CI / <span class="mono">npx shadow-verify</span>.</div></div><button class="btn" id="raw">Download</button></div>
    <div class="pack">
      <button class="btn" id="verify">Verify this record now</button>
      <span class="verifyline" id="vline"></span>
    </div>
    <div class="banner" id="banner"></div>
  </div>

  <div class="panel">
    <h2>How your examiner verifies it — no account, offline</h2>
    <div class="verify">Open the examiner pack and click <b>Verify this record</b> — it re-checks the Ed25519 signature + hash-chain and rebinds the decision to what was signed, in their browser. Or from a terminal:
      <span class="cmd">npx shadow-verify bundle.json --public-key key.pem</span>
      Green ⇒ intact; red ⇒ names the exact altered step. The AI's original draft and the officer's edits are both in the record.</div>
  </div>
  <div class="foot">Independent + open-source (MIT). Real crypto, in-browser, nothing uploaded. · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a></div>
</div>

<script>
const BUNDLE=${JSON.stringify(BUNDLE)};
const PUB=${JSON.stringify(PUB)};
const NOTICES=${JSON.stringify(NOTICES)};
const VERIFY_SRC=${JSON.stringify(BROWSER_VERIFY_JS)};
const { verifyBundle } = new Function(VERIFY_SRC + "\\n return { verifyBundle };")();
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function dl(name,text,type){const b=new Blob([text],{type:type||"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();}

$("verify").onclick=async()=>{
  const v=await verifyBundle(JSON.parse(JSON.stringify(BUNDLE)),PUB);const b=$("banner");b.className="banner show "+(v.ok?"ok":"fail");
  b.textContent=v.ok?("✓ Verified — signature + chain intact"+(v.sourceResolution==="VERIFIED"?", decision rebinds to the signed hash":"")):("✕ "+v.reason+(v.seq!=null?" @ seq "+v.seq:""));
  $("vline").innerHTML="<span style='color:"+(v.ok?"var(--ok)":"var(--fail)")+"'>"+(v.ok?"✓ ready to hand over":"✕ do not send")+"</span>";
};
$("raw").onclick=()=>{dl("adverse-action-"+BUNDLE.header.session_id.slice(0,8)+".bundle.json",JSON.stringify(BUNDLE,null,2),"application/json");dl("adverse-action.pub.pem",PUB,"application/x-pem-file");};

// The self-contained examiner pack: notices + embedded bundle/pubkey/verifier + a verify button.
function buildPack(){
  const noticeHtml=NOTICES.map(n=>"<div class='rc'><div class='code'>"+escapeHtml(n.code)+(n.edited?" · officer-edited":"")+"</div><pre>"+escapeHtml(n.text)+"</pre></div>").join("");
  return "<!doctype html><html lang='en'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/>"+
    "<title>Adverse-action record — verify offline</title><style>"+
    "body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;color:#14161A;background:#fff;line-height:1.5}"+
    "h1{font-size:20px;margin-bottom:4px}.sub{color:#565C63;font-size:13px;margin-bottom:20px}"+
    ".rc{border:1px solid #DDE0E4;border-radius:6px;padding:12px;margin:10px 0}.code{font-family:ui-monospace,monospace;font-size:12px;color:#3E63DD;font-weight:600;margin-bottom:6px}"+
    "pre{white-space:pre-wrap;font:inherit;font-size:13px;margin:0}"+
    "button{font:inherit;font-weight:600;font-size:15px;border:0;border-radius:8px;padding:12px 20px;background:#3E63DD;color:#fff;cursor:pointer;margin:16px 0}"+
    "#st{font-weight:650;font-size:15px;padding:12px 14px;border-radius:8px;display:none;margin-top:8px}#st.ok{display:block;background:#E6F4EA;color:#1A7F37}#st.bad{display:block;background:#FDECEA;color:#B42318}"+
    ".foot{margin-top:24px;color:#878D95;font-size:11.5px;line-height:1.6}code{font-family:ui-monospace,monospace;background:#F6F7F9;padding:1px 5px;border-radius:3px}</style></head><body>"+
    "<h1>Adverse-action record — Application "+escapeHtml(BUNDLE.events[1].payload.application.application_id||"")+"</h1>"+
    "<div class='sub'>Reg B / ECOA §1002.9(b)(2) principal reasons. Verify the record below — offline, no account, no trust in the sender.</div>"+
    noticeHtml+
    "<button id='v'>Verify this record</button><div id='st'></div>"+
    "<div class='foot'>This file contains the signed evidence bundle + the public key. Verification runs entirely in your browser (nothing is uploaded). You can also re-check it with <code>npx shadow-verify bundle.json --public-key key.pem</code>. Open-source: github.com/alex-jb/shadow-mentor</div>"+
    "<script>var BUNDLE="+JSON.stringify(BUNDLE)+";var PUB="+JSON.stringify(PUB)+";"+
    "var verifyBundle=(function(){"+VERIFY_SRC+" return verifyBundle;})();"+
    "document.getElementById('v').onclick=async function(){var v=await verifyBundle(JSON.parse(JSON.stringify(BUNDLE)),PUB);var s=document.getElementById('st');"+
    "if(v.ok){s.className='ok';s.textContent='\\u2713 Verified \\u2014 signature + hash-chain intact'+(v.sourceResolution==='VERIFIED'?', and the decision above rebinds to the signed hash.':'.');}"+
    "else{s.className='bad';s.textContent='\\u2717 Verification FAILED \\u2014 '+v.reason+(v.seq!=null?' at step '+v.seq:'')+'. This record was altered after signing.';}};"+
    "<\\/script></body></html>";
}
$("pack").onclick=()=>dl("examiner-pack-"+(BUNDLE.events[1].payload.application.application_id||"record")+".html",buildPack(),"text/html");
</script>
</body></html>`;
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "index.html"), html);
console.log("[build] demos/adverse-action/export-app/index.html  (WORKING export — generates a self-contained, offline-verifiable examiner pack)");
