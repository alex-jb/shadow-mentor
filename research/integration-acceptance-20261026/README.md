# Known-fault integration probes, 2026-10-26

These are research artifacts for two already documented failures. They do not
modify the Shadow application, run a trading strategy, call a model provider,
or establish production failure rates. Cases were authored after reading fixes.

See [the research report](../../docs/research/2026-10-26-integration-research-update.md)
for the sources, controls, results, interpretation, and limits.

## Recorded environment

- Python 3.12.14; the version-pinned host dependencies are in
  `requirements-host.lock.txt`. This file pins versions, not wheel hashes.
- Node v24.22.1; the two npm package lockfiles retain resolved tarball integrity.
- `observed-results.json`: 10 FastMCP ASGI configuration observations.
- `discovery-observed-results.json`: 13 CLI commands, including healthy and
  nonempty controls, raw protocol exchanges, reports, package versions and hashes.

These counts are not 23 independently discovered bugs or 23 business tasks.

## Re-run

From this directory, create a separate Python environment, then install:

```sh
python3 -m venv /tmp/shadow-host-probe
/tmp/shadow-host-probe/bin/python -m pip install --only-binary=:all: -r requirements-host.lock.txt
/tmp/shadow-host-probe/bin/python host_origin_probe.py --output host-reproduced.json
```

Install the two CLI versions from their exact npm locks with lifecycle scripts
disabled, then run the local stdio comparison:

```sh
npm ci --prefix locks/082 --ignore-scripts --no-audit --no-fund
npm ci --prefix locks/083 --ignore-scripts --no-audit --no-fund
python3 discovery_cli_probe.py --old-prefix locks/082 --fixed-prefix locks/083 --output discovery-reproduced.json
```

Package installation requires registry access. The actual probes use in-process
ASGI or controlled stdio, with connection guards; these guards are not a general
security sandbox. No external MCP server or credentials are required.

`host_origin_probe.py` fixes the guard policy explicitly and rejects mismatched
principal dependency versions. A successful POST must contain the expected
JSON-RPC initialization result, not merely HTTP 200. It does not call a tool.

`discovery_cli_probe.py` checks actual package versions, exit codes, fixture
requests and replies, baseline creation, and report semantics. A startup error,
empty output, or invalid JSON cannot stand in for the expected check result.
Its minimal package inventory follows Node lookup paths to find installed
package roots without requiring ESM packages through CommonJS.

The original raw observation files are retained separately from re-run outputs.
No full Data360 environment, historical FastMCP dependency pair, model benchmark,
diagnosis-time comparison, or customer deployment was executed.
