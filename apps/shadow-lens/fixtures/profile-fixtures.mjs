// apps/shadow-lens/fixtures/profile-fixtures.mjs
// Two REAL, reproducible, non-banking fixtures. Each returns a build spec for
// buildEvidenceSession() so the fixture seals a genuine attest-core bundle (not a static
// pre-signed blob). Both use the SAME generic core: source_map of artifacts, source-bound
// claims, a signed evidence chain, verification. Banking is not involved.

const sha = (seed) => "sha256:" + Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(seed * 7 + i * 3) % 16]).join("");

// 1 ── Data Science Experiment Replay ─────────────────────────────────────────
export function dataScienceSpec({ signingKeyPem, publicKeyPem }) {
  const source_map = [
    { source_id: "dataset", content: `dataset ${sha(1)}`, content_type: "dataset" },
    { source_id: "metric_auc", content: "test AUC = 0.912", content_type: "metric" },
    { source_id: "metric_logloss", content: "test logloss = 0.281", content_type: "metric" },
    { source_id: "calibration", content: "Brier = 0.11 (post-Platt)", content_type: "metric" },
    { source_id: "selection", content: "gbm selected over logreg, rf", content_type: "decision" },
  ];
  const claims = [
    { claim_id: "c1", text: "GBM selected: highest test AUC among candidates", source_ids: ["metric_auc", "selection"], produced_by: "model", validation_status: "source_bound", confidence: 0.9 },
    { claim_id: "c2", text: "Calibrated with Platt scaling (Brier 0.11)", source_ids: ["calibration"], produced_by: "model", validation_status: "source_bound", confidence: 0.85 },
  ];
  return {
    session_id: "ds_experiment_fixture",
    agent: { name: "shadow-ds-replay", version: "ds-commit-abc123" },
    models: [{ model_id: "gbm", provider: "sklearn" }],
    platform: "cli",
    source_map, claims,
    events: [
      { event_type: "prompt", actor: "user", payload: { command: "run_experiment", issue: "predict default risk" } },
      { event_type: "tool_call", actor: "tool", payload: { tool: "load_dataset" } },
      { event_type: "tool_result", actor: "tool", payload: { dataset_hash: sha(1) }, extensions: { dataset_hash: sha(1) } },
      { event_type: "tool_result", actor: "tool", payload: { split: { train: 0.8, test: 0.2 } } },
      { event_type: "model_output", actor: "model", payload: { selected_model: "gbm", auc: 0.912 } },
      { event_type: "human_approval", actor: "user", payload: { approved: true, by: "ds-lead" } },
    ],
    profile: {
      name: "data-science-v1",
      data: {
        dataset_hash: sha(1),
        preprocessing: ["dropna", "standard-scale", "one-hot(category)"],
        split: { train: 0.8, test: 0.2, seed: 42 },
        feature_config: { n_features: 24, selection: "mutual-info top-24" },
        model_candidates: ["logreg", "rf", "gbm"],
        eval_metrics: { auc: { source_id: "metric_auc", value: 0.912 }, logloss: { source_id: "metric_logloss", value: 0.281 } },
        calibration: { method: "platt", brier: 0.11, source_id: "calibration" },
        selected_model: "gbm",
        environment: { python: "3.12", packages: ["scikit-learn==1.5.0", "numpy==2.0.1", "pandas==2.2.2"] },
        code_commit: "abc123",
        human_approval: { by: "ds-lead", decision: "approved" },
      },
    },
    signingKeyPem, publicKeyPem, keyId: "ds-demo",
  };
}

// 2 ── Coding Agent Replay ────────────────────────────────────────────────────
export function codingAgentSpec({ signingKeyPem, publicKeyPem }) {
  const source_map = [
    { source_id: "issue", content: "Fix null deref in config parser", content_type: "issue" },
    { source_id: "file_parser", content: `src/parser.js @ ${sha(2)}`, content_type: "file" },
    { source_id: "diff1", content: `add null guard ${sha(3)}`, content_type: "diff" },
    { source_id: "cmd_test", content: "npm test → 42 passed, 0 failed", content_type: "command_output" },
    { source_id: "cmd_lint", content: "eslint → 0 errors, 0 high", content_type: "command_output" },
  ];
  const claims = [
    { claim_id: "c1", text: "Added a null guard in the config parser", source_ids: ["diff1", "file_parser"], produced_by: "model", validation_status: "source_bound", confidence: 0.95 },
    { claim_id: "c2", text: "All tests pass after the change", source_ids: ["cmd_test"], produced_by: "tool", validation_status: "source_bound", confidence: 1.0 },
  ];
  return {
    session_id: "coding_agent_fixture",
    agent: { name: "shadow-coding-replay", version: "def456" },
    models: [{ model_id: "claude-sonnet", provider: "anthropic" }],
    platform: "cli",
    source_map, claims,
    events: [
      { event_type: "prompt", actor: "user", payload: { command: "fix_issue", issue: "null deref in parser" } },
      { event_type: "tool_call", actor: "tool", payload: { tool: "read_file", path: "src/parser.js" } },
      { event_type: "tool_result", actor: "tool", payload: { file_hash: sha(2) } },
      { event_type: "model_output", actor: "model", payload: { diff_hash: sha(3) } },
      { event_type: "tool_result", actor: "tool", payload: { test: "42 passed", output_hash: sha(4) }, extensions: { output_hash: sha(4) } },
      { event_type: "human_approval", actor: "user", payload: { approved: true, by: "maintainer" } },
    ],
    profile: {
      name: "coding-agent-v1",
      data: {
        issue: "Fix null deref in config parser",
        agent_config: { model: "claude-sonnet", provider: "anthropic", temperature: 0 },
        files_read: ["src/parser.js"],
        commands: ["npm test", "npm run lint"],
        diffs: ["diff1"],
        dependency_changes: [],
        test_results: { passed: 42, failed: 0, output_source_id: "cmd_test" },
        security_lint: { high: 0, medium: 0, output_source_id: "cmd_lint" },
        reviewer_interaction: { decision: "approved", override_rationale: null },
        human_approval: { by: "maintainer", decision: "approved" },
        final_commit: "def456",
      },
    },
    signingKeyPem, publicKeyPem, keyId: "coding-demo",
  };
}
