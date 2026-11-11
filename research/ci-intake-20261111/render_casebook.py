"""Render the persisted CI intake research results as a static, offline casebook."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent


def load_casebook() -> dict:
    results = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    catalog_bytes = (HERE / "case-catalog.json").read_bytes()
    catalog = json.loads(catalog_bytes)
    opa = json.loads((HERE / "opa-reference/results.json").read_text(encoding="utf-8"))
    if results["source_sha256"]["case-catalog.json"] != sha256(catalog_bytes).hexdigest():
        raise ValueError("the saved result was generated with a different case catalog")
    authored = {row["id"]: row for row in catalog["cases"]}
    comparisons = {row["case"]: row for row in opa["rows"]}
    rows = results["rows"]
    case_ids = {row["case"] for row in rows}
    if (
        case_ids != authored.keys()
        or case_ids != comparisons.keys()
        or len(case_ids) != len(rows)
        or len(case_ids) != len(catalog["cases"])
        or len(case_ids) != len(opa["rows"])
        or len(case_ids) != results["authored_case_count"]
        or len(case_ids) != opa["authored_cases"]
    ):
        raise ValueError("saved case identifiers or counts disagree")
    joined = []
    for row in rows:
        reference = authored[row["case"]]
        comparison = comparisons[row["case"]]
        if row["authored_expected"] != reference["decision"] or comparison["authored_expected"] != reference["decision"]:
            raise ValueError(f"expected disposition disagrees for {row['case']}")
        if comparison["pipeline_decision"] != row["admitted"]:
            raise ValueError(f"saved combined pipeline decision disagrees for {row['case']}")
        policy_result = comparison.get("opa_application_result")
        joined.append({**row, "why": reference["why"], "opa_policy": policy_result})
    return {
        "cases": joined,
        "metrics": results["metrics"],
        "public": results["separate_public_metadata_check"],
        "opa": {
            "version": opa["opa"]["version"],
            "common_gate_withheld": opa["common_gate_withheld"],
            "actual_evaluations": opa["actual_opa_evaluations"],
            "policy_agreement": opa["opa_decision_agreement_with_python_on_admitted"],
            "combined_agreement": opa["common_gate_plus_opa_agreement_with_authored"],
            "numeric": opa["separate_numeric_controls"],
        },
    }


def embed_json(value: dict) -> str:
    """Encode JSON for an HTML script data block without allowing its end tag."""
    return (
        json.dumps(value, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
        .replace("<", r"\u003c")
        .replace(">", r"\u003e")
        .replace("&", r"\u0026")
    )


PAGE = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Shadow | CI 证据案例册</title>
  <style>
    :root{color-scheme:light;--bg:#f2f5fa;--surface:#fff;--ink:#14263d;--muted:#506279;--line:#dae2ef;--accent:#1e4f88;--navy:#0a2038}
    *{box-sizing:border-box}
    body{margin:0;color:var(--ink);background:var(--bg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
    header{color:white;background:linear-gradient(115deg,#0a2038,#123861);padding:42px 24px 35px;border-bottom:4px solid #5c9fe5}
    .shell{max-width:1130px;margin:auto}
    .eyebrow{font-size:.78rem;font-weight:750;letter-spacing:.15em;color:#9fd2ff}
    h1{font-size:clamp(2rem,5vw,3.2rem);margin:.3rem 0 .55rem;line-height:1.12;letter-spacing:-.035em}
    h2{margin:0 0 .6rem;font-size:1.22rem;letter-spacing:-.015em}
    h3{margin:1.2rem 0 .5rem;font-size:.96rem}
    p{margin:0 0 .75rem}
    .lead{color:#d7e7f8;max-width:720px;font-size:1.03rem}
    .tag{display:inline-block;font-size:.8rem;font-weight:650;border:1px solid #6796bf;border-radius:999px;color:#e3f1ff;padding:3px 10px}
    main{padding:22px 20px 32px}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:18px}
    .metric,.panel{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:17px 18px}
    .metric{border-top:3px solid #8ca7c8}
    .metric:last-child{border-top-color:#3d8568}
    .metric-name{font-size:.86rem;color:var(--muted);font-weight:650}
    .metric-num{font-weight:780;font-size:1.9rem;line-height:1.25;font-variant-numeric:tabular-nums}
    .metric-note,.small{font-size:.84rem;color:var(--muted)}
    .grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:15px;align-items:start}
    .stack{display:grid;gap:15px}
    label{display:block;font-weight:650;margin-bottom:5px}
    .picker{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;margin-bottom:12px}
    button,select{border:1px solid #9cafc7;border-radius:8px;background:#fff;color:var(--ink);min-height:42px;font:inherit}
    button{padding:0 10px;cursor:pointer}
    button:hover:not(:disabled){background:#ebf3ff}
    button:disabled{cursor:default;opacity:.5}
    select{padding:0 7px;width:100%}
    :focus-visible{outline:3px solid #447ebc;outline-offset:2px}
    .caption{font-size:.9rem;color:var(--muted);min-height:2.8rem}
    .verdicts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .vcard{background:#f6f8fc;border:1px solid var(--line);border-radius:10px;padding:9px 10px}
    .vcard .small{display:block;margin-bottom:5px;font-weight:620}
    .pill{display:inline-block;border-radius:999px;padding:3px 8px;font-size:.76rem;font-weight:750;white-space:nowrap}
    .accept{color:#13563d;background:#def3e7}
    .reject{color:#87302c;background:#fde7e5}
    .withhold{color:#6d4400;background:#fff0cc}
    .neutral{color:#364f6a;background:#e9eff6}
    .details{margin-top:12px;border-left:3px solid #6796bf;padding-left:10px}
    .details p{margin:.24rem 0}
    code{font: .82em ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
    .table-wrap{overflow-x:auto}
    table{border-collapse:collapse;width:100%;font-size:.84rem}
    th,td{text-align:left;border-bottom:1px solid var(--line);padding:6px 7px;vertical-align:top}
    th{background:#f5f8fc;color:var(--muted);font-weight:680;white-space:nowrap}
    .digest{margin:.35rem 0;color:var(--muted);font-size:.79rem}
    .digest code{display:block;color:var(--ink)}
    footer{margin:15px 0 0;font-size:.82rem;color:var(--muted)}
    @media(max-width:770px){.grid{grid-template-columns:minmax(0,1fr)}}
    @media(max-width:520px){main{padding:14px 10px 23px}header{padding:30px 14px 24px}.metrics{gap:6px}.metric,.panel{padding:12px}.metric-name,.metric-note{font-size:.75rem}.metric-num{font-size:1.55rem}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <header>
    <div class="shell">
      <div class="eyebrow">SHADOW / RESEARCH CASEBOOK</div>
      <h1>CI 证据案例册</h1>
      <p class="lead">选择一个案例，比较作业汇总、类型化报告与证据绑定后的判定，看看同一个绿灯为什么有时应当暂缓。</p>
      <span class="tag">离线 · 只读 · 不运行 CI</span>
    </div>
  </header>
  <main class="shell">
    <noscript><p>此离线案例册需要启用 JavaScript 以查看保存的结果。</p></noscript>
    <section class="metrics" id="metrics" aria-label="人工对照汇总"></section>
    <p class="small" id="denominator"></p>
    <div class="grid">
      <section class="panel" aria-labelledby="cases-title">
        <h2 id="cases-title">人工构造的对照案例</h2>
        <label for="case">选择案例</label>
        <div class="picker">
          <select id="case"></select>
          <button id="prev" type="button" aria-label="上一个案例">←</button>
          <button id="next" type="button" aria-label="下一个案例">→</button>
        </div>
        <p class="caption" id="why"></p>
        <div class="verdicts" id="verdicts" aria-live="polite"></div>
        <div class="details" id="reasons"></div>
        <h3>步骤记录</h3>
        <div id="native" class="table-wrap"></div>
        <h3>应用检查</h3>
        <div id="checks" class="table-wrap"></div>
        <h3>报告摘要（SHA-256）</h3>
        <div id="digests"></div>
      </section>
      <aside class="stack" aria-label="单独报告的对照">
        <section class="panel" aria-labelledby="public-title">
          <h2 id="public-title">公开 CI 元数据示例</h2>
          <div id="public"></div>
        </section>
        <section class="panel" aria-labelledby="opa-title">
          <h2 id="opa-title">OPA 参考规则</h2>
          <div id="opa"></div>
          <h3 id="numeric-title"></h3>
          <div id="numeric" class="table-wrap"></div>
        </section>
      </aside>
    </div>
    <footer>数据来自仓库保存的 results.json、case-catalog.json 和 opa-reference/results.json。人工构造对照不代表生产错误率；摘要一致也不证明证据来源真实。</footer>
  </main>
  <script type="application/json" id="data">@@DATA@@</script>
  <script>
  "use strict";
  const data = JSON.parse(document.getElementById("data").textContent);
  const byId = id => document.getElementById(id);
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  const verdictLabels = {ACCEPT:"通过 / ACCEPT",REJECT:"拒绝 / REJECT",WITHHOLD:"暂缓 / WITHHOLD"};
  const verdictStyles = {ACCEPT:"accept",REJECT:"reject",WITHHOLD:"withhold"};
  function badge(verdict) {
    return node("span", verdictLabels[verdict] || verdict || "未记录", "pill " + (verdictStyles[verdict] || "neutral"));
  }
  function line(title, content) {
    const p = node("p");
    p.append(node("strong", title + " "), content);
    return p;
  }
  function cell(value) {
    return value instanceof Node ? value : document.createTextNode(value == null ? "未提供" : String(value));
  }
  function table(headings, rows) {
    const t = node("table");
    const heading = t.createTHead().insertRow();
    for (const title of headings) {
      const th = node("th", title);
      th.scope = "col";
      heading.append(th);
    }
    const body = t.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const value of row) tr.insertCell().append(cell(value));
    }
    return t;
  }
  const names = [
    ["green_job_only","只读作业汇总"],
    ["typed_report_only","只读类型化报告"],
    ["admitted","先绑定再判定"]
  ];
  for (const [key, name] of names) {
    const stats = data.metrics[key];
    const m = node("div", undefined, "metric");
    m.append(
      node("div", name, "metric-name"),
      node("div", stats.agreement + "/" + data.cases.length, "metric-num"),
      node("div", "缺乏支持的通过 " + stats.unsupported_accepts + " · 缺乏支持的拒绝 " + stats.unsupported_rejects, "metric-note")
    );
    byId("metrics").append(m);
  }
  byId("denominator").textContent = "分母是 " + data.cases.length + " 个预设判定的人工对照；公开元数据和数值对照单独报告。";

  const select = byId("case");
  for (const [index, row] of data.cases.entries()) {
    const option = node("option", String(index + 1).padStart(2, "0") + " · " + row.case);
    option.value = String(index);
    select.append(option);
  }
  const initial = data.cases.findIndex(row => row.case === "tolerated_step_failure");
  select.selectedIndex = Math.max(initial, 0);
  function render() {
    const row = data.cases[select.selectedIndex];
    byId("prev").disabled = select.selectedIndex === 0;
    byId("next").disabled = select.selectedIndex === data.cases.length - 1;
    byId("why").textContent = row.why;
    byId("verdicts").replaceChildren();
    for (const [key, title] of [...names, ["authored_expected","构造时的预期判定"]]) {
      const card = node("div", undefined, "vcard");
      card.append(node("span", title, "small"), badge(row[key]));
      byId("verdicts").append(card);
    }
    byId("reasons").replaceChildren(
      line("绑定后的理由", node("code", row.reason)),
      line("OPA 应用层", row.opa_policy ? badge(row.opa_policy.decision) : node("span", "共同准入步骤暂缓，未调用 OPA。", "small"))
    );
    const native = row.native_steps.length
      ? table(["步骤","状态","原始 outcome","平台 conclusion"], row.native_steps.map(s => [s.step_number,s.status,s.outcome,s.conclusion]))
      : node("p", "该案例未记录已匹配的步骤。", "small");
    byId("native").replaceChildren(native);
    const checks = row.checks.length
      ? table(["检查","状态","理由"], row.checks.map(c => [node("code", c.id),c.state,node("code", c.reason)]))
      : node("p", "该案例未产生应用检查记录。", "small");
    byId("checks").replaceChildren(checks);
    const match = row.observed_report_sha256 === row.receipt_report_sha256;
    const receipt = node("p", "收据中的摘要", "digest");
    receipt.append(node("code", row.receipt_report_sha256));
    const observed = node("p", "实际报告字节的摘要", "digest");
    observed.append(node("code", row.observed_report_sha256));
    byId("digests").replaceChildren(node("span", match ? "一致" : "不一致", "pill " + (match ? "accept" : "withhold")), receipt, observed);
  }
  select.addEventListener("change", render);
  byId("prev").addEventListener("click", () => {select.selectedIndex -= 1; render();});
  byId("next").addEventListener("click", () => {select.selectedIndex += 1; render();});
  render();

  const sample = data.public;
  byId("public").append(
    line("仓库", node("code", sample.source.repository)),
    line("导出中的作业", node("span", String(sample.job_count))),
    line("步骤", node("span", sample.step.name)),
    line("平台 conclusion", node("code", sample.step.conclusion)),
    line("本地判定", badge(sample.result.decision)),
    line("理由", node("code", sample.result.reason)),
    node("p", sample.boundary, "small"),
    line("来源", node("code", sample.source.run_url))
  );
  const opa = data.opa;
  byId("opa").append(
    line("版本", node("code", opa.version)),
    line("进入 OPA 的案例", node("span", String(opa.actual_evaluations))),
    line("实际判定与 Python 一致", node("strong", opa.policy_agreement + "/" + opa.actual_evaluations)),
    node("p", "另有 " + opa.common_gate_withheld + " 个案例被共同准入步骤暂缓。合起来与预期一致 " + opa.combined_agreement + "/" + data.cases.length + "；这不是独立的全流程复现。", "small")
  );
  byId("numeric-title").textContent = opa.numeric.length + " 个单独的数值对照";
  byId("numeric").append(table(["JSON 数值","Python","OPA"], opa.numeric.map(r => [
    node("code", r.literal),r.python_application_result.decision,r.opa_application_result.decision
  ])));
  byId("numeric").append(node("p", "两种规则对 1.0 的处理不同；数值对照不计入上面的 " + data.cases.length + " 个案例。", "small"));
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    (HERE / "casebook.html").write_text(PAGE.replace("@@DATA@@", embed_json(load_casebook())), encoding="utf-8")
