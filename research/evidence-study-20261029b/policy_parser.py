"""Ordinary policy-aware mcpdiff output parser used as a strong baseline.

The caller supplies the actual CLI policy. This module reads neither study labels
nor RPC receipts, and cannot establish discovery or business-state completeness.
It reuses the earlier summary/changes consistency validator, not its verdict.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
import re


_source = Path(__file__).resolve().parent.parent / "evidence-acceptance-20261029/acceptance.py"
_spec = importlib.util.spec_from_file_location("_shadow_native_report_validator", _source)
if _spec is None or _spec.loader is None:
    raise ImportError("Cannot load the recorded native report validator")
_validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_validator)
_validate_counts = _validator.native_report
_discovery_error = _validator.DISCOVERY_ERROR

_HASH = re.compile(r"sha256:[0-9a-fA-F]{64}\Z")
_LEVEL = {"safe": 0, "warning": 1, "breaking": 2}


def _result(process_state: str, report_state: str, reason: str, verdict: str = "UNKNOWN") -> dict:
    return {
        "process_state": process_state,
        "report_state": report_state,
        "supported_verdict": verdict,
        "acceptance": "ACCEPT" if verdict == "PASS" else "WITHHOLD",
        "reason": reason,
    }


def _process_state(process) -> tuple[str, str | None]:
    if not isinstance(process, dict) or type(process.get("exit_code")) is not int:
        return "UNKNOWN", "MISSING_OR_INVALID_PROCESS_STATUS"
    if "timed_out" in process and type(process["timed_out"]) is not bool:
        return "UNKNOWN", "INVALID_TIMEOUT_STATUS"
    if process.get("timed_out") or process["exit_code"] not in {0, 1}:
        return "ERROR", "PROCESS_ERROR"
    return "COMPLETE", None


def _hashes(report: dict) -> tuple[str, str] | None:
    try:
        before = report["meta"]["before"]["contentHash"]
        after = report["meta"]["after"]["contentHash"]
        if not isinstance(before, str) or not isinstance(after, str):
            return None
        if _HASH.fullmatch(before) is None or _HASH.fullmatch(after) is None:
            return None
        return before.lower(), after.lower()
    except (KeyError, TypeError):
        return None


def interpret(process, raw, policy) -> dict:
    """Interpret a complete, unfiltered native report under actual runner flags.

    ``policy`` must supply ``fail_on`` and ``display_severity``. A normal exit
    is not a product-success label. Hash metadata here means precisely the two
    before/after content hashes needed by the consistency rule, not every future
    mcpdiff metadata field. Filtered displays are deliberately unsupported.
    """
    state, process_reason = _process_state(process)
    if not isinstance(raw, dict) or not isinstance(raw.get("stdout"), str) or not isinstance(raw.get("stderr"), str):
        return _result(state, "INVALID", process_reason or "MISSING_OR_INVALID_RAW_OUTPUT")
    _ignored_breaking_only_verdict, report = _validate_counts(raw)
    report_state = "ABSENT" if not raw["stdout"].strip() else ("VALID" if report is not None else "INVALID")
    if process_reason is not None:
        return _result(state, report_state, process_reason)
    if _discovery_error.search(raw["stderr"]):
        return _result("ERROR", report_state, "DISCOVERY_ERROR_IN_DIAGNOSTIC")
    if (
        not isinstance(policy, dict)
        or not isinstance(policy.get("fail_on"), str)
        or not isinstance(policy.get("display_severity"), str)
        or policy.get("fail_on") not in _LEVEL
        or policy.get("display_severity") not in _LEVEL
    ):
        return _result(state, report_state, "MISSING_OR_INVALID_POLICY")
    if report is None:
        return _result(state, report_state, "MISSING_OR_INVALID_REPORT")
    # Filtering can omit evidence. Do not apply the unclassified-change rule,
    # or infer unchanged, from a display whose minimum severity exceeds safe.
    if policy["display_severity"] != "safe":
        return _result(state, "FILTERED_UNSUPPORTED", "UNSUPPORTED_FILTERED_REPORT")
    hashes = _hashes(report)
    if hashes is None:
        return _result(state, "INVALID", "MISSING_OR_INVALID_HASH_METADATA")
    if hashes[0] != hashes[1] and not report["changes"]:
        return _result(state, "INCONSISTENT", "CHANGED_HASH_WITHOUT_CLASSIFIED_CHANGE")
    threshold = _LEVEL[policy["fail_on"]]
    fails_policy = any(_LEVEL[change["severity"]] >= threshold for change in report["changes"])
    expected_exit = 1 if fails_policy else 0
    if process["exit_code"] != expected_exit:
        return _result(state, "INCONSISTENT", "EXIT_POLICY_REPORT_CONFLICT")
    return _result(state, "VALID", "NATIVE_REPORT_CONSISTENT_WITH_POLICY", "FAIL" if fails_policy else "PASS")
