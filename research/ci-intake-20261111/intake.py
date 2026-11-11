"""Admit a caller-exported GitHub Actions observation report for local review.

Expected metadata, attempt scope and collection receipts come from the caller.
The checks establish consistency among those inputs, not provider authenticity,
trusted execution, or the truth of the reported observation. This module does
not read the network, run workflows, or update any CI decisions.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re


def _load_contract():
    path = Path(__file__).resolve().parent.parent / "acceptance-contract-20261111" / "contract.py"
    spec = importlib.util.spec_from_file_location("_shadow_acceptance_contract", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load acceptance contract at {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_contract = _load_contract()
MAX_JSON_BYTES = 1024 * 1024
_SCOPE_KEYS = {"repository_id", "run_id", "attempt"}
_IDENTITY_KEYS = _SCOPE_KEYS | {"job_id"}
_OUTCOMES = {"success", "failure", "cancelled", "skipped"}


def _keys(value: object, keys: set[str]) -> bool:
    return type(value) is dict and all(type(k) is str for k in value) and value.keys() == keys


def _positive(value: object) -> bool:
    return type(value) is int and value > 0


def _identity(value: object) -> bool:
    return _keys(value, _IDENTITY_KEYS) and all(_positive(v) for v in value.values())


def _hex(value: object, length: int) -> bool:
    return type(value) is str and len(value) == length and re.fullmatch("[0-9a-f]+", value) is not None


def _object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _nonfinite(value: str):
    raise ValueError(f"non-finite JSON number: {value}")


def _float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        _nonfinite(value)
    return number


def _decode(data: bytes):
    return json.loads(
        data.decode("utf-8"),
        object_pairs_hook=_object,
        parse_constant=_nonfinite,
        parse_float=_float,
    )


def _indexed(rows: object, key: str) -> dict | None:
    if type(rows) is not list:
        return None
    indexed = {}
    for row in rows:
        if type(row) is not dict or not _positive(row.get(key)) or row[key] in indexed:
            return None
        indexed[row[key]] = row
    return indexed


def _text(value: object) -> str | None:
    return value if type(value) is str else None


def expectation_digest(expected: dict) -> str:
    """Hash the local compact, key-sorted JSON representation of expectations."""
    encoded = json.dumps(
        expected, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def admit_ci(
    frozen: bytes, expected: dict, snapshot: dict, receipt: dict, report_bytes: bytes
) -> tuple[dict, object]:
    """Check bindings and return parsed JSON for an independent policy evaluator.

    ``snapshot`` is an externally collected, complete attempt-specific job list;
    the exporter supplies the request scope and completeness marker. A provider's
    step ``conclusion`` and a collector's original step ``outcome`` are retained
    separately. Both must show success for each required step under this profile.
    The receipt binds the expectation, frozen plan and report. The report's hash
    is checked before decoding the same immutable bytes. ``ADMITTED`` means these
    checks passed; it does not mean the JSON satisfies an evidence schema or the
    frozen assertions. Use the first tuple item's decision to distinguish a
    blocked input from an admitted JSON null.
    """
    native_steps = []

    def withhold(reason: str) -> tuple[dict, None]:
        return {"decision": "WITHHOLD", "reason": reason, "checks": [], "native_steps": native_steps}, None

    if not (
        _keys(expected, {"identity", "tested_sha", "check_steps"})
        and _identity(expected["identity"])
        and _hex(expected["tested_sha"], 40)
        and type(expected["check_steps"]) is dict
        and all(type(k) is str and _positive(v) for k, v in expected["check_steps"].items())
    ):
        return withhold("INVALID_EXPECTATION")

    if type(frozen) is not bytes or len(frozen) > MAX_JSON_BYTES:
        return withhold("INVALID_PLAN")
    identity = expected["identity"]
    try:
        plan = _decode(frozen)
        if _contract.freeze(plan) != frozen:
            return withhold("INVALID_PLAN")
        run_id = "github:{repository_id}:{run_id}:{attempt}:{job_id}".format(**identity)
    except (ValueError, RecursionError):
        return withhold("INVALID_PLAN")
    if plan["run_id"] != run_id:
        return withhold("PLAN_IDENTITY_MISMATCH")
    if plan["scope"]["lane"] != "github-actions":
        return withhold("PLAN_LANE_MISMATCH")
    transport = plan["scope"]["transport"]
    required = {check["id"] for check in plan["checks"] if transport in check["applies_to"]}
    if expected["check_steps"].keys() != required:
        return withhold("PLAN_STEP_MAPPING_MISMATCH")
    numbers = sorted(set(expected["check_steps"].values()))
    try:
        step_keys = {number: str(number) for number in numbers}
        expected_sha256 = expectation_digest(expected)
    except ValueError:
        return withhold("INVALID_EXPECTATION")

    if not (
        _keys(snapshot, _SCOPE_KEYS | {"complete", "total_count", "jobs"})
        and all(_positive(snapshot[k]) for k in _SCOPE_KEYS)
        and snapshot["complete"] is True
        and type(snapshot["total_count"]) is int
        and type(snapshot["jobs"]) is list
        and snapshot["total_count"] == len(snapshot["jobs"])
    ):
        return withhold("INVALID_JOBS_SNAPSHOT")
    if any(snapshot[k] != identity[k] for k in _SCOPE_KEYS):
        return withhold("JOBS_SCOPE_MISMATCH")
    jobs = _indexed(snapshot["jobs"], "id")
    if jobs is None:
        return withhold("INVALID_JOBS_SNAPSHOT")
    job = jobs.get(identity["job_id"])
    if job is None:
        return withhold("JOB_NOT_FOUND")
    if not _positive(job.get("run_id")) or job["run_id"] != identity["run_id"]:
        return withhold("JOB_RUN_MISMATCH")
    # When present, the provider's per-job attempt must agree with the enclosing
    # caller-exported attempt scope. Older response shapes may omit this field.
    if "run_attempt" in job and (
        not _positive(job["run_attempt"]) or job["run_attempt"] != identity["attempt"]
    ):
        return withhold("JOB_ATTEMPT_MISMATCH")
    steps = _indexed(job.get("steps"), "number")
    if steps is None:
        return withhold("INVALID_JOB_STEPS")
    for number in numbers:
        step = steps.get(number, {})
        native_steps.append({
            "step_number": number,
            "status": _text(step.get("status")),
            "conclusion": _text(step.get("conclusion")),
            "outcome": None,
        })
    if _text(job.get("status")) != "completed":
        return withhold("JOB_NOT_COMPLETED")

    if not (
        _keys(receipt, {
            "identity", "tested_sha", "expectation_sha256", "plan_sha256", "report_sha256", "outcomes",
        })
        and _identity(receipt["identity"])
        and _hex(receipt["tested_sha"], 40)
        and _hex(receipt["expectation_sha256"], 64)
        and _hex(receipt["plan_sha256"], 64)
        and _hex(receipt["report_sha256"], 64)
        and type(receipt["outcomes"]) is dict
        and all(
            type(k) is str
            and re.fullmatch("[1-9][0-9]*", k) is not None
            and type(v) is str
            and v in _OUTCOMES
            for k, v in receipt["outcomes"].items()
        )
    ):
        return withhold("INVALID_RECEIPT")
    if receipt["identity"] != identity or receipt["tested_sha"] != expected["tested_sha"]:
        return withhold("RECEIPT_SCOPE_MISMATCH")
    if receipt["expectation_sha256"] != expected_sha256:
        return withhold("RECEIPT_EXPECTATION_MISMATCH")
    if receipt["plan_sha256"] != _contract.digest(frozen):
        return withhold("RECEIPT_PLAN_MISMATCH")
    for row in native_steps:
        row["outcome"] = receipt["outcomes"].get(step_keys[row["step_number"]])
    if any(
        row["status"] != "completed" or row["conclusion"] != "success" or row["outcome"] != "success"
        for row in native_steps
    ):
        return withhold("REQUIRED_STEP_NOT_OBSERVED")

    if type(report_bytes) is not bytes:
        return withhold("INVALID_REPORT_BYTES")
    if len(report_bytes) > MAX_JSON_BYTES:
        return withhold("REPORT_TOO_LARGE")
    if hashlib.sha256(report_bytes).hexdigest() != receipt["report_sha256"]:
        return withhold("REPORT_DIGEST_MISMATCH")
    try:
        report = _decode(report_bytes)
    except (ValueError, RecursionError):
        return withhold("INVALID_REPORT_JSON")
    return {
        "decision": "ADMITTED",
        "reason": "REPORT_ADMITTED",
        "checks": [],
        "native_steps": native_steps,
    }, report


def evaluate_ci(
    frozen: bytes, expected: dict, snapshot: dict, receipt: dict, report_bytes: bytes
) -> dict:
    """Admit the report, then interpret it under the original acceptance contract."""
    result, report = admit_ci(frozen, expected, snapshot, receipt, report_bytes)
    if result["decision"] != "ADMITTED":
        return result
    return {**_contract.evaluate(frozen, report), "native_steps": result["native_steps"]}
