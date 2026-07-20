# Shadow → Flow — the fastest path to real spatial (honest version)

**The division of labor, stated plainly:** Flow Immersive (a.flow.gl) is the spatial
visualization ENGINE — it builds the 3D data story, camera/narrative steps, filters,
and the glasses render. **Shadow does NOT do the spatial computing.** Shadow analyzes,
sources, signs, and verifies; it hands Flow a dataset. *Flow makes the data visible;
Shadow makes it verifiable.* Do not describe Flow's spatial capability as Shadow's.

## What this gives you today

`node demos/spatial-finance/flow-adapter.mjs` writes three Flow-importable CSVs:

| Scene | File | Shape |
|---|---|---|
| **1 · Investment Overview** | `flow-portfolio.csv` | one row per holding — X=risk, Y=5y return, Z=confidence, size=weight, color=action |
| **2 · Agent Council** | `flow-council.csv` | center = Final Recommendation; 5 voices as spokes with support/oppose relation + confidence |
| **3 · Audit Trace** | `flow-audit.csv` | one row per evidence-chain node (real SHA-256 prev-hash chain), verification_status |

Import any CSV into Flow Editor → arrange the 3D encoding → view on the glasses.

## Honest status + open questions (must resolve before claiming a Flow demo)

- **One Pro support is UNCONFIRMED.** Flow's site lists the XREAL combo as **Air 2
  Ultra + Samsung S24**, and also claims browser + Quest support. Do NOT assume One Pro
  runs Flow's spatial mode — confirm with the Flow team, or test on a **Quest** (school
  headset) which Flow states it supports.
- **Push Dataset API** (live/real-time updates) — needs the docs + account access from
  the Flow team; the CSV path works today, the live path is the same row shape but gated
  on their contract.
- **Real bundle → audit CSV.** The Scene-3 chain here mirrors a Shadow bundle; the next
  step is to export an ACTUAL signed `demo-session.bundle.json` to `flow-audit.csv` so
  the audit story in Flow is a real record, not a mock.
- **Tamper beat in Flow.** After a tamper, the changed node should turn red, its edge
  break, downstream nodes dim, and the original vs altered value both show. Whether Flow
  supports that conditional styling / re-push is an open question for their API.

## The demo framing (honest, and it opens the Flow partnership)

> "This is Shadow's verifiable audit experience displayed through smart glasses. The
> current build is a heads-up spatial prototype. Our next integration renders the same
> **verified** evidence through Flow's full spatial visualization platform — Flow makes
> the data spatial, Shadow proves it wasn't rewritten."

## What is NOT done (do not claim)

Flow-level spatial-analytics (AI builds the spatial story, data anchored in the room,
walk-around + voice-driven filtering, real-time scene updates, multi-user) — Shadow has
done ~0% of this itself. It is a separate product layer; the Audit Room (Three.js) is a
prototype that reuses the real verifier, not a Flow-equivalent.
