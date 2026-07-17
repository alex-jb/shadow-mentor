# Reference banking-decision evidence

A committed, verifiable example of what Shadow produces for one real regulated
credit decision — the artifact a procurement reviewer or examiner can check
themselves.

- `banking-decision.bundle.json` — a signed evidence bundle for an **adverse
  (block)** decision from the deterministic loan council (`REF-2026-001`: FICO
  640 / DTI 0.44 / LTV 0.88 → 4 adverse-action codes, the Reg B maximum).
- `banking-decision.public.pem` — the Ed25519 public key. The private key was
  discarded at generation (this is a static fixture, like `docs/dogfood-evidence/`).
- `banking-decision.payloads.json` — the event payloads (content-addressed out of
  the bundle) so value-level checks (reason-code count, adverse detection) run.

## Verify it yourself

```bash
# integrity + Banking Evidence Profile v1 conformance
node bin/shadow-verify.mjs docs/reference/banking-decision.bundle.json \
  --public-key docs/reference/banking-decision.public.pem --profile banking-v1

# the examiner-ready packet
node bin/evidence-packet.mjs docs/reference/banking-decision.bundle.json \
  --public-key docs/reference/banking-decision.public.pem \
  --payloads docs/reference/banking-decision.payloads.json
```

Expected: `✓ Bundle verified` + `CONFORMS`. The reason-code dictionary resolves to
a **governed** registered version — a swapped dictionary would fail.

`test/reference-banking-bundle.test.js` asserts this in CI, so a change to the
profile, the council, or the dictionary that breaks a real decision's conformance
is caught. Regenerate with `node scripts/build-reference-bundle.mjs` (mints a new
key; the committed artifact is the reference).
