const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const readOnly = Object.prototype.hasOwnProperty.call(window, 'SHADOW_READONLY_STATE');
const state = { payload: null, selected: null, days: 60, receipts: [], busy: false, loading: false, candles: [] };
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 5 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const shortDate = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function svgEl(tag, attrs = {}) { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); return node; }
function set(id, value) { $(id).textContent = value; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function price(value) { return finite(value) ? usd.format(value) : '—'; }
function assetLabel(symbol) { return String(symbol || '未知资产').replace(/-USD$/, ''); }
function percent(value) { return finite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—'; }
function polarity(value) { return !finite(value) || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative'; }
function date(value) { if (!value) return '—'; const d = new Date(typeof value === 'number' ? value * 1000 : value); return Number.isFinite(d.getTime()) ? `${fullDate.format(d)} UTC` : '—'; }
function apiPath(value, kind) { if (typeof value !== 'string') return null; const pattern = kind === 'bundle' ? /^\/api\/download\/[A-Za-z0-9_-]+\/bundle\.json$/ : /^\/api\/download\/[A-Za-z0-9_-]+\/report\.json$/; return pattern.test(value) ? value : null; }
function publicUrl(value) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null; } catch { return null; } }
function validCandles(asset) { return Array.isArray(asset?.candles) ? asset.candles.filter(c => c && ['time', 'open', 'high', 'low', 'close'].every(k => finite(c[k])) && c.time > 0 && Number.isFinite(new Date(c.time * 1000).getTime()) && c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close, c.high)).slice().sort((a, b) => a.time - b.time) : []; }
function selectedAsset() { return state.payload?.snapshot?.assets?.find(asset => asset.symbol === state.selected) ?? null; }
function message(id, text, error = false) { const node = $(id); node.textContent = text; node.hidden = !text; node.classList.toggle('error', error); }

