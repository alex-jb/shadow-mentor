# Kimi work order — rebuild orshadow.com from research demo → credible product
*Paste this whole file to Kimi. Repo: the shadow-web-full-workspace (orshadow.com). 2026-07-30.*

## Context (read first)
Three independent audits (design/taste, YC-messaging, best-in-class benchmark) reached one verdict: **the content is procurement-grade, but the site reads as a research demo, not a product a bank trusts.** The gap is craft + positioning, not substance. The buyer is a **fair-lending / model-risk compliance officer at an EU-exposed fintech lender** with a live exam. Fix the site so that buyer bookmarks it and forwards it internally.

**Positioning has changed — apply everywhere:**
- Lead with **independence**, not cryptography. "Others log their own agents; Shadow verifies anyone's — independently." (Microsoft made the crypto layer free in 2026-04; it's plumbing, never the pitch.)
- The moat is **banking reason-code depth** (Reg B / ECOA adverse-action + GDPR Art. 22 / Schufa).
- Narrow to **ONE workflow**: adverse-action verification for AI credit decisions.
- **EU-first.** Retire "SR 11-7 compliant" and any "Tier 3" framing.

## STEP 0 — install and run the anti-slop design skill
Install **`Nutlope/hallmark`** (Anti-AI-slop design skill, 20k★): `npx skills add nutlope/hallmark` (or clone into `.claude/skills/`). Run it in **audit mode** against every page, then in **redesign mode** on the homepage. It exists to kill exactly the tells this site trips. Treat its output as the design spec; the items below are the must-fixes it should confirm.

## STEP 1 — the hero (highest impact)
Kill the standing banner headline "Shadow Web Audit Room / Local-first audit case workspace · offline browser presentation" (that's an internal tool name). Replace the hero with:

> **H1:** When the examiner asks why your model denied that applicant, answer in an afternoon — not three weeks.
>
> **Sub:** Shadow is the **independent, open-source verifier for automated credit decisions.** We didn't build your model — which is exactly why your regulator trusts us to check it. Shadow traces every adverse-action decision to its evidence and reason codes, flags the first step that won't hold up under **Reg B / ECOA and GDPR Article 22**, and hands you the exam-ready record with a human's sign-off. For fair-lending & model-risk teams, EU and US.
>
> **Primary CTA (one, no competitors beside it):** "Bring us one real denied application — we'll show you the exam-ready trace in 20 minutes → **Book a fair-lending review**"
> **Secondary (small link):** "or poke at a synthetic case first → Demo"

Demote the 160px "SHADOW" wordmark to ~text-6xl. Remove the pulsing sonar-orb or make it subtle. Remove cyan `text-shadow` glow from ALL headlines.

## STEP 2 — de-slop the visuals (the #1 credibility fix)
- **Remove every emoji used as an icon** (🔒👤🔗🔐💻🔍 on "Trusted Principles"). Replace with ONE monochrome line-icon family (Phosphor or Tabler), single strokeWidth, on one accent color. A cartoon padlock next to "Ed25519" is the single most credibility-destroying element.
- **One accent color only.** Pick one blue; kill the cyan glow and the clashing teal gradients.
- **Fix the contrast bug:** the hero subtitle currently computes to pure black over near-black — set it to a real ~#B8C0CC gray (WCAG AA).
- **Fix the half-built light theme:** the hero panel stays hardcoded dark navy in Light mode → dark-on-dark subtitle. Make the hero invert with the theme.
- **Fix live bugs:** the "Scroll" label overlaps the "How Shadow Works →" link on screen one; the hero "Explore Spatial View" CTA card has an empty description. Remove/fix both.
- Lower overall motion to calm/restraint (this is a trust-first brief, not a consumer demo). Optionally use premium interaction refs — **21st.dev**, **reactbits.dev**, **Made With GSAP** — but sparingly; restraint > flash.

## STEP 3 — add the OPEN-SOURCE surface (currently 100% absent — the biggest miss)
The whole thesis is "an open-source verifier a bank can run itself." Add a first-class section:
- **GitHub link + live star badge** (github.com/alex-jb/shadow-mentor).
- One-liner install: `npx @shadow/verify bundle.json` (or the real CLI), and `npx skills add alex-jb/shadow-mentor`.
- A **"Verify a bundle yourself in 30 seconds"** widget (drop a bundle → offline verify → ✔/✗) — reuse the existing `verify.html` logic.
- "MIT — fork, self-host, audit the code." (Reference: Langfuse's "Open platform. Open source." block — copy its structure.)

## STEP 4 — add a conversion path (currently none — no contact anywhere)
- A persistent **"Book a fair-lending review"** / **"Request the security brief"** CTA + a real email or short form.
- A light **"How to adopt"** block (open-source self-serve vs. guided pilot) in place of pricing.
- Reframe the footer: from company disclaimer "Research prototype · Not production-ready" → **build status**: "This is the public synthetic build. Production pilots run on your data under NDA — talk to us." Same honesty, forward path.

## STEP 5 — one inline worked example (proof-of-substance)
Promote the **printable evidence-lineage report** (VERIFIED / NOT EVALUATED / FIRST FAILURE / AFFECTED DOWNSTREAM + APPROVAL ABSENT) — currently buried at ~600px — to a **large, legible hero asset**. Show one denial → evidence bundle → first-failure → Reg B reason code → approver → an expandable "✔ signature verified" chip. Show, don't screenshot.

## STEP 6 — rebuild a real Trust/Security page + downloadable PDF brief
Replace the "No production cert / No RBAC / No…" disclaimer wall with a structured page: threat model, key-management, what verification does/doesn't prove (keep the excellent "verification ≠ correctness" line), data-handling (local-first, no upload), and a **"Download the security & architecture brief (PDF)"** button. Recast "not production-ready" as a **dated compliance roadmap** (SOC 2 planned). Reference: Persona's security/trust wall + Anthropic's sober tone.

## STEP 7 — collapse the nav + demote XR
Nav → **Product · How it works · Security · Docs · Research · GitHub**. Fold **Flow / Spatial / XR / Shadow Lens** into ONE "Research / what's next" section — never top-nav parity with Security. The XR sizzle is the #1 credibility risk for this buyer; keep it as a clearly-labeled research footnote, never the hero.

## STEP 8 — fix SSR / metadata / AI-crawlability (structural)
- Move from the hash router (`/#/…`) to **path-based routes with pre-rendered / server-rendered HTML** so the pitch text is in the raw HTML (ChatGPT/Perplexity/Claude crawlers don't run JS — today they see an empty shell).
- Per-page `<title>` / meta / OpenGraph; a `sitemap.xml`.
- Add **`llms.txt`** (product summary + links to how-it-works, security, docs, the verifier, GitHub) and **JSON-LD** (`SoftwareApplication` + `Organization` + `DefinedTerm` for Council / First-Failure / Evidence-Lineage).

## Anti-goals (be ruthless — single workflow)
Do NOT: headline XR/Beam Pro/Spatial; add more demos/themes/council-theater; invent logos or claim certifications you don't have; broaden past banking/fair-lending; bury the OSS/verifier proof for minimalism (restraint applies to nav + color, not the core credibility surface); add a chatbot / gamification / animation-heavy hero.

## Priority order
1 (hero) → 2 (de-slop + hallmark) → 3 (OSS surface) → 4 (conversion) → 5 (worked example) — these five make it "forwardable." Then 6 (trust page) → 7 (nav) → 8 (SSR/crawl).

*Full rationale + the exact elements each fix targets: `docs/KIMI_SITE_SCAN_2026-07-30.html`.*
