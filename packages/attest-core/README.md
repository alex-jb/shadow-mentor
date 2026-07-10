# @shadow/attest-core

Zero-LLM-dep cryptographic evidence primitives for AI decision attestation.

**Status:** contract surface only during the v2.0.0-rc window. Source files still live in the parent repo's `lib/` and are re-exported here. Physical file move planned for v2.0.0 final.

## What lives here

- Ed25519 (RFC 8032) + HMAC-SHA-256 signing
- Append-only signed-payload contract (frozen v2 schema at `../../spec/attestation.schema.json`)
- Batch attestation with SHA-256 batch root
- Hash chain primitives (`previous_hash` linking)

## What does NOT live here

- Any LLM SDK (`@anthropic-ai/sdk`, `openai`, `@google/genai`, etc)
- Any HTTP handler
- Any Shadow domain logic (loan council, personas, prompts)

CI enforces the "zero LLM deps" invariant via `test/attest-core-contract.test.js`.

## Import surface

```js
import {
  ATTESTATION_VERSION,
  SIGNATURE_MODES,
  buildAttestation,
  verifyAttestation,
  computeAttestationHash,
} from "@shadow/attest-core";

// Optional sub-entries:
import { computeBatchRootHash } from "@shadow/attest-core/batch";
import { computeAttestationHash } from "@shadow/attest-core/chain";
```

## Roadmap

- **v2.0.0 (planned)** — physical files move from `lib/` into this package; `lib/attestation.js` becomes a re-export shim in the opposite direction.
- **v2.0.0 (planned)** — publish to npm as `@shadow/attest-core`.
- **v3.0.0 (planned)** — add `createSession` / `appendEvent` / `sealSession` streaming API per `docs/roadmap/SHADOW_V3_BRIEF.md` M1.2.

## Schema

The frozen v2 signed-fields set is authoritative in [`../../spec/attestation.schema.json`](../../spec/attestation.schema.json). Any new signed field requires bumping `schema_version` to 3 and a back-compat test.

## License

MIT.
