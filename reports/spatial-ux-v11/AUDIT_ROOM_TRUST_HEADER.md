# Audit Room Trust header

The detached bottom `SELF_SIGNED · valid · …` line is no longer the primary trust communication.
An in-scene, world-anchored (SBS-safe) Trust header sits near the rail and shows three SEPARATE
dimensions, never one generic green "valid":

- `INTEGRITY  VERIFIED` (green — verification result; `FAILED` red when the verifier fails)
- `TRUST      SELF_SIGNED` (amber — trust posture, from the verifier's trustLevel)
- `CORRECTNESS NOT EVALUATED` (grey — Shadow never claims analytical correctness)

Integrity uses verification semantics; posture uses trust-posture semantics; correctness does not
inherit integrity state. Updated from the real verifier in `refreshVerdict` (`setTrustHeader`). The
bottom line is now a minimal grey diagnostic (`FLAT · eye · open ../verify.html for exact detail`).
The frozen verifier wording is untouched.
