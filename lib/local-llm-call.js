// Local-LLM provider — Ollama / llama.cpp OpenAI-compatible endpoint.
//
// Default base: http://127.0.0.1:11434/v1 (Ollama's OpenAI-compat shim,
// stable since Ollama 0.1.30). Override LOCAL_LLM_BASE_URL to point at
// llama.cpp's server, LM Studio's local server, or any other
// OpenAI-compatible local runner.
//
// Used by api/deliberate.js when the request body specifies provider="local"
// (or the future LOCAL_LLM_DEFAULT=true env override). The contract test in
// test/local-llm-call.test.js asserts request shape WITHOUT requiring a
// local model to be installed — the fetchImpl injection lets the test stub
// the round-trip response.
//
// Why this lives in Shadow
// ------------------------
// 2026-06-30 cross-stack thesis from 6 days of daily brief: open-weight
// models crossed the procurement-defensibility threshold for
// banking-analyst reasoning. Phi-4-mini (Microsoft, MIT) and Gemma 3 9B
// (Google) both run on Apple Silicon laptops at >40 tok/s with quality
// adequate for the structural-rubric Shadow Agentic Capability Benchmark.
// This file is the structural integration point that lets a cold-email
// prospect run Shadow's 5-voice council with zero data ever leaving
// their laptop — the "Runs on your laptop, zero-breach risk" sales line
// becomes literal, not aspirational.
//
// What it does NOT do
// -------------------
// - Does NOT install / spin up Ollama. That's an operator step (`brew
//   install ollama` + `ollama pull phi4-mini` once).
// - Does NOT benchmark cross-provider Brier-score consistency. That's
//   the open research direction the IEEE VR 2027 paper Section 8 flags
//   as future work.
// - Does NOT change the existing API contract. If LOCAL_LLM_BASE_URL is
//   unset or Ollama is offline, callLocalLlm() throws — callers should
//   fall back to Anthropic / OpenAI / GLM in the existing provider chain.

export const LOCAL_LLM_BASE_URL =
  process.env.LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";

// Default to phi4-mini (Microsoft, MIT-licensed, ~3.8B params,
// tool-use-capable, fits on 16GB M2 Pro). Override per call or via
// LOCAL_LLM_DEFAULT_MODEL env.
export const LOCAL_LLM_DEFAULT_MODEL =
  process.env.LOCAL_LLM_DEFAULT_MODEL || "phi4-mini";

/**
 * Call a local LLM through an OpenAI-compatible /chat/completions endpoint.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt - Shadow voice persona prompt
 * @param {string} opts.userMessage  - loan packet or analyst question
 * @param {number} [opts.maxTokens=220] - matches existing per-voice cap
 * @param {string} [opts.model] - override model name (default phi4-mini)
 * @param {string} [opts.baseUrl] - override endpoint (default Ollama)
 * @param {function} [opts.fetchImpl] - injectable fetch for tests
 * @returns {Promise<{text: string, model: string}>}
 */
export async function callLocalLlm({
  systemPrompt,
  userMessage,
  maxTokens = 220,
  model,
  baseUrl,
  fetchImpl,
}) {
  const resolvedModel = model || LOCAL_LLM_DEFAULT_MODEL;
  const resolvedBase = baseUrl || LOCAL_LLM_BASE_URL;
  const fetchFn = fetchImpl || fetch;

  let response;
  try {
    response = await fetchFn(`${resolvedBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    // Connection refused / DNS fail / network down — almost always means
    // "Ollama isn't running on this machine". Surface a specific,
    // actionable error so the caller can fall back to a cloud provider
    // (or, for the cold-email demo flow, prompt the user to `ollama serve`).
    throw new Error(
      `local LLM endpoint unreachable at ${resolvedBase} (${err.message}). ` +
        `Is Ollama running? Try: ollama serve`,
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    // Ollama returns 404 with model name in body when the model isn't
    // pulled — preserve that detail in the message for clarity.
    throw new Error(
      `local LLM API ${response.status}: ${detail.slice(0, 200)}`,
    );
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("local LLM returned empty content");
  }
  return { text: text.trim(), model: resolvedModel };
}
