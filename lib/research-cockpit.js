// Read-only market research + controlled local record creation. No orders,
// prediction model, API credentials, wallet, or broker are connected.
import { createHash, generateKeyPairSync, randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRANT_SCHEMA, describeWrite, signWriteGrant, createControlledWriter, reviewControlledWrite } from './controlled-execution-evidence.js';

export const MARKET_SYMBOLS = Object.freeze(['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'LINK-USD', 'DOGE-USD']);
const DAY = 86400;
const hash = (x) => createHash('sha256').update(x).digest('hex');
const endpoint = (symbol) => `https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=86400`;
const isNumber = (x) => typeof x === 'number' && Number.isFinite(x);
const plain = (x) => x && Object.getPrototypeOf(x) === Object.prototype;

export function normalizeMarketAsset(record, atMs) {
  if (!plain(record) || !MARKET_SYMBOLS.includes(record.symbol) || !Number.isSafeInteger(atMs)
      || record.source_url !== endpoint(record.symbol)
      || (record.final_url !== undefined && record.final_url !== record.source_url)) throw new Error('Invalid source identity');
  const base = { symbol: record.symbol, source_url: record.source_url,
    request_at: record.request_at, response_at: record.response_at };
  if (record.error) return { ...base, status: 'ERROR', error: String(record.error).slice(0,200), candles: [], metrics: {} };
  if (record.http_status !== 200 || typeof record.raw_text !== 'string' || Buffer.byteLength(record.raw_text) > 2_000_000
      || !Number.isFinite(Date.parse(record.request_at)) || !Number.isFinite(Date.parse(record.response_at))
      || Date.parse(record.response_at) < Date.parse(record.request_at) || Date.parse(record.response_at) > atMs + 5000) throw new Error('Invalid source response');
  const rows = JSON.parse(record.raw_text);
  if (!Array.isArray(rows) || rows.length > 2000) throw new Error('Invalid candle response');
  const byTime = new Map();
  let excludedIncomplete = 0;
  // A response fetched just before midnight must not become a completed
  // candle merely because the last asset finishes after midnight.
  const cutoffMs = Math.min(atMs,Date.parse(record.request_at));
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 6 || !row.every(isNumber)
        || !Number.isSafeInteger(row[0]) || row[0] < 0 || row[0] % DAY !== 0
        || row.slice(1,5).some((x) => x <= 0) || row[5] < 0
        || row[1] > Math.min(row[3],row[4]) || row[2] < Math.max(row[3],row[4]) || row[1] > row[2]) throw new Error('Invalid OHLCV row');
    if (byTime.has(row[0])) throw new Error('Duplicate candle timestamp');
    byTime.set(row[0], row);
  }
  const completed = [];
  for (const row of byTime.values()) {
    if ((row[0] + DAY) * 1000 > cutoffMs) { excludedIncomplete++; continue; }
    completed.push({ time: row[0], low: row[1], high: row[2], open: row[3], close: row[4], volume: row[5] });
  }
  completed.sort((a,b) => a.time - b.time);
  const candles = completed.slice(-90);
  if (!candles.length) throw new Error('No completed candles');
  const last = candles.at(-1);
  const findAgo = (days) => candles.find((c) => c.time === last.time - DAY*days);
  const change = (days) => findAgo(days) ? (last.close / findAgo(days).close - 1)*100 : null;
  let gaps = 0;
  for (let i=1;i<candles.length;i++) gaps += (candles[i].time-candles[i-1].time)/DAY - 1;
  const recent = candles.slice(-20);
  const consecutive20 = recent.length === 20 && recent.every((c,i) => !i || c.time - recent[i-1].time === DAY);
  const returns = recent.slice(1).map((c,i) => Math.log(c.close / recent[i].close));
  const mean = returns.reduce((a,b) => a+b,0)/Math.max(returns.length,1);
  const volatility = consecutive20 ? Math.sqrt(returns.reduce((a,b) => a+(b-mean)**2,0)/returns.length)*100 : null;
  return { ...base, status: 'READY', raw_sha256: hash(record.raw_text), candles,
    excluded_incomplete: excludedIncomplete, coverage: { gap_count: gaps, returned_rows: rows.length,
      completed_rows: completed.length, displayed_rows: candles.length },
    metrics: { last_close: last.close, one_day_change_pct: change(1), seven_day_change_pct: change(7),
      sma20: consecutive20 ? recent.reduce((a,c) => a+c.close,0)/20 : null, volatility_daily_pct: volatility } };
}

