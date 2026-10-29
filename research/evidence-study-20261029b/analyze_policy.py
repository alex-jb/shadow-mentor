"""Compare frozen interpretation and an ordinary policy-aware strict parser.

Authored dispositions come from the selected fixture changes and CLI flags;
they are not inputs to either parser. This is development analysis, not a
blinded performance or unknown-defect discovery evaluation.
"""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

from policy_parser import interpret


HERE = Path(__file__).resolve().parent
GOLD_ACCEPT = {
    "unchanged_warning_policy": True,
    "annotation_warning_policy": False,
    "annotation_breaking_policy": True,
    "description_warning_policy": False,
    "description_breaking_policy": True,
    "required_schema_warning_policy": False,
}


def main():
    source_bytes = (HERE / "contract-change-results.json").read_bytes()
    source = json.loads(source_bytes)
    rows = []
    for row in source["observations"]:
        output = interpret(row["process"], row["raw"], row["policy"])
        rows.append({
            "record_id": row["cli_version"] + "/" + row["case"],
            "authored_acceptance": "ACCEPT" if GOLD_ACCEPT[row["case"]] else "WITHHOLD",
            "actual_cli_policy": row["policy"],
            "frozen_discovery_gate": row["legacy_receipt_interpretation"],
            "ordinary_policy_parser": output,
        })
    metrics = {}
    for key in ["frozen_discovery_gate", "ordinary_policy_parser"]:
        metrics[key] = {
            "false_accept_count": sum(row[key]["acceptance"] == "ACCEPT" and row["authored_acceptance"] == "WITHHOLD" for row in rows),
            "allowed_change_or_healthy_result_withheld": sum(row[key]["acceptance"] == "WITHHOLD" and row["authored_acceptance"] == "ACCEPT" for row in rows),
            "unknown_supported_verdict_count": sum(row[key]["supported_verdict"] == "UNKNOWN" for row in rows),
        }
    result = {
        "schema": "shadow-known-policy-development-analysis/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Twelve authored native check controls, one historical omission, two CLI versions",
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "parser_sha256": hashlib.sha256((HERE / "policy_parser.py").read_bytes()).hexdigest(),
        "driver_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "held_out": False,
        "known_cost": "Hash inconsistency makes the strict parser withhold the old annotation/breaking control even though the authored change is warning-only and allowed under that policy.",
        "comparison_limit": "The frozen interpreter assumed breaking-only policy and a narrower discovery obligation. This is a scope/engineering counterexample, not a claim of algorithmic superiority.",
        "record_count": len(rows),
        "metrics": metrics,
        "observations": rows,
    }
    (HERE / "policy-analysis-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()
