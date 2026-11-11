"""Evaluate caller-provided observations against a frozen acceptance plan.

The digest binds exact plan bytes within this local JSON profile. The evaluator
does not authenticate inputs, establish execution time, or verify evidence refs.
"""

from __future__ import annotations

import hashlib
import json

PLAN_SCHEMA = "shadow.acceptance-plan.v1"
EVIDENCE_SCHEMA = "shadow.acceptance-evidence.v1"
_TRANSPORTS = ("http", "stdio")
_OBSERVATION_STATES = ("OBSERVED", "SKIPPED", "ERROR")


def _keys(value: object, expected: set[str]) -> bool:
    return (
        type(value) is dict
        and all(type(key) is str for key in value)
        and value.keys() == expected
    )


def _text(value: object) -> bool:
    return type(value) is str and bool(value.strip())


def _scalar(value: object) -> bool:
    return type(value) in (str, int, bool)


def _scope(value: object) -> bool:
    return (
        _keys(value, {"lane", "transport"})
        and _text(value["lane"])
        and type(value["transport"]) is str
        and value["transport"] in _TRANSPORTS
    )


def freeze(plan: dict) -> bytes:
    """Validate and encode a plan deterministically without retaining mutable input."""
    if not (
        _keys(plan, {"schema", "run_id", "scope", "checks", "open_questions"})
        and type(plan["schema"]) is str
        and plan["schema"] == PLAN_SCHEMA
        and _text(plan["run_id"])
        and _scope(plan["scope"])
        and type(plan["checks"]) is list
        and type(plan["open_questions"]) is list
        and all(_text(question) for question in plan["open_questions"])
    ):
        raise ValueError("invalid acceptance plan")
    ids = set()
    for check in plan["checks"]:
        if not (
            _keys(check, {"id", "applies_to", "expected"})
            and _text(check["id"])
            and check["id"] not in ids
            and _scalar(check["expected"])
            and type(check["applies_to"]) is list
            and all(type(item) is str and item in _TRANSPORTS for item in check["applies_to"])
            and len(set(check["applies_to"])) == len(check["applies_to"])
        ):
            raise ValueError("invalid or duplicate acceptance check")
        ids.add(check["id"])
    return json.dumps(plan, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(frozen: bytes) -> str:
    return hashlib.sha256(frozen).hexdigest()


def _result(decision: str, reason: str, checks: list[dict] | None = None) -> dict:
    return {"decision": decision, "reason": reason, "checks": checks if checks is not None else []}


def evaluate(frozen: bytes, evidence: dict) -> dict:
    """Return a decision and check-level reasons; lack of evidence is not failure."""
    if type(frozen) is not bytes:
        return _result("WITHHOLD", "INVALID_PLAN")
    try:
        plan = json.loads(frozen.decode("utf-8"))
        if freeze(plan) != frozen:
            return _result("WITHHOLD", "INVALID_PLAN")
    except (ValueError, RecursionError):
        return _result("WITHHOLD", "INVALID_PLAN")
    if not (
        _keys(evidence, {"schema", "plan_sha256", "run_id", "scope", "observations"})
        and type(evidence["schema"]) is str
        and evidence["schema"] == EVIDENCE_SCHEMA
        and _text(evidence["plan_sha256"])
        and _text(evidence["run_id"])
        and _scope(evidence["scope"])
        and type(evidence["observations"]) is list
    ):
        return _result("WITHHOLD", "INVALID_EVIDENCE")
    if evidence["plan_sha256"] != digest(frozen):
        return _result("WITHHOLD", "PLAN_DIGEST_MISMATCH")
    if evidence["run_id"] != plan["run_id"]:
        return _result("WITHHOLD", "RUN_ID_MISMATCH")
    if evidence["scope"] != plan["scope"]:
        return _result("WITHHOLD", "SCOPE_MISMATCH")
    if plan["open_questions"]:
        return _result("WITHHOLD", "OPEN_QUESTIONS")

    transport = plan["scope"]["transport"]
    check_by_id = {check["id"]: check for check in plan["checks"]}
    observation_by_id = {}
    for obs in evidence["observations"]:
        if (
            type(obs) is not dict
            or not _text(obs.get("id"))
            or not _text(obs.get("ref"))
            or type(obs.get("state")) is not str
            or obs["state"] not in _OBSERVATION_STATES
        ):
            return _result("WITHHOLD", "INVALID_OBSERVATION")
        observed = obs["state"] == "OBSERVED"
        expected_keys = {"id", "state", "ref", "value"} if observed else {"id", "state", "ref"}
        if not _keys(obs, expected_keys) or (observed and not _scalar(obs["value"])):
            return _result("WITHHOLD", "INVALID_OBSERVATION")
        check_id = obs["id"]
        if check_id in observation_by_id:
            return _result("WITHHOLD", "DUPLICATE_OBSERVATION")
        if check_id not in check_by_id:
            return _result("WITHHOLD", "UNKNOWN_CHECK")
        if transport not in check_by_id[check_id]["applies_to"]:
            return _result("WITHHOLD", "NONAPPLICABLE_OBSERVATION")
        observation_by_id[check_id] = obs

    rows = []
    for check in plan["checks"]:
        check_id = check["id"]
        obs = observation_by_id.get(check_id)
        if transport not in check["applies_to"]:
            state, reason = "NOT_APPLICABLE", "OUTSIDE_PLANNED_TRANSPORT"
        elif obs is None:
            state, reason = "NOT_OBSERVED", "MISSING_OBSERVATION"
        elif obs["state"] != "OBSERVED":
            state, reason = "NOT_OBSERVED", obs["state"]
        elif type(obs["value"]) is not type(check["expected"]):
            state, reason = "NOT_OBSERVED", "VALUE_TYPE_MISMATCH"
        elif obs["value"] != check["expected"]:
            state, reason = "FAIL", "VALUE_MISMATCH"
        else:
            state, reason = "PASS", "VALUE_MATCH"
        row = {"id": check_id, "state": state, "reason": reason}
        if obs is not None:
            row["ref"] = obs["ref"]
        rows.append(row)

    states = {row["state"] for row in rows}
    if "FAIL" in states:
        return _result("REJECT", "REQUIRED_CHECK_FAILED", rows)
    if "NOT_OBSERVED" in states:
        return _result("WITHHOLD", "REQUIRED_CHECK_NOT_OBSERVED", rows)
    if "PASS" not in states:
        return _result("WITHHOLD", "NO_APPLICABLE_CHECKS", rows)
    return _result("ACCEPT", "APPLICABLE_CHECKS_PASSED", rows)