export function prepareMarketSnapshot(collection) {
  if (!plain(collection) || collection.schema !== 'shadow-market-collection/1'
      || !['PUBLIC_API_SNAPSHOT','SYNTHETIC_TEST'].includes(collection.mode)
      || !Array.isArray(collection.assets) || collection.assets.length !== 6
      || !Number.isFinite(Date.parse(collection.fetched_at))) throw new Error('Invalid collection');
  if (new Set(collection.assets.map((a) => a.symbol)).size !== 6) throw new Error('Duplicate/missing assets');
  const assets = collection.assets.map((record) => {
    try { return normalizeMarketAsset(record, Date.parse(collection.fetched_at)); }
    catch (error) { return { symbol: record.symbol, status: 'ERROR', error: error.message, candles: [], metrics: {} }; }
  });
  if (assets.some((a) => !MARKET_SYMBOLS.includes(a.symbol))) throw new Error('Unsupported asset');
  return { schema: 'shadow-market-snapshot/1', snapshot_id: hash(JSON.stringify(collection)),
    fetched_at: collection.fetched_at, mode: collection.mode, source: { provider: 'Coinbase Exchange (declared)',
      provenance: collection.mode === 'SYNTHETIC_TEST' ? 'SYNTHETIC_TEST_DATA'
        : 'DECLARED_SOURCE_LOCAL_FILE_UNAUTHENTICATED' }, assets };
}

