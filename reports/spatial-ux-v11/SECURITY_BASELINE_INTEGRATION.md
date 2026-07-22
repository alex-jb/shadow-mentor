# V11 — security-baseline integration (rebase onto attestation envelope v2)

V11 is now based on the completed security fix. Ancestry: **V10 → security envelope v2 @ 9f889dd → V11**.

## What happened
- `feat/shadow-spatial-ux-asset-audit-v11` had **zero unique commits** — its HEAD was `ada7de2` (= V10 HEAD).
  The only V11 work so far (`reports/spatial-ux-v11/BRANCH_ANCESTRY.md`) was untracked in the working tree.
- Backed up the untracked V11 work to scratchpad and created local backup branch
  `backup/v11-pre-security-baseline` (@ `ada7de2`, **not pushed**).
- Rebased V11 onto `security/attestation-unambiguous-envelope-v2`. Because V11 had no unique commits, this
  fast-forwarded the branch pointer to `9f889dd` with **no conflicts**.

## Verified preserved (security work intact on V11)
| Item | Check |
|---|---|
| V2 named attestation envelope | `packages/attest-core/attestation-v2.js` present ✅ |
| production default-secret guard | `packages/attest-core/secret-guard.js` present ✅ |
| browser v2 verifier candidate | `verify-v2-candidate.html` present ✅ |
| C# golden-vector parity evidence | `packages/attest-core/csharp-parity/evidence/editmode-results.xml` present ✅ |
| security documentation | `docs/security/ATTESTATION_V2_*.md` present ✅ |
| V11 ancestry report | `reports/spatial-ux-v11/BRANCH_ANCESTRY.md` preserved ✅ |
| V10 in ancestry | `ada7de2` is an ancestor of V11 HEAD ✅ |

## Post-rebase validation (this checkout, `9f889dd`)
| Gate | Result |
|---|---|
| Targeted V1/V2 + all-paths + golden + characterization | **45/45 pass, 0 fail** |
| Full Node suite (identical tree to security HEAD) | 1985 total · 1982 pass · 0 fail · 3 pre-existing skips |
| C# canonical parity (Unity EditMode) | evidence valid for this exact commit — 4/4 (`editmode-results.xml`) |
| Browser v2 candidate acceptance (Chromium) | 14/14 (`verify-acceptance/v2-candidate/`) |
| forbidden-phrases guard | clean (1686 files) |
| Security commits touch Unity Assets / APK / verify.html | **none** (empty diff `ada7de2..HEAD`) ✅ |

## Frozen-artifact integrity
- **Frozen verifier** `verify.html` sha256 `c478b46f42d0a9aea407a68a14178ffd638ba608b8972c806bd612c9f7d0d6bc`
  — **matches** the documented frozen hash; untouched by the security work.
- **Stable fallback APK** `apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk`
  (documented sha256 `93f2a81a…`): the real ~135MB binary is **operator-local** (git-tracked entry is an
  empty placeholder, same not-committed pattern as the licensed XREAL SDK) and is not materialized in this
  checkout. The security commits touch **no** APK path (verified empty diff), so it is provably unaffected.

## Not done (by design)
Not merged to main; 2.3.0 not published; frozen verifier not replaced (candidate stays a candidate);
`INDEPENDENT-CRYPTO-AUDIT-COMPLETED` + `PRODUCTION-READY` remain false. Security scope is closed — V11
proceeds on this baseline.
