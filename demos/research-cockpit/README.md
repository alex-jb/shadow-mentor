# Shadow Research Desk

A local research workspace with six public daily-candle snapshots, inspectable
charts, and signed evidence for saving a research record. It connects the
controlled-write prototype to an actual HTTP workflow. No prediction model,
exchange account, wallet, or order submission is connected.

## Run

From this repository root, with Node 20+ and Python 3:

```bash
python3 bin/shadow-market-snapshot.py /tmp/shadow-market-new.json
node bin/shadow-research-cockpit.mjs --collection /tmp/shadow-market-new.json --output-dir /tmp/shadow-research-local --port 8767
```

Open `http://127.0.0.1:8767`. Select an asset, inspect 30/60/90 calendar days,
then choose **保存研究记录**. Download the record and its evidence envelope.
The collector refuses to overwrite its destination; choose a new filename for
a new collection. Re-reading the UI reloads the same collection, not new prices.

The server binds only to loopback. The POST requires the local Host, same-origin
Origin, JSON content type and the session request token. Browser requests cannot
choose paths, keys, content or grants. Output and ledger directories, their parent
directories and the host remain trusted configuration. Do not expose this local
prototype as an authenticated multi-user service.

## What the data means

The collector requests daily candles once for BTC, ETH, SOL, AVAX, LINK and DOGE
from the Coinbase Exchange public API. It records the requested and final URL,
request and response time, status and exact response text. No API key is used.
Provider documentation: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles

Candles are sorted, validated, and limited to the last 90 completed days.
Completion uses the individual request time as a conservative cutoff, including
when collection crosses midnight. Missing intervals stay missing. Duplicate or
malformed rows produce an asset error. An unavailable asset never receives
fabricated replacement data.

One-day and seven-day change require the exact earlier calendar date. SMA20
requires 20 consecutive completed daily candles. Daily volatility is the
population standard deviation of the 19 log returns between those 20 closes,
in percent. These are descriptive observations, not forecasts or win rates.

The source label is a declaration in a local file. Hashes bind local bytes;
they do not authenticate the market provider or prove the downloaded file was
not altered before being loaded. `SYNTHETIC_TEST` collections remain visibly
distinct from public API collections.

## Record and evidence

Saving creates a fresh, single-use demo-issued grant binding the exact report
bytes, output name, subject, run and invocation. The existing controlled writer
checks that grant, persists its reservation, creates a new file, records the raw
return and prepared response, then reads the file back.

The exported report is byte-for-byte the saved UTF-8 file. Compare its SHA-256
to `ATTEMPT.action.content_sha256` in the verified signed bundle. The envelope's
outer `report_sha256`, `report` and `review` alone are not signed authority;
rederive the review from the bundle. `report_utf8` preserves exact bytes for
offline comparison. The envelope includes public keys for the ephemeral demo
issuer and capture signer; no private key is exported. A trusted key pin must
come from an independent configuration for any real identity claim.

Readback, signature validity, source authenticity, actual model delivery,
organization authority and capture completeness are separate. Local readback
does not establish independent execution or causality. Both fixture keys are
generated on the same host in this prototype. A restart begins a new UI session;
previous reports, evidence envelopes and JSONL remain on disk, but are not loaded
into the new session's list.

## Validation

```bash
node --test test/research-cockpit.test.js test/controlled-execution-evidence.test.js test/session-api.test.js test/session-crash-recovery.test.js test/attest-core-contract.test.js test/adapter-claude-code-permissions.test.js
```

The 2026-10-15 increment adds 18 tests; this targeted set has 94 tests, with
zero failures or skips. A separate run used all six fetched assets to create,
download and reverify real local reports. It checked exact download byte hashes
against signed action digests. These are engineered checks, not a trading
benchmark. Remote-browser access to the isolated local service was unavailable;
full browser interaction and mobile rendering have not been validated.

## Open-source comparison and research scope

The linked Douyin page visibly showed a GROKBOT + JEV cockpit. Its exact backend
repository and profitability were not established. Related public projects:

| Project | Useful reference | Boundary |
| --- | --- | --- |
| https://github.com/zadescoxp/Jev-Trades | Apache-2.0 multi-asset dashboard, data feed, indicators and paper portfolio | A similar interface, not confirmed as the video's source. Real Jev calls need a key. |
| https://github.com/jarrodwatts/jev-trader | MIT intent, order receipt and fill events; streamed dashboard | Default model is a mock stand-in; no-private-key runs simulate execution. |
| https://github.com/TauricResearch/TradingAgents | Apache-2.0 multi-agent research and saved reports; optional Jev social-post filtering | Model outputs and history-date runs need independent data-timing and reproducibility checks. |

No third-party implementation was copied into this increment. TypeSafe's Jev
is a structured decision model, not the chart renderer or an established trading
edge: https://typesafe.ai/blog/introducing-system-one-models-and-jev

AI-Trader is relevant evaluation background, rather than proof that this
workspace predicts returns: https://arxiv.org/html/2512.10971v1 . Its current
repository also includes paper trading: https://github.com/HKUDS/AI-Trader .
A useful future question is whether an agent's conclusions, information timing,
authorization and execution evidence agree. Signed logs and a financial UI
alone do not establish a novel research contribution.
