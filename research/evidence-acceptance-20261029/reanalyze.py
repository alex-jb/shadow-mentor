"""Re-analyze seven existing check observations, excluding snapshot commands.

Gold labels below are manually fixed from the controlled source fixture. The
interpreters receive only process/raw evidence, never these labels or case IDs.
This is a development replay, not a new held-out or production benchmark.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

from acceptance import exit_only, inspect_check, strict_output


HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "integration-acceptance-20261026/discovery-observed-results.json"
REQUIREMENTS = ("initialize", "tools/list")
GOLD = {
    "0.8.2/check_valid_empty": "COMPLETE",
    "0.8.2/check_error_against_valid_empty": "ERROR",
    "0.8.2/check_error_against_nonempty": "ERROR",
    "0.8.2/check_error_against_contaminated_baseline": "ERROR",
    "0.8.3/check_valid_empty": "COMPLETE",
    "0.8.3/check_error_against_valid_empty": "ERROR",
    "0.8.3/check_error_against_nonempty": "ERROR",
}


def main() -> None:
    source_bytes = SOURCE.read_bytes()
    source = json.loads(source_bytes)
    rows = []
    for version_index, version in enumerate(source["versions"]):
        for row_index, observation in enumerate(version["observations"]):
            if observation["action"] != "check":
                continue
            key = version["cli_version"] + "/" + observation["case"]
            process = {"exit_code": observation["observed_exit"], "timed_out": False}
            raw = {name: observation[name] for name in ["stdout", "stderr", "exchanges"]}
            # The fixture collector produced a complete local capture. This is
            # a study premise, not an authenticated independent completeness proof.
            raw["capture_complete"] = True
            native = exit_only(process)
            strict = strict_output(process, raw)
            receipts = inspect_check(process, raw, REQUIREMENTS)
            rows.append({
                "record_id": key,
                "source_pointer": f"/versions/{version_index}/observations/{row_index}",
                "process": process,
                "raw": raw,
                "gold_execution_state": GOLD[key],
                "gold_acceptance": "ACCEPT" if GOLD[key] == "COMPLETE" else "WITHHOLD",
                "exit_only": native,
                "strict_output": strict,
                "receipt_gate": receipts,
            })
    assert len(rows) == 7 and {row["record_id"] for row in rows} == set(GOLD)
    metrics = {}
    for method in ["exit_only", "strict_output", "receipt_gate"]:
        predicted_accept = lambda row: row[method] == "PASS" if method == "exit_only" else row[method]["acceptance"] == "ACCEPT"
        metrics[method] = {
            "false_accept_count": sum(predicted_accept(row) and row["gold_acceptance"] != "ACCEPT" for row in rows),
            "valid_accept_withheld_count": sum(not predicted_accept(row) and row["gold_acceptance"] == "ACCEPT" for row in rows),
            "errors_called_product_fail": sum((row[method] == "FAIL" if method == "exit_only" else row[method]["supported_verdict"] == "FAIL") and row["gold_execution_state"] == "ERROR" for row in rows),
        }
    report = {
        "schema": "shadow-evidence-acceptance-development-replay/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_file": SOURCE.name,
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "interpreter_sha256": hashlib.sha256((HERE / "acceptance.py").read_bytes()).hexdigest(),
        "driver_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "obligation": {"required_methods": REQUIREMENTS, "claim": "MCP tools discovery and a valid native mcpdiff report, not business correctness"},
        "selection": "Seven check commands from one known historical fix; six snapshot commands excluded",
        "new_native_tool_executions": 0,
        "held_out_evaluation": False,
        "independent_defect_count": 1,
        "gold_source": "Manually fixed from the already authored local fixture and its recorded replies; no blinded second annotator",
        "record_count": len(rows),
        "metrics": metrics,
        "observations": rows,
    }
    (HERE / "reanalysis-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"records": len(rows), "metrics": metrics}, ensure_ascii=False))


if __name__ == "__main__":
    main()
