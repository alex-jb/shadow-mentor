# Security policy

Shadow is pre-1.0. The Vercel demo is intentionally non-production: it routes regulated questions through cloud LLM APIs for pattern demonstration. **Do not paste real client PII into the public demo.**

## Supported versions

Only `main` and the most recent tagged release receive security fixes. Older tags are demo snapshots, not maintained branches.

| Version | Supported |
|---|---|
| main | Yes |
| latest tag (v2.0.0-rc\*) | Yes |
| earlier tags | No |

## Reporting a vulnerability

If you discover a security vulnerability in Shadow — including anything that could compromise the integrity of an attestation, the signing key material, or the tamper-evidence guarantee — please report it privately.

**Preferred**: GitHub Security Advisories at https://github.com/alex-jb/shadow-mentor/security/advisories/new. Reports here are private until we jointly publish an advisory.

**Alternative**: email `xji1@mail.yu.edu` with subject line `SECURITY: Shadow`. A response acknowledging receipt will be sent within 72 hours. PGP key will be published after `v2.0.0` final.

Please do NOT open a public GitHub issue for security matters. Public disclosure before a fix is available is coordinated by joint agreement.

## In scope

- Any way an attacker could produce an attestation that verifies against a Shadow verifier without holding the corresponding private key.
- Any way an attacker could modify an attested record without the verifier detecting the change.
- Any way to weaken the append-only signing contract (silently downgrading a v2 attestation to a v1 shape, omitting a signed field that should be bound).
- Any dependency vulnerability that transitively affects the crypto path in `lib/attestation.js` or `@shadow/attest-core`.
- Any way the linked chain (`previous_hash`) could be broken, reordered, or truncated without the chain verifier detecting it.
- Compromise of secrets in demo material. Demo bundles intentionally use ephemeral test keys; if a real key ever leaks in a shipped demo, that is in scope.

## Out of scope

- Bank-side / operator-side private-key compromise. Shadow assumes the operator protects the signing key; if the operator loses control of it, attestation cannot defend against retro-signing. See [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).
- Denial of service on the demo Vercel deployment. Shadow's evidence guarantees are offline-verifiable; the hosted endpoints are convenience surfaces, not the security perimeter.
- Bugs in the LLM rationale layer that produce misleading prose. The rationale layer is advisory and cannot change the signed verdict.
- Issues that require physical access to a signing device beyond what a typical operator would consider a compromise.

## Coordinated disclosure

Once a fix is available:

1. A GitHub Security Advisory is published, crediting the reporter (with permission).
2. A patch release is tagged.
3. The `CHANGELOG.md` entry describes the fix and the impact.
4. If the issue affects consumers of a published npm package, an advisory is filed via `npm audit` metadata.

If a vulnerability is being actively exploited in a way that puts an operator's data at risk, we may publish an advisory before a patch is available so operators can take mitigating action.

## Notes

Shadow is a solo-maintainer, pre-1.0 project. Response times are best-effort. If a bank is planning to run Shadow in production, please open a discussion first so we can align on threat model coverage — see [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).
