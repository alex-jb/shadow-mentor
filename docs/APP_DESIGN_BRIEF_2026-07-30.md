# Shadow — product app design brief (界面设计方案)
*The compliance-officer-facing application, not the marketing site. 2026-07-30. Complements `KIMI_WORK_ORDER` (which covers orshadow.com the marketing site).*

> Scope: the actual tool a **fair-lending / model-risk compliance officer** at an EU-exposed fintech lender uses to turn an AI-denied credit decision into an exam-ready, independently-verifiable adverse-action record. Backbone below (screens + flows + IA) is grounded in the shipped wedge (`lib/adverse-action-review.js` / `bin/shadow-adverse-action.mjs` / `api/adverse-action.js` / the worked-example page). Visual language + borrowed patterns + JTBD validation are fed by the four research streams (RegTech IA · officer JTBD · verifiability-made-visible · sober fintech visual language) — folded in below.

---

## ⚑ Review outcome (autoplan, 2026-07-31)
Ran the CEO → Design → Eng → DX pipeline (subagent voices; Codex unavailable). Decisions + findings below are now part of this brief.

### Scope decision (premise gate — Alex chose: cut to the thin path)
The 6-screen app over-builds before a customer, and the buyer (§5) lives *inside* their GRC/LOS, not in a new destination app. **Build/design only three surfaces:**
1. **Verify** — offline, accountless (standalone tab + the examiner's shared read-only link). This is the trust hero.
2. **Export / examiner-pack** — report + bundle + pubkey, download-first.
3. **ONE review-and-sign screen** — a single decision: reason codes + editable notice + sign-off.

**Vision-only (Figma / deferred, build only when a design partner asks):** Decisions work-queue + filters, Settings/key-management UI, LOS/GRC connectors. Shadow stays **stateless by default** — it transforms one decision passed to it and returns a portable, self-verifying artifact; it does not become a second book-of-record against the LOS. **Real next move = a services-led pilot on one lender's real denied applications, not a SaaS build.** (CEO review + memory `shadow_strategy_pivot_2026_07_30`.)

### Build-blocker status (2026-07-31)
✅ **B1 shipped** (`c2a3e12`) — plaintext bound + rebound; the BLOCK→APPROVE tamper is caught in core/CLI/API/verify.html/live demo. ✅ **B2 shipped** (`c2a3e12`) — legible error, not a crash. ✅ **B3 shipped** — `npx shadow-verify` installable CLI in `shadow-attest-core`. ✅ **B5 shipped** — one shared browser verifier + cross-impl golden test. 🟡 **B4 down-payment** — `draft` mode added; full seal-at-sign-off flow deferred until the app is built for real (per the don't-over-build call). ✅ **Three thin screens mockup'd** — Verify + review-sign + Export (Radix Blue, hallmark, real verifier). ✅ **§4 folded**.

### 🔴 (historical) MUST FIX before any screen — now addressed above
- **B1 — Bind the plaintext to the signature.** *(Eng C1 + DX #3 + brief §7 — the cross-phase theme, verified in code by two reviewers.)* The bundle stores `payload_hash` + a self-referential `payload_ref` with an **empty inline `payload:{}`**; the real verdict/AA-codes/notice live only in the unsigned `report.md`. `verifyBundle` never recomputes `sha256(canonical(payload))===payload_hash`. Result: edit the displayed verdict BLOCK→APPROVE, leave the bundle byte-identical → still GREEN. The worked-example asserts "exactly what was sealed" — **currently false**. Fix: embed canonical payloads inline (or a content-addressed sidecar resolved against `payload_ref`); make all verifiers recompute + assert the hash and surface `source_resolution: VERIFIED`; render notice text **from the resolved+rebound payload**, never a side channel. Until this lands, the README + demo over-claim — scrub or fix before launch.
- **B2 — Validate input before the council.** *(DX #2.)* `run-loan-council.js:80` does `loan.debt_to_income.toFixed(2)` unguarded → `Cannot read properties of undefined` on any real LOS JSON. `normalizeLoan`/`validateLoan`/`LOAN_DEFAULTS` already exist in `lib/schemas/loan.js`; wire them in the shared lib so CLI + API both emit `missing required field 'debt_to_income' (expected number 0–1)`.
- **B3 — Ship an installable verifier CLI.** *(DX #1.)* Neither root `package.json` nor `shadow-attest-core` has a `bin`, and `files[]` excludes `bin/`. Give `shadow-attest-core` a `bin` (`shadow-verify` → thin `verify.mjs` in `files[]`) so a regulator can `npx shadow-verify bundle.json --public-key k.pem` with zero clone. This is what makes "trustless outside the vendor" true instead of true-if-you-clone.
- **B4 — Seal at sign-off, with a persistent key.** *(Eng H2/H3.)* Today `reviewAdverseAction` seals eagerly at compute time with a fresh ephemeral key. Split: `/api/adverse-action` returns an *unsigned draft*; a seal-at-sign-off path takes the final edited notices + a persistent key. Block Export + sign-off on ephemeral keys (hard-label them). Keep signing server-side/CLI — **do not** hold the private key in the browser (Eng H4 XSS).
- **B5 — One verifier module.** *(Eng M1.)* Three divergent hand-copied `verifyBundle` (Node `session.js`, `verify.html`, `try/index.html`). Extract one zero-dep ESM `verify-bundle.mjs`, import everywhere, cross-test against the Node verifier with golden vectors. Build the screens on this, not copy-paste.

### Design changes folded in (auto-decided, structural)
- **Verify is a ~400px right RAIL on the review-sign screen, not a 60% pane** *(Design F1)* — it's near-tautological there (the officer signed it 4s ago). Verify-as-full-hero only on the Verify tab + the examiner shared link. Rail copy = "preview what your examiner will see."
- **Signing auto-triggers the rail verify** *(F7)* — act→confirmation resolves in place (no animation, §6 rule 10).
- **The reason-code card gets its own spec** *(F2)* — 5 states (unedited / officer-edited / grounded / ungrounded-refusal / over-4-cap); ungrounded = a visibly distinct **refusal block**, not a greyed "loading" card; ≤4 is an inline warning at card 5. **Seal BOTH the AI-drafted original and the officer-edited final, and make that diff a first-class provenance node** — the edit is the exam-relevant evidence, not chrome.
- **Add a dispute path** *(F3)* — the officer is the "effective challenge" second line; give them "Dispute / return to model team" (mandatory note) → a sealed terminal "Disputed — returned" state. Verdict stays immutable; the disagreement becomes record.
- **Three verify outcomes, not two** *(F4 + Eng M2)* — **GREEN/AMBER** valid (amber = chain intact but signing key unconfirmed/rotated, via fingerprint compare vs `/api/attestation-info` — wire M3 so that endpoint actually returns the Ed25519 key), **RED** = valid bundle, integrity broken at seq N, **GREY** = not a verifiable Shadow bundle / unreadable. A parse error must never borrow the tamper-RED (false accusation).
- **Every RED ends in a recovery door** *(F6)* — re-ingest from source, escalate/flag, or export-the-failure-as-evidence-of-tamper.
- **Tamper locus names the pair** *(Eng M4 + DX #5)* — report "chain broken between seq 2 and seq 3" (attribute to the edited event), not a bare downstream "seq 3." Test: reported-seq === mutated-seq.
- **Council rationale = plain labeled text blocks, no avatars** *(F14)* — the §7 no-council-theater rule, enforced at the component layer.
- **Accent = Radix Blue `#3E63DD`; migrate the teal; collapse info-blue into the accent** *(F13)* — teal sits in the blue-green band too close to verify-green (the one semantic collision a trust product can't afford); Radix Blue reads institutional-financial without indigo's purple "AI-startup" tell. Applied in §3 below.

### Don't-erode list (reviewers praised these — keep)
Ephemeral-key fallback (zero-setup records that still verify) · `verify.html`'s honest limits matrix + "verify the verifier" tab + "external requests: 0" panel · real-tamper failure legibility (plain-English impact + downstream consequence) · the sans/mono grammar + light-default/dark-first-class + the hash-display atom · the anti-slop copy discipline. The brief nails the *proof* and under-served the *work* — the fixes above rebalance toward the officer's actual job without touching the strong parts.

---

## 0 · The one job (design north star)
When a fair-lending exam or a GDPR Art. 22 request lands, the officer must produce, per denied applicant: the **specific** reason(s) for denial (Reg B §1002.9(b)(2)), a compliant notice, and proof the record wasn't rewritten after the fact. Today that's a three-week scramble across the model team, the LOS, and spreadsheets. **The app collapses it to an afternoon and makes the proof self-verifiable — by someone who doesn't trust us.**

Every screen is judged against: *does this help the officer survive the exam faster, and does it make the record more defensible?* If not, cut it.

---

## 1 · Screen inventory + information architecture
> *Full-vision inventory below. Per the review outcome, only **Verify · Export · one review-and-sign screen** get built now; Decisions-queue / Settings / LOS are Figma-vision. Screen B is the review-and-sign screen with verify as a right RAIL (not a 60% pane).*

**The atomic object is a Decision (adverse action), keyed to an Application ID — NOT a "case" or "model run"** (per JTBD §5: it's the native noun and it's what the examiner asks for). Top-level nav:

1. **Decisions** (default) — the work queue. AI adverse actions (denials/downgrades/term-changes) needing specific-reason documentation + verification.
2. **Verify** — standalone offline bundle verifier (drop a bundle → ✓/✗). Also the public trust surface; same engine as `verify.html`.
3. **Exports** — exam-ready records already produced (report + bundle + pubkey), packaged "hand this to your examiner."
4. **Settings** — signing identity (the bank's persistent Ed25519 key + fingerprint), reason-code dictionary, model manifest, data-handling.
5. *(footnote)* **Research / what's next** — spatial/XR, session-level bundles. Never top-nav parity. Mirrors the site brief's demote-XR rule.

### Screen A — Decisions (list / work queue)
Dense data table (the officer's home). One row = one adverse-action decision.
- Columns: `[status] · Application ID (mono) · Decision date · **30-day clock** (days remaining, amber <7, red overdue) · Model/version · **Override/exception** flag · Principal reasons (≤4 code chips) · Notice status · Verified?`
- **Override/exception is a first-class column + filter** — it's the examiner's first request and the highest-risk bucket.
- Status ladder: `Needs reasons → Notice drafted → Signed off → Exported`.
- Filters: by status, by model, by reason code, by date range, **"override/exception only,"** **"flagged for exam,"** "clock <7 days."
- Bulk: select N → "produce exam pack." Row click → Screen B.
- Empty state: "Connect your LOS or drop an adverse-action decision to start" (→ Screen C). Sober, mono CLI alt (`shadow adverse-action ./decision.json`).

### Screen B — Case detail (THE core screen; two-pane)
Left / main column — **the decision & the notice**:
- Applicant signals band: FICO · DTI · LTV (tabular figures), model + version, decision timestamp, **30-day-clock chip**, **override/exception flag** if present.
- **Reg B / ECOA §1002.9(b)(2) principal reasons** — each as a card: code, plain-language label, the drafted notice text (editable), the ECOA rights block. **≤4 reasons** (the UI caps/warns past 4 — "more than four is not likely to be helpful"). A code that couldn't be grounded shows a **refusal, not a guess**. **Never label an ECOA reason a "key factor"** — that's the FCRA term and mislabeling gets lenders cited; the component enforces "principal/specific reason" language.
- **Human sign-off**: the officer reviews, edits prose, and signs. The **deterministic verdict is NOT editable** (integrity); only the notice prose is. Sign-off seals the bundle.
- Council reasoning (collapsible): the 5 voices' rationale — labeled "rationale for human reviewers; does not change the verdict." Never surfaced as "AI explanation" on the artifact (JTBD trust-break).

Right / rail — **the evidence & the proof**:
- Provenance chain (source → application → council verdict → notices → sealed record), as an ordered, inspectable timeline.
- **Verify control** (the hero interaction — see Screen D).
- Key fingerprint + signing identity used.
- "Export exam pack" primary action.

### Screen C — Ingest / new case (Screen E entry)
- Drop an AI-denied application (JSON now; CSV + LOS connectors next) → runs the council locally → produces report + bundle.
- Honest banner: fixture/model status; "no applicant PII leaves your environment when self-hosted."
- Approved-application path: explicitly show "not denied — nothing adverse to notice" (mirrors the `approved` branch in code).

### Screen D — The verify moment (the value made physical)
The interaction the whole product exists to earn. Applies inline (case rail) and standalone (Verify tab).
- Idle → click **Verify** → local Ed25519 + SHA-256 check → **GREEN** "✓ verified — not altered since signing (key <fingerprint>)" or **RED** "✗ failed — altered after signing, at step N."
- **Inspectable, not a badge**: expose the batch root hash, the per-event chain, WHERE a tamper broke it (the exact seq), and the key fingerprint. Let the user re-run it. "Tamper" affordance in demo builds shows the red path live.
- Offline-first: state plainly "this ran in your browser; no network, no trust in Shadow." (Verified by the zero-telemetry posture.)

### Screen E — Export for examiner
- One action bundles: the exam-ready report (PDF/MD), the signed evidence bundle (JSON), the public key (PEM), and a one-page "how to verify this yourself offline" for the examiner (CLI + verify.html).
- Shareable read-only link OR download. The examiner verifies without an account, without Shadow.

### Screen F — Settings / signing identity
- The bank's persistent Ed25519 key (generate / import / rotate) + fingerprint pinning. Ephemeral-demo key is clearly labeled as non-production.
- Reason-code dictionary (the Reg B mapping — the moat) and model manifest.
- Data-handling statement (local-first, no upload).

---

## 2 · Core user flow (happy path)
`Cases → open denied case → review reason codes + notice → edit prose → sign off (seals bundle) → Verify (green) → Export exam pack → hand link/PDF to examiner → examiner verifies offline`.
Failure branch that MUST feel good: a tampered/failed record → RED verify → the app names the exact broken step. That's not an error state to hide; it's the product working.

---

## 3 · Visual language
**Posture:** near-monochrome canvas · one accent on <10% of pixels · hairline borders instead of shadows · **mono type carries every cryptographic/identifier value** · tabular figures on every number. Reads as an *instrument*, not a brand. Reference DNA: Linear (mono + single accent, keyboard density) · Stripe/GitHub Primer (audit-legible tables + status system) · Vercel/Geist (border discipline) · Sigstore/Vanta (provenance signaled through restraint).

### Typography — commit to this
- **UI sans: Inter** (self-hosted, variable) — best-in-class OpenType numerics for dense financial tables. *Cohesion swap:* Geist Sans if we want "Vercel-native"; keep Inter since table numerics dominate.
- **Data/crypto mono: JetBrains Mono** — unambiguous `0 O 1 l I`, non-negotiable when a human eyeball-compares a SHA-256 / Ed25519 value.
- **The grammar:** sans = human-readable magnitude (money, DTI/LTV, FICO, %); **mono = machine-verifiable identity** (hashes, signatures, key fingerprints/IDs, case/decision IDs, reason codes AA01–AA06, ISO-8601 timestamps, `previous_hash`, `dictionary_hash`, JSON, CLI). Enforce as a lint rule if possible.
- Inter feature flags where numbers live: `font-feature-settings:"tnum" 1,"cv05" 1,"ss03" 1;` (tabular + disambiguated `l`).
- Scale (px/LH/wt): display 30/36/600 · title 24/32/600 · h2 20/28/600 · h3 16/24/590 · body 14/22/400 · **sm 13/20/400 = table default** · meta 12/16/450 · micro 11/14/600 uppercase +0.04em · mono-sm 12.5/18 · mono-xs 11.5/16. **Body/table run 13–14px, never 16 (16 = consumer-marketing tell).**

### Color — one accent, ration it
Anchored on GitHub Primer semantics + Linear monochrome discipline. **Accent = Radix Blue `#3E63DD`** (RESOLVED — see review outcome F13). Accent appears ONLY on primary button / active nav / focus ring / links / selected-row rail — **never behind data, never as a fill under numbers.**
> **Why Radix Blue, not teal or indigo:** teal `#12a594` (the worked-example/Kimi seed) sits in the blue-green band close enough to verify-green that the eye conflates "brand teal" with "verified-green semantic" — the one color collision a trust product cannot afford. Indigo `#5E6AD2` carries a purple "AI-startup" cast a conservative bank buyer reads as un-serious. Radix Blue is institutional-financial (the Stripe/Plaid/banking-dashboard blue) with zero overlap against green/red/amber. **Migrate the teal seed. And collapse the semantic info-blue into this accent** (`#3E63DD` is a near-neighbor of the old info `#1F5EDB` — a compliance readout doesn't need a separate decorative info hue; one blue).

Light (default) tokens — `bg #FCFCFD · surface #FFF · surface-sunken #F6F7F9 · border-subtle #ECEDEF · border #DDE0E4 · border-strong #C4C8CE · text-1 #14161A · text-2 #565C63 · text-3 #878D95 · accent #5E6AD2 · accent-bg #EEF0FB`.
Dark (first-class) — `bg #0C0D10 · surface #141619 · surface-sunken #0F1013 · border-subtle #1F2227 · border #2A2E35 · text-1 #EBEDF0 · text-2 #9AA1AB · text-3 #6B7178 · accent #7B85E0`. (Never `#000`/`#fff` pure.)
Semantic (text / light-tint / dark-text): **verified-green** `#1A7F37`/`#E6F4EA`/`#3FB950` · **failed-red** `#B42318`/`#FDECEA`/`#F85149` · **flagged-amber** `#9A6700`/`#FFF8E1`/`#D29922` (brown-gold, AA on white) · **info-blue** `#1F5EDB`/`#E7F0FE`/`#58A6FF`. **Every status is word+icon+color (3 redundant channels)** so it survives greyscale print (audit PDFs) + colorblind auditors — never color-only. Full CSS token block lives in the D research output; port verbatim.

### Density & spacing
Base unit **4px** (`2 4 6 8 12 16 20 24 32 40 48 64`). **Table row 36px** default (32 compact toggle / 44 two-line), cell padding `0 12px`, first/last `16px` gutter. Panels 16/20/24px. Controls 32px (28 toolbar). Icons 16px inline / 14 dense cell / 20 section-header. Tables full-bleed; prose/config cap 720px. Radius 4 (badges/inputs) / 6 (buttons/cards) / 8 (modals). **No pills** except the 8px status dot.

### Component specs (buildable)
- **Data table (case list — the spine):** zebra OFF; rows separated by 1px `border-subtle` bottom only (stripes = Bootstrap tell). Sticky `surface-sunken` header, uppercase micro labels. Row 36px/13px, hover `surface-sunken`, selected `accent-bg` + 2px left accent rail. Columns: `[status] · Case ID (mono, trunc) · Decision type · Model · Amount (tnum, right) · Flags · Verified (badge) · Timestamp (mono, right) · ⋯`. Numeric right-aligned tabular; ID/hash left mono. Keyboard-first (`↑↓` move · `↵` open · `⌘K` palette · `/` filter) with a footer hint bar — signals "tool for professionals."
- **Case-detail two-pane:** left fixed 40% (min 420px) = decision under audit; right 60% = verification & provenance (verify banner top → timeline → hash/sig block → collapsed JSON). 1px draggable divider, hairline only. <1100px stack, **verify result first**.
- **Status badges:** dot+label (tables) or solid-tint (headers), never full-saturation fills. `✓ Verified` · `✕ Failed` · `⚑ Flagged` · `◷ Pending` · `● Signed` · `⟲ Superseded`.
- **Verify result banner (the emotional peak — must survive a screenshot in an audit memo):** three honest degrees (not binary) — **pass** = 3px `--ok` rail + `--ok-bg` + `✓ Signature valid · chain intact` + mono sub-line (`Ed25519 · key prod-2026-Q3 · verified <ts> UTC`); **⚠ partial** = `--warn` + `chain intact but signing key unconfirmed / rotated`; **fail** = 3px `--fail` rail + the *specific* broken invariant in mono (`hash mismatch at chain index 4`), never a generic "error." Banner is a **door** → expands to the inspector (fingerprint + root + algorithm-in-plain-words). ~64px, 120ms fade-in only. No confetti/pulsing — this is evidence, not a celebration.
- **Hash/signature atom:** `sha256:3f9a…c2e1` truncated mono-xs + hover-copy (icon→✓ 1s), `user-select:all`, full value in tooltip; detail variant = full hash `word-break:break-all` + algo chip + fingerprint-compare against `/api/attestation-info`.
- **Provenance timeline:** flat 2D vertical spine of the hash-chain (`previous_hash→hash`); 10px ring nodes, filled `--ok` when link verified, `--fail` ring + red rail segment when broken; broken-link is the star — show mismatching pair side-by-side with differing bytes highlighted. (Depth/3D reserved for a dedicated replay view, not the product spine.)
- **JSON viewer:** `surface-sunken`, mono 12.5, muted 4-hue syntax (keys text-1 · strings info · numbers ok-tone · null warn-tone), line numbers text-3, `Signed` badge + covering signature pinned at header, arrays >20 collapse.
- **Empty states:** sober, no mascots — 1px dashed container, one state line + one action, often a **copy-able mono CLI snippet** (`shadow verify ./audit-log.json`) because the audience lives in a terminal (reads as infra, not SaaS).

### Light vs dark default
**Default LIGHT; dark fully first-class (one-keystroke `⌘⇧L`, persisted).** The primary user produces *audit evidence* — screenshots/PDFs pasted into examiner memos & board decks, consumed on white; light is the format of record and reads "regulated-institution serious" (Stripe/Vanta/Drata all default light). But the secondary audience is the engineer installing the CLI in a dark terminal — dark must be pixel-equal, not an afterthought. *Light default, dark first-class* resolves the "audit-grade AND infra-credible" tension exactly.

## 4 · Borrowed IA + case-detail patterns (RegTech teardown)
**Positioning seam, confirmed:** governance tools (Credo/Holistic/Dataiku) log *that* a review happened; observability tools (Fiddler/Arize) *explain* a prediction but never attest it. **None ships a cryptographically verifiable, tamper-evident, offline-re-verifiable record of a *specific* AI decision bound to a regulatory control.** That gap is Shadow's wedge — patterns #5 + #8 are where the UI makes it visible.

**Canonical compliance-tool IA everything converges on** (the full vision; our thin build uses the ⭐ parts):
`Dashboard (action-items: expiring evidence, SLA/deadlines) → Case Queue (dense triage table) → Case Detail (three-zone canvas) → Evidence Library / Audit Trail → ⭐Reports/Export (typed bundle + auditor portal) → Frameworks/Controls/Policies`. **Two status streams always kept separate: machine readiness (test passed/failed) vs human/auditor verdict — every SOC 2 vendor refuses to conflate them** (maps to our §3 F9 fix: workflow-status ladder ≠ verification result).

**Canonical case-detail = three-zone canvas** (Unit21 + Persona + Hummingbird): summary band above the fold · **left rail = a guided completion checklist, not nav** (turns audit documentation into a byproduct of the work) · tabbed evidence workspace (density via tabs, not one scroll) · **right rail = decision surface + persistent event timeline, kept distinct from the evidence-reading surface** ("read left, decide right").

**8 borrowable patterns → mapped to the thin scope:**
1. **Read-left/decide-right three-zone** (Unit21+Persona) → the **review-sign screen**: applicant summary band top · left = adverse-action completion checklist (reasons selected → notice drafted → signed → examiner-ready) · center = evidence · right = the verify rail + sign/dispute actions. (Reconciles with §3 F1's rail.)
2. **Required-checks-pinned-to-top + yellow=no-evidence** (Persona Verifications + Arize) → the **reason-code card**: principal §1002.9(b)(2) reasons pinned top, rows expand to model evidence, green-check / red-x / **amber = "no evidence available" as its own audible state** (matches F2's ungrounded-refusal state — absence of evidence is never silent in a verifier).
3. **Signed attribution bars + plain-language reason side by side** (Fiddler grammar + Datricks) → show the decision's contribution breakdown as signed horizontal bars (**blue/red = weight direction**) next to an officer-readable sentence — and **reserve red/amber/green strictly for status/severity, never for weight direction** (Unit21's explicit caution; protects our verify-green).
4. **Typed, control-bound evidence objects** (Credo AI) → model the bundle so each reason code declares its evidence type `{quantitative result | document | human attestation}`; Technical evidence (the hash-chain results) vs Documentation evidence (the officer sign-off). "Verified" only when every reason's required evidence is satisfied.
5. **Provenance ledger + immutable signed export** (Vanta API-Requests ledger + Exports) → **Shadow's differentiator made legible**: a ledger row per computation (what/when/from where/result) capped by the immutable signed export — the on-screen form of the hash chain. Incumbents' weakest surface; our strongest. *This is what the Verify screen already exposes (source_resolution + batch root + fingerprint) and the Export screen must package.*
6. **Mandatory reason-code baked into the action** (Persona + ComplyAdvantage) → the reason-code selector is a *required field on the sign action itself*, not a separate form — models Reg B directly (no adverse action commits without its principal reasons attached).
7. **Feedback ≠ final-approval gate** (Dataiku Govern) → for the MRM buyer, separate optional Feedback (Fair-Lending / Model-Risk category; Approved / Minor / Major) from a single mandatory Final Approval that **gates** examiner-ready. Don't collapse "comment" and "approve." (Pairs with §3 F3 dispute path.)
8. **Export = one-click typed document bundle, not a raw PDF** (Holistic Documentation Package + Drata/Secureframe auditor portal) → the **Export screen**: named artifacts (adverse-action notice PDF · reason-code report · **signed bundle ZIP that re-verifies offline**) + a read-only examiner portal scoped to one case ("both sides see the exact same state," Read-Only tier), with observation-window scoping + lock-on-completion so a shared case can't be silently altered after handoff.

## 5 · JTBD / vocabulary / trust-framing (validated)
**Who:** a **second-line control function** — fair-lending analyst (Compliance) or model-validation analyst (MRM). Does NOT make loans; sits *behind* the LOS + the model, lives in **spreadsheets + GRC tools** (RiskExec, Wolters Kluwer Fair Lending Wiz, Ncontracts, 360Factors). Perpetually assembling evidence for two audiences: a **CFPB/prudential examiner** and their own **MRM "effective challenge" committee.** Deep anxiety = the exam + the enforcement action behind it, because the law puts *the lender* (and them personally), not the vendor or the algorithm, on the hook.

**The legal chain Shadow produces evidence FOR (slots between step 3 and step 5):**
1. Application completes → the **30-day ECOA clock** starts when the creditor has all info it normally considers (not at submission).
2. The AI/ML model denies/downgrades → this is the **adverse action**: a **decision** with an ID tied to an applicant.
3. Someone must map model output to **specific principal reasons** — §1002.9(b)(2): reasons must be **specific** and "relate to and accurately describe the factors actually considered or scored," **max ~4** ("more than four is not likely to be helpful"). **FCRA "key factors" do NOT satisfy the ECOA "specific reasons" requirement** — conflating them gets lenders cited. ← *Shadow's core job.*
4. Notice goes out within 30 days. Generic language fails: under Reg B §1002.9(b)(2) the reasons must be specific and accurate; **model complexity is no excuse** — "a creditor's lack of understanding of its own methods" and "did not meet our proprietary model" do not satisfy the statute. *(Anchor on the durable ECOA/Reg B statute, not a specific CFPB circular by number — the 2022/2023 adverse-action circulars were withdrawn; updated 2026-08-05.)*
5. Evidence retained + must **survive an exam months/years later**. Under the Interagency Fair Lending Exam Procedures, examiners request **override/exception logs** (exceptions to score cutoffs, both approvals AND denials), do **comparative/matched-pair file review**, and (2024 CFPB) require "written copies of the complete results of all analyses." **Overrides + exceptions are the single highest-risk bucket.**

**EU angle is legally live TODAY:** GDPR Art. 22 + **Schufa C-634/21** (CJEU, 7 Dec 2023 — a credit score *is* automated decision-making; Art. 15(1)(h) grants a right to "meaningful information about the logic"). Cite this, NOT "EU AI Act" (credit-scoring high-risk obligations deferred to Dec 2027; sophisticated buyers know it).

**Native vocabulary the UI MUST mirror (in order of centrality):** Application → **Decision** → **Adverse action** (atomic unit = the **decision**, keyed to Application ID) · **principal/specific reasons** (ECOA) — *deliberately distinct from* **"key factors" (FCRA); never label an ECOA reason a "key factor"* · **reason codes** · **overrides / exceptions** (examiner's first request, highest risk) · **matched pairs / comparative file review / similarly-situated / prohibited basis** · **notice** + **30-day clock** · **effective challenge / conceptual soundness / model inventory / findings** (the MRM/SR-side buyer) · "documentation that survives an exam" = their success metric.

**Top trust framings (lead with the reg section, never the technology):**
| Trust-EARNING | Trust-BREAKING |
|---|---|
| "The **specific principal reasons** required by **ECOA/Reg B §1002.9(b)(2)** — not FCRA key factors." | "AI-powered explanations" (any "AI" adjective on the *compliance* artifact — the model IS their problem). |
| "**Evidence that survives an exam** — offline-verifiable record of the exact factors behind each decision, on the date made." | "Trust our audit trail" (unverifiable; they've been burned by vendor logs examiners rejected). |
| "**The lender remains liable — model complexity is no excuse under Reg B §1002.9(b)(2).** Shadow closes that gap." | "Set-and-forget / fully automated compliance" (regulators say automation doesn't shift responsibility). |
| "Reconciles the **notice sent** vs the **model's actual reasons**; flags **override/exception** decisions." | "Explainable-AI dashboard with SHAP values" (SHAP is an input, not the deliverable; sells to data science, not Compliance). |
| "**EU-ready: GDPR Art. 22 + Schufa C-634/21**, per decision." | "EU AI Act compliant" (over-claim; deferred to 2027). |

**Meta-rule for all app copy + empty states:** this buyer is defensive, personally exposed, regulation-fluent. Trusts **specific citations, admissions of the lender's own liability, examiner vocabulary**; distrusts **superlatives, "AI magic," any framing that implies the tool absorbs their accountability.** The enforcement headline that keeps them up — the **Mass. AG's AI-underwriting disparate-impact settlement (2025, ~$2.5M, Earnest)** whose remedy terms map ~1:1 to what Shadow produces — is the fear to *mirror*, never dismiss. *(Dropped the VyStar reference — it's a UDAAP/ops case, not fair-lending/AI. Verify the Earnest figure before external use.)*

## 6 · Making verification legible + anti-slop rules
**Earned vs hollow (extracted from Sigstore/Rekor · C2PA Content Credentials · GitHub Verified · Etherscan · CT/Keybase):** earned = badge is a *door*, user can *re-run the check locally*, exposes *key fingerprint + algorithm*, admits *degrees & failure*, points to *WHERE* a tamper broke it, proof is *reproducible outside the vendor*. Hollow = static image, server-side "trust us," no key, only-ever-green, binary with no locus, proof lives only inside us. Rekor's lesson is the whole product thesis: *the crypto is sound but illegible when CLI-only — Shadow is the legible UI over the same re-runnable proof.*

**The 10 verify-moment patterns (build these):**
1. **The badge is a door, never a sticker** — GREEN expands into an inspector: Ed25519 **key fingerprint** (short hex groups, Keybase-style), signing **timestamp**, SHA-256 **chain root**, **algorithm in plain words** ("Ed25519 signature over a SHA-256 hash chain").
2. **User-triggered + re-runnable + local** — a visible **"Re-verify (runs in your browser, offline)"** button + "we never phoned home — this used only the file and the public key." The value prop must be a literal button, not a claim.
3. **Render the hash chain as a visible spine** — each step a node with truncated-copyable SHA-256, `prev_hash → hash`, next to a plain label ("Step 3: adverse-action reason codes computed"). The chain IS the audit trail — make it the hero object.
4. **On failure, point to WHERE** — never generic "failed." Render the chain with the tamper locus lit: "✗ altered after signing — intact through step 4, broken at step 5," step-5 node red, **expected-hash vs recomputed-hash side by side**. Locating the tamper is the single most credibility-defining behavior.
5. **Degrees, not binary** — like GitHub: `✓ signature valid AND chain intact` / `⚠ chain intact but key unconfirmed / rotated` / `✗ broken`. Admitting uncertainty out-trusts always-green. *(Enriches the §3 verify banner — add the amber middle state.)*
6. **Public key independently checkable out-of-band** — fingerprint in comparable hex groups + link to fetch the same key independently (`/api/attestation-info`, `/.well-known/`-style). Verification you can only do with keys the vendor hands you is circular.
7. **Timestamp everything** — immutable "signed at" + live "verified just now, in your browser." Freshness + immutability = tamper-evidence.
8. **Copyable self-contained proof + a second path** — "Copy verification command" / "Download evidence bundle" so a skeptical regulator re-runs the same check with the CLI (`bin/shadow-verify.mjs`) or Python, outside the browser. Reproducible-outside-the-vendor separates earned from hollow.
9. **Translate every crypto fact in plain language beside the raw value** — Etherscan's failure is assuming expertise; Shadow's users are regulators + borrowers. Raw value for the expert, one sentence for everyone else.
10. **Static, monochrome, no motion on the verdict** — instrument readout, not a celebration. No confetti, no toast, no scroll-fade; green/red carried by one reserved semantic color against neutral ink. A verdict that animates reads as marketing; one that's just *there* reads as fact.

**Anti-slop checklist (this is a trust product — "looks generic = looks untrustworthy"; hallmark skill is the spec):**
- **Color/bg:** zero gradients (no purple→blue hero, no `background-clip:text` headline, no aurora/orbs); one accent, semantically reserved (for a trust product, reserve the verify green/red hard — never spend verify-green on a decorative button); **do NOT default to dark as a reflex** (the #1 AI tell — light is chosen here for a reason, §3); every color/font via `var(--token)`.
- **Type:** two faces, real hierarchy (not Inter-everywhere → our sans+mono split IS the hierarchy); headlines roman solid ink; **`tabular-nums` on every hash/key/timestamp/number**; curly quotes + real `—` `…`.
- **Layout:** no 3-column icon-card feature grid, no card-in-card, no glassmorphism; break symmetry (don't center everything); no genre-blind AI-nav/AI-footer — chrome should read like a **record viewer**, not a SaaS marketing shell.
- **Icons/motion:** no emoji as icons (`✓`/`✕` typographic marks OK, not `✨🚀🔒`); one icon library; no `hover:scale-105`, no `transition-all`, no bouncy easing, no success confetti/toast.
- **Copy (highest-stakes for a trust product):** **zero fabricated metrics** (no "trusted by 50,000+ banks," "99.9% tamper-proof" — a product that lies on its proof bar has no claim left); ban the slop lexicon (Effortless/Seamless/Supercharge/Unleash/Transform/Empower/"Don't just X — Y") — matches Alex's "no AI voice" rule; **specific > generic** (name the algorithm, the artifact, the actor); **errors are instructions, not apologies** — never "Oops!" on a RED result; state what broke, where, how to independently confirm.

---

## 7 · Anti-goals (same discipline as the site brief)
Do NOT: build council-theater / avatar 剧场 as the product's spine; headline XR; add a chatbot; invent a dashboard of vanity metrics; make the deterministic verdict look editable; require an account to VERIFY (verification must be trustless + accountless). Restraint applies to chrome + color, never to the credibility surface (the verify moment + the OSS/self-host proof).

## 8 · Build path (after research folds in)
1 design-token pass → 2 the two hero screens as static HTML mockups (Cases + Case-detail-with-verify) → 3 design-review → 4 hand the winning mockup + tokens to Kimi/build. Reuse the worked-example page's verify engine verbatim.
