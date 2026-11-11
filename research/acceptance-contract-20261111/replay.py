"""Re-evaluate saved recorder controls under explicit, authored obligations.

The archived transports and task outcomes are unchanged. A local experiment
envelope simulates binding, omission and scope changes after capture; it is not
an upstream receipt or a measurement of authentication/freshness.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from contract import EVIDENCE_SCHEMA, PLAN_SCHEMA, digest, evaluate, freeze

HERE = Path(__file__).resolve().parent


def json_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def build_plan(case: dict, transport: str) -> dict:
    profile = case["profile"]
    if profile not in {"http_status", "status_required", "rpc_and_http_status"}:
        raise ValueError("unsupported experiment profile")
    checks = [{
        "id": "lifecycle_status",
        "applies_to": ["http", "stdio"] if profile == "status_required" else ["http"],
        "expected": case.get("status", 200),
    }]
    if profile == "rpc_and_http_status":
        checks.append({"id": "rpc_response_equals", "applies_to": ["http", "stdio"], "expected": True})
    return {
        "schema": PLAN_SCHEMA,
        "run_id": "study-run:" + case["id"],
        "scope": {"lane": "archived-authored-transport", "transport": transport},
        "checks": checks,
        "open_questions": case.get("open_questions", []),
    }


def extract_observations(row: dict, index: int, plan: dict) -> list[dict]:
    """Translate only this archived fixture format, not arbitrary recorder logs."""
    prefix = f"#/rows/{index}"
    transport = plan["scope"]["transport"]
    observations = []
    for check in plan["checks"]:
        check_id = check["id"]
        if transport not in check["applies_to"]:
            continue
        if check_id == "lifecycle_status":
            events = [(i, event) for i, event in enumerate(row["transport_events"])
                      if event["kind"] == "lifecycle" and event.get("http_method") == "DELETE"
                      and event.get("http_path") == "/mcp"]
            if not events and "(lifecycle, skipped)" in row["native_log"]:
                observations.append({"id": check_id, "state": "SKIPPED", "ref": prefix + "/native_log"})
            for i, event in events:
                item = {"id": check_id, "ref": f"{prefix}/transport_events/{i}"}
                if "exception" in event:
                    observations.append({**item, "state": "ERROR"})
                elif "response_status" in event:
                    observations.append({**item, "state": "OBSERVED", "value": event["response_status"]})
        elif check_id == "rpc_response_equals":
            expected = [interaction for interaction in row["input"]["cassette"]["interactions"]
                        if interaction["type"] == "jsonrpc_request"]
            if len(expected) != 1:
                raise ValueError("fixture requires one recorded RPC expectation")
            for i, event in enumerate(row["transport_events"]):
                if event["kind"] != "request" or event.get("request") != expected[0]["request"]:
                    continue
                item = {"id": check_id, "ref": f"{prefix}/transport_events/{i}"}
                if "exception" in event:
                    observations.append({**item, "state": "ERROR"})
                elif "response" in event:
                    observations.append({
                        **item, "state": "OBSERVED",
                        "value": json_bytes(event["response"]) == json_bytes(expected[0]["response"]),
                    })
        else:
            raise ValueError(f"unsupported fixture check: {check_id}")
    return observations


def build_evidence(case: dict, row: dict, index: int, frozen: bytes) -> dict:
    plan = json.loads(frozen)
    evidence = {
        "schema": EVIDENCE_SCHEMA, "run_id": plan["run_id"], "plan_sha256": digest(frozen),
        "scope": dict(plan["scope"]), "observations": extract_observations(row, index, plan),
    }
    change = case.get("change")
    if change == "old_run":
        evidence["run_id"] = "previous-study-run"
    elif change == "other_plan":
        plan["checks"][0]["expected"] = 204
        evidence["plan_sha256"] = digest(freeze(plan))
    elif change == "other_lane":
        evidence["scope"]["lane"] = "different-authored-lane"
    elif change == "missing":
        evidence["observations"] = []
    elif change == "string_status":
        evidence["observations"][0]["value"] = str(evidence["observations"][0]["value"])
    elif change == "duplicate":
        evidence["observations"].append(deepcopy(evidence["observations"][0]))
    elif change is not None:
        raise ValueError(f"unsupported experiment change: {change}")
    return evidence


def native_only(native: dict | None) -> str:
    """Conservative counting rule; an empty or absent report cannot pass."""
    if not isinstance(native, dict):
        return "WITHHOLD"
    count, passed, failed = (native.get(name) for name in ("total", "passed", "failed"))
    if any(type(n) is not int or n < 0 for n in (count, passed, failed)):
        return "WITHHOLD"
    if count == 0 or count != passed + failed:
        return "WITHHOLD"
    return "REJECT" if failed else "ACCEPT"


def plain_rule(frozen: bytes, evidence: dict, *, check_binding: bool) -> str:
    """Independent simple comparator for the study's known-shaped envelopes.

    The unbound ablation omits only plan-digest and run-ID equality.
    This is a same-information rule on the cohort, not a general schema parser.
    """
    plan = json.loads(frozen)
    if check_binding and (evidence["run_id"] != plan["run_id"]
                          or evidence["plan_sha256"] != hashlib.sha256(frozen).hexdigest()):
        return "WITHHOLD"
    if plan["scope"] != evidence["scope"] or plan["open_questions"]:
        return "WITHHOLD"
    applicable = {row["id"]: row["expected"] for row in plan["checks"]
                  if plan["scope"]["transport"] in row["applies_to"]}
    evidence_rows = evidence["observations"]
    observations = {row["id"]: row for row in evidence_rows}
    if not applicable or len(observations) != len(evidence_rows) or observations.keys() - applicable.keys():
        return "WITHHOLD"
    compared = {check_id: obs["value"] == applicable[check_id]
                for check_id, obs in observations.items()
                if obs["state"] == "OBSERVED" and type(obs["value"]) is type(applicable[check_id])}
    if False in compared.values():
        return "REJECT"
    return "ACCEPT" if compared.keys() == applicable.keys() else "WITHHOLD"


def run() -> dict:
    study_file = HERE / "study_plan.json"
    source_bytes = study_file.read_bytes()
    study = json.loads(source_bytes)
    archive_file = (HERE / study["source"]).resolve()
    archive_bytes = archive_file.read_bytes()
    archived = json.loads(archive_bytes)
    if archived["schema"] != "shadow-recorder-original-module-probe/1":
        raise ValueError("unsupported archive")
    by_case = {row["case_id"]: (i, row) for i, row in enumerate(archived["rows"])}
    group = ["lifecycle_observed_200", "lifecycle_unsupported_skip", "lifecycle_observed_500"]
    same_reports = [by_case[name][1]["native_result"] for name in group]
    if not all(report == same_reports[0] for report in same_reports) or native_only(same_reports[0]) != "ACCEPT":
        raise ValueError("recorded equality control changed")

    results = []
    for case in study["cases"]:
        index, row = by_case[case["source_case"]]
        transport = row["input"]["cassette"]["metadata"]["transport_type"]
        frozen = freeze(build_plan(case, transport))
        evidence = build_evidence(case, row, index, frozen)
        verdict = evaluate(frozen, evidence)
        results.append({
            "id": case["id"], "source_case": case["source_case"], "source_row": index,
            "native_result_sha256": hashlib.sha256(json_bytes(row["native_result"])).hexdigest(),
            "frozen_plan": json.loads(frozen), "frozen_plan_sha256": digest(frozen), "evidence": evidence,
            "authored_expected": case["expected"],
            "native_only": native_only(row["native_result"]),
            "unbound_rule": plain_rule(frozen, evidence, check_binding=False),
            "same_information_rule": plain_rule(frozen, evidence, check_binding=True),
            "frozen_evaluator": verdict["decision"], "detail": verdict,
        })

    methods = ["native_only", "unbound_rule", "same_information_rule", "frozen_evaluator"]
    return {
        "schema": "shadow.acceptance-replay-results.v1",
        "boundary": study["boundary"],
        "bindings": {
            "study_plan_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "source_archive_sha256": hashlib.sha256(archive_bytes).hexdigest(),
            "evaluator_sha256": hashlib.sha256((HERE / "contract.py").read_bytes()).hexdigest(),
            "driver_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        },
        "counts": {
            "authored_replay_rows": len(results),
            "distinct_archived_fixture_rows_used": len({row["source_row"] for row in results}),
            "new_native_invocations": 0,
            "new_historical_defects": 0,
        },
        "identical_native_reports_for": group,
        "metrics": {
            method: {
                "matches_authored_expectation": sum(r[method] == r["authored_expected"] for r in results),
                "unsupported_accepts": sum(r[method] == "ACCEPT" and r["authored_expected"] != "ACCEPT" for r in results),
                "unsupported_rejects": sum(r[method] == "REJECT" and r["authored_expected"] != "REJECT" for r in results),
                "expected_accepts_withheld": sum(r[method] == "WITHHOLD" and r["authored_expected"] == "ACCEPT" for r in results),
            } for method in methods
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "results.json")
    args = parser.parse_args()
    results = run()
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"counts": results["counts"], "metrics": results["metrics"]}, indent=2))
    if any(row["frozen_evaluator"] != row["authored_expected"] for row in results["results"]):
        raise SystemExit("Evaluator differs from authored expectations; outputs preserved for inspection")


if __name__ == "__main__":
    main()
