"""Known-fault mechanism probe; this does not run the Data360 application.

Run with the pinned, isolated environment described in the research report.
All requests use Starlette's in-process ASGI transport. No provider credentials
or model calls are required. The cases were chosen after reading the fix.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import inspect
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def deny_socket_operations(event: str, args: tuple) -> None:
    if event in {"socket.connect", "socket.bind", "socket.getaddrinfo"}:
        raise RuntimeError("This probe permits in-process ASGI requests only")


sys.addaudithook(deny_socket_operations)

from fastmcp import FastMCP, settings  # noqa: E402
from fastmcp.server import http as fastmcp_http  # noqa: E402
from starlette.responses import JSONResponse  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402


EXTERNAL_HOST = "service.example.test"
TRUSTED_ORIGIN = "https://client.example.test"
REQUIRED_VERSIONS = {
    "fastmcp-slim": "3.4.3",
    "mcp": "1.25.0",
    "starlette": "1.3.1",
    "httpx": "0.28.1",
}
INITIALIZE = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "shadow-mechanism-probe", "version": "1"},
    },
}

# This is a predeclared, known-fault check matrix, not a held-out discovery set.
CASES = [
    ("default_health", "default", "http://testserver", "GET", {}, 200),
    ("default_initialize", "default", "http://testserver", "POST", {}, 200),
    ("external_base_url_masks_guard", "default", f"http://{EXTERNAL_HOST}", "GET", {}, 200),
    ("explicit_external_health", "default", "http://testserver", "GET", {"host": EXTERNAL_HOST}, 421),
    ("explicit_external_initialize", "default", "http://testserver", "POST", {"host": EXTERNAL_HOST}, 421),
    ("host_allowlist_only_foreign_origin", "hosts_only", "http://testserver", "POST", {"host": EXTERNAL_HOST, "origin": TRUSTED_ORIGIN}, 403),
    ("narrow_allowlist_initialize", "narrow", "http://testserver", "POST", {"host": EXTERNAL_HOST, "origin": TRUSTED_ORIGIN}, 200),
    ("narrow_rejects_unknown_host", "narrow", "http://testserver", "GET", {"host": "unknown.example.test"}, 421),
    ("narrow_rejects_unknown_origin", "narrow", "http://testserver", "POST", {"host": EXTERNAL_HOST, "origin": "https://unknown.example.test"}, 403),
    ("wildcard_reference_initialize", "wildcard_reference", "http://testserver", "POST", {"host": EXTERNAL_HOST, "origin": TRUSTED_ORIGIN}, 200),
]


def build_app(policy: str):
    # Avoid inheriting ambient environment allow-lists into this experiment.
    settings.http_allowed_hosts = []
    settings.http_allowed_origins = []
    server = FastMCP("shadow-host-mechanism")

    @server.custom_route("/health", methods=["GET"])
    async def health(_request):
        return JSONResponse({"status": "ok"})

    options = {
        "path": "/mcp", "stateless_http": True, "json_response": True,
        "host_origin_protection": True,
    }
    if policy == "hosts_only":
        options["allowed_hosts"] = [EXTERNAL_HOST]
    elif policy == "narrow":
        options["allowed_hosts"] = [EXTERNAL_HOST]
        options["allowed_origins"] = [TRUSTED_ORIGIN]
    elif policy == "wildcard_reference":
        # Historical fix comparator only; not a production recommendation.
        options["allowed_hosts"] = ["*"]
        options["allowed_origins"] = ["*"]
    return server.http_app(**options)


def run_case(case: tuple) -> dict:
    name, policy, base_url, method, headers, expected_status = case
    with TestClient(build_app(policy), base_url=base_url) as client:
        if method == "GET":
            response = client.get("/health", headers=headers)
        else:
            response = client.post(
                "/mcp",
                headers={"accept": "application/json, text/event-stream", **headers},
                json=INITIALIZE,
            )
    success_payload_valid = None
    if response.status_code == 200:
        payload = response.json()
        if method == "POST":
            success_payload_valid = (
                payload.get("jsonrpc") == "2.0"
                and payload.get("id") == 1
                and payload.get("result", {}).get("protocolVersion") == "2025-06-18"
                and payload.get("result", {}).get("serverInfo", {}).get("name") == "shadow-host-mechanism"
                and "error" not in payload
            )
        else:
            success_payload_valid = payload == {"status": "ok"}
    return {
        "case": name,
        "policy": policy,
        "base_url": base_url,
        "method": method,
        "explicit_headers": headers,
        "expected_status": expected_status,
        "observed_status": response.status_code,
        "success_payload_valid": success_payload_valid,
        "response_sha256": hashlib.sha256(response.content).hexdigest(),
        "matched_expectation": response.status_code == expected_status and success_payload_valid is not False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    actual_versions = {name: importlib.metadata.version(name) for name in REQUIRED_VERSIONS}
    if actual_versions != REQUIRED_VERSIONS:
        raise SystemExit(f"Dependency mismatch; refusing this fixed-version probe: {actual_versions}")
    cases = [run_case(case) for case in CASES]
    report = {
        "schema": "shadow-known-fault-mechanism-probe/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "FastMCP 3.4.3 minimal ASGI application; not the Data360 repository",
        "source_case": "https://github.com/worldbank/data360-mcp/pull/146",
        "selection": "Known fix was read before authoring cases; no discovery claim",
        "network": "In-process ASGI only; Python socket connect/bind/DNS audit events blocked",
        "business_semantic_regression_established": False,
        "historical_dependency_pair_reproduced": False,
        "python": sys.version.split()[0],
        "required_versions": REQUIRED_VERSIONS,
        "effective_configuration": {
            "host_origin_protection": True,
            "stateless_http": True,
            "json_response": True,
            "ambient_allowlists_cleared_before_each_app": True,
        },
        "packages": sorted(
            ({"name": dist.metadata["Name"], "version": dist.version} for dist in importlib.metadata.distributions()),
            key=lambda item: item["name"].lower(),
        ),
        "source_sha256": {
            "probe": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "fastmcp/server/http.py": hashlib.sha256(Path(inspect.getfile(fastmcp_http)).read_bytes()).hexdigest(),
        },
        "case_count": len(cases),
        "matched_expectation_count": sum(case["matched_expectation"] for case in cases),
        "cases": cases,
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0 if all(case["matched_expectation"] for case in cases) else 1


if __name__ == "__main__":
    raise SystemExit(main())
