# Package test strategy (for the future implementation increment)

Template: `test/shadow-flow-export-cli.test.js` (spawn the real CLI, no shell, bare
`PATH`-only env, temp dirs, byte comparisons) + `verify/` manifest tests +
`test/shadow-verify-cli.test.js` exit-code pins.

## Generation & determinism
1. Fixture mode produces a complete package; manifest validates; every member parses.
2. Byte-determinism: two runs with pinned `built_at` and the same fixture key → byte-identical package (member-by-member + manifest).
3. Canonical ordering: `assets[]` sorted by path; re-ordering input files does not change output.
4. `package_id` stable and content-derived (changes iff any member hash changes).
5. Semantic equality: presentation member ≡ direct `exportFlowContract` output; verification member ≡ fresh `verifyBundle` run.

## Signature & tamper matrix (each case must fail closed, with a named reason)
6. Valid signature verifies with the correct public key.
7. Wrong public key → manifest signature failure (and bundle `signature_verification_failed`).
8. Changed member byte → that member's sha256 mismatch (`TAMPERED`), package rejected.
9. Removed member → `INCOMPLETE`; no partial acceptance.
10. Renamed member → path binding breaks (listed path missing + unlisted file present).
11. Duplicated member / extra unlisted file → `UNEXPECTED_MEMBER` (two-way completeness).
12. Case-ID substitution: edit `case_id` in manifest → signature fails; edit inside presentation member → member hash fails; consistency check between manifest `case_id`, presentation `case_id`, and `bindings.evidence_session_id` pinned.
13. Replayed attestation/bundle from another case under this manifest → member hash fails; whole-package replay → stale-but-valid documented, `supersedes` chain test.
14. Tampered Flow presentation member (valid JSON, changed row) → hash fails even though the member would still pass its own schema validation.
15. Tampered evidence bundle (event edit) → both member-hash fail AND `verifyBundle` `prev_hash_mismatch`/`batch_root_mismatch` (defense in depth demonstrated).

## Compatibility & malformed input
16. Unsupported `manifest_version` / unknown member role / unknown member schema_version → `UNSUPPORTED`, never best-effort.
17. Malformed manifest JSON → I/O-class exit, nothing written/accepted.
18. Partial package on the producer side: any member generation failure → no package directory left behind (temp+rename discipline; mirror of "no partial artifact").
19. Backward compatibility: the presentation member alone still imports through the existing `shadow-flow-export/1.0` Web pipeline unchanged (regression pin).

## Verifier interplay
20. Shipped verification-result deliberately falsified → hash-listed member detects transit tamper; consumer re-derivation disagrees → `VERIFIER_DISAGREEMENT` state (never trust the shipped copy).
21. shadow-verify exit codes preserved through composition (0/1/2/3/4 mapping documented in the package CLI's own exit-code table).

## Offline / privacy
22. No-network fixture mode: bare env, no credentials; static scan — no network-capable imports in the package CLI.
23. Secret & PII scan on every member and the manifest: no private keys (`BEGIN … PRIVATE KEY`), no credential patterns, no private absolute paths, no `identity_ref`/reviewer PII unless the operator explicitly opted in (flag-gated, default off); HMAC-mode bundles rejected as NOT_PORTABLE.
24. Key-provenance label required (`fixture|operator|production`); fixture-key packages must carry the demo label end-to-end.

## Browser / Web (when the Web increment lands)
25. Browser import: manifest signature + member hashes verified in WebCrypto; all display states from `PACKAGE_WEB_CONSUMPTION.md` reachable via fixtures (valid, tampered, incomplete, padded, unsupported, unverifiable, fixture-key, disagreement).
26. CLI verification of the same fixtures matches browser outcomes (cross-surface parity, like the existing Node/Python parity pin).
27. Web rendering: imported package case renders with source attribution; honest absence preserved; no physical claim; no persistence of member bytes.
28. Existing Web tests keep passing unchanged (no weakening — same rule as this repo's "do not weaken existing tests").
