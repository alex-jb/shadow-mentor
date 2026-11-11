"""Run OPA only on the application inputs admitted by the common CI gate."""

from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

HERE = Path(__file__).resolve().parent
INTAKE = HERE.parent
OPA_SHA256 = "26f04bc50983ac67db9dea2fd28c1670c74ac22639a2f4408a7e16d488898e5f"

# Run as a script beside the policy, without installing the experiment modules.
sys.path.insert(0, str(INTAKE))
from experiment import build, encode
from intake import _contract, admit_ci


def opa_eval(opa: Path, policy: Path, caps_file: Path, frozen: bytes, report: object) -> dict:
    payload = {
        "plan": json.loads(frozen),
        "frozen_plan_sha256": sha256(frozen).hexdigest(),
        "report": report,
    }
    raw = subprocess.check_output(
        [opa, "eval", "--format", "raw", "--strict-builtin-errors", "--fail",
         "--capabilities", caps_file, "-d", policy, "--stdin-input", "data.shadow_app.result"],
        input=json.dumps(payload, allow_nan=False), text=True, timeout=10,
    )
    result = json.loads(raw)
    if result.get("decision") not in {"ACCEPT", "REJECT", "WITHHOLD"}:
        raise ValueError("OPA returned an unexpected application decision")
    return result


def numeric_probe(opa: Path, policy: Path, caps_file: Path) -> list[dict]:
    """Change a correctly bound observation's numeric literal, not its identity."""
    result = []
    for value in (1, 1.0, 1.25):
        bundle = build("fresh_match")
        altered = json.loads(bundle["report_bytes"])
        altered["observations"][0]["value"] = value
        bundle["report_bytes"] = encode(altered)
        bundle["receipt"]["report_sha256"] = sha256(bundle["report_bytes"]).hexdigest()
        gate, report = admit_ci(**bundle)
        if gate["decision"] != "ADMITTED":
            raise ValueError("numeric probe must have a consistent evidence binding")
        frozen = bundle["frozen"]
        result.append({
            "literal": json.dumps(value),
            "source_report_sha256": bundle["receipt"]["report_sha256"],
            "python_application_result": _contract.evaluate(frozen, report),
            "opa_application_result": opa_eval(opa, policy, caps_file, frozen, report),
        })
    observed = [(r["python_application_result"]["decision"], r["opa_application_result"]["decision"])
                for r in result]
    if observed != [("ACCEPT", "ACCEPT"), ("WITHHOLD", "ACCEPT"), ("WITHHOLD", "WITHHOLD")]:
        raise ValueError(f"unexpected numeric boundary behavior: {observed}")
    return result


def run(opa: Path) -> dict:
    opa = opa.resolve()
    if sha256(opa.read_bytes()).hexdigest() != OPA_SHA256:
        raise ValueError("expected the verified Linux/amd64 OPA 1.22.3 binary")

    policy = HERE / "policy.rego"
    catalog = INTAKE / "case-catalog.json"
    cases = json.loads(catalog.read_text(encoding="utf-8"))["cases"]
    capabilities = json.loads(subprocess.check_output([opa, "capabilities", "--current"], timeout=10))
    excluded = {"http.send", "net.lookup_ip_addr", "opa.runtime"}
    capabilities["builtins"] = [
        b for b in capabilities["builtins"] if not b.get("nondeterministic") and b["name"] not in excluded
    ]
    capabilities["allow_net"] = []

    results = []
    with TemporaryDirectory() as work:
        caps_file = Path(work) / "capabilities.json"
        caps_file.write_text(json.dumps(capabilities), encoding="utf-8")
        for item in cases:
            bundle = build(item["id"])
            gate, report = admit_ci(**bundle)
            admitted = gate["decision"] == "ADMITTED"
            if admitted:
                frozen = bundle["frozen"]
                opa_result = opa_eval(opa, policy, caps_file, frozen, report)
                python_result = _contract.evaluate(frozen, report)
            else:
                if gate["decision"] != "WITHHOLD":
                    raise ValueError("unexpected common admission decision")
                opa_result = python_result = None

            # No label, case identifier or Python verdict enters the OPA input.
            final = opa_result["decision"] if admitted else gate["decision"]
            results.append({
                "case": item["id"],
                "admission": gate["decision"],
                "admission_reason": gate["reason"],
                "opa_application_result": opa_result,
                "python_application_result": python_result,
                "pipeline_decision": final,
                "authored_expected": item["decision"],
            })
        numeric_controls = numeric_probe(opa, policy, caps_file)

    evaluated = [r for r in results if r["opa_application_result"] is not None]
    sources = [policy, Path(__file__), catalog, INTAKE / "intake.py", INTAKE / "experiment.py",
               INTAKE.parent / "acceptance-contract-20261111" / "contract.py"]
    return {
        "schema": "shadow.opa-reference-results.v1",
        "boundary": (
            "Only the application policy is independent of the Python evaluator. "
            "The common admission gate and authored case construction are shared. "
            "No live CI run or general equivalence claim."
        ),
        "numeric_limit": (
            "Rego sees a number after JSON decoding; integral numeric spellings such as 1 and 1.0 "
            "compare equal there, unlike this Python contract's lexical integer/float type distinction. "
            "The 22-case corpus excludes float spellings. The three numeric controls are reported separately."
        ),
        "opa": {"version": "1.22.3", "binary_sha256": OPA_SHA256},
        "source_sha256": {str(p.resolve().relative_to(INTAKE.parent)): sha256(p.read_bytes()).hexdigest()
                          for p in sources},
        "authored_cases": len(results),
        "common_gate_withheld": len(results) - len(evaluated),
        "actual_opa_evaluations": len(evaluated),
        "opa_decision_agreement_with_python_on_admitted": sum(
            r["opa_application_result"]["decision"] == r["python_application_result"]["decision"]
            for r in evaluated
        ),
        "opa_full_result_agreement_with_python_on_admitted": sum(
            r["opa_application_result"] == r["python_application_result"] for r in evaluated
        ),
        "opa_agreement_with_authored_on_admitted": sum(
            r["pipeline_decision"] == r["authored_expected"] for r in evaluated
        ),
        "common_gate_plus_opa_agreement_with_authored": sum(
            r["pipeline_decision"] == r["authored_expected"] for r in results
        ),
        "separate_numeric_controls": numeric_controls,
        "rows": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--opa", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=HERE / "results.json")
    args = parser.parse_args()
    result = run(args.opa)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if type(v) is int}, indent=2))
    return int(result["common_gate_plus_opa_agreement_with_authored"] != result["authored_cases"])


if __name__ == "__main__":
    raise SystemExit(main())
