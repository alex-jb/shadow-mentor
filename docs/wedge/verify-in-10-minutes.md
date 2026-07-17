# Verify any AI agent's decision log wasn't tampered — in your CI, in 10 minutes

> Dev-first packaging of the Shadow verifier as an OSS wedge (per
> `docs/strategy/shadow-reposition-2026-07-16.md`). This is the *independent
> third-party* story: anyone can verify a Shadow evidence bundle **offline**,
> with only the signer's **public** key — no backend, no account, no trust in
> the vendor who produced the log. That independence is the whole point: a
> vendor auditing its own agent is auditing its own books; this lets a bank (or
> your bank *customer*) check your agent's decisions themselves.

If you ship an AI agent that makes decisions someone downstream must trust
(loan calls, AML flags, any regulated or high-stakes action), this proves the
decision record you handed them is the one your agent actually produced —
byte-for-byte, cryptographically, with no way to quietly edit it after the fact.

## What it catches

- A tampered payload (someone edited a verdict/reason after signing)
- A broken hash-chain (an event reordered, inserted, or dropped)
- A silent model/key swap (re-signed with a different Ed25519 keypair)
- Any of the above **anywhere downstream of the signer**

## 10-minute quickstart (offline, zero infrastructure)

The verifier needs only the bundle + the signer's **public** key. It never
touches the network and never needs the private key — it can't forge, it can
only check.

**1. Get the verifier + a demo bundle.**

```bash
git clone https://github.com/alex-jb/shadow-mentor && cd shadow-mentor
npm ci   # workspace setup; the verifier itself uses only Node's built-in crypto
```

**2. Verify a bundle against a public key.**

```bash
node bin/shadow-verify.mjs demos/replay/data/demo-session.bundle.json \
  --public-key demos/replay/data/demo-public-key.pem
# exit 0 = verified · 1 = failed (tamper/bad sig/chain break) · 2 = usage · 3 = I/O
```

Add `--json` for a single-line machine-readable report (drop into any pipeline).

**3. Prove tamper is caught.** Flip one byte of one event and watch it fail:

```bash
node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1]));
const e=b.events[6];e.payload_hash=e.payload_hash.slice(0,-1)+(e.payload_hash.slice(-1)==="f"?"0":"f");
fs.writeFileSync("/tmp/tampered.json",JSON.stringify(b,null,2))' \
  demos/replay/data/demo-session.bundle.json
node bin/shadow-verify.mjs /tmp/tampered.json \
  --public-key demos/replay/data/demo-public-key.pem
# exit 1 — names the broken event: "seq 7 · prev_hash_mismatch · chain broken here…"
```

## Drop it in CI (copy-paste)

Fail the build if any committed evidence bundle doesn't verify. Store the
signer's public key as the `SHADOW_PUBLIC_KEY` secret (PEM, including headers).

```yaml
# .github/workflows/verify-bundles.yml
name: verify-agent-audit-bundles
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - name: write public key
        run: printf '%s' "${{ secrets.SHADOW_PUBLIC_KEY }}" > /tmp/pub.pem
      - name: verify every bundle
        run: |
          set -e
          find audit-bundles -name '*.json' -print0 | while IFS= read -r -d '' f; do
            node bin/shadow-verify.mjs "$f" --public-key /tmp/pub.pem
          done
```

That's it — every push re-verifies every bundle, offline, deterministically.
The green check is your independent-attestation answer to "how do you know the
record you filed is the one your agent produced?"

## Why this is the wedge (not the banking-council pitch)

- **Independent.** The verifier is decoupled from whoever signed — a bank, an
  examiner, or your bank *customer* runs it themselves. That third-party
  independence is the durable seam (platforms attest their *own* execution;
  this attests *across* vendors).
- **Offline + tiny.** No server, no account, Ed25519 via Node's built-in
  WebCrypto. Runs in CI, on a laptop, or in a browser (`verify.html`).
- **Agent-agnostic.** Nothing here is banking-specific — it verifies any Shadow
  evidence bundle. The banking council + persona layer sits *on top*; this
  verifier is the dev-adoptable bottom.

## Making it `npx`-able — progress + the remaining step

**Done (2026-07-17):** both CLIs now import the published `shadow-attest-core`
(via `shadow-attest-core/session`, resolved through the workspace symlink from a
clone and through the dependency when published), and `shadow-adapter-otel` is a
real publishable package (`packages/adapter-otel/package.json`, `npm pack` clean)
so its README `import` resolves for an external user. The CLIs are therefore
publish-ready in their imports.

**Remaining step:** the verifier still runs from a clone (`node
bin/shadow-verify.mjs …`) rather than `npx`. To expose an `npx` bin, the CLI file
must ship inside a published package's `bin`. `bin/shadow-verify.mjs` is
referenced in ~20 places (the `shadow-verify` GitHub Action, the CI dogfood step,
two test files, and many docs), so the clean move is a small refactor — extract
the CLI core into `shadow-attest-core` and add a `bin` there (keeping the root
`bin/shadow-verify.mjs` as a thin wrapper so every existing reference still
works) — not a quick rename. Named unscoped (`shadow-verify` / a `shadow-attest-core`
bin), not `@shadow/…`, to avoid the org-scope name-taken 403 that already forced
the `@shadow/attest-core → shadow-attest-core` rename. Left as an explicit,
scoped refactor.

## See also

- Bank-audience CI recipe (HTTP endpoint, deployment-in-the-loop):
  `examples/verify-in-ci/README.md`
- The verifier internals: `packages/attest-core` (Node) · `demos/replay/verify-browser.js` (browser, parity-tested)
- Strategy: `docs/strategy/shadow-reposition-2026-07-16.md`
