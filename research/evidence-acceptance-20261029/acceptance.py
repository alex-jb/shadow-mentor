"""Research-only interpretation of mcpdiff reports and recorded MCP exchanges.

This checks a narrow discovery obligation, not business correctness, transport
authenticity, arbitrary MCP conformance, or complete observation of a process.
No research labels or fixture modes are accepted by the interpretation API.
"""
from __future__ import annotations

import json
import re
from collections import Counter


DISCOVERY_ERROR = re.compile(r"Discovery incomplete|Failed to list (?:tools|resources|prompts)", re.I)


def native_report(raw: dict) -> tuple[str, dict | None]:
    try:
        report = json.loads(raw.get("stdout", ""))
        summary, changes = report["summary"], report["changes"]
        if not isinstance(changes, list) or not isinstance(summary, dict):
            return "ABSENT", None
        counts = Counter(change["severity"] for change in changes)
        if any(kind not in {"breaking", "warning", "safe"} for kind in counts):
            return "ABSENT", None
        for kind in ["breaking", "warning", "safe", "total"]:
            value = summary[kind]
            if type(value) is not int or value < 0:
                return "ABSENT", None
            expected = len(changes) if kind == "total" else counts[kind]
            if value != expected:
                return "ABSENT", None
        return ("FAIL" if summary["breaking"] else "PASS"), report
    except (ValueError, TypeError, KeyError, AttributeError):
        return "ABSENT", None


def exit_only(process: dict) -> str:
    if not isinstance(process, dict) or process.get("timed_out") or type(process.get("exit_code")) is not int:
        return "ERROR"
    return {0: "PASS", 1: "FAIL"}.get(process["exit_code"], "ERROR")


def strict_output(process: dict, raw: dict) -> dict:
    """A plain tool-specific parser baseline; it does not read exchanges."""
    if not isinstance(process, dict) or not isinstance(raw, dict):
        return result("ABSENT", "UNKNOWN", "MALFORMED_INPUT")
    verdict, report = native_report(raw)
    if process.get("runner_state") == "SKIPPED":
        state, reason = "SKIPPED", "RUNNER_RECORDED_SKIP"
    elif process.get("timed_out"):
        state, reason = "ERROR", "PROCESS_DID_NOT_COMPLETE_CHECK"
    elif type(process.get("exit_code")) is not int:
        state, reason = "UNKNOWN", "EXIT_STATUS_ABSENT_OR_INVALID"
    elif process["exit_code"] not in {0, 1}:
        state, reason = "ERROR", "PROCESS_DID_NOT_COMPLETE_CHECK"
    elif not isinstance(raw.get("stderr", ""), str):
        state, reason = "UNKNOWN", "INVALID_DIAGNOSTIC"
    elif DISCOVERY_ERROR.search(raw.get("stderr", "")):
        state, reason = "ERROR", "DISCOVERY_ERROR_IN_DIAGNOSTIC"
    elif report is None:
        state, reason = "UNKNOWN", "INVALID_OR_ABSENT_REPORT"
    elif process["exit_code"] != (1 if verdict == "FAIL" else 0):
        state, reason = "UNKNOWN", "EXIT_REPORT_CONFLICT"
    else:
        state, reason = "COMPLETE", "VALID_NATIVE_REPORT"
    return result(verdict, state, reason, "/raw/stdout", "/raw/stderr")


def result(verdict: str, state: str, reason: str, *refs: str) -> dict:
    supported = verdict if state == "COMPLETE" and verdict in {"PASS", "FAIL"} else "UNKNOWN"
    return {
        "reported_verdict": verdict,
        "execution_state": state,
        "supported_verdict": supported,
        "acceptance": "ACCEPT" if supported == "PASS" else "WITHHOLD",
        "reason": reason,
        "evidence_refs": list(refs),
    }


