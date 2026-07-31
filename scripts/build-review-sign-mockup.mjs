#!/usr/bin/env node
// scripts/build-review-sign-mockup.mjs
// Design mockup for the thin-scope REVIEW-AND-SIGN screen — the officer's actual work
// (the screen the CEO/Design review said the brief under-served). Three-zone canvas per
// the RegTech teardown (§4 pattern #1) with the reviewed fixes: verify is a RIGHT RAIL
// not a 60% pane (F1), reason-code cards with grounded/edited/refusal states (F2), the
// AI-drafted→officer-edited diff as a provenance node (F2), sign-off auto-fires verify
// (F7), a dispute/return path (F3). Runs the real council at build time + inlines the
// real signed bundle so the verify rail actually fires. Radix Blue, hallmark disciplines.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROWSER_VERIFY_JS as VERIFY_JS } from "../packages/attest-core/verify-bundle.browser.mjs";
import { reviewAdverseAction } from "../lib/adverse-action-review.js";

const R = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = resolve(R, "demos/adverse-action");
const application = JSON.parse(readFileSync(resolve(D, "sample-denied-application.json"), "utf8"));
const result = reviewAdverseAction(application, { keyId: "prod-2026-Q3", nowIso: "2026-07-13T14:02:00.000Z" });
const pubkey = result.publicKeyPem;
const bundleJson = JSON.stringify(result.bundle);
const noticeText = (n) => !n.notice ? "" : (typeof n.notice === "string" ? n.notice : (n.notice.text || n.notice.reason || ""));
const reasons = result.notices.map((n) => ({ code: n.code, label: n.label || "", source: (application && "") , text: noticeText(n) }));

// The browser verifier is the single shared source in packages/attest-core (imported above).

// ECOA rights block (shown once, not per card — it's the same statutory language).
const ECOA = "The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age, or because income derives from a public-assistance program. The federal agency that administers compliance is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington DC 20552.";

