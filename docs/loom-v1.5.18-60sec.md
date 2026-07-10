# Shadow v1.5.18 — 60-second Loom script

**Audience:** Bank counsel / compliance officer / procurement head at a mid-tier US bank. Assume they know Reg B / CFPB Circular 2026-03 / SR 26-2 but have NEVER seen Shadow before.

**Constraint:** Exactly 60 seconds. Kill everything that doesn't cite either a CFR section or a real number. Alex records once, no re-shoots.

**Setup:** Screen split — left half is a Terminal running `curl` against `/api/loan-council`, right half is a text editor showing the response JSON. Both windows named "Shadow v1.5.18 demo".

---

## Scene 1 — the ask (0:00–0:08)

**On screen:** Terminal cursor blinking. `# Loan packet: FICO 685, DTI 0.42, adverse-action flag set`

**Voiceover:**
> "Compliance officer at a mid-tier bank. Analyst sends you an AI-generated adverse-action letter. CFPB Circular 2023-03 says 'internal standards' as a reason is insufficient. How do you prove the letter meets Reg B §1002.9(b)(2)?"

---

## Scene 2 — Shadow's answer (0:08–0:22)

**On screen:** `curl -X POST http://localhost:3000/api/loan-council -d @loan.json | jq .voices[0]`

Terminal fills with the Compliance Officer voice rationale. Highlight the two literal CFR citations in yellow:
- `12 CFR § 1002.9(b)(2)`
- `CFPB Circular 2022-03`

**Voiceover:**
> "Every persona voice cites a specific regulatory section by number. That section is in a frozen registry. If the model hallucinates a section that doesn't exist, the response gets REWORK, not APPROVE."

---

## Scene 3 — the registry gate (0:22–0:35)

**On screen:** Split to JSON view. Scroll to `citation_check` block:

```json
"citation_check": {
  "by_voice": [
    {
      "voice": "Compliance Officer",
      "resolved_ids": ["12CFR1002.9(b)(2)", "CFPB-Circular-2022-03"],
      "resolved_count": 2,
      "unresolved": []
    }
  ]
}
```

**Voiceover:**
> "The `citation_check` field shows which citations resolved against the registry. Unresolved list is empty — every claim this voice made maps to a real CFR section your counsel can grep for."

---

## Scene 4 — the crypto binding (0:35–0:48)

**On screen:** Scroll to `attestation` block:

```json
"attestation": {
  "mode": "ed25519",
  "dictionary_hash": "a1b2c3...",
  "citation_registry_sha256": "d4e5f6...",
  "signature": "Base64Ed25519..."
}
```

**Voiceover:**
> "The Ed25519 signature covers the reason-code dictionary hash AND the citation registry hash. If someone edits the registry after this decision was signed — adding fake CFR sections, editing verbatim snippets — verification fails. Your procurement contract pins these two hashes on day one."

---

## Scene 5 — close (0:48–0:60)

**On screen:** GitHub release page https://github.com/alex-jb/shadow-mentor/releases/tag/v1.5.18. Test count "876/876 green" visible.

**Voiceover:**
> "876 tests, MIT license, released today. Not a pitch. Alex Ji from Yeshiva Katz. If you want the CITATION_MAP that shows every persona-to-regulation binding — the link is below. Fifteen minutes on your calendar, that's the ask."

**Bottom-third overlay for final 5 seconds:**
- github.com/alex-jb/shadow-mentor
- v1.5.18 · 876 tests · MIT
- xji1@mail.yu.edu

---

## Recording checklist (Screen Studio $89 buy)

1. Terminal font 16pt+ (readable at 720p)
2. `jq` colored output
3. Yellow highlight on the 2 CFR citations in Scene 2 (Screen Studio annotation)
4. Bottom-third overlay in Scene 5 (name + version + email)
5. No AI voice — record with actual voice per brain rule `feedback_no_ai_voice_in_submissions`
6. Do NOT mention Council-for-Slack, VibeXForge, Orallexa, or any other project — one product one demo
7. Do NOT mention 12 releases in 6 days — that reads as "hasn't stabilized"

## What NOT to say (per red-team A2 defense)

- Never "required by SR 26-2" — say "SR 26-2 footnote 3 delegation positioning"
- Never "solves protected-class proxy detection" — Fed itself has no crisp solution
- Never "Anthropic couldn't do this" — competitor-punching sounds insecure
- Never "AI-native" — banking counsel hears buzzword

## The 3 questions Alex answers on the follow-up call

1. **"What happens if the model cites a section that exists but doesn't apply?"** — That's attack A2 (semantic mismatch). Registry has `valid_for_aa_codes` per entry. `isValidForAA()` gates. Partial defense; full defense requires counsel review flag, tracked as `citation_reviewed_by`.

2. **"Show me a live tamper detection."** — In terminal: edit `lib/schemas/citation-registry.json`, rerun `verify` on the previous attestation, watch it fail. Ed25519 verification hard-fails.

3. **"What's your test coverage on Reg B specifically?"** — `test/citation-registry.test.js` has 5 named tests just for A1/A2/A3 attacks + 5 for the §1002.9(b)(2) load-bearing case. Grand total 876 across the codebase.
