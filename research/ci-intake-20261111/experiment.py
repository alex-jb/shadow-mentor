"""Authored intake controls and a separate public metadata availability check."""

from __future__ import annotations

import argparse
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

from intake import _contract, _decode, evaluate_ci, expectation_digest

HERE = Path(__file__).resolve().parent
FRESH_ID = {"repository_id": 101, "run_id": 201, "attempt": 2, "job_id": 301}
TESTED_SHA = "a" * 40


def encode(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def build(case: str) -> dict:
    """Create a deterministic case; authored labels are in a separate catalog."""
    checks = [{"id": "active-count", "expected": 1, "applies_to": ["stdio"]}]
    check_steps = {"active-count": 7}
    if case == "declared_scope_exclusion":
        checks.append({"id": "http-status", "expected": 200, "applies_to": ["http"]})
    if case == "zero_applicable_checks":
        checks = [{"id": "http-status", "expected": 200, "applies_to": ["http"]}]
        check_steps = {}
    plan = {
        "schema": _contract.PLAN_SCHEMA,
        "run_id": "github:101:201:2:301",
        "scope": {"lane": "github-actions", "transport": "stdio"},
        "open_questions": [],
        "checks": checks,
    }
    frozen = _contract.freeze(plan)
    expected = {"identity": dict(FRESH_ID), "tested_sha": TESTED_SHA, "check_steps": check_steps}
    job = {
        "id": 301, "run_id": 201, "run_attempt": 2, "status": "completed",
        "head_sha": TESTED_SHA, "conclusion": "success",
        "steps": [{"number": n, "status": "completed", "conclusion": "success"} for n in (7, 8)],
    }
    snapshot = {
        "repository_id": 101, "run_id": 201, "attempt": 2, "complete": True, "total_count": 2,
        "jobs": [job, {**deepcopy(job), "id": 302}],
    }
    rows = [] if not check_steps else [{
        "id": "active-count", "state": "OBSERVED",
        "value": 3 if case == "fresh_mismatch" else 1,
        "ref": "authored fixture: typed application result",
    }]
    report = {
        "schema": _contract.EVIDENCE_SCHEMA, "run_id": plan["run_id"],
        "scope": plan["scope"], "plan_sha256": _contract.digest(frozen), "observations": rows,
    }
    if case == "missing_required_value":
        report["observations"] = []
    elif case == "wrong_report_run":
        report["run_id"] = "github:101:201:1:301"
    elif case == "wrong_value_type":
        rows[0]["value"] = True
    report_bytes = encode(report)
    if case == "duplicate_json_member":
        report_bytes = b'{"schema":"duplicate",' + report_bytes[1:]
    receipt = {
        "identity": dict(FRESH_ID), "tested_sha": TESTED_SHA,
        "plan_sha256": _contract.digest(frozen), "expectation_sha256": expectation_digest(expected),
        "report_sha256": sha256(report_bytes).hexdigest(), "outcomes": {"7": "success", "8": "success"},
    }
    if case == "trigger_is_not_checkout":
        job["head_sha"] = "b" * 40
    elif case == "unrelated_failure":
        job["conclusion"] = "failure"
        job["steps"][1]["conclusion"] = "failure"
        receipt["outcomes"]["8"] = "failure"
    elif case == "old_snapshot_attempt":
        snapshot["attempt"] = 1
        for row in snapshot["jobs"]:
            row["run_attempt"] = 1
    elif case == "old_receipt_attempt":
        receipt["identity"]["attempt"] = 1
    elif case == "other_job_receipt":
        receipt["identity"]["job_id"] = 302
    elif case == "provider_job_attempt_conflict":
        job["run_attempt"] = 1
    elif case == "partial_job_page":
        snapshot.update(complete=False, total_count=3)
    elif case == "wrong_tested_checkout":
        receipt["tested_sha"] = "c" * 40
    elif case == "wrong_plan_digest":
        receipt["plan_sha256"] = "d" * 64
    elif case == "changed_step_mapping":
        expected["check_steps"]["active-count"] = 8
    elif case == "tolerated_step_failure":
        receipt["outcomes"]["7"] = "failure"
    elif case == "skipped_required_step":
        job["steps"][0]["conclusion"] = "skipped"
        receipt["outcomes"]["7"] = "skipped"
    elif case == "changed_report_bytes":
        report_bytes += b"\n"
    elif case == "incomplete_job":
        job.update(status="in_progress", conclusion=None)
    elif case not in {
        "fresh_match", "fresh_mismatch", "missing_required_value", "wrong_report_run",
        "wrong_value_type", "duplicate_json_member", "declared_scope_exclusion", "zero_applicable_checks",
    }:
        raise ValueError(f"unknown case: {case}")
    return {
        "frozen": frozen, "expected": expected, "snapshot": snapshot,
        "receipt": receipt, "report_bytes": report_bytes,
    }


def green_job_only(bundle: dict) -> str:
    job_id = bundle["expected"]["identity"]["job_id"]
    job = next(j for j in bundle["snapshot"]["jobs"] if j["id"] == job_id)
    if job["status"] != "completed":
        return "WITHHOLD"
    return {"success": "ACCEPT", "failure": "REJECT"}.get(job["conclusion"], "WITHHOLD")


def typed_report_only(bundle: dict) -> str:
    """Use the same contract and decoder, omitting external run admission."""
    try:
        report = _decode(bundle["report_bytes"])
    except (ValueError, RecursionError):
        return "WITHHOLD"
    return _contract.evaluate(bundle["frozen"], report)["decision"]


def public_metadata_check(sample: dict) -> dict:
    snapshot = sample["snapshot"]
    job = next(j for j in snapshot["jobs"] if j["name"] == "lint")
    step = next(s for s in job["steps"] if s["name"] == "validate conventional commit prefix")
    identity = {k: snapshot[k] for k in ("repository_id", "run_id", "attempt")}
    identity["job_id"] = job["id"]
    plan = {
        "schema": _contract.PLAN_SCHEMA,
        "run_id": "github:{repository_id}:{run_id}:{attempt}:{job_id}".format(**identity),
        "scope": {"lane": "github-actions", "transport": "stdio"},
        "checks": [{"id": "example-prefix-observation", "expected": True, "applies_to": ["stdio"]}],
        "open_questions": [],
    }
    expected = {
        "identity": identity, "tested_sha": job["head_sha"],
        "check_steps": {"example-prefix-observation": step["number"]},
    }
    return {
        "boundary": "Illustrative local plan written after the run. Desired SHA uses the trigger SHA as a test input, not an assertion of the tested checkout. No receipt or application report exists here.",
        "source": sample["source"],
        "job_count": snapshot["total_count"],
        "step": step,
        "result": evaluate_ci(_contract.freeze(plan), expected, snapshot, {}, b""),
    }


def run() -> dict:
    catalog_file = HERE / "case-catalog.json"
    sample_file = HERE / "public-metadata.json"
    catalog = json.loads(catalog_file.read_text())
    results = []
    for item in catalog["cases"]:
        case = item["id"]
        bundle = build(case)
        verdict = evaluate_ci(**bundle)
        results.append({
            "case": case, "authored_expected": item["decision"],
            "green_job_only": green_job_only(bundle), "typed_report_only": typed_report_only(bundle),
            "admitted": verdict["decision"], "reason": verdict["reason"], "checks": verdict["checks"],
            "native_steps": verdict["native_steps"],
            "observed_report_sha256": sha256(bundle["report_bytes"]).hexdigest(),
            "receipt_report_sha256": bundle["receipt"]["report_sha256"],
        })
    stats = {}
    for method in ("green_job_only", "typed_report_only", "admitted"):
        stats[method] = {
            "agreement": sum(row[method] == row["authored_expected"] for row in results),
            "unsupported_accepts": sum(row[method] == "ACCEPT" and row["authored_expected"] != "ACCEPT" for row in results),
            "unsupported_rejects": sum(row[method] == "REJECT" and row["authored_expected"] != "REJECT" for row in results),
            "expected_accepts_withheld": sum(row[method] == "WITHHOLD" and row["authored_expected"] == "ACCEPT" for row in results),
        }
    return {
        "schema": "shadow.ci-intake-results.v1",
        "boundary": catalog["boundary"],
        "source_sha256": {
            p.name: sha256(p.read_bytes()).hexdigest() for p in (
                catalog_file, sample_file, Path(__file__), HERE / "intake.py",
                HERE.parent / "acceptance-contract-20261111" / "contract.py",
            )
        },
        "authored_case_count": len(results), "metrics": stats, "rows": results,
        "separate_public_metadata_check": public_metadata_check(json.loads(sample_file.read_text())),
    }


def write_bundle(case: str, destination: Path) -> None:
    bundle = build(case)
    destination.mkdir(parents=True)
    for key, filename in (
        ("frozen", "plan.json"), ("expected", "expected.json"), ("snapshot", "jobs.json"),
        ("receipt", "receipt.json"), ("report_bytes", "report.json"),
    ):
        content = bundle[key]
        (destination / filename).write_bytes(content if type(content) is bytes else encode(content))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "results.json")
    parser.add_argument("--write-bundle", nargs=2, metavar=("CASE", "NEW_DIRECTORY"))
    args = parser.parse_args()
    if args.write_bundle:
        name, directory = args.write_bundle
        write_bundle(name, Path(directory))
        return 0
    output = run()
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "authored_cases": output["authored_case_count"], "metrics": output["metrics"],
        "public_metadata": output["separate_public_metadata_check"]["result"]["decision"],
    }, indent=2))
    return int(output["metrics"]["admitted"]["agreement"] != output["authored_case_count"])


if __name__ == "__main__":
    raise SystemExit(main())
