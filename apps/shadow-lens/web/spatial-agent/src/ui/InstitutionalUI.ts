// apps/shadow-lens/web/spatial-agent/src/ui/InstitutionalUI.ts
// The Shadow Institutional Spatial UI shell (DOM overlay over the Three.js canvas): Trust Bar
// (six INDEPENDENT states — never one green VERIFIED), profile selector, artifact slate, result
// card, grounded answer card + citation chips, action rail, query bar, status toast, LAST ACTION.
// AUTHORED for the browser — not executed in the Node suite.
import { Tokens, statusColor } from "../design-tokens.ts";
import type { AgentResponse, Citation } from "../app/types.ts";

const TRUST_KEYS = ["RECORD INTEGRITY", "SOURCE COVERAGE", "ANALYSIS CONFIDENCE", "HUMAN REVIEW", "DATA FRESHNESS", "EXTERNAL ANCHOR"];

export class InstitutionalUI {
  private root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  onQuery: (q: string) => void = () => {};
  onProfile: (p: string) => void = () => {};
  onCommand: (c: string) => void = () => {};

  constructor(mount: HTMLElement) {
    this.root = mount;
    mount.style.cssText = `position:fixed;inset:0;font-family:ui-sans-serif,system-ui;color:${Tokens.TextPrimary};background:${Tokens.Background}`;
    this.build();
  }

  private panel(css: string) { const d = document.createElement("div"); d.style.cssText = `background:${Tokens.PanelPrimary};border:1px solid ${Tokens.Border};border-radius:10px;${css}`; return d; }

  private build() {
    // Trust bar (top) — six independent chips
    const trust = this.panel("position:absolute;top:12px;left:12px;right:12px;display:flex;gap:10px;padding:10px 14px;align-items:center");
    for (const k of TRUST_KEYS) {
      const chip = document.createElement("div");
      chip.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:11px";
      chip.innerHTML = `<span style="color:${Tokens.TextSecondary}">${k}</span><span data-trust="${k}" style="font-weight:600;color:${Tokens.Neutral}">—</span>`;
      trust.appendChild(chip);
    }
    this.els.trust = trust;

    // Result / decision card (right)
    const card = this.panel("position:absolute;top:80px;right:12px;width:32%;padding:14px;font-size:14px");
    card.innerHTML = `<div style="color:${Tokens.TextSecondary};font-size:11px">RESULT</div><div id="result-body">—</div>`;
    this.els.result = card;

    // Grounded answer card (contextual, bottom-right) + citation chips
    const answer = this.panel(`position:absolute;bottom:120px;right:12px;width:32%;padding:14px;display:none`);
    answer.innerHTML = `<div style="color:${Tokens.Information};font-size:11px">GROUNDED ANSWER</div><div id="answer-body" style="margin:6px 0"></div><div id="citations" style="display:flex;flex-wrap:wrap;gap:6px"></div>`;
    this.els.answer = answer;

    // Query bar + action rail (bottom)
    const bottom = this.panel("position:absolute;bottom:12px;left:12px;right:12px;padding:10px;display:flex;gap:10px;align-items:center");
    const rail = document.createElement("div"); rail.style.cssText = "display:flex;gap:6px";
    for (const [label, cmd] of [["Analyze", "analyze"], ["Sources", "show sources"], ["Risks", "show risks"], ["Review", "show review"], ["Audit", "show audit"], ["Verify", "verify"]] as const) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = `background:${Tokens.PanelSecondary};color:${Tokens.TextPrimary};border:1px solid ${Tokens.Border};border-radius:8px;padding:8px 12px;cursor:pointer`;
      b.onclick = () => this.onCommand(cmd);
      rail.appendChild(b);
    }
    const input = document.createElement("input");
    input.placeholder = "Ask a grounded question…";
    input.style.cssText = `flex:1;background:${Tokens.Background};color:${Tokens.TextPrimary};border:1px solid ${Tokens.Border};border-radius:8px;padding:10px`;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && input.value.trim()) { this.onQuery(input.value.trim()); input.value = ""; } });
    this.els.input = input;
    bottom.append(rail, input);

    // Profile selector (top-left, below trust) + status toast + last action
    const prof = document.createElement("div"); prof.style.cssText = "position:absolute;top:80px;left:12px;display:flex;gap:6px";
    for (const p of ["banking-v1", "data-science-v1", "coding-agent-v1"]) {
      const b = document.createElement("button"); b.textContent = p; b.style.cssText = `background:${Tokens.PanelSecondary};color:${Tokens.TextSecondary};border:1px solid ${Tokens.Border};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px`;
      b.onclick = () => this.onProfile(p); prof.appendChild(b);
    }
    const toast = this.panel("position:absolute;top:130px;left:12px;padding:8px 12px;font-size:12px;display:none");
    this.els.toast = toast;
    const last = document.createElement("div"); last.style.cssText = `position:absolute;bottom:70px;left:12px;font-size:12px;color:${Tokens.TextSecondary}`; last.textContent = "LAST ACTION: —";
    this.els.last = last;

    this.root.append(trust, prof, card, answer, bottom, toast, last);
  }

  setTrust(states: Record<string, string>) {
    for (const k of TRUST_KEYS) {
      const el = this.els.trust.querySelector(`[data-trust="${k}"]`) as HTMLElement | null;
      if (el && states[k]) { el.textContent = states[k]; el.style.color = statusColor(states[k]); }
    }
  }
  setState(s: string) { const t = this.els.toast; t.textContent = s; t.style.display = "block"; }
  setResult(text: string) { (this.els.result.querySelector("#result-body") as HTMLElement).textContent = text; }
  showAnswer(resp: AgentResponse) {
    this.els.answer.style.display = "block";
    (this.els.answer.querySelector("#answer-body") as HTMLElement).textContent = resp.text;
    const c = this.els.answer.querySelector("#citations") as HTMLElement; c.innerHTML = "";
    for (const cit of resp.citations ?? []) c.appendChild(this.citationChip(cit));
  }
  private citationChip(cit: Citation) {
    const chip = document.createElement("span");
    chip.style.cssText = `background:${Tokens.PanelSecondary};border:1px solid ${Tokens.Border};border-radius:14px;padding:4px 10px;font-size:12px`;
    chip.textContent = `${cit.source_id}: "${(cit.quote ?? "").slice(0, 40)}"`;
    return chip;
  }
  setLastAction(line: string) { this.els.last.textContent = line; }
  clearAnswer() { this.els.answer.style.display = "none"; }
}
