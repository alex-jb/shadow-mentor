"""Known repaired annotation-diff omission, with explicit policy controls.

This runs published CLI packages against a synthetic local stdio server. It is
not new bug discovery or a test of whether a tool's actual behavior changed.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone


HERE = Path(__file__).resolve().parent


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--old-prefix", required=True, type=Path)
    parser.add_argument("--fixed-prefix", required=True, type=Path)
    args = parser.parse_args()
    node = shutil.which("node")
    if node is None:
        raise SystemExit("Node is required")
    legacy = load("frozen_acceptance_v1", HERE.parent / "evidence-acceptance-20261029/acceptance.py")
    capture = load("frozen_capture_utils", HERE.parent / "integration-acceptance-20261026/discovery_cli_probe.py")
    guard = HERE.parent / "integration-acceptance-20261026/no_network.cjs"
    cases = [
        ("unchanged_warning_policy", "before", "warning", 0),
        ("annotation_warning_policy", "annotation", "warning", None),
        ("annotation_breaking_policy", "annotation", "breaking", 0),
        ("description_warning_policy", "description", "warning", 1),
        ("description_breaking_policy", "description", "breaking", 0),
        ("required_schema_warning_policy", "schema", "warning", 1),
    ]
    observations, inventories = [], {}
    with tempfile.TemporaryDirectory(prefix="shadow-contract-change-") as temporary:
        for version, prefix in [("0.8.3", args.old_prefix), ("0.9.0", args.fixed_prefix)]:
            cli = prefix.resolve() / "node_modules/@mcp-contracts/cli/dist/index.js"
            packages = capture.package_inventory(node, cli)
            for name in ["@mcp-contracts/cli", "@mcp-contracts/core", "@mcp-contracts/test"]:
                if packages[name]["version"] != version:
                    raise RuntimeError(f"Unexpected package version for {name}")
            inventories[version] = packages
            work = Path(temporary) / version
            work.mkdir()
            baseline = work / "baseline.mcpc.json"
            env = {"PATH": os.environ.get("PATH", os.defpath), "NO_COLOR": "1", "NODE_OPTIONS": "--require=" + str(guard)}

            def execute(name, mode, fail_on=None):
                transcript = work / (name + ".jsonl")
                command = [node, str(cli), "--format", "json"]
                if fail_on is None:
                    command += ["-o", str(baseline), "snapshot"]
                else:
                    command += ["check", "--baseline", str(baseline), "--severity", "safe", "--fail-on", fail_on]
                command += ["--command", node, "--args", str(HERE / "contract_fixture.cjs"), mode, str(transcript)]
                run = subprocess.run(command, cwd=work, env=env, capture_output=True, text=True, timeout=15)
                exchanges = [json.loads(line) for line in transcript.read_text().splitlines()]
                if fail_on is None:
                    assert run.returncode == 0 and baseline.exists()
                    return {"exit": run.returncode, "baseline": json.loads(baseline.read_text()), "exchanges": exchanges}
                report = json.loads(run.stdout)
                assert any(x["direction"] == "request" and x["message"].get("method") == "tools/list" for x in exchanges)
                assert not any(x["direction"] == "response" and "error" in x["message"] for x in exchanges)
                return {"process": {"exit_code": run.returncode, "timed_out": False}, "raw": {"stdout": run.stdout, "stderr": run.stderr, "exchanges": exchanges, "capture_complete": True}, "report": report}

            captured = execute("capture_before", "before")
            for name, mode, fail_on, expected_exit in cases:
                if expected_exit is None:
                    expected_exit = 0 if version == "0.8.3" else 1
                record = execute(name, mode, fail_on)
                report = record["report"]
                before_hash = report["meta"]["before"]["contentHash"]
                after_hash = report["meta"]["after"]["contentHash"]
                expected_count = 0 if mode == "before" or (mode == "annotation" and version == "0.8.3") else None
                if expected_count is None:
                    expected_id = {"annotation": "tool.alpha.annotations", "description": "tool.alpha.description", "schema": None}[mode]
                    report_valid = report["summary"]["total"] > 0 and (expected_id is None or any(change["id"] == expected_id for change in report["changes"]))
                    if mode == "schema":
                        report_valid = report_valid and report["summary"]["breaking"] > 0
                else:
                    report_valid = report["summary"]["total"] == 0 and report["changes"] == []
                record.update({
                    "case": name, "cli_version": version,
                    "policy": {"fail_on": fail_on, "display_severity": "safe"},
                    "expected_native_exit": expected_exit,
                    "hashes_equal": before_hash == after_hash,
                    "baseline": captured["baseline"],
                    "legacy_receipt_interpretation": legacy.inspect_check(record["process"], record["raw"], ("initialize", "tools/list")),
                    "matched_reproduction_expectation": record["process"]["exit_code"] == expected_exit and report_valid and ((mode == "before") == (before_hash == after_hash)),
                })
                observations.append(record)
                print(version, name, record["process"]["exit_code"], record["matched_reproduction_expectation"], file=sys.stderr, flush=True)
    assert inventories["0.8.3"]["@modelcontextprotocol/sdk"] == inventories["0.9.0"]["@modelcontextprotocol/sdk"]
    assert inventories["0.8.3"]["zod"] == inventories["0.9.0"]["zod"]
    result = {
        "schema": "shadow-known-contract-change-probe/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "https://github.com/mcp-contracts/mcp-contracts/blob/v0.9.0/CHANGELOG.md",
        "scope": "Published CLI pair; authored local metadata fixture; tools/call never executed",
        "selection": "Fix and source read before constructing cases; development reproduction only",
        "independent_historical_defects": 1, "new_bug_discovery": False,
        "native_snapshot_commands": 2, "native_check_commands": len(observations),
        "node": subprocess.check_output([node, "--version"], text=True).strip(),
        "resolved_packages": inventories,
        "source_sha256": {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in ["contract_change_probe.py", "contract_fixture.cjs"]},
        "frozen_interpreter_sha256": hashlib.sha256((HERE.parent / "evidence-acceptance-20261029/acceptance.py").read_bytes()).hexdigest(),
        "observations": observations,
    }
    (HERE / "contract-change-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return 0 if all(row["matched_reproduction_expectation"] for row in observations) else 1


if __name__ == "__main__":
    raise SystemExit(main())
