import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MARKET_SYMBOLS, normalizeMarketAsset, prepareMarketSnapshot,
  createResearchCockpitServer } from '../lib/research-cockpit.js';
import { reviewControlledWrite } from '../lib/controlled-execution-evidence.js';

// Every price and candle here is synthetic. These fixtures test descriptive
// arithmetic and local evidence capture, not trading performance or forecasts.
const DAY = 86_400;
const AT = Date.parse('2026-10-15T12:00:00.000Z');
const LAST = Date.parse('2026-10-14T00:00:00.000Z') / 1000;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const candle = (time, close) => [time, close - 2, close + 2, close - 1, close, 10];
function asset(symbol = MARKET_SYMBOLS[0], rows = Array.from({ length: 30 },
  (_, i) => candle(LAST - (29 - i) * DAY, 100 + i))) {
  return { symbol,
    source_url: `https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=86400`,
    request_at: '2026-10-15T11:59:58.000Z',
    response_at: '2026-10-15T11:59:59.000Z', http_status: 200,
    raw_text: JSON.stringify(rows) };
}
function collection() {
  return { schema: 'shadow-market-collection/1', mode: 'SYNTHETIC_TEST',
    fetched_at: new Date(AT).toISOString(), assets: MARKET_SYMBOLS.map((symbol) => asset(symbol)) };
}
function http(base, path, { method = 'GET', headers = {}, body } = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = request({ hostname: url.hostname, port: url.port, path, method,
      headers: { Connection: 'close', ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let json; try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
async function fixture(t, input = collection()) {
  const base = mkdtempSync(join(tmpdir(), 'shadow-research-cockpit-test-'));
  const outputDir = join(base, 'output');
  const ledgerDir = join(base, 'ledger');
  const server = createResearchCockpitServer({ collection: input, outputDir, ledgerDir });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(base, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const state = (await http(origin, '/api/state')).json;
  const inputBody = { symbol: MARKET_SYMBOLS[0], snapshot_id: state.snapshot.snapshot_id };
  const headers = { Origin: origin, 'Content-Type': 'application/json',
    'X-Shadow-Token': state.request_token };
  const post = (body = inputBody, overrides = {}) => http(origin, '/api/record', {
    method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(body) });
  const assertNoWrites = () => {
    assert.deepEqual(readdirSync(outputDir), [], 'rejected request wrote an output file');
    assert.deepEqual(readdirSync(ledgerDir), [], 'rejected request consumed a grant or wrote evidence');
  };
  return { origin, state, inputBody, headers, post, assertNoWrites, outputDir, ledgerDir };
}

test('normalization excludes the unfinished daily candle and preserves raw response digest', () => {
  const rows = [candle(LAST, 120), candle(LAST + DAY, 900)];
  const raw = asset(undefined, rows);
  const result = normalizeMarketAsset(raw, AT);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.candles.map((c) => c.time), [LAST]);
  assert.equal(result.metrics.last_close, 120);
  assert.equal(result.excluded_incomplete, 1);
  assert.equal(result.coverage.returned_rows, 2);
  assert.equal(result.raw_sha256, digest(raw.raw_text));
});

test('a request begun before midnight cannot promote its partial candle after midnight', () => {
  const raw = { ...asset(undefined, [candle(LAST - DAY, 110), candle(LAST, 120)]),
    request_at: '2026-10-14T23:59:59.000Z', response_at: '2026-10-15T00:00:01.000Z' };
  const result = normalizeMarketAsset(raw, AT);
  assert.deepEqual(result.candles.map((c) => c.time), [LAST - DAY]);
  assert.equal(result.excluded_incomplete, 1);
  assert.equal(result.metrics.last_close, 110);
});

test('normalization rejects malformed OHLCV rather than silently repairing it', () => {
  const invalid = [
    [LAST, 101, 110, 100, 105, 1], // low above open
    [LAST, 90, 104, 100, 105, 1], // high below close
    [LAST, 90, 110, 100, 105, -1],
    [LAST + 1, 90, 110, 100, 105, 1],
    [LAST, 90, 110, 100, '105', 1],
    [LAST, 90, 110, 100, 0, 1],
    [LAST, 90, 110, 100, 105],
  ];
  for (const row of invalid) assert.throws(() => normalizeMarketAsset(asset(undefined, [row]), AT), /OHLCV/);
  assert.throws(() => normalizeMarketAsset({ ...asset(), raw_text: '{' }, AT));
});

test('duplicate timestamps are rejected even when the repeated candle is unfinished', () => {
  for (const time of [LAST, LAST + DAY]) {
    assert.throws(() => normalizeMarketAsset(asset(undefined,
      [candle(LAST - DAY, 100), candle(time, 110), candle(time, 110)]), AT), /Duplicate/);
  }
});

test('sparse history reports calendar gaps and never invents replacement candles', () => {
  const rows = [candle(LAST - 7 * DAY, 100), candle(LAST - 2 * DAY, 110), candle(LAST, 120)];
  const result = normalizeMarketAsset(asset(undefined, rows.reverse()), AT);
  assert.deepEqual(result.candles.map((c) => c.time), [LAST - 7 * DAY, LAST - 2 * DAY, LAST]);
  assert.equal(result.coverage.gap_count, 5);
  assert.equal(result.metrics.one_day_change_pct, null);
  assert.ok(Math.abs(result.metrics.seven_day_change_pct - 20) < 1e-10);
});

test('one- and seven-day changes use exact calendar offsets rather than row positions', () => {
  const result = normalizeMarketAsset(asset(undefined, [candle(LAST - 8 * DAY, 10),
    candle(LAST - 7 * DAY, 100), candle(LAST - DAY, 125), candle(LAST, 150)]), AT);
  assert.ok(Math.abs(result.metrics.one_day_change_pct - 20) < 1e-10);
  assert.equal(result.metrics.seven_day_change_pct, 50);
  const missingSeven = normalizeMarketAsset(asset(undefined,
    [candle(LAST - 8 * DAY, 10), candle(LAST - DAY, 125), candle(LAST, 150)]), AT);
  assert.equal(missingSeven.metrics.seven_day_change_pct, null);
});

test('twenty-day statistics require twenty consecutive completed days', () => {
  const ready = normalizeMarketAsset(asset(), AT);
  assert.equal(ready.metrics.sma20, 119.5);
  assert.ok(ready.metrics.volatility_daily_pct > 0);
  for (const rows of [Array.from({ length: 19 }, (_, i) => candle(LAST - i * DAY, 100 + i)),
    Array.from({ length: 20 }, (_, i) => candle(LAST - i * 2 * DAY, 100 + i))]) {
    const result = normalizeMarketAsset(asset(undefined, rows), AT);
    assert.equal(result.metrics.sma20, null);
    assert.equal(result.metrics.volatility_daily_pct, null);
  }
});

test('normalization rejects unknown source, symbol, failed HTTP status, and inconsistent clocks', () => {
  for (const change of [{ source_url: 'https://example.com/candles' }, { symbol: 'UNKNOWN-USD' },
    { http_status: 503 }, { request_at: 'invalid' },
    { response_at: '2026-10-15T11:59:57.000Z' },
    { response_at: '2026-10-15T12:01:00.000Z' }]) {
    assert.throws(() => normalizeMarketAsset({ ...asset(), ...change }, AT));
  }
});

test('snapshot requires all six unique supported assets and an explicit collection mode', () => {
  const valid = collection();
  assert.equal(prepareMarketSnapshot(valid).mode, 'SYNTHETIC_TEST');
  assert.equal(prepareMarketSnapshot(valid).source.provenance, 'SYNTHETIC_TEST_DATA');
  assert.equal(prepareMarketSnapshot({ ...valid, mode: 'PUBLIC_API_SNAPSHOT' }).source.provenance,
    'DECLARED_SOURCE_LOCAL_FILE_UNAUTHENTICATED');
  assert.equal(prepareMarketSnapshot(valid).snapshot_id, prepareMarketSnapshot(structuredClone(valid)).snapshot_id);
  const missing = structuredClone(valid); missing.assets.pop();
  const duplicate = structuredClone(valid); duplicate.assets[5] = duplicate.assets[0];
  const unknown = structuredClone(valid); unknown.assets[5] = asset('UNKNOWN-USD');
  for (const input of [missing, duplicate, unknown, { ...valid, mode: 'LIVE_TRADING' }]) {
    assert.throws(() => prepareMarketSnapshot(input));
  }
});

test('data errors remain visible per asset and cannot become misleading READY values', async (t) => {
  const input = collection();
  input.assets[0].error = 'Synthetic upstream fetch failure';
  input.assets[1].raw_text = 'not json';
  const f = await fixture(t, input);
  assert.equal(f.state.snapshot.assets[0].status, 'ERROR');
  assert.match(f.state.snapshot.assets[0].error, /Synthetic upstream/);
  assert.equal(f.state.snapshot.assets[1].status, 'ERROR');
  assert.deepEqual(f.state.snapshot.assets[1].metrics, {});
  assert.equal((await f.post()).status, 400);
  f.assertNoWrites();
});

test('HTTP state explicitly exposes research-only boundaries and a per-server token', async (t) => {
  const f = await fixture(t);
  assert.equal(f.state.snapshot.schema, 'shadow-market-snapshot/1');
  assert.equal(f.state.snapshot.mode, 'SYNTHETIC_TEST');
  assert.deepEqual(f.state.boundaries, { model: 'NOT_CONNECTED', trading: 'DISABLED',
    grant_profile: 'EPHEMERAL_DEMO_ISSUER' });
  assert.match(f.state.request_token, /^[a-f0-9]{64}$/);
  assert.deepEqual(f.state.receipts, []);
  f.assertNoWrites();
});

test('HTTP record writes real report bytes and exports independently recheckable signatures', async (t) => {
  const f = await fixture(t);
  const created = await f.post();
  assert.equal(created.status, 201, created.text);
  const receipt = created.json;
  assert.equal(receipt.review.grant_binding, 'GRANT_MATCH');
  assert.equal(receipt.review.effect, 'LOCAL_READBACK_MATCH');
  const downloaded = await http(f.origin, receipt.bundle_url);
  assert.equal(downloaded.status, 200);
  const envelope = downloaded.json;
  const review = reviewControlledWrite(envelope.bundle, {
    capturePublicKey: createPublicKey(envelope.capture_public_key),
    authorizationPublicKey: createPublicKey(envelope.authorization_public_key) });
  assert.equal(review.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(review.grant_binding, 'GRANT_MATCH');
  assert.equal(review.return_relation, 'IDENTICAL');
  assert.equal(review.effect, 'LOCAL_READBACK_MATCH');
  assert.equal(review.capture_completeness, 'UNVERIFIED');
  const actual = readFileSync(join(f.outputDir, receipt.filename));
  assert.equal(digest(actual), envelope.report_sha256);
  assert.equal(envelope.report_utf8, actual.toString('utf8'));
  assert.deepEqual(JSON.parse(actual), envelope.report);
  const reportDownload = await http(f.origin, receipt.report_url);
  assert.equal(reportDownload.text, actual.toString('utf8'));
  assert.equal(digest(reportDownload.text), envelope.report_sha256);
  assert.deepEqual(reportDownload.json, JSON.parse(actual));
  assert.equal(envelope.report.model_status, 'NOT_CONNECTED');
  assert.equal(envelope.report.prediction_status, 'NOT_EVALUATED');
  const nextState = (await http(f.origin, '/api/state')).json;
  assert.equal(nextState.receipts[0].id, receipt.id);
  const persistedEnvelope = JSON.parse(readFileSync(join(f.outputDir, `receipt-${receipt.id}.json`), 'utf8'));
  assert.equal(persistedEnvelope.report_sha256, envelope.report_sha256);
});

test('HTTP rejects a stale snapshot identifier before grant creation or file writes', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.post({ ...f.inputBody, snapshot_id: '0'.repeat(64) })).status, 409);
  f.assertNoWrites();
});

test('HTTP rejects extra client-controlled filename, root, key, or grant arguments', async (t) => {
  const f = await fixture(t);
  for (const injected of [{ filename: '../outside.json' }, { root_id: '/tmp' },
    { capture_private_key: 'injected' }, { authorization_public_key: 'injected' },
    { grant_envelope: {} }, { content: 'client controls bytes' }]) {
    assert.equal((await f.post({ ...f.inputBody, ...injected })).status, 409);
    f.assertNoWrites();
  }
  assert.equal((await f.post({ ...f.inputBody, symbol: 'UNKNOWN-USD' })).status, 400);
  f.assertNoWrites();
});

test('HTTP requires token and JSON content type before any write', async (t) => {
  const f = await fixture(t);
  for (const overrides of [{ 'X-Shadow-Token': '' }, { 'X-Shadow-Token': 'wrong' },
    { 'Content-Type': 'text/plain' }]) {
    assert.equal((await f.post(f.inputBody, overrides)).status, 403);
    f.assertNoWrites();
  }
});

test('HTTP rejects cross-origin writes even with the correct local token', async (t) => {
  const f = await fixture(t);
  for (const Origin of ['https://attacker.example', 'null', '']) {
    assert.equal((await f.post(f.inputBody, { Origin })).status, 403);
    f.assertNoWrites();
  }
});

test('HTTP rejects an unrecognized Host on state reads and record writes', async (t) => {
  const f = await fixture(t);
  const read = await http(f.origin, '/api/state', { headers: { Host: 'attacker.example' } });
  assert.equal(read.status, 403);
  assert.equal(read.json.request_token, undefined);
  assert.equal((await f.post(f.inputBody, { Host: 'attacker.example' })).status, 403);
  f.assertNoWrites();
});

test('download routes expose only exact receipt artifacts and reject traversal or extra segments', async (t) => {
  const f = await fixture(t);
  const receipt = (await f.post()).json;
  for (const path of ['/api/download/not-a-receipt/bundle.json',
    `/api/download/${receipt.id}/other.json`, `/api/download/${receipt.id}/../report.json`,
    '/api/download/%2e%2e/%2e%2e/package.json',
    `/api/download/${receipt.id}/bundle.json/extra`,
    `/api/download/${receipt.id}/report.json/extra`]) {
    assert.equal((await http(f.origin, path)).status, 404, path);
  }
  assert.equal((await http(f.origin, receipt.bundle_url)).status, 200);
});