function renderAssets() {
  const grid = $('asset-grid'); grid.replaceChildren();
  const assets = state.payload?.snapshot?.assets;
  if (!Array.isArray(assets) || !assets.length) {
    for (let i = 0; i < 6; i++) { const card = el('div', 'asset-card'); const top = el('div', 'asset-card-top'); top.append(el('span', 'asset-symbol', '— / USD'), el('span', 'status-dot')); card.append(top, el('strong', 'asset-card-price', '—')); const bottom = el('div', 'asset-card-bottom'); bottom.append(el('span', 'card-caption', state.loading ? '读取数据中' : '暂无公开数据')); card.append(bottom); grid.append(card); }
    return;
  }
  assets.forEach(asset => {
    const ready = asset.status === 'READY' && validCandles(asset).length > 0;
    const card = el('button', `asset-card${asset.symbol === state.selected ? ' selected' : ''}`); card.type = 'button'; card.setAttribute('aria-pressed', String(asset.symbol === state.selected)); card.setAttribute('aria-label', `${asset.symbol}，${ready ? '查看公开行情' : '数据不可用'}`);
    const top = el('div', 'asset-card-top'); const name = el('span', 'asset-symbol'); name.append(el('span', 'asset-coin', String(asset.symbol || '?').slice(0, 1)), document.createTextNode(assetLabel(asset.symbol)), el('small', '', '/ USD')); top.append(name, el('span', `status-dot ${ready ? 'ready' : 'error'}`));
    const bottom = el('div', 'asset-card-bottom'); bottom.append(el('span', `change ${polarity(asset.metrics?.one_day_change_pct)}`, ready ? percent(asset.metrics?.one_day_change_pct) : '获取失败'));
    const candles = validCandles(asset).slice(-25);
    if (ready && candles.length > 1) { const spark = svgEl('svg', { viewBox: '0 0 90 24', 'aria-hidden': 'true' }); const values = candles.map(c => c.close), min = Math.min(...values), span = Math.max(...values) - min || 1; const path = values.map((value, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1) * 90).toFixed(2)},${(21 - (value - min) / span * 18).toFixed(2)}`).join(' '); spark.append(svgEl('path', { d: path, fill: 'none', stroke: values.at(-1) >= values[0] ? '#88c8ad' : '#cd8c91', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); bottom.append(spark); }
    card.append(top, el('strong', 'asset-card-price', ready ? price(asset.metrics?.last_close ?? candles.at(-1)?.close) : '—'), bottom);
    if (!ready) card.append(el('span', 'asset-error', String(asset.error || '未获取到有效日线')));
    card.addEventListener('click', () => { state.selected = asset.symbol; message('record-message', ''); renderAssets(); renderSelection(); }); grid.append(card);
  });
}

function renderSelection() {
  const asset = selectedAsset(); const candles = validCandles(asset); const ready = asset?.status === 'READY' && candles.length > 0;
  const title = $('chart-title'); title.replaceChildren(document.createTextNode(asset ? assetLabel(asset.symbol) : '选择资产'), el('span', 'quote-currency', ' / USD'));
  set('main-price', ready ? price(asset.metrics?.last_close ?? candles.at(-1)?.close) : '—');
  const change = $('main-change'); change.textContent = ready ? percent(asset.metrics?.one_day_change_pct) : '—'; change.className = `change ${ready ? polarity(asset.metrics?.one_day_change_pct) : 'neutral'}`;
  set('price-caption', ready ? `最新已完成日线收盘价 · ${shortDate.format(new Date(candles.at(-1).time * 1000))} UTC` : '最新已完成日线收盘价');
  set('metric-seven', ready ? percent(asset.metrics?.seven_day_change_pct) : '—'); $('metric-seven').className = ready ? `change ${polarity(asset.metrics?.seven_day_change_pct)}` : '';
  set('metric-sma', ready ? price(asset.metrics?.sma20) : '—'); set('metric-volatility', ready && finite(asset.metrics?.volatility_daily_pct) ? `${asset.metrics.volatility_daily_pct.toFixed(2)}%` : '—'); set('metric-excluded', ready && Number.isInteger(asset.excluded_incomplete) ? `${asset.excluded_incomplete} 根` : '—');
  const synthetic = state.payload?.snapshot?.mode === 'SYNTHETIC_TEST';
  const source = publicUrl(asset?.source_url); const link = $('source-link'); link.textContent = state.payload?.snapshot?.source?.provider || (source ? source.hostname : '来源不可用'); if (source) link.href = source.href; else link.removeAttribute('href');
  set('source-label', synthetic ? '合成测试数据' : '行情来源声明');
  set('source-provenance', synthetic ? '仅用于测试界面与记录流程，不代表市场行情' : state.payload?.snapshot?.source?.provenance === 'DECLARED_SOURCE_LOCAL_FILE_UNAUTHENTICATED' ? '本地抓取文件声明来源；未取得提供方签名' : '尚未确认来源证明方式');
  set('request-time', date(asset?.request_at)); set('response-time', `返回时间 ${date(asset?.response_at)}`); set('source-hash', typeof asset?.raw_sha256 === 'string' ? asset.raw_sha256 : '未取得原始响应摘要'); set('source-status', ready ? '已捕获快照' : '数据不可用');
  $('record-button').disabled = readOnly || !ready || state.busy || state.loading || !state.payload?.snapshot?.snapshot_id || !state.payload?.request_token;
  set('record-help', readOnly ? '只读快照：展示本次本地核验记录；保存功能需运行本地服务' : ready ? `${synthetic ? '保存合成测试记录' : '保存当前快照，不重新请求行情'}；模型与交易均未接入` : '获取有效快照后可以保存');
  renderChart();
}

function renderChart() {
  const svg = $('market-chart'); const empty = $('chart-empty'); const tooltip = $('chart-tooltip'); tooltip.hidden = true;
  svg.replaceChildren(svgEl('title', { id: 'svg-title' }), svgEl('desc', { id: 'svg-description' })); svg.querySelector('title').textContent = `${state.selected || '资产'} 近 ${state.days} 个已完成自然日日线`; svg.querySelector('desc').textContent = '来自本次公共数据快照。每根蜡烛表示一天的开盘、最高、最低与收盘价格。缺失日期留空，不插值。';
  const asset = selectedAsset(); const all = validCandles(asset); const latest = all.at(-1)?.time; const candles = latest ? all.filter(c => c.time >= latest - (state.days - 1) * 86400) : [];
  state.candles = candles;
  if (asset?.status !== 'READY' || !candles.length) { empty.hidden = false; empty.querySelector('strong').textContent = state.loading ? '正在读取行情快照' : '暂无可展示的行情数据'; empty.querySelector('span:last-child').textContent = asset?.error ? String(asset.error) : '成功获取公开数据后，这里会显示真实日线'; set('chart-coverage', '数据覆盖 —'); return; }
  empty.hidden = true;
  const width = Math.max($('chart-area').clientWidth, 250), height = Math.max($('chart-area').clientHeight, 180); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const margin = { left: 5, right: 65, top: 10, bottom: 25 }; const plotWidth = width - margin.left - margin.right, plotHeight = height - margin.top - margin.bottom;
  const low = Math.min(...candles.map(c => c.low)), high = Math.max(...candles.map(c => c.high)), padding = (high - low || Math.max(high * .02, .01)) * .12, min = Math.max(0, low - padding), max = high + padding;
  const start = latest - (state.days - 1) * 86400, dayWidth = plotWidth / state.days; const x = t => margin.left + ((t - start) / 86400 + .5) * dayWidth; const y = p => margin.top + (max - p) / (max - min) * plotHeight;
  for (let i = 0; i < 5; i++) { const py = margin.top + i / 4 * plotHeight, value = max - (max - min) * i / 4; svg.append(svgEl('line', { x1: margin.left, x2: width - margin.right + 1, y1: py, y2: py, class: 'chart-grid-line' })); const label = svgEl('text', { x: width - margin.right + 10, y: py + 3.5, class: 'chart-axis-label' }); label.textContent = value >= 1000 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value) : number.format(value); svg.append(label); }
  const ticks = width < 450 ? 3 : 5;
  for (let i = 0; i < ticks; i++) { const t = start + Math.round(i * (state.days - 1) / (ticks - 1)) * 86400; const label = svgEl('text', { x: x(t), y: height - 4, class: 'chart-axis-label', 'text-anchor': i === 0 ? 'start' : i === ticks - 1 ? 'end' : 'middle' }); label.textContent = shortDate.format(new Date(t * 1000)); svg.append(label); }
  const last = candles.at(-1); svg.append(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: y(last.close), y2: y(last.close), class: 'chart-current-line' }));
  candles.forEach(c => { const color = c.close >= c.open ? '#8ac6ac' : '#ca8c92'; const candle = svgEl('g', { 'aria-label': `${shortDate.format(new Date(c.time * 1000))}，开盘 ${price(c.open)}，最高 ${price(c.high)}，最低 ${price(c.low)}，收盘 ${price(c.close)}` }); const px = x(c.time); candle.append(svgEl('line', { x1: px, x2: px, y1: y(c.high), y2: y(c.low), stroke: color, 'stroke-width': 1 }), svgEl('rect', { x: px - Math.max(1.5, dayWidth * .55) / 2, y: Math.min(y(c.open), y(c.close)), width: Math.max(1.5, dayWidth * .55), height: Math.max(1, Math.abs(y(c.open) - y(c.close))), rx: .5, fill: color })); svg.append(candle); });
  const hoverLine = svgEl('line', { x1: 0, x2: 0, y1: margin.top, y2: height - margin.bottom, class: 'chart-hover-line', visibility: 'hidden' }); svg.append(hoverLine);
  const surface = svgEl('rect', { x: margin.left, y: margin.top, width: plotWidth, height: plotHeight, fill: 'transparent', tabindex: '0', 'aria-label': '图表详情：左右方向键切换日线，移出图表关闭提示' }); svg.append(surface);
  let focusIndex = candles.length - 1;
  function show(index) { focusIndex = Math.max(0, Math.min(candles.length - 1, index)); const c = candles[focusIndex], px = x(c.time); hoverLine.setAttribute('x1', px); hoverLine.setAttribute('x2', px); hoverLine.setAttribute('visibility', 'visible'); tooltip.replaceChildren(el('div', 'tooltip-date', `${shortDate.format(new Date(c.time * 1000))} · UTC`)); [['开盘', c.open], ['最高', c.high], ['最低', c.low], ['收盘', c.close]].forEach(([name, value]) => { const row = el('div', 'tooltip-value'); row.append(el('span', '', name), el('span', '', price(value))); tooltip.append(row); }); tooltip.style.left = `${Math.max(4, Math.min(width - 182, px + (px > width * .55 ? -188 : 12)))}px`; tooltip.style.top = '12px'; tooltip.hidden = false; }
  function hide() { tooltip.hidden = true; hoverLine.setAttribute('visibility', 'hidden'); }
  surface.addEventListener('pointermove', event => { const rect = svg.getBoundingClientRect(), pointer = (event.clientX - rect.left) * width / rect.width; let closest = 0; candles.forEach((c, i) => { if (Math.abs(x(c.time) - pointer) < Math.abs(x(candles[closest].time) - pointer)) closest = i; }); show(closest); }); surface.addEventListener('pointerleave', hide); surface.addEventListener('focus', () => show(focusIndex)); surface.addEventListener('blur', hide); surface.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(focusIndex + (event.key === 'ArrowLeft' ? -1 : 1)); } if (event.key === 'Escape') hide(); });
  const gapCount = asset.coverage?.gap_count; set('chart-coverage', `${candles.length} 根已完成日线${Number.isInteger(gapCount) ? ` · 全量缺失 ${gapCount} 天` : ''}`);
}

function statusText(value) { const labels={VALID_CAPTURE_SIGNATURE:'演示签名通过',GRANT_MATCH:'许可参数一致',CONSISTENT:'记录一致',LOCAL_READBACK_MATCH:'本地文件匹配',INVALID:'签名无效',INCONSISTENT:'记录矛盾',ACTION_MISMATCH:'许可参数不符',LOCAL_READBACK_MISMATCH:'文件不匹配',NOT_EVALUATED:'未核验',UNCONFIRMED:'尚未确认'}; if (value === undefined || value === null) return '未提供'; if (labels[value]) return labels[value]; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); try { return JSON.stringify(value); } catch { return '无法读取'; } }
function statusClass(value) { const text = String(value??'').toUpperCase(); if (value === true || ['PASS', 'VALID', 'OK', 'VERIFIED', 'MATCH', 'BOUND','VALID_CAPTURE_SIGNATURE','GRANT_MATCH','CONSISTENT','LOCAL_READBACK_MATCH'].includes(text)) return ''; if (value === false || /FAIL|INVALID|MISMATCH|ERROR|REJECT|INCONSISTENT/.test(text)) return ' failed'; return ' unknown'; }
function renderReceipts() {
  const list = $('receipts'); list.replaceChildren(); $('receipt-empty').hidden = state.receipts.length > 0; set('record-count', `${state.receipts.length} 份记录`);
  state.receipts.slice().reverse().forEach(receipt => {
    const item = el('article', 'receipt-item'); const identity = el('div', 'receipt-identity'); const text = el('div'); text.append(el('strong', '', `${receipt.symbol || '资产'} · 研究记录`), el('span', 'receipt-id', receipt.id || receipt.filename || '未提供记录 ID')); identity.append(el('span', 'receipt-icon', '↳'), text);
    const checks = el('div', 'receipt-checks'); [['完整性', 'integrity'], ['许可绑定', 'grant_binding'], ['捕获结构', 'capture_shape'], ['本地读回', 'effect']].forEach(([label, key]) => { const value = receipt.review?.[key]; const pill = el('span', `check-pill${statusClass(value)}`, `${label} · ${statusText(value)}`); pill.title = `${label}: ${statusText(value)}`; checks.append(pill); });
    const actions = el('div', 'receipt-actions'); if (!readOnly) [['证据包 ↗', receipt.bundle_url, 'bundle'], ['检查报告 ↗', receipt.report_url, 'report']].forEach(([label, url, kind]) => { const path = apiPath(url, kind); if (path) { const link = el('a', '', label); link.href = path; link.target = '_blank'; link.rel = 'noopener'; actions.append(link); } });
    const details = el('div', 'receipt-details', `${readOnly ? '本次本地核验记录；此只读页面未独立重新验签。' : ''}许可签发配置：${receipt.grant_profile || '未提供'} · 检查结果只描述该次保存与本地读回，不证明行情准确性、完整捕获或独立执行真实性。`);
    item.append(identity, checks, actions, details); list.append(item);
  });
}

async function loadState() {
  if (state.loading || state.busy) return;
  state.loading = true; $('refresh-button').disabled = true; message('global-message', ''); if (!state.payload) renderAssets(); renderSelection();
  try {
    let payload;
    if (readOnly) payload = window.SHADOW_READONLY_STATE;
    else { const response = await fetch('/api/state', { cache: 'no-store', headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(`快照接口返回 HTTP ${response.status}`); payload = await response.json(); }
    if (!payload || payload.snapshot?.schema !== 'shadow-market-snapshot/1' || !Array.isArray(payload.snapshot.assets)) throw new Error('快照格式不符合约定，未加载数据');
    state.payload = payload; const assets = payload.snapshot.assets; if (!assets.some(asset => asset.symbol === state.selected)) state.selected = (assets.find(asset => asset.status === 'READY' && validCandles(asset).length) || assets[0])?.symbol ?? null;
    state.receipts = Array.isArray(payload.receipts) ? payload.receipts.filter(receipt => receipt && typeof receipt === 'object') : [];
    const synthetic = payload.snapshot.mode === 'SYNTHETIC_TEST';
    const count = assets.filter(asset => asset.status === 'READY' && validCandles(asset).length).length; set('snapshot-status', `${readOnly ? '只读 · ' : ''}${synthetic ? `合成测试快照 · ${count} / ${assets.length} 个资产可用 · 非市场数据` : count ? `公开数据快照 · ${count} / ${assets.length} 个资产可用` : '快照中暂无可用行情'}`); $('snapshot-dot').className = `status-dot ${count ? 'ready' : 'error'}`; set('snapshot-time', `快照时间 ${date(payload.snapshot.fetched_at)}`); set('snapshot-id', `SNAPSHOT / ${payload.snapshot.snapshot_id || '—'}`);
    document.querySelector('.plain-tag').textContent = synthetic ? 'SYNTHETIC TEST DATA' : 'PUBLIC SNAPSHOT';
    if (synthetic) message('global-message', '当前为合成测试数据，只用于验证图表与研究记录流程，不代表实际市场价格。');
    if (!count) message('global-message', '未获得可用的公开行情数据。保留空状态，不使用模拟价格。');
    if (payload.boundaries?.model !== 'NOT_CONNECTED' || payload.boundaries?.trading !== 'DISABLED') message('global-message', '接口未确认「模型未接入、交易已关闭」的演示边界，请核对服务配置。');
    if (readOnly) message('global-message', `${synthetic ? '包含合成测试数据，非市场价格。' : ''}这是已保存的只读快照，不发送网络请求。下方结果为本次本地核验记录，浏览器未独立重新验签；不能在此页面签名保存新记录。`);
  } catch (error) {
    state.payload = null; state.selected = null; state.receipts = []; set('snapshot-status', readOnly ? '只读快照无法读取' : '快照连接失败'); $('snapshot-dot').className = 'status-dot error'; set('snapshot-time', '快照时间 —'); set('snapshot-id', 'SNAPSHOT / —'); message('global-message', `${error.message || '无法连接数据服务'}。${readOnly ? '未载入替代数据，未发送网络请求。' : '未展示模拟行情，可在服务恢复后重新读取。'}`, true);
  } finally { state.loading = false; $('refresh-button').disabled = false; renderAssets(); renderSelection(); renderReceipts(); }
}

async function record() {
  const asset = selectedAsset(); if (readOnly || state.busy || state.loading || asset?.status !== 'READY' || !state.payload?.request_token) return;
  state.busy = true; renderSelection(); $('record-button').querySelector('span').textContent = '正在保存记录'; message('record-message', '');
  try {
    const response = await fetch('/api/record', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shadow-Token': state.payload.request_token }, body: JSON.stringify({ symbol: asset.symbol, snapshot_id: state.payload.snapshot.snapshot_id }) });
    let result; try { result = await response.json(); } catch { throw new Error(`保存接口未返回有效 JSON（HTTP ${response.status}）`); }
    if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : `保存失败（HTTP ${response.status}）`);
    if (!result?.id || !result?.review) throw new Error('返回结果缺少记录 ID 或检查报告，未计入已保存记录');
    state.receipts = [...state.receipts.filter(receipt => receipt.id !== result.id), result]; renderReceipts(); message('record-message', '研究记录已保存。请查看下方检查结果与证据包，确认本次保存的核对范围。');
  } catch (error) { message('record-message', error.message || '保存失败，未确认生成记录', true); }
  finally { state.busy = false; $('record-button').querySelector('span').textContent = '保存研究记录'; renderSelection(); }
}

document.querySelectorAll('[data-days]').forEach(button => { button.setAttribute('aria-pressed', String(Number(button.dataset.days) === state.days)); button.addEventListener('click', () => { state.days = Number(button.dataset.days); document.querySelectorAll('[data-days]').forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', String(other === button)); }); renderChart(); }); });
if (readOnly) { $('refresh-button').querySelector('span').textContent = '重读保存快照'; $('record-button').querySelector('span').textContent = '只读快照 · 保存已禁用'; set('records-title', '本次本地核验记录'); document.querySelector('.page-heading p').textContent = '查看已保存的公开行情快照与本次本地核验记录。此页面不会发送网络请求。'; document.querySelector('.local-tag').lastChild.textContent = '只读快照'; }
$('refresh-button').addEventListener('click', loadState); $('record-button').addEventListener('click', record); new ResizeObserver(() => renderChart()).observe($('chart-area')); renderAssets(); renderReceipts(); loadState();
