# Show HN — refreshed for the governed-agents wave

Title options (pick one):

1. Show HN: Shadow – Ed25519 attestation for AI agent decisions (2,253 tests, MIT)
2. Show HN: Your agent fleet's audit log is a promise. This makes it a proof
3. Show HN: Signed, hash-chained, regulation-mapped attestation for agent decisions

Body:

---

Over the last five months I built Shadow: an open-source attestation layer
for AI agent decisions, aimed at the gap every new "agent company OS" leaves
open.

The gap: Paperclip (75K stars), Buzz, and Microsoft's governance toolkit all
keep audit logs. The logs are append-only as a *database property* — an
admin can rewrite them and no outside party can detect it. For a consumer
tool that's fine. The moment an agent's decision affects a loan, a
sanctions check, or an HR outcome, "trust my Postgres" stops working.

What Shadow does instead:

- Every decision is signed (Ed25519) over both the request and the
  response, so neither side can be swapped later.
- Decisions hash-chain to their predecessors; reordering, insertion,
  truncation, and edit-cascades all break verification.
- The reason-code dictionary is bound into the signature (dictionary_hash),
  so you can't quietly change what "code AA-3" means after the fact.
- Every persona rule maps to a regulatory citation and to the exact test
  that pins it (CITATION_MAP, machine-readable JSON/CSV).
- Verification is deliberately boring: a CLI, an MCP tool (works in Claude
  Desktop/Cursor — 11 tools total), an HTTP endpoint for SIEMs, and a
  Python library that produces byte-identical results. Same primitive under
  every surface.

Numbers, honestly stated: 2,253/2,256 tests passing (3 are env-gated live
LLM smokes), MIT license, npm shadow-attest-core 2.1.0. It is NOT
production-certified, NOT device-validated on our XR track, and the deep
persona reasoning uses whatever LLM you configure — Shadow's job is making
the decision *verifiable*, not making the model smart.

Anticipated questions:

Q: How is this different from Microsoft's Agent Governance Toolkit?
A: Real overlap on the crypto layer — they commoditized generic signing,
and honestly that pushed us to sharpen. What they don't do: persona-level
deliberation, regulatory citation mapping (Reg B / ECOA / BSA / OFAC per
rule, each pinned by a test), or the bank vertical. If you need generic
agent identity, use theirs. If an examiner will ever read your audit trail,
that's us.

Q: Isn't Buzz already signing agent events?
A: Yes, at the transport layer (Nostr events) — and that's genuinely good.
It proves *an event happened*. Shadow attests *that a regulated decision
followed policy*: what rule fired, which regulation it cites, whether human
review happened before approval. Different layer; they compose.

Q: Why should I trust your verifier?
A: You shouldn't have to. The verifier is ~200 lines, MIT, reimplemented
independently in Python with byte-identical output, and the signing payload
contract is documented. Verify with your own Ed25519 implementation if you
prefer.

Q: What's the business model?
A: Open core. The engine and verifiers stay MIT. If a bank wants the
persona packs and procurement paperwork, that's the paid layer.

Repo: https://github.com/alex-jb/shadow-mentor
