# Paper proposal — development draft, not submission ready

## Working title

**Beyond Exit Code Zero: Case Studies of Evidence Gaps in MCP Acceptance Pipelines**

中文：**退出码为零之后：MCP 验收流程中的证据缺口**。

## Draft abstract

Agent development pipelines promote native test reports into acceptance
decisions, although successful execution alone does not establish that every
required assertion was exercised or every contract change was classified. We
present a development pilot of three documented historical defects across two
MCP tool families: incomplete discovery, omitted metadata changes, and an
unexercised capability restriction. The first two use published CLI packages
with controlled local fixtures; the third executes extracted original checker
logic with RPC stubs. These execution levels are analyzed separately. A frozen
discovery-receipt interpreter accepts a complete trace whose native report
omits a policy-relevant annotation change. Recording actual failure thresholds
distinguishes permitted warning exits from policy failures. An ordinary
policy-aware parser exposes inconsistent reports, but conservatively withholds
one authored change permitted by its policy when the old report cannot classify
it. Separately, an upstream checker repair marks unexercised evidence as
untestable rather than claiming a protocol violation. We retain controls for
healthy behavior, authored forbidden-request controls and legitimate empty selection. All cases
were developed after reading fixes. The pilot supports a bounded experience
study, not production failure rates, held-out generalization, or superiority
of a new verification algorithm.

## Problem and example

A consumer may require successful tools discovery before accepting a contract
comparison. If discovery fails but the tool substitutes an empty list, an empty
baseline can compare unchanged. This is different from a conformance selector
correctly choosing no applicable scenarios. It is also different from a local
health check being valid locally but insufficient to accept a proxy deployment.
Each example needs an independently specified acceptance obligation before its
downstream conclusion can be judged. The follow-up annotation case additionally
shows that complete discovery receipts cannot establish the adequacy of the
native diff engine. A documented capability-check repair provides a second
tool-family example of successful evaluation without exercising its target.

## Research questions

1. Which evidence gaps arise when native MCP test results are promoted into
   downstream acceptance claims, and which belong to the tool versus the consumer?
2. How do exit rules, current native reports, ordinary strict parsers and
   receipt-aware interpretation compare when given matched information?
3. What healthy outcomes are withheld, what remains unknown, and what adaptation
   and maintenance effort is required across tools and versions?

## What exists now

- Three known historical defects across two tool families. Published CLI replay
  covers discovery-error and annotation-omission repairs; a pinned Git revision
  pair covers extracted capability-checker logic. The latter is not a full suite
  execution. Commands and variants do not increase the independent defect count.
- The earlier seven-record re-analysis remains a development comparison; snapshot
  creation commands are not counted as acceptance checks.
- A research interpreter preserving reported verdict, execution state, supported
  verdict, acceptance and evidence references. It supports only a narrow
  initialize/tools-list discovery profile.
- Twenty-two synthetic regression controls, not independently sampled tasks.
- One native empty-suite control with a working sentinel positive control.
- A negative result for method superiority: the strict parser already handles
  every error in the seven-record development replay.
- A counterexample to the frozen discovery gate and a policy-aware ordinary
  parser with explicit abstention cost. The latter fixes scope assumptions;
  it is not a new verification algorithm or a matched-budget superiority result.
- The broader expected-versus-emitted coverage question is already stated in
  [upstream issue451](https://github.com/modelcontextprotocol/conformance/issues/451).

## Contributions to establish, not claim yet

- An independently labeled cross-tool taxonomy of native faults, consumer
  over-interpretation, legitimate inapplicability and missing evidence.
- A reproducible corpus including installation failures and unknown outcomes.
- A comparison against current fixed tools and strict scripts with equivalent
  access to evidence, reporting both false acceptance and unnecessary withholding.

Separating PASS, ERROR and SKIP, using receipts, or adding signatures is not by
itself an original research contribution. A stricter parser may be the final
engineering outcome. If additional evidence does not support a broader finding,
the paper should remain a limited experience report or not be submitted.

## Suggested short-paper structure

1. Motivation and explicit consumer obligations.
2. Related work: test oracles, checked coverage, infrastructure failures,
   harness positive controls and agent completion judging.
3. Case selection, tool/version pins, independent labels and replay protocol.
4. Results with native, exit-only and matched-information strict baselines.
5. Threats to validity, effort, negative findings and artifact boundary.

## References to read and cite

- Barr et al., *The Oracle Problem in Software Testing: A Survey*, IEEE TSE,
  2015, DOI [10.1109/TSE.2014.2372785](https://doi.org/10.1109/TSE.2014.2372785).
- Schuler and Zeller, *Assessing Oracle Quality with Checked Coverage*,
  [IEEE ICST 2011 author page](https://www.st.cs.uni-saarland.de/publications/details/schuler-icst-2011/).
  Full text still needs direct review before detailed comparison.
- Herzig and Nagappan, *Empirically Detecting False Test Alarms Using Association
  Rules*, [ICSE 2015 Companion / IEEE author page](https://www.microsoft.com/en-us/research/publication/empirically-detecting-false-test-alarms-using-association-rules/).
- [Doc2Harness, arXiv:2610.20344v1](https://arxiv.org/html/2610.20344v1),
  especially positive controls; preprint status, not assumed IEEE acceptance.
- [Self-Report Leakage, arXiv:2610.29609v1](https://arxiv.org/html/2610.29609v1),
  report-isolated trace checking; model experiments not reproduced here.
- [Post-wire MCP semantic changes, arXiv:2610.00182v1](https://arxiv.org/html/2610.00182v1),
  consumer-relative information preservation and oracle challenges.
- [Official conformance PR442](https://github.com/modelcontextprotocol/conformance/pull/442)
  and [issue451](https://github.com/modelcontextprotocol/conformance/issues/451),
  unexercised prerequisites and expected-versus-emitted coverage.

The [cross-tool follow-up](./2026-10-29-cross-tool-followup.md) contains the raw
execution boundaries, counterexamples, parser costs and limitations. A third
tool family, blinded independent annotation and held-out evaluation remain undone.

## Preparation notes

Choose one submission route when the evidence is ready; AGENT's short paper is
five pages including references, while ICST NIER is four pages plus up to two
reference-only pages. An ICST submission needs anonymous artifacts rather than
the current public repository links. Keep the AI assistance disclosure aligned
with the selected venue's current instructions. ChatGPT/Codex assisted this
research draft and code; the author must verify and finalize the submission.
