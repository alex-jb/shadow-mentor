// GLM-5.2 (Zhipu) provider — OpenAI-compatible endpoint at open.bigmodel.cn.
//
// Used by api/deliberate.js when the request body specifies provider="glm".
// Env var: GLM_API_KEY (set on Vercel project + local .env.local).

const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const GLM_DEFAULT_MODEL = "glm-5-plus";

export async function callGlm({ systemPrompt, userMessage, maxTokens = 220 }) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error("GLM_API_KEY not configured");

  const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GLM_DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GLM API ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("GLM returned empty content");
  return { text: text.trim(), model: GLM_DEFAULT_MODEL };
}
