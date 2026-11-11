# Local reference check: Ergo Rego 0.6.0

This is a bounded smoke test of the public Ergo Rego engine on five synthetic observations. It does not compare whole CI intake pipelines, authenticate a producer, or evaluate a live workflow.

- [GitHub release and asset](https://github.com/kosli-dev/ergo/releases/tag/rego-v0.6.0): `rego-v0.6.0`, published 2026-11-11 17:27:27 UTC. The annotated tag resolves to commit `c2d3160fe35755d97e85f2b6d34c5c66d40a31d5`.
- [Release metadata](https://api.github.com/repos/kosli-dev/ergo/releases/tags/rego-v0.6.0): asset SHA-256 `3810c49bde52cbf3ddd6a0bbf934aab35c186b054cd4631e53e39385825205c7`. The test reconstructed the file using the one-line version substitution in the [pinned release workflow](https://github.com/kosli-dev/ergo/blob/c2d3160fe35755d97e85f2b6d34c5c66d40a31d5/.github/workflows/release.yml) and verified the exact digest and byte length before loading it.
- [OPA v1.22.3](https://github.com/open-policy-agent/opa/releases/tag/v1.22.3), Linux/amd64, binary SHA-256 `26f04bc50983ac67db9dea2fd28c1670c74ac22639a2f4408a7e16d488898e5f`. The harness excludes nondeterministic, network, and runtime-introspection builtins from evaluation capabilities. It loads one local Rego module and JSON supplied on stdin; it uses no HTTP policy calls.
- [Pinned API documentation](https://github.com/kosli-dev/ergo/blob/c2d3160fe35755d97e85f2b6d34c5c66d40a31d5/OPA.md): only the public `data.ergo.report(input, policy, {})` entry point was used.

The policy checks whether a supplied `row_count` equals the number `1` for a query whose scope is `release`. This checks the supplied observation, not a database. The policy sets `min_subjects: 0` explicitly to exercise an optional scope.

| Synthetic input | Overall `compliant` | Requirement status | Check row |
| --- | --- | --- | --- |
| In scope, numeric `1` | true | `met` | `one`: true, `satisfied` |
| In scope, numeric `2` | false | `not_met` | `one`: false, `value` |
| In scope, field absent | false | `not_met` | `one`: false, `absent` |
| In scope, string `"1"` | false | `not_met` | `one`: false, `unusable` |
| Out of scope, numeric `2` | true | `not_applicable` | `$applies`: false, `value`; no `one` row |

The two failed numeric/typed observations are distinguishable from absence in Ergo's own output. When present, `row_count` points to `/queries/0/row_count`; the missing observation points to the containing `/queries/0`. The out-of-scope result is consistent with the policy allowing zero subjects. It should not be read as proof that a required release observation was performed. These results make Ergo a reference for check semantics. An attempt/producer binding test would additionally need the same trustworthy CI identity fields and selection policy supplied to both systems.

## Reproduce

Run in a scratch directory containing the verified OPA binary named `opa-1.22.3`. The clone is a read of the pinned public source. No build or install scripts are run and the release module is not vendored here.

```sh
git clone --depth 1 --single-branch --branch rego-v0.6.0 https://github.com/kosli-dev/ergo.git ergo-rego-v0.6.0
python3 - <<'PY'
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import subprocess

repo = Path("ergo-rego-v0.6.0")
opa = Path("opa-1.22.3").resolve()
assert subprocess.check_output(
    ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
).strip() == "c2d3160fe35755d97e85f2b6d34c5c66d40a31d5"
assert hashlib.sha256(opa.read_bytes()).hexdigest() == (
    "26f04bc50983ac67db9dea2fd28c1670c74ac22639a2f4408a7e16d488898e5f"
)
source = (repo / "engines/rego/ergo.rego").read_bytes()
old, new = b'version := "0.6.0-dev"\n', b'version := "0.6.0"\n'
assert source.count(old) == 1
asset = source.replace(old, new)
assert len(asset) == 467679
assert hashlib.sha256(asset).hexdigest() == (
    "3810c49bde52cbf3ddd6a0bbf934aab35c186b054cd4631e53e39385825205c7"
)

caps = json.loads(subprocess.check_output([opa, "capabilities", "--current"]))
blocked = {"http.send", "net.lookup_ip_addr", "opa.runtime"}
caps["builtins"] = [
    b for b in caps["builtins"]
    if not b.get("nondeterministic") and b["name"] not in blocked
]
caps["allow_net"] = []

policy = {
    "ergo_spec": "v0.6",
    "subjects": {
        "query": {"from": 'queries whose scope is "release"', "identified_by": "id"},
    },
    "requirements": {
        "row_expectation": {
            "subject": "query", "min_subjects": 0, "checks": {"one": "row_count is 1"},
        },
    },
}
query = "data.ergo.report(input, " + json.dumps(policy, separators=(",", ":")) + ", {})"
cases = [
    ("match", {"row_count": 1}, (True, "met", [("one", True, "satisfied")])),
    ("mismatch", {"row_count": 2}, (False, "not_met", [("one", False, "value")])),
    ("absent", {}, (False, "not_met", [("one", False, "absent")])),
    ("string_not_number", {"row_count": "1"}, (False, "not_met", [("one", False, "unusable")])),
    ("out_of_scope", {"scope": "development", "row_count": 2},
     (True, "not_applicable", [("$applies", False, "value")])),
]
with TemporaryDirectory() as work:
    lib = Path(work) / "ergo.rego"
    lib.write_bytes(asset)
    capabilities = Path(work) / "capabilities.json"
    capabilities.write_text(json.dumps(caps), encoding="utf-8")
    for name, changes, expected in cases:
        observation = {"queries": [{"id": "q1", "scope": "release", **changes}]}
        raw = subprocess.check_output(
            [opa, "eval", "--format", "raw", "--strict-builtin-errors", "--fail",
             "--capabilities", capabilities, "-d", lib, "--stdin-input", query],
            input=json.dumps(observation), text=True,
        )
        report = json.loads(raw)
        assert report["engine"] == {"name": "ergo-rego", "version": "0.6.0"}
        requirement = report["requirements"]["row_expectation"]
        rows = [r for r in report["results"]
                if r["check"] == "one" or (r["check"] == "$applies" and not r["passed"])]
        observed = (report["compliant"], requirement["status"],
                    [(r["check"], r["passed"], r["cause"]) for r in rows])
        assert observed == expected, (name, observed)
        print(name, observed)
PY
```
