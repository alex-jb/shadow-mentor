# Portfolio Upgrade Brief — github.com/alex-jb — for Claude Code

> Scope: everything on the account EXCEPT shadow-mentor's frozen Wednesday-demo path. shadow-mentor work continues under its own briefs (SHADOW_V3_BRIEF.md). This brief is about the other 59 repos, the account surface, and reusable launch/hackathon infrastructure.
> Priority order is strict: P0 before 2026-08-02 (launch day traffic will hit the profile), P1 after Wednesday 7/16, P2 anytime.
> Global rules: additive only · no history rewrites · every changed repo must still pass its own tests (if it has none and it's being kept, add a smoke test) · no forbidden phrases (reuse shadow-mentor/scripts/check-forbidden-phrases.mjs) · trading-related repos must carry a "not financial advice / educational research" disclaimer in README and any published output.

---

## Kickoff prompt for Claude Code

Paste this verbatim into a fresh Claude Code session from any machine
that has this repo cloned:

```
Read `docs/PORTFOLIO_UPGRADE_BRIEF.md` in this repo. Then read
`docs/AUTONOMOUS_SESSION_RULES.md` — its rules apply to this work
transitively across repos (additive-only, no fabrication, no outbound
sends, no retro-signing).

Start with P0-A3 ENUMERATION ONLY. Produce a Markdown table listing all
60 repos with columns:
  | repo name | last_commit | stars | classification | reason |

Classifications: KEEP / ARCHIVE / PRIVATE / CARVEOUT (hackathon submission,
even non-winning — kept as portfolio evidence of participation).

Do NOT archive anything until I approve the table.

Classification rules:
- KEEP: active + part of the deliberation/evidence/launch-infra thesis + has topics or license
- ARCHIVE: 60+ days idle AND 0 stars AND not referenced by a KEEP repo AND not a hackathon submission
- PRIVATE: half-starts, embarrassing state, or anything with secrets-adjacent content
- CARVEOUT: any hackathon submission → KEEP (winning OR not)

After the table, wait for my approval. Do NOT touch A1/A2/A4/A5 until
A3 is signed off — the archive sweep changes what "visible repos" means,
which affects every downstream description/pin decision.

When I approve, proceed in this order: A3 archiving → A4 description
rewrites → A2 pin curation → A1 profile README + bio → A5 disclaimers
+ secret scan. P0 acceptance: profile page passes forbidden-phrases
lint; ≤ 12 visible public repos; every KEEP repo has license + topics
+ a ≤ 160-char quantified one-liner.

DO NOT touch P1 (dogfood integrations) or P2 (hackathon kit) in this
session. P1 unblocks 2026-07-17 (after Wed demo). P2 needs its own
separate brief expansion (see §C1 for what must be extracted first).

End-of-session debrief must include: repos archived (count),
descriptions changed (list), any classification I overrode, any repo
that resisted classification (needs Alex judgment).
```

---

## P0 — Account surface (must be done before Aug 2 launch traffic)

### A1. Profile README + bio single-identity rewrite
- Create the special repo `alex-jb/alex-jb` with a profile README. Structure:
  1. One-line thesis that covers the WHOLE portfolio honestly: "I build multi-agent systems you can audit — deliberation engines and the cryptographic evidence layer that makes their decisions verifiable."
  2. Flagship section: Shadow (flight recorder for AI agents) — one paragraph, quantified one-liner style, link to repo + verify.html demo GIF.
  3. "Also building" section: 3-4 lines max — Orallexa trading agents (hedge-fund-style Bull/Bear/Judge deliberation, verified), claude-debate (structured second opinions), spacex-ipo-tracker (publicly auditable AI research, evidence-verified).
  4. Papers/education footer: Katz School, ICAIF '26 submission, IEEE VR '27.
- Update the account bio from "AI agents that think, debate, and trade like hedge funds" to the umbrella thesis. Under 120 chars.
- **Bio proposal — three tightening options, ranked by preference:**
  - **60 chars (recommended):** `Deliberation engines. Evidence layers. AI you can trust.`
  - **72 chars:** `Multi-agent deliberation + cryptographic evidence layer for AI.`
  - **90 chars:** `Build multi-agent systems you can audit — deliberation engines + cryptographic evidence.`
  The 60-char version drops "trading" as a keyword. That SEO cost is mitigated by keeping "hedge-fund-style deliberation" in the "Also building" section of profile README (bullet 3 above), where the /orallexa description surfaces the trading vertical for anyone searching. Headline stays evidence-first; trading keyword lives one scroll down.
- Acceptance: profile renders with GIF; bio ≤ 120 chars; profile README passes forbidden-phrases lint; string "hedge-fund" or "trading" appears at least once in profile README body (SEO floor).

### A2. Pin curation
- Pin exactly six, in this order: shadow-mentor · spacex-ipo-tracker (after P1-B1 lands; until then pin claude-debate higher) · orallexa-ai-trading-agent · claude-debate · embodied-compliance-council (if public) · vibex or solo-founder-os (pick the one with a working demo).
- Pins are set via GitHub UI — produce a checklist for Alex rather than attempting API calls unless a token is configured.

### A3. Archive sweep: 60 repos → ~10 visible
- Enumerate all 60 repos. Classify: KEEP (active, part of the thesis), ARCHIVE (finished experiments — archive, don't delete; archived repos are honest history), PRIVATE (half-starts, anything with secrets-adjacent content or embarrassing state).
- Default archive rule: **if it hasn't had a commit in 60 days AND has 0 stars AND isn't referenced by a kept repo AND is not a hackathon submission → archive.**
- **Hackathon submission carveout:** any repo created for a hackathon (winning OR non-winning) stays KEEP as portfolio evidence of participation. With 8 followers, seeing 8 hackathon entries beats seeing 6 KEEPs + 4 archives — the "this person ships to deadlines" signal is worth more than tidiness. If a hackathon repo is truly embarrassing, PRIVATE it; only archive if it's demonstrably a duplicate of another kept repo.
- For every KEPT repo, verify: LICENSE file exists and matches README claim · README first line is a quantified one-liner (see A4) · repo has topics set (ai-agent, self-hosted, etc. — match the trending-topic vocabulary).
- Output `docs/portfolio-audit-2026-07.md` in alex-jb/alex-jb listing every repo and its disposition, so the sweep itself is auditable.
- Acceptance: visible (non-archived, public) repo count ≤ 12; every kept repo has license + topics + one-liner; all hackathon submissions accounted for in the audit doc even if archived.

### A4. Description rewrite in the house style that's winning right now
Formula (derived from currently-trending repos): [quantified capability] + [artifact form] + [host/compat matrix]. Rewrite the GitHub description (the one-liner, not the README) for every kept repo. Drafts:
- shadow-mentor: "One command → every agent session becomes signed, tamper-evident evidence. Verify offline with a single HTML file. 1,400+ tests. Claude Code · OpenTelemetry · any agent via HTTP."
- orallexa-ai-trading-agent: keep the 8-source/Bull-Bear-Judge quantification, append "tamper-evident decision logs via shadow attest-core" only AFTER P1-B2 actually lands. Never claim before shipping.
- claude-debate: "Advocate/Critic/Judge debate over any decision — pip package + Claude Code skill. Pressure-test PRs, architecture calls, hires."
- spacex-ipo-tracker: after P1-B1: "Daily AI-managed IPO research, publicly auditable since 2026-05-12 — every run cryptographically signed, verifiable in your browser."
- Acceptance: no description exceeds 160 chars; every claim in a description is verifiable in the repo today.

### A5. Disclaimer + hygiene pass on trading repos
- orallexa-ai-trading-agent, spacex-ipo-tracker, and any other market-facing repo: add a clear "educational research, not financial advice; past performance ≠ future results" block near the top of README and in any generated report template.
- Scan all kept repos for committed secrets (API keys, tokens) with a standard scanner; report findings to Alex, never auto-rotate.
- Acceptance: disclaimers present; secret scan report written to the portfolio audit doc.

---

## P1 — Dogfood integrations (start 7/17, after capstone)

### B1. spacex-ipo-tracker × attest-core — the first production user
The tracker already promises "publicly auditable." Make that promise cryptographic:
- Add `shadow-attest-core` (npm published 2026-07-11) to the daily research pipeline: wrap each daily run in createSession/appendEvent/sealSession — events: data fetches (hash of inputs), each model/agent verdict, the final published report hash.
- Publish per-day bundles to a `/evidence/` directory in the repo (bundles are small; payload store trimmed to hashes + summaries). Link verify.html preloaded instructions in README.
- **NEVER retro-sign historical runs. Enforced in code, not prose:**

  ```js
  // spacex-ipo-tracker/lib/attest-guard.js
  export const EVIDENCE_START_DATE = "2026-07-17";  // day after Wed demo unfreezes
  export function assertNotRetroSigning(runDateIso) {
    const cutover = Date.parse(EVIDENCE_START_DATE + "T00:00:00Z");
    if (Date.parse(runDateIso) < cutover) {
      throw new Error(
        `refusing to sign run dated ${runDateIso}: before evidence cutover ` +
        `${EVIDENCE_START_DATE}. Retroactive signing is exactly the fraud ` +
        `Shadow exists to detect. Backfill = threat model target, not feature.`
      );
    }
  }
  ```

  Every daily-run entry point calls `assertNotRetroSigning(runDate)` before
  `createSession`. Additionally, a CI check greps `evidence/*.bundle` and
  fails if any bundle's `header.session_started_at_utc` is earlier than
  `EVIDENCE_START_DATE`. Rule cannot be violated even if a future Claude
  Code session "helpfully" tries to complete history.

- The honest cut-over date is itself a credibility statement. README banner: "Evidence layer active since 2026-07-17. Runs before that date are unsigned by design — retroactively signing history is what Shadow exists to detect."
- Add the shadow-verify GitHub Action to CI so every published day is verified on push. README badge once green.
- Acceptance: (a) three consecutive real daily runs produce bundles that pass CLI + verify.html; (b) CI test asserts NO bundle exists with `session_started_at_utc < EVIDENCE_START_DATE`; (c) README explains the trust level honestly (SELF_SIGNED until anchoring is wired; upgrade to TIME_ANCHORED when M3 config is added — one config block).

### B2. orallexa-ai-trading-agent × attest-core — signed deliberations

**Scope warning: bigger than B1.** B1 tracker has ~5 simple events per run (fetch, verdict, publish). B2 requires designing an event vocabulary for Bull/Bear/Judge deliberation — persona identity, prompt hash, model manifest (model id + sampling params hash), verdict object, confidence, rebuttal chains, Portfolio Manager gate. **Expect 1 day of schema-design work before writing implementation.** Non-starter until B1 ships and validates the pattern on a simpler surface.

- Same pattern as B1 including the `assertNotRetroSigning` guard + CI check with `EVIDENCE_START_DATE`.
- Richer event vocabulary — each Bull/Bear/Judge turn is an event with fields: `persona`, `model_id`, `prompt_hash`, `verdict`, `confidence`, `rebutted_seq` (link back to the event being challenged). The Portfolio Manager gate decision is the sealing event.
- Deliberation-specific extension of the shadow event schema, documented in a companion spec `docs/orallexa-event-vocab.md` (this doc is B2 prerequisite deliverable).
- Update repo description per A4 ONLY after this lands: "The open trading agent whose decision log can't be quietly rewritten." Never claim before shipping.
- Acceptance: (a) event vocab spec committed and reviewed; (b) one full simulated trading session produces a bundle; (c) tamper test — mutate one Judge verdict — fails verification with correct seq + reason.

### B3. claude-debate × evidence (light touch)
- Add an optional `--attest` flag: debate transcript sealed as a bundle. One flag, one doc section, no architecture change. Keeps the skill/pip dual form intact; align its SKILL.md format with Shadow's skill so both look like one family.

### B4. marketing-agent in service of the launch
- Configure orallexa-marketing-agent with Shadow's launch brief to DRAFT platform-native posts for X, Reddit (r/selfhosted, r/LocalLLaMA), Dev.to, 小红书. Output to drafts folder for Alex's review.
- HARD RULE: Hacker News post is hand-written by Alex, never generated. Marketing-agent output is drafts-only everywhere — nothing auto-posts.
- Bonus honesty loop: run the marketing-agent session itself under the Claude Code adapter once it exists — "our launch posts come with evidence bundles" is a cute footnote, not a headline.

---

## P2 — Hackathon kit (anytime; goal: enter any 48h event at 60% done)

### C1. Create private repo `alex-jb/hackathon-kit`

**Prerequisite: source-locate 4 real assets before building the kit.** The four assets below are NOT hypothetical — they exist in current repos but were never extracted or parameterized. Kit creation session must FIRST locate each source file/dir, THEN parameterize into templates. If any asset can't be located, that section of the kit is a placeholder with a follow-up task, not fabricated content.

Assets to extract (source → destination):

| Asset | Source location (verify) | Kit destination |
|---|---|---|
| pptxgenjs deck generator | search `shadow-mentor/` for pptxgenjs .mjs/.js files; likely a competition-deck script | `deck/` |
| verify.html visual template | `shadow-mentor/verify.html` — the drag-drop tamper-detect UX | `demo/verify-template.html` |
| attest-core minimal wire pattern | `shadow-mentor/packages/attest-core/` — a 4-line createSession → appendEvent → sealSession → verifyBundle example already exists in README | `starter/attest-example.js` |
| AUTONOMOUS_SESSION_RULES chapter 0 | `shadow-mentor/docs/AUTONOMOUS_SESSION_RULES.md` — rules 3 (scope freeze), 7 (pre-commit gates), 8 (fabrication ban) | `PLAYBOOK.md` §0 |

Template repository containing:
- `starter/` — Node + Python project skeletons with attest-core pre-wired (every hackathon build ships with tamper-evident build/session logs — a judge-facing differentiator nobody else has), CI, forbidden-phrases lint, LICENSE, README template with the quantified one-liner formula and host-matrix table pre-scaffolded.
- `debate/` — claude-debate configured as a decision tool for the team ("should we pivot the idea at hour 20?" gets a structured second opinion).
- `deck/` — parameterized pptxgenjs generator: project name, accent color, 4-verb solution slide, stat band. One command → 12-slide dark deck.
- `demo/` — presenter-beats pattern (numbered-key camera waypoints), preflight checklist template, contingency-lines template, screen-record script, verify-template.html.
- `launch/` — marketing-agent config template + Show-HN-structure doc (tiny artifact first, quantified one-liner, honest limitations section).
- `PLAYBOOK.md` — the meta-lessons as a checklist. §0 is a direct port of AUTONOMOUS_SESSION_RULES rules 3/7/8. Subsequent §§ cover: hour-0 scope freeze ritual; "one tiny instantly-graspable artifact" rule; judge psychology notes (demo determinism > feature count; the 2-second silence after the money shot); what trends now and why (agent/skills/self-hosted/MCP vocabulary as of 2026-07).
- Acceptance:
  1. `gh repo create --template alex-jb/hackathon-kit` to working demo skeleton in under 10 minutes, measured.
  2. Every asset in the extract table above is either physically present in the kit OR has a follow-up task file explaining what's missing and why (no fabricated content).
  3. `make demo` in a spawned skeleton produces a working `verify.html`-based tamper-detect GIF suitable for use as a hackathon Show HN artifact.

### C2. New-project spawn checklist (goes in PLAYBOOK.md)
Before any new repo is created on this account, it must answer in its README's first commit: (1) which portfolio thesis line does it extend (deliberation / evidence / launch-infra)? (2) what is its quantified one-liner? (3) keep, archive-after-event, or private-experiment — decided at birth, with a review date. This is the rule that prevents 60-repos-8-followers from happening again.

---

## Explicitly out of scope
- Anything inside shadow-mentor before 2026-07-17 beyond reading.
- Auto-posting to any platform. Deleting any repo (archive only). Retro-signing any historical data (B1 rule).
- New product ideas — this brief consolidates; it does not expand.

## Definition of done
- [ ] Profile README + bio live; bio ≤ 120 chars; profile README contains "hedge-fund" or "trading" at least once (SEO floor)
- [ ] Six pins curated; ≤ 12 visible public repos, all with license/topics/one-liner
- [ ] Portfolio audit doc committed listing every repo + disposition + hackathon carveout notes
- [ ] Secret-scan findings reported to Alex; trading disclaimers in place on all market-facing repos
- [ ] spacex-ipo-tracker: `assertNotRetroSigning` code-enforced + CI test blocks pre-cutover bundles; three consecutive daily bundles verified; README banner acknowledges honest cutover date
- [ ] Trading agent event-vocab spec committed BEFORE code; sealing works; tamper test proves the point
- [ ] claude-debate --attest flag ships; launch drafts generated (HN post NOT generated — Alex hand-writes)
- [ ] hackathon-kit template spawns a working skeleton in <10 min; every asset either present or documented-missing; `make demo` produces a shareable tamper-detect GIF
