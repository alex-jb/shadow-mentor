# Shadow × Flow demo storyboard (3–5 minutes, one completed audit result)

A guided presentation of ONE completed Shadow audit (`case-2026-Q3-0042`). This is not Time Mode
and not a live analysis — the audit is finished; Flow replays its structure spatially. Keyboard/
narration fallbacks are listed per step so the demo survives any Flow limitation.

Personas: **presenter** (Alex or Lora) + optional **Flow copilot** (AI querying, if the account
supports it — step 4/8 fallbacks assume it may not).

| # | Step | Presenter narration (EN — zh gloss in parentheses) | Flow view / focus | Source data | Expected action | Evidence shown | Fallback if Flow can't do it live |
|---|---|---|---|---|---|---|---|
| 1 | Open the banking case | "A mid-market loan, case SL-2026-014, an $8.4M request. Everything you'll see is a deterministic demonstration fixture — the label says so." (中型市场贷款,固定演示数据) | Wide shot; `left-case` group highlighted | `presentation:case-card`, `evidence:B0L*` | Focus/zoom to case card | Case card + FIXTURE MODEL label | Static opening view; narrate from the printed case card |
| 2 | Show the council | "Five governance voices reviewed it — credit, risk, fair-lending compliance, customer advocacy, macro. Three of five challenged." (五个治理视角,三个提出异议) | Orbit the `ring-council` ring | 5 `council:*` nodes | Rotate/step through voices | Stance + confidence per voice, verbatim | Point at each voice in a fixed layout; stances are on the labels |
| 3 | Focus the first failure | "In the tampered replay, verification breaks first HERE — the council-claims link, sequence 3. That's the first failure; everything after it is consequence." (首个失败在序号3) | Camera to `center` — the FIRST_FAILURE node | `banking-v1:n3:claim`, scenario `tamper_seq_3` | Zoom to center | FIRST FAILURE / 首个失败 status + octahedron/alert encoding | The node is pre-styled as focal; presenter simply walks to it |
| 4 | Trace the evidence chain | "The lineage is ordered: source, intake snapshot, evidence, claims, recommendation, signature, audit record. Order is the argument." (证据链按序号排列) | Follow `path-lineage` seq 0→6 | 7 lineage nodes + e1–e6 edges | Step along the path | DERIVED_FROM / SEALED_BY edges in order | Read the sequence numbers off the labels; order is data, not animation |
| 5 | Show downstream consequences | "Sequences 4, 5, 6 freeze as AFFECTED DOWNSTREAM — not independently re-judged, frozen because an upstream link failed." (下游冻结,不重新判断) | Dim/highlight the three downstream nodes | `affected_downstream` list | Highlight group | AFFECTED_DOWNSTREAM status ×3 + consequence edges | Statuses are baked into node styling; narrate the freeze |
| 6 | Show Human Review | "The council's own output was REVIEW — routed to a person. Three dissents, so no machine auto-decision." (结论是转人工复核) | Move right: decision + human-review nodes | `presentation:decision`, `presentation:human-review` | Focus right group | REQUIRES HUMAN REVIEW / 需人工复核 | Fixed layout keeps the right rail visible at all times |
| 7 | Show Approval — distinct | "Review is not approval. In this fixture no approval exists — the node says NOT PRESENT. Shadow refuses to blur that line." (复核≠批准;本例无批准) | Focus `presentation:approval` | approval node | Focus | NOT PRESENT status, separate node | Same — the distinction is in the data, not the camera |
| 8 | Hash-chain / verifier result | "Verification lives apart from the business view: hash chain FAILED in the tampered replay, and note — analytical correctness is NEVER evaluated by the chain. Integrity, not correctness." (验证与业务结论分区;完整性≠正确性) | Pan to `verification-area` | 4 `presentation:verify-*` + attestation | Focus verification area | HASH CHAIN: FAILED · ANALYTICAL CORRECTNESS: NOT EVALUATED · sealed-verified attestation | Narrate from the verification nodes; optionally show the offline verifier output on a laptop screen beside the glasses feed |
| 9 | Shadow / Flow / XREAL relation | "Division of labor: Shadow analyzed and attested this case; Flow made it spatial; XREAL displays it. The SIMULATION node is our own disclaimer — no native Shadow Lens device claim is being made here." (Shadow 分析签章,Flow 可视化,XREAL 显示) | Wide shot incl. `presentation:device-boundary` | device-boundary + manifest | Pull back to full scene | SIMULATION disclaimer node + FIXTURE MODEL label | This step is pure narration; works identically on a flat screen |

## CSV-structure notes (added 2026-07-27 with the vendor graph dataset)

The nine steps are unchanged. The vendor CSV (`shadow-flow-vendor-graph.csv`, one row per node with
a pipe-delimited `idList`) changes two things a presenter will be asked about on the floor:

- **Step 2 — two council voices render unconnected, on purpose.** `Fair Lending Compliance` and
  `Macro Contrarian` have no edge, and neither does the `Annual income` evidence item. In this case
  those voices reached a finding **without citing an evidence item**, and nobody cited B0L0. If an
  auditor asks why they float, that is the correct answer: the absence is the audit record. Do not
  apologize for it, and do not let anyone "fix" the dataset to connect them — a test pins these six
  nodes as isolated precisely so a future edit cannot invent citations.
  (Also isolated by design: the case card, the attestation panel and the SIMULATION disclaimer —
  contextual panels, not graph participants.)
- **Step 4 — arrow direction is `DERIVED_FROM`, not flow-of-time.** In `idList` each row names the
  nodes it points *to*, and Shadow's lineage edges point from a successor to the thing it was
  derived from. So if Flow draws arrowheads, the chain reads `n6 → n5 → … → n0` — child pointing at
  parent. Narrate the sequence numbers (`lineage_order` 0→6), which ascend in narration order, and
  let the arrows mean provenance rather than chronology.

Everything else the storyboard relies on survives the projection unchanged: statuses, first-failure
and downstream markers, bilingual labels, review-vs-approval separation, and the verification
grouping are all copied from the same Shadow fixtures the earlier steps already cite.

## Timing

~20–35 s per step ≈ 3–5 min total. Steps 3–5 are the hero arc (first failure → lineage →
consequence); if time is short, compress 1–2 and 6–7, never 3–5.

## Global fallbacks

- **Flow account unavailable / import unconfirmed** → present the identical storyboard from the
  existing offline surfaces (Three.js guided story / 2D replay) and say so honestly; the data and
  narration are unchanged because Shadow owns the canonical story. **As of 2026-07-27 this is still
  the operative case**: the vendor CSV is prepared and validated offline, but no import has been
  performed and no Flow scene has rendered — see `SHADOW_FLOW_IMPORT_RUNBOOK.md`.
- **XREAL unavailable** → browser on a laptop/projector; the storyboard has no device-only step.
- **AI querying unavailable** → all 9 steps work as a guided walkthrough with zero live AI.
