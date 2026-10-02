// Routing tests deliberately stop at the real SDK resource boundary.
// No HTTP request, provider credential lookup, or downstream attestation
// is needed to prove that a request passed the input gates.
import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";

export const OFFLINE_PROVIDER_ERROR = "OFFLINE_PROVIDER_MOCK_FAILURE";

export function offlineDeliberate(t) {
  // Node's test runner isolates each test file in its own process. Clear
  // inherited provider configuration without reading or logging values,
  // then use only a static fake key inside this routing-test worker.
  for (const name of [
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
    "GLM_API_KEY", "SHADOW_LOCAL_LLM_URL", "OLLAMA_HOST",
  ]) delete process.env[name];
  process.env.ANTHROPIC_API_KEY = "shadow-offline-test-key";

  const messages = t.mock.method(Anthropic.Messages.prototype, "create", async () => {
    throw new Error(OFFLINE_PROVIDER_ERROR);
  });
  // An SDK/provider refactor that bypasses the resource mock must fail
  // this test rather than open a network connection with a fake key.
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("UNEXPECTED_NETWORK_ATTEMPT_IN_OFFLINE_ROUTING_TEST");
  });
  t.after(() => {
    assert.equal(network.mock.callCount(), 0, "routing tests must not attempt HTTP requests");
  });
  return messages;
}
