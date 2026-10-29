#!/usr/bin/env python3
"""Execute unmodified pinned recorder modules against authored local transports.

This is an original-module mechanism study, not CLI/server conformance. The
namespace bootstrap bypasses upstream __init__ and imports _types and verifier
unchanged. Only their declared API receives an authored Cassette and transport.
"""
from __future__ import annotations

import argparse
import contextlib
import dataclasses
import hashlib
import importlib
import importlib.metadata
import io
import json
import logging
import platform
import socket
import subprocess
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
REVISION = "44803e1cb47d7d4bb0b8dbd490550a3367eff674"
sys.dont_write_bytecode = True


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources() -> dict:
    manifest = json.loads((HERE / "upstream-manifest.json").read_text())
    assert manifest["revision"] == REVISION
    for row in manifest["files"]:
        raw = (HERE / row["local_path"]).read_bytes()
        assert len(raw) == row["size"], row["path"]
        assert hashlib.sha256(raw).hexdigest() == row["sha256"], row["path"]
        header = f"blob {len(raw)}\0".encode()
        assert hashlib.sha1(header + raw).hexdigest() == row["git_blob_sha1"], row["path"]
    return manifest


def load_original_modules():
    if any(name == "mcp_recorder" or name.startswith("mcp_recorder.") for name in sys.modules):
        raise RuntimeError("fresh process required: recorder namespace already imported")
    package = types.ModuleType("mcp_recorder")
    package.__path__ = [str(HERE / "sources/src/mcp_recorder")]
    sys.modules["mcp_recorder"] = package
    models = importlib.import_module("mcp_recorder._types")
    verifier = importlib.import_module("mcp_recorder.verifier")
    for module in (models, verifier):
        assert Path(module.__file__).is_relative_to(HERE / "sources")
    return models, verifier


def blocked(*args, **kwargs):
    raise RuntimeError("probe forbids networking and subprocesses")


class MemoryTransport:
    """Authored API duck type with no HTTP lifecycle support or I/O."""

    def __init__(self, *, response=None, request_error=False, notification_error=False):
        self.events = []
        self.response = response
        self.request_error = request_error
        self.notification_error = notification_error

    async def __aenter__(self):
        self.events.append({"kind": "context_enter"})
        return self

    async def __aexit__(self, typ, exc, traceback):
        self.events.append({"kind": "context_exit", "exception_type": typ.__name__ if typ else None})

    async def send_request(self, request):
        event = {"kind": "request", "request": request}
        self.events.append(event)
        if self.request_error:
            event["exception"] = {"type": "ConnectionError", "message": "authored request transport error"}
            raise ConnectionError("authored request transport error")
        event["response"] = self.response
        return self.response

    async def send_notification(self, request):
        event = {"kind": "notification", "request": request}
        self.events.append(event)
        if self.notification_error:
            event["exception"] = {"type": "ConnectionError", "message": "authored notification transport error"}
            raise ConnectionError("authored notification transport error")
        event["completed"] = True


class LifecycleTransport(MemoryTransport):
    """Authored HTTP-capable API duck type; does not issue HTTP requests."""

    def __init__(self, *, lifecycle_status=200, lifecycle_error=False, **kwargs):
        super().__init__(**kwargs)
        self.lifecycle_status = lifecycle_status
        self.lifecycle_error = lifecycle_error

    async def send_lifecycle(self, method, path):
        event = {"kind": "lifecycle", "http_method": method, "http_path": path}
        self.events.append(event)
        if self.lifecycle_error:
            event["exception"] = {"type": "ConnectionError", "message": "authored lifecycle transport error"}
            raise ConnectionError("authored lifecycle transport error")
        event["response_status"] = self.lifecycle_status
        return self.lifecycle_status


