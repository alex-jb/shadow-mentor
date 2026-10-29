"""Expected zero-coverage control in published MCP conformance 0.1.16.

This is not a conformance-tool defect. A draft-only suite filtered to a dated
revision selects no scenarios. A consumer requiring executed checks must inspect
coverage, rather than treating the successful selector exit as completed tests.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone


HERE = Path(__file__).resolve().parent


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", required=True, type=Path)
    args = parser.parse_args()
    package_root = args.prefix.resolve() / "node_modules/@modelcontextprotocol/conformance"
    package = json.loads((package_root / "package.json").read_text())
    if package["version"] != "0.1.16":
        raise SystemExit("This control is pinned to conformance 0.1.16")
    node = shutil.which("node")
    if node is None:
        raise SystemExit("Node is required")
    cli = package_root / "dist/index.js"
    guard = HERE.parent / "integration-acceptance-20261026/no_network.cjs"
    env = {"PATH": os.environ.get("PATH", os.defpath), "NO_COLOR": "1", "NODE_OPTIONS": "--require=" + str(guard)}
    sentinel_source = "require('node:fs').writeFileSync(process.argv[2], 'client-executed');\n"
    with tempfile.TemporaryDirectory(prefix="shadow-zero-coverage-") as directory:
        work = Path(directory)
        sentinel = work / "sentinel.cjs"
        sentinel.write_text(sentinel_source)
        control_marker, probe_marker = work / "positive-control", work / "suite-client"
        positive = subprocess.run([node, str(sentinel), str(control_marker)], env=env, cwd=work, capture_output=True, text=True, timeout=5)
        command = [
            node, str(cli), "client", "--command", shlex.join([node, str(sentinel), str(probe_marker)]),
            "--suite", "draft", "--spec-version", "2025-11-25", "--timeout", "100",
        ]
        observed = subprocess.run(command, env=env, cwd=work, capture_output=True, text=True, timeout=10)
        control_valid = positive.returncode == 0 and control_marker.read_text() == "client-executed"
        # Exact wording is retained below; the expected summary has three zero counts.
        summary = observed.stdout + observed.stderr
        zero_summary = all(fragment in summary for fragment in ["0 passed", "0 failed", "0 warnings"])
        client_executed = probe_marker.exists()
    report = {
        "schema": "shadow-native-empty-suite-control/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "package": {"name": package["name"], "version": package["version"]},
        "arguments": ["client", "--suite", "draft", "--spec-version", "2025-11-25", "--timeout", "100"],
        "node": subprocess.check_output([node, "--version"], text=True).strip(),
        "positive_control_valid": control_valid,
        "client_command_executed_in_suite": client_executed,
        "observed_exit": observed.returncode,
        "stdout": observed.stdout,
        "stderr": observed.stderr,
        "zero_count_summary_observed": zero_summary,
        "matched_expectation": control_valid and not client_executed and observed.returncode == 0 and zero_summary,
        "interpretation": "Expected empty selection, not a native tool bug or explicit per-scenario SKIP. Zero client scenarios cannot establish a consumer obligation requiring an executed client check.",
        "new_defect_discovered": False,
        "included_in_seven_record_reanalysis": False,
        "source_sha256": {
            "driver": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "cli_entry": hashlib.sha256(cli.read_bytes()).hexdigest(),
            "network_guard": hashlib.sha256(guard.read_bytes()).hexdigest(),
            "sentinel_source": hashlib.sha256(sentinel_source.encode()).hexdigest(),
        },
    }
    (HERE / "conformance-empty-suite-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["matched_expectation"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