const OUT = resolve(D, "review-sign-mockup");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cardHtml = reasons.map((r, i) => `
    <div class="rcard" data-i="${i}">
      <div class="rtop">
        <span class="code mono">${esc(r.code)}</span>
        <span class="rlabel">${esc(r.label)}</span>
        <span class="state grounded" data-state>grounded</span>
      </div>
      <div class="notice-wrap">
        <label class="nlbl">Principal reason — §1002.9(b)(2) notice text <span class="ai">AI-drafted · editable</span></label>
        <textarea class="notice" data-orig="${esc(r.text)}">${esc(r.text)}</textarea>
      </div>
    </div>`).join("");

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shadow — review &amp; sign an adverse action</title>
<meta name="description" content="The compliance officer's workspace: review the model's principal reason codes, edit the Reg B notice, sign off to seal a tamper-evident record, or dispute the decision back to the model team."/>
<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 -->
<style>
:root{
  --bg:#FCFCFD;--surface:#FFF;--sunken:#F6F7F9;--border-subtle:#ECEDEF;--border:#DDE0E4;--border-strong:#C4C8CE;
  --t1:#14161A;--t2:#565C63;--t3:#878D95;--accent:#3E63DD;--accent-hover:#3452C4;--accent-bg:#EDF2FE;
  --ok:#1A7F37;--ok-bg:#E6F4EA;--fail:#B42318;--fail-bg:#FDECEA;--warn:#9A6700;--warn-bg:#FFF8E1;--neutral:#565C63;--neutral-bg:#F0F1F3;
  --radius:6px;--radius-sm:4px;--sans:-apple-system,"Inter","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0C0D10;--surface:#141619;--sunken:#0F1013;--border-subtle:#1F2227;--border:#2A2E35;--border-strong:#3A3F47;
  --t1:#EBEDF0;--t2:#9AA1AB;--t3:#6B7178;--accent:#7B85E0;--accent-hover:#8B94E6;--accent-bg:#1A1D33;
  --ok:#3FB950;--ok-bg:#12261A;--fail:#F85149;--fail-bg:#2A1615;--warn:#D29922;--warn-bg:#26200E;--neutral:#9AA1AB;--neutral-bg:#1C1F24;}}
*{margin:0;padding:0;box-sizing:border-box}html,body{overflow-x:clip}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);font-feature-settings:"tnum" 1,"cv05" 1;line-height:1.5;-webkit-font-smoothing:antialiased}
.mono{font-family:var(--mono);font-variant-ligatures:none}.tnum{font-variant-numeric:tabular-nums}
.wrap{max-width:1140px;margin:0 auto;padding:20px 22px 64px}
header{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:14px;margin-bottom:16px}
.wordmark{font-size:15px;font-weight:640;letter-spacing:-.01em}.wordmark b{color:var(--accent)}
.role{font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
/* summary band */
.band{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px}
.band .id{font-weight:640;font-size:15px}.band .id .mono{font-size:13px;color:var(--t2);font-weight:400}
.decision{font-size:12px;font-weight:640;color:var(--fail);background:var(--fail-bg);border:1px solid var(--fail);border-radius:var(--radius-sm);padding:2px 8px;letter-spacing:.03em}
.sig{display:flex;gap:14px;margin-left:auto;font-size:12.5px;color:var(--t2)}
.sig b{color:var(--t1);font-weight:600}
.clock{font-size:12px;font-weight:600;color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn);border-radius:20px;padding:2px 10px}
/* checklist */
.steps{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;font-size:12px}
.step{display:flex;align-items:center;gap:6px;color:var(--t3);padding:4px 10px;border:1px solid var(--border-subtle);border-radius:20px}
.step .dot{width:7px;height:7px;border-radius:50%;background:var(--border-strong)}
.step.done{color:var(--ok)}.step.done .dot{background:var(--ok)}
.step.active{color:var(--accent);border-color:var(--accent)}.step.active .dot{background:var(--accent)}
/* two-column: work + rail */
.cols{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start}
@media (max-width:900px){.cols{grid-template-columns:minmax(0,1fr)}}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.panel h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:12px;display:flex;justify-content:space-between}
.detnote{font-size:11.5px;color:var(--t3);margin:-4px 0 14px;background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:7px 10px}
.detnote b{color:var(--t2)}
.rcard{border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px;background:var(--surface)}
.rcard.edited{border-color:var(--accent)}
.rtop{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.code{font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-bg);border-radius:var(--radius-sm);padding:1px 7px}
.rlabel{font-size:13px;font-weight:560;flex:1;min-width:0}
.state{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;padding:1px 7px;border-radius:var(--radius-sm)}
.state.grounded{color:var(--ok);background:var(--ok-bg)}
.state.edited{color:var(--accent);background:var(--accent-bg)}
.state.refusal{color:var(--warn);background:var(--warn-bg)}
.nlbl{display:block;font-size:11px;color:var(--t3);margin-bottom:5px}.nlbl .ai{color:var(--accent);margin-left:4px}
.notice{width:100%;min-height:52px;font:inherit;font-size:12.5px;color:var(--t1);background:var(--sunken);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;resize:vertical;line-height:1.5}
.notice:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
.cap{font-size:11px;color:var(--t3);margin:4px 0 14px}
.ecoa{font-size:11px;color:var(--t3);background:var(--sunken);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:9px 11px;margin-bottom:14px;line-height:1.55}
details.council{margin-bottom:16px}details.council summary{font-size:12px;color:var(--t2);cursor:pointer;font-weight:560}
.voices{font-size:12px;color:var(--t2);margin-top:8px}.voices div{padding:3px 0;border-bottom:1px solid var(--border-subtle)}.voices b{color:var(--t1)}
.actions{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:14px}
.btn{font:inherit;font-size:13px;font-weight:560;height:34px;padding:0 15px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);color:var(--t1);cursor:pointer}
.btn:hover{border-color:var(--border-strong)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{background:var(--accent-hover)}
.btn.primary:disabled{opacity:.5;cursor:not-allowed}
.btn.danger{color:var(--fail);border-color:var(--fail)}
/* right rail */
.rail{position:sticky;top:18px;display:flex;flex-direction:column;gap:14px}
.banner{border-radius:var(--radius);border:1px solid var(--border);border-left-width:3px;padding:12px 14px}
.banner .h{font-size:13.5px;font-weight:620;display:flex;align-items:center;gap:7px}.banner .s{font-size:11.5px;margin-top:4px;color:var(--t2)}
.banner.idle{border-left-color:var(--border-strong)}.banner.idle .h{color:var(--t3)}
.banner.ok{background:var(--ok-bg);border-left-color:var(--ok)}.banner.ok .h{color:var(--ok)}
.banner.dispute{background:var(--warn-bg);border-left-color:var(--warn)}.banner.dispute .h{color:var(--warn)}
.rail h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:640;margin-bottom:8px}
.spine{list-style:none}
.node{position:relative;padding:0 0 12px 20px;font-size:12px;color:var(--t2)}
.node:before{content:"";position:absolute;left:3px;top:3px;width:9px;height:9px;border-radius:50%;border:2px solid var(--ok);background:var(--surface)}
.node:after{content:"";position:absolute;left:7px;top:12px;bottom:0;width:2px;background:var(--border)}
.node:last-child:after{display:none}
.node b{color:var(--t1);font-weight:560}
.node .diff{margin-top:3px;font-size:11px;color:var(--accent);background:var(--accent-bg);border-radius:var(--radius-sm);padding:2px 7px;display:none}
.node.hasdiff .diff{display:inline-block}
.fp{font-size:11.5px;color:var(--t2)}.fp .mono{color:var(--t1)}
.railpanel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.foot{margin-top:22px;font-size:11px;color:var(--t3);line-height:1.6}.foot a{color:var(--accent);text-decoration:none}
.critique{margin-top:16px;font-size:10.5px;color:var(--t3);font-family:var(--mono)}
</style></head>
<body>
<div class="wrap">
  <header><span class="wordmark">🛡 <b>Shadow</b></span><span class="role">review &amp; sign · adverse action</span></header>

  <div class="band">
    <span class="id">Application <span class="mono">${esc(application.application_id)}</span></span>
    <span class="decision">DENIED</span>
    <span class="clock" id="clock">18 days to ECOA notice</span>
    <span class="sig tnum">FICO <b>${application.credit_score}</b> · DTI <b>${application.debt_to_income}</b> · LTV <b>${application.loan_to_value}</b> · model <b class="mono" style="font-weight:600">loan-council v1</b> · <span class="mono">2026-07-13</span></span>
  </div>

  <div class="steps" id="steps">
    <span class="step done"><span class="dot"></span>Reasons cited</span>
    <span class="step active" data-step="notice"><span class="dot"></span>Notice drafted</span>
    <span class="step" data-step="signed"><span class="dot"></span>Signed off</span>
    <span class="step" data-step="ready"><span class="dot"></span>Examiner-ready</span>
  </div>

  <div class="cols">
    <div class="panel">
      <h2><span>Principal reasons · Reg B / ECOA §1002.9(b)(2)</span><span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">${reasons.length} of ≤4</span></h2>
      <div class="detnote">The <b>DENIED</b> verdict is produced by deterministic policy rules (FICO/DTI/LTV/risk thresholds) and is <b>not editable here</b> — only the notice prose below. This is the integrity boundary: you review and word the reasons; you don't rewrite the decision.</div>
