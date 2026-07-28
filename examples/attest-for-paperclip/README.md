# attest-for-paperclip — Paperclip logs it. Shadow proves it.

Agent-workspace platforms (Paperclip, and every "AI company OS" like it) keep
append-only audit logs — **as a database property**. A DB admin can rewrite
them and no outside party can tell. This adapter turns such a log into a
**signed, hash-chained attest-core bundle** that anyone with the public key can
verify: reordering, insertion, deletion, or edits of any row break
verification at the exact sequence number.

Unaffiliated community adapter. The JSONL row shape here mirrors the
documented audit surface (actor / action kind / run_id / payload / timestamp)
but is **illustrative until wired to a real export or webhook** — every
original row is carried verbatim inside the sealed payload, so the mapping
loses nothing and adds only proof.

## 60-second demo

```bash
node attest-audit-log.mjs sample-paperclip-audit-log.jsonl
node verify-audit-bundle.mjs paperclip-audit-bundle.json paperclip-audit-bundle.json.pub.pem
# → VERIFIED — chain intact, signature valid.

# now tamper with any row inside the bundle and re-verify:
#   → VERIFICATION FAILED at the exact seq
```

The demo generates an ephemeral keypair. For real use, generate a pinned pair
(`bin/generate-attestation-keypair.mjs`, 0600/0644 modes) and publish the
public half — verification then requires nothing from the operator's machine.

## What this proves / does not prove

Proves: the log an auditor holds is byte-identical to what was sealed, in the
sealed order, signed by the holder of the private key at seal time.
Does NOT prove: the log was complete before sealing, the actions were wise,
or any compliance/business correctness. Same honest boundary as every Shadow
attestation surface.

## Row-type mapping (explicit, auditable)

| audit row `kind` | attest-core event |
|---|---|
| `tool_call` / `tool_result` | `tool_call` / `tool_result` |
| `approval` / `hire_approval` | `human_approval` (with real `approved` flag) |
| `budget_pause` | `error` |
| `agent_message` | `model_output` |
| `run_start` / `run_end` | session envelope |
| anything else | `tool_call` (row preserved verbatim — no row is ever dropped) |
