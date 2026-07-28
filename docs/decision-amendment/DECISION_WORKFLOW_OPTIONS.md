# Decision Workflow Execution Options

Status: discovery only. Evaluates five future execution models for producing
signed decision-amendment successor packages. Exactly one is recommended for
the next bounded prototype. None is implemented here.

## Options

### A. Core CLI only
Operator writes a decision JSON file by hand (or from a template); Core CLI
validates it against the contract, resolves the predecessor package, and
produces the signed successor package.

| Criterion | Assessment |
|---|---|
| Private-key boundary | Best available: key stays where the existing fixture signing key already lives (filesystem, 0600), touched only by Core. |
| User experience | Weakest: hand-authored JSON; mitigated by a `--template` emitter and strict validation errors. Acceptable for the current operator (developer) audience. |
| Auditability | Strong: input intent file + output package are both plain artifacts; deterministic rebuild possible from fixture inputs. |
| Offline | Fully offline. |
| Replay protection | Decision ID derived from signed content incl. predecessor manifest hash + case ID → cross-case replay is detectable by binding checks; no server nonce needed. |
| Identity limitations | Operator-declared only — identical to fixture boundary, honestly labeled. |
| Web security | Untouched: Web remains read-only consumer. |
| Implementation scope | Smallest of all options; reuses the existing package-creation and supersession CLI paths. |
| Rollback | Trivial — delete the CLI command; no surface contracts beyond the package format. |
| Production migration | Clean: the same contract later accepts authenticated identity; CLI becomes one producer among several. |

### B. Web drafts unsigned decision intent → Core validates and signs
Web exports a bounded `decision-intent.json` (unsigned, clearly labeled);
operator feeds it to Core CLI, which validates, canonicalizes, and signs.

- Adds real UX value (forms, validation preview) without moving keys into the
  browser.
- Risk: intent file is untrusted input to Core → needs the same full
  validation as hand-written JSON (which Option A builds anyway).
- Scope: requires Web work, which is out of bounds for the next Core
  increment, but is the natural *second* increment.

### C. Local companion service
Web posts intent to a restricted local Core process that signs.

- Key boundary weaker (long-running process holding key, local port exposed to
  browser origin policy questions), replay/ CSRF surface appears, offline
  story fine but implementation scope much larger. Premature.

### D. Desktop/Tauri application
UI + signer packaged together.

- Good long-term key boundary and UX; large scope, new build/distribution
  surface, wrong increment size now. Revisit after contract stabilizes.

### E. Backend service with authenticated reviewers
Server-side signer, authenticated submission.

- Only path to *verified* identity/authority — and explicitly out of bounds
  now (no auth, no backend, no network per task constraints). This is the
  production target, not the prototype.

## Recommendation

**Option A — Core CLI only** for the next bounded prototype, with Option B as
the designated follow-on once the contract exists, and Option E as the
eventual production identity path.

Rationale: A exercises the entire contract (binding, signing, state
derivation, failure vocabulary) with the smallest new surface, zero new key
exposure, zero Web changes, and full offline determinism. Every artifact A
produces is exactly what B–E would produce; later options change only *who
authors the intent*, never the signed format.
