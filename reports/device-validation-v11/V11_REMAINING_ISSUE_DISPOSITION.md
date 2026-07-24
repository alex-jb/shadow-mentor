# V11 remaining issue disposition

Six issues remain open after the six implemented increments. Definitions are quoted from the
committed matrix, not remembered. **None blocks the Shadow-vs-control A/B package-handoff test.**

| issue | committed title / behaviour | severity | primary disposition | implementation recommendation |
|---|---|---|---|---|
| **UX-08** | "29 % of the frame is empty while the top band is crowded" — partially borrowed by the UX-02 fix (left margin) and the UX-14 fix (lower band) | P2 | `SAFE_TO_DEFER_WITHIN_V11` | `DO_NOT_IMPLEMENT_IN_V11` — unused space alone is not a defect; the two fixes that needed the capacity already took it |
| **UX-10** | "`role:` value is not localized" — the Chinese view shows `角色: decision` | P2 | `SAFE_TO_DEFER_WITHIN_V11` | `IMPLEMENT_ONLY_AFTER_HANDOFF` — a one-line localization fix, but it changes committed wording surface; not worth re-baselining before the device run |
| **UX-11** | "Absence is encoded three different ways" — not-present / not-evaluated / downstream share `#8a92a0` | P2 | `SAFE_TO_DEFER_WITHIN_V11` | `REQUIRES_PRODUCT_DECISION` — distinguishing absent vs unknown vs downstream needs a reviewed token-family split, which touches the schema-`/3` palette that just stabilised |
| **UX-12** | "The Workspace and the Audit Room contradict each other on what 'verified' looks like" | P2 | `DEFER_TO_POST_V11` (its committed disposition) | `REQUIRES_PRODUCT_DECISION` — choosing one colour grammar for both surfaces is a design decision, not a maintenance fix; the Flat grammar is the documented, test-pinned one |
| **UX-13** | "No focus / selected / hover / disabled model exists" | P3 | `REQUIRES_PHYSICAL_EVIDENCE_BEFORE_IMPLEMENTATION` | `IMPLEMENT_ONLY_AFTER_PHYSICAL_OBSERVATION` — designing controller affordances before ever holding the controller against the real panel would be invention; the committed disposition is `REQUIRES_DEVICE_VALIDATION` |
| **UX-15** | "The capture harness pollutes the shared PlayMode session" + PNG non-byte-determinism | P3 | `SAFE_TO_DEFER_WITHIN_V11` | `IMPLEMENT_ONLY_AFTER_HANDOFF` — fully mitigated operationally: every regression run uses fresh processes and capture never shares one; the UX-06 restoration proved the discipline works (101/99/0/2 twice) |

## The seven explicit questions

1. **Blocks the Shadow-vs-HelloMR A/B?** None. The A/B tests the MyGlasses package-handoff route;
   all six remaining issues live in workspace rendering, localization, colour grammar, interaction
   or capture tooling — none participates in discovery/handoff.
2. **Blocks checking whether Shadow's XR loader starts?** None. Loader startup precedes any UI.
3. **Blocks checking whether the workspace is visible?** None. Visibility is decided by the loader,
   camera and scene — all frozen in candidate-04; the six open issues affect quality, not presence.
4. **Blocks 3DoF/controller validation?** UX-13 does not *block* it — it is the *subject* of it.
   Controller validation runs against the current Prev/Next/Select mapping; UX-13's missing focus
   affordance is precisely what the physical session is meant to observe.
5. **Safe to remain open entering physical testing?** All six.
6. **Defer to post-V11?** UX-12 (committed as such) and UX-08 (space is not a defect).
7. **Any additional offline implementation justified before the A/B?** **No.** Every remaining item
   is either physical-evidence-gated (UX-13), a product decision (UX-11, UX-12), tooling already
   mitigated by process (UX-15), a non-defect (UX-08), or a trivial fix not worth re-baselining for
   (UX-10). Implementing any of them now would risk the just-stabilised offline baseline for zero
   effect on the device experiment.

Machine-readable: `v11-remaining-issue-disposition.json`.
