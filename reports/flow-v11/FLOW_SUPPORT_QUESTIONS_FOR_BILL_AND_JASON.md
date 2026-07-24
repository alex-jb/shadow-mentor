# Technical questions for Bill and Jason (Flow Immersive)

Context we already have from our side (so we don't re-ask what's answered): our runbook already
records that CSV import into the Flow Editor works in principle, that the published XREAL combo is
Air 2 Ultra + Samsung S24 (One Pro support unconfirmed), and that the Push Dataset API exists but
needs docs + account access. Everything below is genuinely unresolved.

We have a sanitized, deterministic demo package ready: one audit-case CSV/JSON in our stable
`shadow-flow-export/1.0` row contract, plus node/edge CSVs for the spatial layer (22 nodes /
19 edges, bilingual EN+ZH labels, stable IDs).

## Import path

1. Can the Flow SCP (or the Flow editor) directly ingest our versioned JSON export, or is CSV the
   only supported input? If JSON: what envelope shape do you expect?
2. What is the recommended import path for a **node/edge** (graph-shaped) dataset — nodes,
   edges, labels, status fields, bilingual labels, and provenance identifiers — as opposed to a
   flat metric table? Two CSVs (nodes + edges)? One joined table? Something else?
3. Are there documented limits we should design to: max fields per row, max rows, max label
   length, max relationships per node, supported character sets (we carry Chinese labels)?

## Launch path on our hardware

4. Can a prepared Flow be launched on **XREAL One Pro + Beam Pro** through Flow's normal supported
   route, without packaging a separate Android APK on our side?
5. What exact application/launch path is used on Beam Pro: browser, a Flow Android app, a
   MyGlasses entry, or another supported route?
6. Can the Flow be prepared on a Mac/PC and then opened on Beam Pro (same account, cross-device)?
7. Is live collaborative querying (the AI editing/querying shown in your "AI + AR Data in a Shared
   Space on XREAL" video) available in the same Flow when it is opened through XREAL, or is that a
   desktop-session feature?

## Data integrity + iteration

8. Can Flow retain our stable evidence IDs (e.g. `banking-v1:n3:claim`, `evidence:B0L1`) so the
   rendered scene can be cross-checked element-by-element against our offline verifier?
9. Is there an official way to import an **updated** dataset into an existing Flow without
   rebuilding the scene (same IDs, refreshed statuses)? This matters for showing pristine vs
   tampered variants of the same audit.
10. Could you point us at (or share) a starter template closest to either of the two demo videos
    Bill sent — "AI + AR Data in a Shared Space on XREAL" (mejHs4MS7h8) or the Bitcoin MVRV
    30-second AI walkthrough (bjST6Hiuv3o) — that we could adapt for a compliance-audit story?

## Nice-to-know (only if quick)

11. Does Flow support conditional styling driven by a status column (our `status_family` field:
    pass/fail/warn/neutral) so tampered-state nodes can render dimmed/red without manual restyling?
