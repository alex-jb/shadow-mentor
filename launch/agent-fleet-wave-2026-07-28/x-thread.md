# X thread — "Paperclip logs it. Shadow proves it."

Audience: people running agent fleets (Paperclip / Buzz / Claude Code
multi-terminal operators), not bank compliance officers. Post as-is, one
tweet per block.

---

1/
Everyone's building agent company OSes now. Paperclip hit ~75K stars in 5
months. Jack Dorsey's Buzz makes agents first-class team members.

Both have "audit logs."

Neither can prove to an outside party that the log wasn't rewritten.

2/
Paperclip's audit trail is append-only — as a database property.

A DB admin can rewrite it and nobody outside can tell.

That's not an attack on Paperclip. It's the difference between a promise
and a proof.

3/
Buzz gets closer: every event is a signed Nostr event. Real cryptography.

But it signs *that a message happened* — not *that a regulated decision
followed policy, cited the right rule, and got human review before
approval*.

4/
That last part is what we've been building for 5 months in the open:

Shadow — Ed25519-signed attestation for agent decisions.
- sign the request AND the response
- hash-chain every decision to the last one
- bind the reason-code dictionary so post-hoc swaps break verification
- 2253 passing tests, MIT

5/
The part nobody else does: every rule maps to a regulation and a test.

CITATION_MAP: persona rule → ECOA / Reg B / BSA / OFAC citation → the exact
test file that pins it. Machine-readable. A bank's counsel can diff it.

6/
Verify from anywhere — none of it requires trusting us:

- CLI: bin/verify-attestation.mjs
- MCP tool inside Claude/Cursor (11 tools)
- POST /api/verify-attestation from your SIEM
- Python: byte-identical verifier

7/
If you run an agent fleet and your "audit log" is a Postgres table:

your log records what happened.
a signed attestation proves it.

Repo: github.com/alex-jb/shadow-mentor
Skills: npx skills add alex-jb/shadow-mentor/skills/shadow-attestation-verify

---

Alt one-shot version (if thread underperforms):

Agent company OSes are exploding (Paperclip 75K★, Buzz 15K★). All of them
keep audit logs. None of them can prove the log wasn't rewritten. We spent
5 months on that exact problem: Ed25519 attestation + hash chain + a
citation map from every rule to a regulation and a test. 2253 tests, MIT.
"Paperclip logs it. Shadow proves it." github.com/alex-jb/shadow-mentor
