# Full browser demo — narration (EN)

Labels to keep distinct throughout: EVIDENCE INTEGRITY (proven) vs ANALYTICAL CONFIDENCE (not judged) · FIXTURE MODEL (not live) · DESKTOP/BROWSER (not device).

1. This is Shadow Verify, running fully local — no network, no upload.
2. I load a valid evidence bundle. Six *independent* checks: record integrity, signature, hash chain, profile — all VERIFIED; external anchor NOT PRESENT because none was supplied.
3. Note the last row: analytical correctness is *not judged by this verifier*. A green signature proves the record wasn't altered — not that the decision was right.
4. The limitations panel says exactly what verification does and does not prove.
5. Now a tampered bundle: it FAILS, at the exact failed sequence, with the downstream events flagged. Unrelated checks do not turn green.
6. Switch to "Verify the verifier". I load a fixture-signed release manifest. The manifest signature verifies, the assets match — but it still says INDEPENDENT COMPARISON NOT PERFORMED, because you must compare the fingerprint against an independent channel yourself. This is a FIXTURE release key, not production.
7. A tampered manifest shows ASSET MISMATCH with the exact expected and actual hashes — no generic "trusted" badge.
8. Everything works in Simplified Chinese too; the evidence values never change with language.