${cardHtml}
      <div class="cap" id="cap">4 principal reasons — at the §1002.9(b)(2) guidance ceiling ("disclosure of more than four is not likely to be helpful").</div>
      <div class="ecoa"><b style="color:var(--t2)">ECOA rights (included on every notice):</b> ${esc(ECOA)}</div>
      <details class="council"><summary>Council rationale (for human reviewers — does not change the verdict)</summary>
        <div class="voices">
          <div><b>Credit Fundamentals</b> — block: FICO ${application.credit_score} below Addendum A floor; credit-eligibility floor failure is a hard block.</div>
          <div><b>Risk Officer</b> — block: LTV ${application.loan_to_value} and portfolio risk exceed Addendum C appetite.</div>
          <div><b>Fair Lending Compliance</b> — reasons map to permissible factors under Reg B §1002.6; no prohibited-basis proxy detected.</div>
          <div><b>Customer Advocate</b> — escalate note: applicant near DTI margin; document compensating-factor path.</div>
          <div><b>Macro Contrarian</b> — concur: no evidence to override the credit-floor block.</div>
        </div>
      </details>
      <div class="actions">
        <button class="btn primary" id="sign">Sign off &amp; seal the record</button>
        <button class="btn danger" id="dispute">Dispute / return to model team</button>
      </div>
    </div>

    <div class="rail">
      <div class="banner idle" id="banner">
        <div class="h" id="bh">◷ Not yet sealed</div>
        <div class="s" id="bs">Sign off to seal a tamper-evident record. The examiner verifies it offline — this is a preview of what they'll see.</div>
      </div>
      <div class="railpanel">
        <h3>Provenance</h3>
        <ul class="spine">
          <li class="node"><b>Source</b> — loan application intake</li>
          <li class="node"><b>Application</b> — signals FICO/DTI/LTV recorded</li>
          <li class="node"><b>Council verdict</b> — DENIED + 4 reason codes</li>
          <li class="node" id="node-notice"><b>Notices</b> — §1002.9(b)(2) text<span class="diff" id="notice-diff">AI-drafted → officer-edited (both sealed)</span></li>
          <li class="node" id="node-seal"><b>Sealed record</b> — <span id="seal-state" style="color:var(--t3)">pending sign-off</span></li>
        </ul>
      </div>
      <div class="railpanel">
        <h3>Signing identity</h3>
        <div class="fp">key <span class="mono">prod-2026-Q3</span><br><span id="fp" class="mono" style="font-size:11px">fingerprint —</span></div>
      </div>
      <button class="btn primary" id="export" disabled style="width:100%">Export examiner pack</button>
    </div>
  </div>

  <div class="foot">Independent + open-source (MIT). The sealed record re-verifies offline — <span class="mono">npx shadow-verify bundle.json --public-key k.pem</span> — with no account and no trust in Shadow. · <a href="https://github.com/alex-jb/shadow-mentor">github.com/alex-jb/shadow-mentor</a></div>
  <div class="critique">Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 — mockup for docs/APP_DESIGN_BRIEF (review-sign screen, thin scope)</div>
