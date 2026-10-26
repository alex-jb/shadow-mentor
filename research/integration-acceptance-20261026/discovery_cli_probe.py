"""Replay an already documented discovery false-pass using real CLI packages.

Only controlled local stdio fixtures are used. Versions and package resolution
are checked, healthy and nonempty controls are retained, and every raw JSON-RPC
exchange is stored in the resulting report. No claim of new bug discovery.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone


HERE = Path(__file__).resolve().parent


def package_inventory(node: str, entry: Path) -> dict:
    script = """
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(process.argv[1]);
const names=['@mcp-contracts/cli','@mcp-contracts/core','@mcp-contracts/test','@modelcontextprotocol/sdk','zod'];
const result={};
for(const name of names){
 // Find the installed package root without requiring a CommonJS export.
 // These packages expose ESM-only entry points.
 const root=name==='@mcp-contracts/cli'?null:req.resolve.paths(name).map(p=>path.join(p,name,'package.json')).find(p=>fs.existsSync(p));
 if(name!=='@mcp-contracts/cli'&&!root)throw Error('Dependency not found: '+name);
 let dir=path.dirname(root||process.argv[1]);
 while(true){
  const file=path.join(dir,'package.json');
  if(fs.existsSync(file)){
   const p=JSON.parse(fs.readFileSync(file,'utf8'));
   if(p.name===name){result[name]={version:p.version,package_json_sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')};break;}
  }
  const parent=path.dirname(dir);if(parent===dir)throw Error('Package root missing: '+name);dir=parent;
 }
}
process.stdout.write(JSON.stringify(result));
"""
    return json.loads(subprocess.check_output([node, "-e", script, str(entry)], text=True, timeout=15))


def run_version(node: str, prefix: Path, version: str, work: Path) -> dict:
    cli = prefix / "node_modules/@mcp-contracts/cli/dist/index.js"
    packages = package_inventory(node, cli)
    for name in ["@mcp-contracts/cli", "@mcp-contracts/core", "@mcp-contracts/test"]:
        if packages[name]["version"] != version:
            raise RuntimeError(f"Wrong resolved {name} version: {packages[name]}")
    for name, expected in {"@modelcontextprotocol/sdk": "1.32.2", "zod": "4.6.7"}.items():
        if packages[name]["version"] != expected:
            raise RuntimeError(f"Wrong resolved {name} version: {packages[name]}")
    work.mkdir()
    observations = []
    baseline_empty = work / "empty.mcpc.json"
    baseline_nonempty = work / "nonempty.mcpc.json"
    baseline_error = work / "error.mcpc.json"

    def execute(name: str, action: str, mode: str, expected_exit: int, baseline: Path) -> None:
        transcript = work / (name + ".jsonl")
        command = [node, str(cli), "--format", "json"]
        if action == "snapshot":
            command += ["-o", str(baseline), "snapshot"]
        else:
            command += ["check", "--baseline", str(baseline)]
        command += ["--command", node, "--args", str(HERE / "discovery_fixture.cjs"), mode, str(transcript)]
        env = {
            "PATH": os.environ.get("PATH", os.defpath), "NO_COLOR": "1",
            "NODE_OPTIONS": "--require=" + str(HERE / "no_network.cjs"),
        }
        try:
            run = subprocess.run(command, cwd=work, env=env, capture_output=True, text=True, timeout=15)
            code, stdout, stderr = run.returncode, run.stdout, run.stderr
        except subprocess.TimeoutExpired:
            code, stdout, stderr = None, "", "PROBE_TIMEOUT"
        exchanges = [json.loads(line) for line in transcript.read_text().splitlines()] if transcript.exists() else []
        tool_lists = [x for x in exchanges if x["direction"] == "request" and x["message"].get("method") == "tools/list"]
        error_replies = [x for x in exchanges if x["direction"] == "response" and x["message"].get("error", {}).get("code") == -32603]
        diagnostic_valid = bool(tool_lists) and ((mode == "error" and bool(error_replies)) or (mode != "error" and not error_replies))
        baseline_contents = json.loads(baseline.read_text()) if baseline.exists() else None
        snapshot_exists_as_expected = action != "snapshot" or baseline.exists() == (expected_exit == 0)
        expected_tool_count = 1 if mode == "nonempty" else 0
        snapshot_shape_valid = action != "snapshot" or expected_exit != 0 or (
            baseline_contents is not None and len(baseline_contents.get("tools", {})) == expected_tool_count
        )
        check_report = None
        if action == "check" and expected_exit in {0, 1}:
            try:
                check_report = json.loads(stdout)
            except (ValueError, TypeError):
                check_report = None
            if expected_exit == 0:
                report_semantics_valid = isinstance(check_report, dict) and (
                    check_report.get("summary", {}).get("total") == 0
                    and check_report.get("changes") == []
                    and "Contract unchanged" in stderr
                )
            else:
                report_semantics_valid = isinstance(check_report, dict) and any(
                    change.get("id") == "tool.alpha.removed" and change.get("severity") == "breaking"
                    for change in check_report.get("changes", [])
                )
        elif expected_exit == 2:
            report_semantics_valid = "Discovery incomplete" in stderr and "fixture discovery failure" in stderr
        else:
            report_semantics_valid = mode != "error" or "Warning: Failed to list tools" in stderr
        observed = {
            "case": name, "action": action, "fixture_mode": mode,
            "expected_exit": expected_exit, "observed_exit": code,
            "baseline_exists": baseline.exists(), "baseline_content": baseline_contents,
            "tools_list_request_count": len(tool_lists),
            "fixture_error_reply_count": len(error_replies),
            "report_semantics_valid": report_semantics_valid,
            "matched_expectation": code == expected_exit and diagnostic_valid and snapshot_exists_as_expected and snapshot_shape_valid and report_semantics_valid,
            "stdout": stdout, "stderr": stderr, "exchanges": exchanges,
        }
        observations.append(observed)
        print(f"{version} {name}: exit={code} expected={expected_exit} matched={observed['matched_expectation']}", file=sys.stderr, flush=True)

    execute("capture_valid_empty", "snapshot", "empty", 0, baseline_empty)
    execute("capture_valid_nonempty", "snapshot", "nonempty", 0, baseline_nonempty)
    execute("capture_discovery_error", "snapshot", "error", 0 if version == "0.8.2" else 2, baseline_error)
    execute("check_valid_empty", "check", "empty", 0, baseline_empty)
    execute("check_error_against_valid_empty", "check", "error", 0 if version == "0.8.2" else 2, baseline_empty)
    execute("check_error_against_nonempty", "check", "error", 1 if version == "0.8.2" else 2, baseline_nonempty)
    if version == "0.8.2":
        execute("check_error_against_contaminated_baseline", "check", "error", 0, baseline_error)
    return {"cli_version": version, "cli_entry_sha256": hashlib.sha256(cli.read_bytes()).hexdigest(), "resolved_packages": packages, "observations": observations}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--old-prefix", required=True, type=Path)
    parser.add_argument("--fixed-prefix", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    node = shutil.which("node")
    if node is None:
        raise SystemExit("Node is required")
    with tempfile.TemporaryDirectory(prefix="shadow-discovery-probe-") as temporary:
        temp = Path(temporary)
        versions = [
            run_version(node, args.old_prefix.resolve(), "0.8.2", temp / "old"),
            run_version(node, args.fixed_prefix.resolve(), "0.8.3", temp / "fixed"),
        ]
    observations = [row for version in versions for row in version["observations"]]
    report = {
        "schema": "shadow-known-discovery-false-pass-probe/1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "https://github.com/mcp-contracts/mcp-contracts/blob/v0.8.3/CHANGELOG.md",
        "scope": "Published CLI version pair with synthetic local stdio fixture; not production failure rates",
        "selection": "Historical fix and source were read before constructing the probe",
        "new_bug_discovery": False,
        "business_semantic_regression_established": False,
        "network": "Local stdio; child environment has no provider credentials; Node connect/DNS guards installed",
        "node": subprocess.check_output([node, "--version"], text=True).strip(),
        "source_sha256": {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in ["discovery_cli_probe.py", "discovery_fixture.cjs", "no_network.cjs"]},
        "observation_count": len(observations),
        "matched_expectation_count": sum(x["matched_expectation"] for x in observations),
        "versions": versions,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return 0 if all(row["matched_expectation"] for row in observations) else 1


if __name__ == "__main__":
    raise SystemExit(main())