def authored_cases():
    lifecycle = {"type": "lifecycle", "http_method": "DELETE", "http_path": "/mcp", "response_status": 200}
    expected_rpc = {"jsonrpc": "2.0", "id": 1, "result": {"tools": []}}
    rpc = {"type": "jsonrpc_request", "request": {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, "response": expected_rpc}
    notification = {"type": "notification", "request": {"jsonrpc": "2.0", "method": "notifications/initialized"}}

    def cassette(items, transport_type):
        return {"version": "1.0", "metadata": {"recorded_at": "2026-10-29T00:00:00+00:00", "transport_type": transport_type}, "interactions": items}

    return [
        {"id": "lifecycle_observed_200", "cassette": cassette([lifecycle], "http"), "transport": "lifecycle", "options": {}, "expected_native": {"total": 1, "passed": 1, "failed": 0}},
        {"id": "lifecycle_unsupported_skip", "cassette": cassette([lifecycle], "stdio"), "transport": "memory", "options": {}, "expected_native": {"total": 1, "passed": 1, "failed": 0}},
        {"id": "rpc_pass_plus_lifecycle_skip", "cassette": cassette([rpc, lifecycle], "stdio"), "transport": "memory", "options": {"response": expected_rpc}, "expected_native": {"total": 2, "passed": 2, "failed": 0}},
        {"id": "lifecycle_observed_500", "cassette": cassette([lifecycle], "http"), "transport": "lifecycle", "options": {"lifecycle_status": 500}, "expected_native": {"total": 1, "passed": 1, "failed": 0}},
        {"id": "lifecycle_transport_error", "cassette": cassette([lifecycle], "http"), "transport": "lifecycle", "options": {"lifecycle_error": True}, "expected_exception": "ConnectionError"},
        {"id": "rpc_matching", "cassette": cassette([rpc], "stdio"), "transport": "memory", "options": {"response": expected_rpc}, "expected_native": {"total": 1, "passed": 1, "failed": 0}},
        {"id": "rpc_mismatch", "cassette": cassette([rpc], "stdio"), "transport": "memory", "options": {"response": {"jsonrpc": "2.0", "id": 1, "result": {"tools": [{"name": "unexpected"}]}}}, "expected_native": {"total": 1, "passed": 0, "failed": 1}},
        {"id": "rpc_transport_error", "cassette": cassette([rpc], "stdio"), "transport": "memory", "options": {"request_error": True}, "expected_native": {"total": 1, "passed": 0, "failed": 1}},
        {"id": "notification_transport_error", "cassette": cassette([notification], "stdio"), "transport": "memory", "options": {"notification_error": True}, "expected_native": {"total": 1, "passed": 0, "failed": 1}},
        {"id": "empty_cassette", "cassette": cassette([], "stdio"), "transport": "memory", "options": {}, "expected_native": {"total": 0, "passed": 0, "failed": 0}},
        {"id": "invalid_cassette_major", "cassette": {"version": "2.0", "interactions": []}, "transport": "memory", "options": {}, "expected_exception": "ValidationError"},
    ]


def execute_case(case, models, verifier):
    transport_cls = LifecycleTransport if case["transport"] == "lifecycle" else MemoryTransport
    transport = transport_cls(**case["options"])
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logger = logging.getLogger("mcp_recorder.verifier")
    old_level, old_propagate = logger.level, logger.propagate
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    result, exception = None, None
    stage = "cassette_validation"
    try:
        cassette = models.Cassette.model_validate(case["cassette"])
        stage = "native_verify"
        result = dataclasses.asdict(verifier.run_verify(cassette, transport=transport))
    except Exception as exc:
        exception = {"type": type(exc).__name__, "message": str(exc), "stage": stage}
    finally:
        logger.removeHandler(handler)
        logger.setLevel(old_level)
        logger.propagate = old_propagate
    expected = case.get("expected_native")
    matched = (
        exception is None and result is not None and all(result[k] == v for k, v in expected.items())
        if expected is not None
        else exception is not None and exception["type"] == case["expected_exception"]
    )
    # Authored labels stay in the driver: they are not passed into the checker.
    return {
        "case_id": case["id"], "input": {"cassette": case["cassette"], "transport_class": transport_cls.__name__, "transport_options": case["options"]},
        "native_result": result, "exception": exception, "transport_events": transport.events,
        "native_log": stream.getvalue(), "expected_native": expected,
        "expected_exception": case.get("expected_exception"), "matched_authored_expectation": matched,
    }


def validate_observed_controls(rows):
    by_id = {row["case_id"]: row for row in rows}
    events = lambda key, kind: [event for event in by_id[key]["transport_events"] if event["kind"] == kind]
    controls = {
        "identical_native_reports_for_200_skip_500": by_id["lifecycle_observed_200"]["native_result"] == by_id["lifecycle_unsupported_skip"]["native_result"] == by_id["lifecycle_observed_500"]["native_result"],
        "positive_lifecycle_observed_200": len(events("lifecycle_observed_200", "lifecycle")) == 1 and events("lifecycle_observed_200", "lifecycle")[0]["response_status"] == 200,
        "unsupported_lifecycle_not_invoked": not events("lifecycle_unsupported_skip", "lifecycle"),
        "mixed_rpc_invoked_but_lifecycle_not_invoked": len(events("rpc_pass_plus_lifecycle_skip", "request")) == 1 and not events("rpc_pass_plus_lifecycle_skip", "lifecycle"),
        "500_observed_without_native_failure": events("lifecycle_observed_500", "lifecycle")[0]["response_status"] == 500 and by_id["lifecycle_observed_500"]["native_result"]["failed"] == 0,
        "empty_cassette_performs_no_operations": [event["kind"] for event in by_id["empty_cassette"]["transport_events"]] == ["context_enter", "context_exit"],
        "invalid_cassette_does_not_enter_transport": not by_id["invalid_cassette_major"]["transport_events"],
    }
    assert all(controls.values()), controls
    return controls


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "results.json")
    args = parser.parse_args()
    manifest = verify_sources()
    # Test that the guard is active independently of the fake transport.
    guards = [(socket.socket, "connect"), (socket.socket, "connect_ex"), (socket.socket, "bind"), (socket, "getaddrinfo"), (socket, "create_connection"), (subprocess, "Popen")]
    with contextlib.ExitStack() as stack:
        for target, attr in guards:
            stack.enter_context(patch.object(target, attr, blocked))
        guard_control = False
        try:
            socket.getaddrinfo("example.invalid", 443)
        except RuntimeError as exc:
            guard_control = str(exc) == "probe forbids networking and subprocesses"
        assert guard_control
        models, verifier = load_original_modules()
        rows = [execute_case(case, models, verifier) for case in authored_cases()]
    dependencies = {name: importlib.metadata.version(name) for name in ["pydantic", "pydantic-core", "annotated-types", "typing-extensions", "typing-inspection"]}
    for line in (HERE / "requirements.lock.txt").read_text().splitlines():
        if line and not line.startswith("#"):
            name, expected_version = line.split("==")
            assert dependencies[name] == expected_version, f"runtime pin mismatch: {name}"
    output = {
        "schema": "shadow-recorder-original-module-probe/1", "executed_at_utc": datetime.now(timezone.utc).isoformat(),
        "upstream": {"repository": manifest["repository"], "revision": REVISION, "project_version": manifest["project_version_at_revision"]},
        "execution_boundary": "Unmodified _types.py and verifier.py imported through an authored namespace package; API-supplied fake transports. No package __init__, CLI, real transport, HTTP/subprocess server, SDK or MCP conformance suite execution.",
        "python": platform.python_version(), "dependencies": dependencies,
        "bindings": {"driver_sha256": digest(Path(__file__)), "manifest_sha256": digest(HERE / "upstream-manifest.json"), "dependency_pins_sha256": digest(HERE / "requirements.lock.txt")},
        "guard": {"network_and_subprocess_patches": [f"{target.__name__}.{attr}" for target, attr in guards], "dns_block_positive_control": guard_control, "general_sandbox": False},
        "counts": {"authored_cases": len(rows), "native_verifier_invocations": sum(r["exception"] is None or r["exception"]["stage"] == "native_verify" for r in rows), "cassette_validation_rejections": sum(r["exception"] is not None and r["exception"]["stage"] == "cassette_validation" for r in rows), "matched_authored_expectations": sum(r["matched_authored_expectation"] for r in rows), "new_or_repaired_defects": 0},
        "observed_controls": validate_observed_controls(rows), "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(output["counts"]))
    if not all(r["matched_authored_expectation"] for r in rows):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
