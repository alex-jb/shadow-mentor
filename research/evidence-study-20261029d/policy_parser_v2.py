"""Research revision of the ordinary policy parser; the prior parser stays frozen.

This accepts only the narrow, unfiltered mcpdiff CLI report profile. Acceptance
means consistency with the supplied policy, not authenticated capture or business
correctness. Explicit runner state overrides output which may be stale.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


_SOURCE = Path(__file__).resolve().parent.parent / "evidence-study-20261029b/policy_parser.py"
_SPEC = importlib.util.spec_from_file_location("_shadow_frozen_policy_parser", _SOURCE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError("Cannot load the frozen ordinary policy parser")
_BASE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_BASE)

_RUNNER_STATES = {"COMPLETE", "SKIPPED", "ERROR", "INCOMPLETE", "UNKNOWN"}


def _withhold(state: str, report_state: str, reason: str) -> dict:
    return {
        "process_state": state,
        "report_state": report_state,
        "supported_verdict": "UNKNOWN",
        "acceptance": "WITHHOLD",
        "reason": reason,
    }


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate JSON member")
        value[key] = item
    return value


def _reject_constant(value: str):
    raise ValueError("Nonfinite JSON literal: " + value)


def interpret(process, raw, policy) -> dict:
    """Interpret native output without treating skipped/stale output as a run.

    ``runner_state`` is optional for earlier captures. If present, it must be one
    of COMPLETE, SKIPPED, ERROR, INCOMPLETE, UNKNOWN. Only COMPLETE permits output
    acceptance. Missing state retains the prior exit/timeout checks; it is not
    proof that a process ran. The caller must bind output to its actual run.

    Duplicate JSON keys and NaN/Infinity are withheld as unsupported input. This
    is a strict input policy, not evidence of a historical native CLI defect.
    Equal hashes with nonempty changes contradict the supported CLI's unchanged
    shortcut; hashes themselves are neither recomputed nor authenticated here.
    """
    if isinstance(process, dict) and "runner_state" in process:
        runner_state = process["runner_state"]
        if not isinstance(runner_state, str) or runner_state not in _RUNNER_STATES:
            return _withhold("UNKNOWN", "UNINTERPRETED", "INVALID_RUNNER_STATE")
        if runner_state != "COMPLETE":
            return _withhold(runner_state, "UNINTERPRETED", "RUNNER_RECORDED_" + runner_state)

    parsed = None
    if isinstance(raw, dict) and isinstance(raw.get("stdout"), str) and raw["stdout"].strip():
        try:
            parsed = json.loads(
                raw["stdout"], object_pairs_hook=_unique_object,
                parse_constant=_reject_constant,
            )
        except (ValueError, RecursionError):
            state, _ = _BASE._process_state(process)
            return _withhold(state, "INVALID", "AMBIGUOUS_OR_INVALID_JSON_REPORT")

    output = _BASE.interpret(process, raw, policy)
    if output["report_state"] == "VALID" and isinstance(parsed, dict):
        hashes = _BASE._hashes(parsed)
        if hashes is not None and hashes[0] == hashes[1] and parsed.get("changes"):
            return _withhold(
                output["process_state"], "INCONSISTENT",
                "UNCHANGED_HASH_WITH_CLASSIFIED_CHANGE",
            )
    return output
