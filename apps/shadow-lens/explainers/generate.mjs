// Shadow explainer generator — authoring-time only (NOT a runtime dependency). Reads SYSTEM_PROMPT.md,
// asks our own Claude for one self-contained HTML explainer of {topic}, strips any fence, writes it.
// Requires ANTHROPIC_API_KEY (Alex runs it with his key). No third-party animation code is used, so the
// output is ours (no CC-NC-ND constraint). Usage: node generate.mjs "how the reason-code dictionary hash binds an attestation"
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const topic = process.argv.slice(2).join(" ").trim();
const scene = process.env.SHADOW_SCENE || "(none — invent a minimal deterministic node list appropriate to the topic)";

if (!topic) { console.error('usage: node generate.mjs "<topic>"  [SHADOW_SCENE=path.json]'); process.exit(1); }

// extract the "## SYSTEM PROMPT" block from the doc (single source of truth for the prompt)
const doc = readFileSync(join(HERE, "SYSTEM_PROMPT.md"), "utf8");
const m = doc.match(/## SYSTEM PROMPT[^\n]*\n([\s\S]*?)\n---/);
if (!m) { console.error("could not find the SYSTEM PROMPT block in SYSTEM_PROMPT.md"); process.exit(1); }
const system = m[1].replace("{topic}", topic).replace("{scene_or_nodes}", scene).trim();

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("ANTHROPIC_API_KEY not set. This is an authoring-time tool — export your key and re-run.");
  console.error("Reference output already committed: audit-chain.html. The prompt is in SYSTEM_PROMPT.md.");
  process.exit(2);
}

const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "explainer";
const model = process.env.SHADOW_EXPLAINER_MODEL || "claude-opus-4-8";

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content: `Generate the self-contained HTML explainer for: ${topic}` }] }),
});
if (!res.ok) { console.error("Anthropic error", res.status, (await res.text()).slice(0, 400)); process.exit(3); }
const data = await res.json();
let html = (data.content || []).map((b) => b.text || "").join("");
// strip a leading/trailing markdown fence if the model added one
html = html.replace(/^\s*```html?\s*/i, "").replace(/\s*```\s*$/, "").trim();
if (!/^<!DOCTYPE html>/i.test(html)) { console.error("model did not return an HTML document; got:\n" + html.slice(0, 300)); process.exit(4); }

const out = join(HERE, `${slug}.html`);
writeFileSync(out, html + "\n");
console.log("wrote", out, `(${html.length} bytes). Review it, then run the self-contained test before committing.`);
