# Shadow · MCP Registry Submission Runbook (2026-07-14)

**Deadline consideration:** Do this **before 2026-08-02 OSS launch** so Shadow appears in the official MCP Registry at `registry.modelcontextprotocol.io` on launch day. Estimated Alex-hand time: **20 minutes total** (5 min prep + 15 min run).

**Source:** https://registry.modelcontextprotocol.io/docs · confirmed 2026-07-14.

---

## Prerequisite (2 min)

Shadow's MCP server ships as part of the `shadow-mentor` repo but has never been published to npm on its own. The MCP Registry submission wants an npm package. Two paths:

### Path A · Publish `shadow-mentor` to npm (recommended for procurement discoverability)

- The whole repo becomes `npm install shadow-mentor`
- Wide discoverability + Alex controls the name
- Requires: valid npm access token (see `docs/NPM_PUBLISH_FIX.md` in the council-diff repo for the pattern Alex used there)

### Path B · Point the registry entry at `shadow-attest-core` (already on npm at v2.0.0)

- `shadow-attest-core` is the verifier lib, not the full MCP server. Semantically imperfect but valid.
- Zero extra publishing steps.
- Downside: registry visitors expect a "server" and find a "lib". Less discovery upside.

**Recommendation:** Path A. The 5-minute npm publish gives Shadow a canonical install path (`npm install shadow-mentor`) that everything else in the launch plan can point to.

---

## Step 1 · Add `mcpName` to package.json

Edit `package.json` in the `shadow-mentor` repo:

```json
{
  "name": "shadow-mentor",
  "version": "2.0.3",
  "mcpName": "io.github.alex-jb/shadow-mentor",
  ...
}
```

The `mcpName` field is what the MCP Registry uses as canonical identifier and must match the `name` field in `server.json`.

**Note:** package.json currently has `"private": true` — must flip to `"private": false` (or remove the line) before `npm publish` works. If Alex doesn't want to publicly publish the whole repo, use Path B instead.

---

## Step 2 · Publish to npm (5 min)

```bash
cd ~/Desktop/AI-Projects/shadow-mentor
npm run build 2>/dev/null || true   # no-op if no build step
npm publish --access public
```

Expected: `+ shadow-mentor@2.0.3`. If prompted for OTP, provide 2FA code.

---

## Step 3 · Install mcp-publisher CLI (2 min)

```bash
brew install mcp-publisher
mcp-publisher --version
```

Or download prebuilt binary from the registry docs page.

---

## Step 4 · Generate server.json (2 min)

From inside the shadow-mentor repo:

```bash
mcp-publisher init
```

This writes a starter `server.json`. Replace its content with the following:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.alex-jb/shadow-mentor",
  "description": "Shadow: 10-tool MCP server for a 5-persona banking-compliance council with Ed25519-signed attestation, hash-chain integrity, and Fair-Lending disparity math (SolasAI-aligned). MIT, 1504+ tests, cross-language Node ↔ Python verifier. Regulatory citation map covers Reg B §1002.9, ECOA, CFPB Circular 2022-03 + 2026-03, SR 26-2, GDPR Art. 22 + Schufa C-634/21, EEOC UGSEP 1978 §1607.4(D).",
  "repository": {
    "url": "https://github.com/alex-jb/shadow-mentor",
    "source": "github"
  },
  "version": "2.0.3",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "shadow-mentor",
      "version": "2.0.3",
      "transport": {"type": "stdio"}
    }
  ]
}
```

---

## Step 5 · Login + publish (3 min)

```bash
mcp-publisher login github
```

Follow the OAuth device-code flow in the browser. Alex approves via his `alex-jb` GitHub account (namespace `io.github.alex-jb` is proven by GitHub ownership).

```bash
mcp-publisher publish
```

Expected: `Published io.github.alex-jb/shadow-mentor@2.0.3`.

---

## Step 6 · Verify (2 min)

```bash
curl -s https://registry.modelcontextprotocol.io/servers/io.github.alex-jb/shadow-mentor | python3 -m json.tool | head -30
```

Expected: 200 OK, JSON body matching the server.json fields.

Also verify via the web UI: https://registry.modelcontextprotocol.io/search?q=shadow-mentor

---

## Downstream launch payoff

Once published:

- **README badge** — add `[![MCP Registry](https://img.shields.io/badge/MCP_Registry-published-blue)](https://registry.modelcontextprotocol.io/servers/io.github.alex-jb/shadow-mentor)` to the top of Shadow README
- **launch/hn-show.md** — cite "listed in the official MCP Registry" as first-day trust signal
- **CITATION_MAP.md** — the registry entry becomes the canonical URL for procurement due-diligence emails ("here's the registry entry, here's the code, here's the paper")

---

## If Path A blocked (Alex decides not to npm-publish the whole repo)

Fall back to Path B using `shadow-attest-core@2.0.0` as the identifier:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.alex-jb/shadow-attest-core",
  "description": "Shadow attest-core verifier library — Ed25519 signed attestation + hash-chain integrity verification for Shadow evidence bundles. Cross-language Node ↔ Python, MIT.",
  "repository": {
    "url": "https://github.com/alex-jb/shadow-mentor",
    "source": "github"
  },
  "version": "2.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "shadow-attest-core",
      "version": "2.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

Then skip Step 1 (mcpName already implicit) and Step 2 (already published), do Steps 3-6.

---

## Time-boxed decision gate

**If npm publish takes more than 15 min** (auth issues, `private: true` conflict, name-taken), abort Path A and switch to Path B immediately. Do NOT delay the launch for registry discoverability polish.
