# Paper proposal — development draft, not submission ready

## Working title

**Beyond Exit Code Zero: Evidence Gaps in MCP Acceptance Pipelines**

中文：**退出码为零之后：MCP 验收流程中的证据缺口**。

## Draft abstract

Agent development pipelines consume test and conformance reports to decide
whether an integration is ready for subsequent execution. A successful process
exit, however, need not establish that the consumer's required checks ran or
that their observations were complete. We investigate the boundary between a
tool's native report and the acceptance claim made by a downstream consumer.
Our preliminary development replay examines seven controlled check observations
from a documented, repaired MCP contract-tool defect. An exit-code-only rule
incorrectly accepts two discovery-error observations and labels another as a
product failure. Both an ordinary strict output parser and a receipt-aware
interpreter avoid these errors; the latter provides no additional accuracy on
this development set. A separate native conformance control returns exit zero
after version filtering selects no scenarios, illustrating legitimate empty
selection rather than a tool defect. We preserve reported verdicts separately
from execution completeness and make acceptance obligations explicit. These
results motivate a cross-tool empirical study with matched-information
baselines, independent labeling, and held-out cases. We do not establish
production failure rates, generalization, or a new oracle algorithm.

## Problem and example

A consumer may require successful tools discovery before accepting a contract
comparison. If discovery fails but the tool substitutes an empty list, an empty
baseline can compare unchanged. This is different from a conformance selector
correctly choosing no applicable scenarios. It is also different from a local
health check being valid locally but insufficient to accept a proxy deployment.
Each example needs an independently specified acceptance obligation before its
downstream conclusion can be judged.

## Research questions

1. Which evidence gaps arise when native MCP test results are promoted into
   downstream acceptance claims, and which belong to the tool versus the consumer?
2. How do exit rules, current native reports, ordinary strict parsers and
   receipt-aware interpretation compare when given matched information?
3. What healthy outcomes are withheld, what remains unknown, and what adaptation
   and maintenance effort is required across tools and versions?

## What exists now

- One known historical defect, previously exercised with real published CLI
  versions and controlled local fixtures. Seven check records are re-analyzed;
  snapshot creation commands are not counted as acceptance checks.
- A research interpreter preserving reported verdict, execution state, supported
  verdict, acceptance and evidence references. It supports only a narrow
  initialize/tools-list discovery profile.
- Twenty-two synthetic regression controls, not independently sampled tasks.
- One native empty-suite control with a working sentinel positive control.
- A negative result for method superiority: the strict parser already handles
  every error in the seven-record development replay.

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

## Preparation notes

Choose one submission route when the evidence is ready; AGENT's short paper is
five pages including references, while ICST NIER is four pages plus up to two
reference-only pages. An ICST submission needs anonymous artifacts rather than
the current public repository links. Keep the AI assistance disclosure aligned
with the selected venue's current instructions. ChatGPT/Codex assisted this
research draft and code; the author must verify and finalize the submission.
