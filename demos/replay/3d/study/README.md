# M5 XR user-study apparatus

Stimuli + scoring for the IEEE VR 2027 study (see
`docs/m5-xr/ieee-vr-2027-method-draft.md`, §3). The task: find the tampered
event in a signed audit chain and state its downstream impact.

## Generate stimuli

```
node generate-trials.mjs --count 8 --len 12 --depth 6
```

Writes to `trials/` (gitignored — freeze per study run):

- `trial-NN.json` — the participant-facing bundle. It is a **real** evidence
  bundle built by `attest-core` (createSession → appendEvent → sealSession,
  Ed25519-signed) and then tampered by flipping one payload hash, so the same
  verifier the demo and `verify.html` use detects the break. No faked data.
- `answer-key.json` — ground truth (altered seq, broken-from seq, affected
  set, difficulty). **Keep this from participants.**
- `study-public-key.pem` — the key the verifier uses for every trial.

**Matched difficulty** within a set: `--len` (chain length), `--depth` (seq of
the altered event), and the resulting fan-out are identical across trials, so a
display comparison is not confounded with puzzle difficulty. Trial *structure*
is deterministic (seeded per index); the signing key is fresh per run, so
generate once and freeze before collecting data.

## Score responses

Collect each participant's answer per trial as:

```json
{ "trial-01": { "altered_seq": 6, "affected_set": [7,8,9,10,11] }, ... }
```

Then:

```
node score.mjs --key trials/answer-key.json --responses responses.json
node score.mjs --selftest    # sanity-check the scoring math
```

Outputs the two primary measures (Method §3.6), reported separately:

- **localization correctness** — binary: did they name the altered event?
- **impact-scope accuracy** — F1 / Jaccard of their affected-set vs. the truth
  (precision penalises over-claiming, recall penalises misses).

`setScores` and `scoreTrial` are covered by `test/replay-3d.test.js`.

## Not built yet (needs the locked design + a served context)

- Loading a trial into the 3D room / Quest condition. The offline file:// build
  inlines one demo bundle; the study conditions will be served (Quest needs
  https anyway), so trial-loading belongs with the served study build, not the
  offline demo. Wire it after the design is locked with Lora + the IRB clears.