def inspect_check(process: dict, raw: dict, required_methods: tuple[str, ...]) -> dict:
    """Ordinary strict parsing plus explicit, caller-frozen receipt obligations.

    Only the narrow initialize/tools-list profile is implemented. Requirements
    come from the caller, never from a report's PASS or a fixture's gold label.
    The caller is responsible for faithful capture; a digest alone cannot prove it.
    """
    output = strict_output(process, raw)
    verdict = output["reported_verdict"]
    if not isinstance(process, dict) or not isinstance(raw, dict):
        return output
    if output["execution_state"] in {"SKIPPED", "ERROR"}:
        return output
    if required_methods != ("initialize", "tools/list"):
        return result(verdict, "UNKNOWN", "UNSUPPORTED_OBLIGATION_PROFILE", "/required_methods")
    if raw.get("capture_complete") is not True:
        return result(verdict, "INCOMPLETE", "CAPTURE_NOT_DECLARED_COMPLETE", "/raw/capture_complete")
    exchanges = raw.get("exchanges")
    if not isinstance(exchanges, list):
        return result(verdict, "INCOMPLETE", "TRANSCRIPT_ABSENT", "/raw/exchanges")
    pending, pairs = {}, []
    initialize_completed = False
    seen = set()
    for index, exchange in enumerate(exchanges):
        ref = f"/raw/exchanges/{index}"
        if not isinstance(exchange, dict) or not isinstance(exchange.get("message"), dict):
            return result(verdict, "UNKNOWN", "MALFORMED_EXCHANGE", ref)
        message = exchange["message"]
        if message.get("jsonrpc") != "2.0":
            return result(verdict, "UNKNOWN", "MALFORMED_JSONRPC", ref)
        if exchange.get("direction") == "request":
            if "id" not in message:  # Notification, not a check result.
                continue
            if message.get("method") == "tools/list" and not initialize_completed:
                return result(verdict, "UNKNOWN", "DISCOVERY_BEFORE_INITIALIZE", ref)
            identity = message["id"]
            if type(identity) not in {str, int} or identity in seen:
                return result(verdict, "UNKNOWN", "AMBIGUOUS_REQUEST_ID", ref)
            seen.add(identity)
            pending[identity] = (message, ref)
        elif exchange.get("direction") == "response":
            identity = message.get("id")
            if type(identity) not in {str, int} or identity not in pending:
                return result(verdict, "UNKNOWN", "UNMATCHED_RESPONSE", ref)
            request, request_ref = pending.pop(identity)
            if ("result" in message) == ("error" in message):
                return result(verdict, "UNKNOWN", "AMBIGUOUS_RESPONSE", ref)
            if request.get("method") in required_methods:
                if "error" in message:
                    return result(verdict, "ERROR", "REQUIRED_RPC_RETURNED_ERROR", request_ref, ref)
                if request.get("method") == "initialize":
                    initialize_completed = True
                pairs.append((request, message["result"], ref))
        else:
            return result(verdict, "UNKNOWN", "UNKNOWN_EXCHANGE_DIRECTION", ref)
    if any(request.get("method") in required_methods for request, _ in pending.values()):
        return result(verdict, "INCOMPLETE", "REQUIRED_RESPONSE_MISSING", "/raw/exchanges")
    initialized = [value for request, value, _ in pairs if request.get("method") == "initialize"]
    if len(initialized) != 1 or not isinstance(initialized[0], dict):
        return result(verdict, "INCOMPLETE", "INITIALIZE_NOT_OBSERVED", "/raw/exchanges")
    capabilities = initialized[0].get("capabilities")
    if not isinstance(capabilities, dict):
        return result(verdict, "UNKNOWN", "CAPABILITIES_INVALID", "/raw/exchanges")
    if "tools" not in capabilities:
        return result(verdict, "SKIPPED", "TOOLS_CAPABILITY_NOT_ADVERTISED", "/raw/exchanges")
    if not isinstance(capabilities["tools"], dict):
        return result(verdict, "UNKNOWN", "TOOLS_CAPABILITY_INVALID", "/raw/exchanges")
    pages = [(request, value, ref) for request, value, ref in pairs if request.get("method") == "tools/list"]
    if not pages:
        return result(verdict, "INCOMPLETE", "REQUIRED_DISCOVERY_NOT_OBSERVED", "/raw/exchanges")
    cursor, visited, tool_names = None, set(), set()
    for request, value, ref in pages:
        parameters = request.get("params", {})
        if not isinstance(parameters, dict):
            return result(verdict, "UNKNOWN", "INVALID_LIST_PARAMETERS", ref)
        if "cursor" in parameters and not isinstance(parameters["cursor"], str):
            return result(verdict, "UNKNOWN", "INVALID_REQUEST_CURSOR", ref)
        if parameters.get("cursor") != cursor:
            return result(verdict, "INCOMPLETE", "PAGINATION_CHAIN_MISMATCH", ref)
        if not isinstance(value, dict) or not isinstance(value.get("tools"), list):
            return result(verdict, "UNKNOWN", "INVALID_TOOLS_RESULT", ref)
        for tool in value["tools"]:
            if not isinstance(tool, dict) or not isinstance(tool.get("name"), str) or not isinstance(tool.get("inputSchema"), dict):
                return result(verdict, "UNKNOWN", "INVALID_TOOL_ENTRY", ref)
            if tool["name"] in tool_names:
                return result(verdict, "UNKNOWN", "DUPLICATE_TOOL_NAME", ref)
            tool_names.add(tool["name"])
        cursor = value.get("nextCursor")
        if "nextCursor" in value and (not isinstance(cursor, str) or cursor in visited):
            return result(verdict, "UNKNOWN", "INVALID_OR_REPEATED_CURSOR", ref)
        if cursor is not None:
            visited.add(cursor)
    if cursor is not None:
        return result(verdict, "INCOMPLETE", "PAGINATION_NOT_FINISHED", "/raw/exchanges")
    if output["execution_state"] != "COMPLETE":
        return output
    return result(verdict, "COMPLETE", "DECLARED_DISCOVERY_OBLIGATION_OBSERVED", "/raw/stdout", "/raw/exchanges")
