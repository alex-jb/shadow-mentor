# Decision Amendment Contract Discovery

Discovery-only documentation set. No product implementation, no contract
extension in source, no Web/Lens/Flow/control-plane changes.

## Baseline record

- Source branch: `feat/shadow-portable-package-supersession`
- Source commit: `8fae7e7` (`8fae7e7ff4794ef149defd2bac99e4ddbc13f346`), verified clean
- Discovery branch: `docs/decision-amendment-contract-discovery`
- Discovery worktree: isolated worktree separate from all active product worktrees
- Initial status: working tree clean at branch creation
- Read-only references: Shadow Web `feat/shadow-web-package-supersession-timeline` @ `d7935bf`; control plane @ `0ef772b`

## Result tokens

- Architecture decision: **NEW_DECISION_MEMBER_IN_PACKAGE_VERSION_RECOMMENDED**
- Task result: **SHADOW_DECISION_AMENDMENT_DISCOVERY_PASSED**

## Contents

| File | Purpose |
|---|---|
| EXISTING_DECISION_INVENTORY.md / decision-inventory.json | Inventory of existing decision concepts (Core, Web, control plane) |
| DECISION_SEMANTICS.md | The four decision types, precisely separated |
| ACTOR_AND_AUTHORIZATION_MODEL.md | Actor fields, identity classes, authorization limits |
| DECISION_TARGET_AND_AMENDMENT_CONTENT.md | Target binding + signed amendment payload |
| DECISION_STATE_MACHINE.md / decision-state-machine.json | Closed lifecycle model, orthogonal to integrity |
| DECISION_CONTRACT_OPTIONS.md | Options A–E assessed |
| DECISION_CONTRACT_RECOMMENDATION.md / decision-contract-decision.json | Selected architecture (Option B) |
| DECISION_SIGNING_BOUNDARY.md | Exact signed bytes, ID derivation, replay prevention, role separation |
| FIXTURE_DECISION_BOUNDARY.md | Honest fixture-mode limits + status tokens |
| DECISION_WORKFLOW_OPTIONS.md | Execution models; Core CLI recommended next |
| DECISION_WEB_HANDOFF.md | Future Web display rules; what Web may/must not do |
| DECISION_PRIVACY_MODEL.md | Field sensitivity classification, text bounds, IndexedDB posture |
| DECISION_FAILURE_VOCABULARY.md / decision-failure-vocabulary.json | Closed failure vocabulary in four disjoint classes |
| DECISION_TEST_STRATEGY.md | Test design for the implementation increment |
| NEXT_DECISION_IMPLEMENTATION_INCREMENT.md | Exact bounded next increment (requires separate approval) |
