# Profile README draft — for `alex-jb/alex-jb`

Alex, when you create the special `alex-jb/alex-jb` repo (GitHub prompts you
to create it when you visit `github.com/alex-jb/alex-jb`), copy the README
content below into `README.md` and push.

Bio and pins are set separately via GitHub UI — instructions after the README
draft.

---

## Recommended bio (paste into GitHub account settings)

**60 chars (recommended):**

```
Deliberation engines. Evidence layers. AI you can trust.
```

**72 chars (alternate — spells out the thesis):**

```
Multi-agent deliberation + cryptographic evidence layer for AI.
```

**90 chars (alternate — longest — most descriptive):**

```
Build multi-agent systems you can audit — deliberation engines + cryptographic evidence.
```

**SEO floor**: the profile README below explicitly includes the strings
"hedge-fund-style deliberation" and "trading" so anyone searching for
`trading agent` / `hedge fund AI` still hits your profile even though the
bio drops those keywords.

---

## README.md content — copy into `alex-jb/alex-jb/README.md`

```markdown
### Hi, I'm Alex 👋

I build multi-agent AI systems you can audit. Two things at once:
**deliberation engines** (councils of AI voices that debate before deciding)
and the **cryptographic evidence layer** underneath (Ed25519-signed,
hash-chained records that make those decisions independently verifiable).

Same primitives, two jobs. Same shape as flight recorders in aviation.

---

## 🛡️ Flagship — Shadow

Cryptographic evidence layer for AI agents. Every session becomes a signed,
tamper-evident bundle you can hand an auditor. Verify offline with a single
HTML file.

- `npm install shadow-attest-core` — 1,417 tests, zero LLM dependencies
- Claude Code hooks adapter (weekend 2026-07-12/13)
- OpenTelemetry adapter · RFC 3161 time-stamping · Sigstore Rekor anchoring
- **Anthropic's own Claude Code v2.1.205 (2026-07)** added rules against
  transcript tampering — Shadow ships the receipt for the integrity
  Anthropic quietly acknowledged.

[**alex-jb/shadow-mentor**](https://github.com/alex-jb/shadow-mentor) · MIT

<!-- Add verify.html tamper-detect GIF here once M6 screencast lands -->

---

## 🧠 Also building

- 🤖 [**orallexa-ai-trading-agent**](https://github.com/alex-jb/orallexa-ai-trading-agent)
  — Self-tuning multi-agent trading system with hedge-fund-style Bull/Bear/Judge
  deliberation. 8-source signal fusion (Kalshi, Polymarket, ML). Paper-mode
  by default, real-money-mode gated behind explicit env flag.
- 🗣️ [**claude-debate**](https://github.com/alex-jb/claude-debate) — Adversarial
  Advocate/Critic/Judge debate over any decision. Pressure-test PRs,
  architecture calls, hires, or trades. pip package + Claude Code skill.
- 🔬 [**spacex-ipo-tracker**](https://github.com/alex-jb/spacex-ipo-tracker) —
  Daily AI-managed research on 8 SpaceX IPO tickers. Publicly auditable
  since 2026-05-12 — every daily run is committed to GitHub with
  cryptographic evidence bundles (as of 2026-07-17+ via `shadow-attest-core`).
- 🧰 [**solo-founder-os**](https://github.com/alex-jb/solo-founder-os) — A
  self-evolving 10-agent stack for running a one-person company. Cron +
  Reflexion + skill library + PR-gated evolver. `pip install solo-founder-os`.

---

## 🎨 What I care about

- **Boring reliability over exciting demos** — evidence layers should
  read like plumbing, not marketing
- **HITL by code-level invariant** — humans in the loop where the code
  provably requires it, not just as documentation
- **Local-first** — your evidence never leaves your machine; verify
  offline from a USB stick
- **Honest posture** — a record with cryptographic integrity properties
  auditors can independently verify. The determination of evidentiary
  value is a legal one; I don't ship legal claims.

---

## 📦 Ship channels

- npm: [`shadow-attest-core`](https://www.npmjs.com/package/shadow-attest-core)
- pip: `solo-founder-os` · `claude-debate` · `bilingual-content-sync-agent`
  · `build-quality-agent` · `funnel-analytics-agent` · `payments-agent`
  · `customer-support-agent`
- Claude Code skills: `de-ai-writing-skill` · `polymarket-brier-skill` ·
  `claude-tier-router` · `vibex-video-decoder-skill`

---

<sub>Trading-related repos ship with "educational research, not financial
advice" disclaimers. Nothing on this profile is investment advice.</sub>
```

---

## GitHub UI actions (after README push)

### 1. Set 6 pinned repos (A2)

Go to <https://github.com/alex-jb> → below the profile README you'll see
"Customize your pins" → select exactly these 6, in this order:

1. **shadow-mentor** (flagship — evidence layer)
2. **orallexa-ai-trading-agent** (flagship — most-starred, 56★)
3. **spacex-ipo-tracker** (dogfood target for Shadow evidence, 3★)
4. **claude-debate** (skill discoverability, 2★)
5. **solo-founder-os** (agent stack meta-repo, 4★)
6. **vibex** (VibeXForge launch platform, 4★)

Save.

### 2. Update bio (from account settings)

Go to <https://github.com/settings/profile> → Bio field → paste the 60-char
version above (or your preferred alternate). Save.

---

## Why these 6 pins over other options

- **shadow-mentor first** — Aug 2 launch target, highest strategic visibility
- **orallexa first-star, second-slot** — 56★ objective proof of shipping
- **spacex-ipo-tracker** — bridges the two thesis lines (trading + evidence)
  and the dogfood proof point starting 2026-07-17
- **claude-debate** — the pip+skill dual-form pattern is a clean OSS story
- **solo-founder-os** — meta-repo makes the 10-agent stack discoverable
  without pinning each agent-* individually
- **vibex** — launch platform proof, currently receiving traffic

Not pinned (kept discoverable via profile README + org page):
- The 8 individual agent-* repos (surface via solo-founder-os)
- Council-diff (surface via claude-debate description)
- Skills (surface via claude-debate skill link)
- Trading research (surface via spacex-ipo-tracker)

---

## Sunset dates on this draft

This draft was written 2026-07-12 based on:
- npm publish of `shadow-attest-core@2.0.0` on 2026-07-11
- Anthropic Claude Code v2.1.205 changelog entry from 2026-07
- Star counts current as of 2026-07-12

Before you push:
- Re-run `gh repo view alex-jb/orallexa-ai-trading-agent --json stargazerCount`
  and update any star counts that drifted
- If Aug 2 has passed, update "weekend 2026-07-12/13" and "2026-07-17+"
  cutover dates to reflect what actually shipped