</div>

<script>
const PUBKEY=${JSON.stringify(pubkey)};
const CLEAN=${bundleJson};
${VERIFY_JS}
const $=id=>document.getElementById(id);
let edited=false, sealed=false;

// F2 — editing a notice flips the card to "edited" and surfaces the AI→edited diff node.
document.querySelectorAll(".notice").forEach(t=>{
  t.addEventListener("input",()=>{
    const card=t.closest(".rcard");const was=t.value!==t.getAttribute("data-orig");
    card.classList.toggle("edited",was);
    const st=card.querySelector("[data-state]");st.textContent=was?"edited":"grounded";st.className="state "+(was?"edited":"grounded");
    edited=[...document.querySelectorAll(".notice")].some(x=>x.value!==x.getAttribute("data-orig"));
    $("node-notice").classList.toggle("hasdiff",edited);
  });
});

async function fingerprint(){try{const der=pemToSpki(PUBKEY);const d=await crypto.subtle.digest("SHA-256",der);
  const hex=[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
  $("fp").textContent=hex.slice(0,16).replace(/(.{4})/g,"$1 ").trim();}catch(e){}}
fingerprint();

function step(name,cls){const el=document.querySelector('[data-step="'+name+'"]');if(el){el.className="step "+cls;}}

$("sign").onclick=async()=>{
  // seal → checklist advances → F7: signing AUTO-fires the rail verify (no separate click)
  sealed=true;
  step("notice","done");step("signed","done");step("ready","done");
  $("seal-state").textContent=edited?"sealed (AI-drafted + officer-edited both covered)":"sealed";
  $("seal-state").style.color="var(--ok)";
  const r=await verifyBundle(CLEAN,PUBKEY);
  const b=$("banner");b.className="banner ok";
  $("bh").textContent="✓ Signature valid · chain intact";
  $("bs").innerHTML="<span class='mono'>Ed25519 · key prod-2026-Q3 · "+(r.sourceResolution==="VERIFIED"?"source VERIFIED":"")+"</span> — this is what your examiner will verify, offline.";
  $("sign").textContent="Sealed ✓";$("sign").disabled=true;$("export").disabled=false;
};

$("dispute").onclick=()=>{
  const note=prompt("Return to model team — state the substantive disagreement (recorded + sealed as exam evidence):","Reason code AA04 (portfolio risk) not substantiated for this obligor mix; request model-team review before notice issues.");
  if(note===null)return;
  step("signed","done");step("ready","done");
  const b=$("banner");b.className="banner dispute";
  $("bh").textContent="⚑ Disputed — returned to model team";
  $("bs").textContent="The verdict is immutable; your disagreement is now part of the sealed record. A documented challenge is good exam evidence.";
  $("seal-state").textContent="sealed (disputed — returned)";$("seal-state").style.color="var(--warn)";
  $("node-notice").classList.add("hasdiff");$("notice-diff").textContent="analyst dispute note (sealed)";
  $("export").disabled=false;$("sign").disabled=true;
};
$("export").onclick=()=>alert("Mockup: exports the typed examiner pack — adverse-action notice (PDF) + reason-code report + the signed bundle (ZIP) that re-verifies offline + a read-only examiner link.");
</script>
</body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "index.html"), html);
console.log("[build] demos/adverse-action/review-sign-mockup/index.html  (review-and-sign screen — three-zone, verify-as-rail, dispute path, reuses the corrected verifier)");
