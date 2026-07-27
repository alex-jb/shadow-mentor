# Decision Fixture Runbook

Status: IMPLEMENTED (fixture mode). Deterministic end-to-end decision arc
over the banking fixture. **These are synthetic fixture actors and fixture
reason codes — never real bank personnel, never real decisions.**

Fixture actors (operator-declared, unauthenticated by design):

- `fixture:reviewer-1` — "Fixture Reviewer One", role `reviewer`
- `fixture:approver-1` — "Fixture Approver One", role `approver`

Committed intents: `test/fixtures/decision/*.intent.json` (+ two `*.template.json`
whose `target.decision_id` is filled from the generated override — the id is
content-derived and depends on the predecessor's manifest hash).

## The arc

```
A  (1.0 original — council recommendation REVIEW)
└─ B  HUMAN_REVIEW_COMPLETED / OVERRIDE_PROPOSED        (fixture:reviewer-1)
   └─ C  DECISION_OVERRIDDEN / approval pending          (fixture:reviewer-1)
      ├─ D  APPROVAL_GRANTED → OVERRIDDEN,               (fixture:approver-1)
      │      effective APPROVE_WITH_CONDITIONS
      └─ R  DECISION_REJECTED → REJECTED,                (fixture:approver-1)
             effective reverts to REVIEW
```

D and R are alternate branches; supplying both is the committed fork/conflict
demonstration (reported, never resolved).

## Commands

```sh
CLI="node bin/shadow-audit-package.mjs"
FIX=test/fixtures/decision

$CLI create --fixture banking --output-dir /tmp/arc/A --build-commit demo
$CLI decide --predecessor /tmp/arc/A --intent $FIX/review-override-proposed.intent.json \
     --output-dir /tmp/arc/B --build-commit demo
$CLI decide --predecessor /tmp/arc/B --intent $FIX/override.intent.json \
     --output-dir /tmp/arc/C --build-commit demo

# fill the approval/rejection templates with C's decision_id
CID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/arc/C/decision/decision-amendment.json')).decision_id)")
node -e "const f=require('fs');const i=JSON.parse(f.readFileSync('$FIX/approval.intent.template.json'));i.target.decision_id='$CID';f.writeFileSync('/tmp/arc/approval.json',JSON.stringify(i))"
node -e "const f=require('fs');const i=JSON.parse(f.readFileSync('$FIX/rejection.intent.template.json'));i.target.decision_id='$CID';f.writeFileSync('/tmp/arc/rejection.json',JSON.stringify(i))"

$CLI decide --predecessor /tmp/arc/C --intent /tmp/arc/approval.json  --output-dir /tmp/arc/D --build-commit demo
$CLI decide --predecessor /tmp/arc/C --intent /tmp/arc/rejection.json --output-dir /tmp/arc/R --build-commit demo

# lifecycle over each branch
$CLI verify-chain --package /tmp/arc/A --package /tmp/arc/B --package /tmp/arc/C --package /tmp/arc/D
$CLI verify-chain --package /tmp/arc/A --package /tmp/arc/B --package /tmp/arc/C --package /tmp/arc/R
# the fork (both branches) — reported, never resolved:
$CLI verify-chain --package /tmp/arc/A --package /tmp/arc/B --package /tmp/arc/C \
     --package /tmp/arc/D --package /tmp/arc/R
```

## Determinism

Fixed inputs (`--build-commit`, the intents' `decided_at_utc`, the fixture
narrative timestamp) → **byte-identical packages on every regeneration**,
pinned by `test/shadow-audit-package-decide-cli.test.js` ("byte-deterministic
… two identical arcs are byte-identical"). No wall-clock value is ever signed.

The council-decision target byte source is pinned by
`test/fixtures/decision/council-decision-extract.expected.json`
(sha256 `98ac9675…`); any drift breaks the regression test before it can break
signed target hashes.