export function createResearchCockpitServer({ collection, outputDir, ledgerDir }) {
  const snapshot = prepareMarketSnapshot(collection);
  for (const path of [outputDir,ledgerDir]) mkdirSync(path,{recursive:true,mode:0o700});
  const output = realpathSync(outputDir);
  const ledger = realpathSync(ledgerDir);
  const auth = generateKeyPairSync('ed25519');
  const capture = generateKeyPairSync('ed25519');
  const runId = 'research-' + randomUUID();
  const token = randomBytes(32).toString('hex');
  const receipts = new Map();
  const writer = createControlledWriter({ roots: { research: output }, ledgerDir: ledger,
    actorId: 'local-demo-operator-declared', runId,
    authorizationPublicKey: auth.publicKey, capturePrivateKey: capture.privateKey });
  const staticDir = fileURLToPath(new URL('../demos/research-cockpit/',import.meta.url));
  const pub = (key) => key.export({type:'spki',format:'pem'});
  const send = (res,status,data,type='application/json; charset=utf-8',exact=false) => {
    res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy':'no-referrer'});
    res.end(!exact && type.startsWith('application/json') ? JSON.stringify(data) : data);
  };
  const server = createServer(async (req,res) => {
    try {
      const port = server.address().port;
      const origins = [`http://127.0.0.1:${port}`,`http://localhost:${port}`];
      if (!origins.some((o) => new URL(o).host === req.headers.host)) return send(res,403,{error:'HOST_REJECTED'});
      const url = new URL(req.url,origins[0]);
      if (req.method === 'GET' && url.pathname === '/api/state') return send(res,200,{
        snapshot,request_token:token,boundaries:{model:'NOT_CONNECTED',trading:'DISABLED',grant_profile:'EPHEMERAL_DEMO_ISSUER'},
        receipts:[...receipts.values()].map(({receipt})=>receipt).reverse() });
      if (req.method === 'POST' && url.pathname === '/api/record') {
        if (!origins.includes(req.headers.origin) || req.headers['x-shadow-token'] !== token
            || req.headers['content-type']?.split(';')[0] !== 'application/json') return send(res,403,{error:'LOCAL_REQUEST_REJECTED'});
        if (receipts.size >= 100) return send(res,429,{error:'DEMO_RECORD_LIMIT'});
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body)>4096) return send(res,413,{error:'REQUEST_TOO_LARGE'}); }
        let input; try { input=JSON.parse(body); } catch {return send(res,400,{error:'INVALID_JSON'});}
        if (!plain(input) || Object.keys(input).sort().join(',') !== 'snapshot_id,symbol'
            || input.snapshot_id !== snapshot.snapshot_id) return send(res,409,{error:'SNAPSHOT_OR_INPUT_MISMATCH'});
        const asset = snapshot.assets.find((a)=>a.symbol===input.symbol && a.status==='READY');
        if (!asset) return send(res,400,{error:'ASSET_UNAVAILABLE'});
        const id = randomUUID();
        const filename = 'research-' + id + '.json';
        const report = { schema:'shadow-local-research-record/1',created_at:new Date().toISOString(),
          snapshot_id:snapshot.snapshot_id,mode:snapshot.mode,source:snapshot.source,asset,
          model_status:'NOT_CONNECTED',trading_status:'DISABLED',prediction_status:'NOT_EVALUATED',
          note:'Historical completed daily candles and descriptive metrics. No forecast or order.' };
        const content = JSON.stringify(report,null,2)+'\n';
        const now = Date.now();
        const grant = signWriteGrant({schema:GRANT_SCHEMA,grant_id:id,run_id:runId,
          actor_id:'local-demo-operator-declared',invocation_id:id,
          action:describeWrite({rootId:'research',filename,content}),not_before_ms:now-1000,expires_at_ms:now+60000,max_attempts:1},auth.privateKey);
        const result = writer({root_id:'research',filename,content,invocation_id:id,grant_envelope:grant});
        const review = reviewControlledWrite(result.bundle,{capturePublicKey:capture.publicKey,authorizationPublicKey:auth.publicKey});
        const envelope = {schema:'shadow-research-review-download/1',bundle:result.bundle,
          capture_public_key:pub(capture.publicKey),authorization_public_key:pub(auth.publicKey),
          key_provenance:'EPHEMERAL_DEMO_ISSUER',report_sha256:hash(content),report_utf8:content,report};
        writeFileSync(join(output,'receipt-'+id+'.json'),JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o600});
        const receipt = {id,symbol:asset.symbol,filename,created_at:report.created_at,review,
          grant_profile:'EPHEMERAL_DEMO_ISSUER',bundle_url:'/api/download/'+id+'/bundle.json',report_url:'/api/download/'+id+'/report.json'};
        receipts.set(id,{receipt,envelope,content});
        return send(res,201,receipt);
      }
      const download = /^\/api\/download\/([0-9a-f-]{36})\/(bundle\.json|report\.json)$/.exec(url.pathname);
      if (req.method === 'GET' && download) {
        const [, id, name] = download;
        const saved = receipts.get(id);
        if (!saved || !['bundle.json','report.json'].includes(name)) return send(res,404,{error:'NOT_FOUND'});
        return name==='bundle.json' ? send(res,200,saved.envelope)
          : send(res,200,saved.content,'application/json; charset=utf-8',true);
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/receipts/')) {
        const saved=receipts.get(url.pathname.slice('/api/receipts/'.length));
        return send(res,saved?200:404,saved?.receipt??{error:'NOT_FOUND'});
      }
      const files = {'/':['index.html','text/html; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8']};
      if (req.method==='GET' && files[url.pathname]) {
        const [name,type]=files[url.pathname];return send(res,200,readFileSync(join(staticDir,name)),type);
      }
      return send(res,404,{error:'NOT_FOUND'});
    } catch { if(!res.headersSent) return send(res,500,{error:'LOCAL_RESEARCH_OPERATION_FAILED'});res.end(); }
  });
  return server;
}
