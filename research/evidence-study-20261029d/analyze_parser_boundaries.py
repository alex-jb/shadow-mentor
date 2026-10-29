"""Save authored parser counterexamples separately from native CLI observations."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import policy_parser_v2 as revised


HERE = Path(__file__).resolve().parent
OLD = HERE.parent / "evidence-study-20261029b"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source = OLD / "contract-change-results.json"
    native = json.loads(source.read_text())["observations"]
    healthy = next(r for r in native if r["case"] == "unchanged_warning_policy")
    seeds = []
    for name, mutation, expected in [
        ("retained_output_after_runner_skip", "skip", "WITHHOLD"),
        ("retained_output_after_runner_error", "error", "WITHHOLD"),
        ("duplicate_summary_key", "duplicate", "WITHHOLD"),
        ("nonfinite_unused_value", "nonfinite", "WITHHOLD"),
        ("same_hash_with_warning", "same_hash", "WITHHOLD"),
        ("quoted_discovery_error_text", "quoted", "ACCEPT"),
        ("healthy_capture_unchanged", "none", "ACCEPT"),
    ]:
        process, raw, policy = deepcopy(healthy["process"]), deepcopy(healthy["raw"]), deepcopy(healthy["policy"])
        # The API receives no case name, mutation name, expected label or gold.
        if mutation == "skip":
            process["runner_state"] = "SKIPPED"
        elif mutation == "error":
            process["runner_state"] = "ERROR"
        elif mutation == "duplicate":
            raw["stdout"] = '{"summary":{"total":1},' + raw["stdout"].lstrip()[1:]
        elif mutation == "nonfinite":
            raw["stdout"] = '{"extra":NaN,' + raw["stdout"].lstrip()[1:]
        elif mutation == "same_hash":
            report = json.loads(raw["stdout"])
            report["changes"] = [{"severity": "warning", "path": "tool.alpha.annotations"}]
            report["summary"] = {"total": 1, "breaking": 0, "warning": 1, "safe": 0}
            raw["stdout"] = json.dumps(report)
            policy["fail_on"] = "breaking"
        elif mutation == "quoted":
            raw["stderr"] = 'note: fixture text contains "Failed to list tools"; no command failed\n'
        # Receipt extras are not used by either output parser.
        raw = {"stdout": raw["stdout"], "stderr": raw["stderr"]}
        seeds.append({
            "authored_case": name, "input_origin": "authored mutation of a saved healthy report; not a native command execution",
            "process": process, "raw": raw, "policy": policy,
            "authored_expected_acceptance": expected,
            "frozen_v1": revised._BASE.interpret(process, raw, policy),
            "revision_v2": revised.interpret(process, raw, policy),
        })

    prior_results = []
    for row in native:
        args = row["process"], row["raw"], row["policy"]
        before, after = revised._BASE.interpret(*args), revised.interpret(*args)
        prior_results.append({"record_id": row["cli_version"] + "/" + row["case"], "identical_output": before == after, "v2": after})
    assert len(prior_results) == 12 and all(r["identical_output"] for r in prior_results)
    assert all(r["revision_v2"]["acceptance"] == r["authored_expected_acceptance"] for r in seeds if r["authored_case"] != "quoted_discovery_error_text")
    quoted = next(r for r in seeds if r["authored_case"] == "quoted_discovery_error_text")
    assert quoted["revision_v2"]["acceptance"] == "WITHHOLD"  # Retain the known limitation.

    result = {
        "schema": "shadow-authored-parser-boundary-analysis/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "bindings": {"source_native_results_sha256": sha(source), "frozen_parser_sha256": sha(OLD / "policy_parser.py"),
                     "v2_parser_sha256": sha(HERE / "policy_parser_v2.py"), "driver_sha256": sha(Path(__file__))},
        "execution_boundary": "Re-analysis of twelve saved native check outputs and seven authored report/process controls; no new native CLI executions.",
        "new_native_or_repaired_defects": 0,
        "held_out": False,
        "known_costs": ["One allowed warning-only change remains withheld in the original twelve-record cohort.",
                        "Quoted discovery-error wording still triggers the inherited stderr regex and withholds a healthy authored control.",
                        "Optional absent runner_state cannot authenticate that stdout belongs to the current run."],
        "counts": {"authored_controls": len(seeds), "saved_native_outputs": len(prior_results),
                   "saved_native_output_decisions_changed": sum(not r["identical_output"] for r in prior_results)},
        "authored_controls": seeds,
        "saved_native_reanalysis": prior_results,
    }
    (HERE / "parser-boundary-results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result["counts"]))


if __name__ == "__main__":
    main()
