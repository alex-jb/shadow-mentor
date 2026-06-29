# Shadow MCP server

> Expose Shadow's loan-council + risk tools + memory recall + calibration stats to any MCP-capable host (Claude Desktop, Cursor, Zed, OpenCode).

## Why

Shadow already ships 8 HTTP endpoints on Vercel. The MCP server lets you skip the curl and call Shadow directly from your LLM chat — same way you'd call `read_file` or `git_status`. Procurement-grade banking workflows are easier to demo when an analyst can type "what would the compliance council say about a B-rated TLB with FICO 740 and DTI 0.28?" and get the verdict back inline.

The 6 tools exposed:

| Tool | Purpose | Backed by |
|---|---|---|
| `shadow_loan_council` | Run the 5-voice deterministic loan-origination council on a structured loan dict. Returns verdict (block / escalate / approve) + voice rationales + risk packet + BR thresholds applied. **v1.1.1**: FICO < 700 is a hard block. | `lib/run-loan-council.js` |
| `shadow_risk_tools` | Run one of Loredana's typed institutional risk primitives (VaR, ES, factor exposures, beta, concentration, sector exposure, correlation). | `lib/risk-tools/index.js` |
| `shadow_recall` | Pull past Shadow deliberation entries for a persona + scenario from cross-session memory. | `lib/memory.js` |
| `shadow_calibration` | Brier calibration stats per persona — useful for SR 26-2 (formerly SR 11-7) model risk monitoring. | `lib/memory.js` |
| `shadow_scenarios` | List the full surface (5 personas × 4 scenarios × 4 device clients × 2 providers) for discovery. | `lib/prompts.js` + `lib/schemas/loan.js` |
| `shadow_traceability` | **New v1.1.1**: Look up the source attribution for any benchmark rule. Returns the governance layer (institutional risk framework / product-line policy / benchmark calibration parameter / regulatory) and the authoritative source. Use to verify procurement-audit citation chain — e.g. *"where does FICO ≥ 700 come from?"* → Addendum A; *"is VaR ≤ 0.12 from the BRD?"* → No, it's Addendum C Risk Appetite Note (benchmark calibration parameter). | `lib/traceability.js` + `lib/schemas/adverse-action.js` |

All tools run locally — no network call, no LLM cost. Built on top of the same `lib/` modules that back `/api/loan-council` and `/api/scenarios` on Vercel.

## Install

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor
npm install
```

### One-line install (recommended, v1.2+)

```bash
node bin/install.mjs                         # list detected MCP hosts
node bin/install.mjs --host cursor --dry-run # preview the merged config
node bin/install.mjs --host cursor           # write it
node bin/install.mjs --all                   # install for every detected host
```

`bin/install.mjs` reads `installer/tools.json` (the canonical install-target catalog — 5 MCP hosts as of v1.2: Claude Desktop / Cursor / Zed / OpenCode / OpenClaw) and writes the correct JSON config. JSON-merge preserves existing MCP servers; only the `shadow-mentor` key is added or updated. Dry-run shows the exact bytes before any file is touched.

### Manual install (always works)

Add Shadow to your MCP host config by hand:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on Windows/Linux:

```json
{
  "mcpServers": {
    "shadow-mentor": {
      "command": "node",
      "args": ["/absolute/path/to/shadow-mentor/mcp/server.js"]
    }
  }
}
```

Restart Claude Desktop. The 6 `shadow_*` tools become available.

### Cursor

Open Settings → MCP → Add Server. Same `command` + `args` shape.

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "shadow-mentor": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/shadow-mentor/mcp/server.js"]
      }
    }
  }
}
```

## Verify

```bash
node mcp/server.js < /dev/null  # should sit waiting for stdio; Ctrl-C to exit
```

If you see `unhandled request` errors, you're missing a host. That's expected when invoked outside an MCP client.

## Example

In Claude Desktop after install:

> "Run shadow_loan_council on a borrower with credit_score 740, debt_to_income 0.28, loan_to_value 0.65, amount 250000, sector industrials, fair_lending_review_flag false."

Claude will dispatch the tool, get back the 5-voice verdict, and explain it in plain English. No curl, no remembering the JSON shape.

## Tests

The tool dispatcher is covered by `test/mcp-server.test.js`. The MCP transport itself (stdio + protocol handshake) is exercised by Claude Desktop / Cursor against the live install.

## What this is NOT

- **Not a hosted MCP server.** You run it locally. Shadow doesn't run your data through anyone else's infrastructure.
- **Not the same as `/api/deliberate`.** That endpoint runs the LLM 3-voice deliberation. The MCP server runs the deterministic rule layer + memory recall. Use both for end-to-end demos.
- **Not required.** The HTTP endpoints work fine without MCP. This is convenience for MCP-capable hosts.

## License

MIT (same as the rest of Shadow).
