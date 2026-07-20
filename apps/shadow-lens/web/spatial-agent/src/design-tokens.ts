// apps/shadow-lens/web/spatial-agent/src/design-tokens.ts
// Shadow Institutional Spatial UI tokens for the web client (mirrors the Unity design tokens).
// Semantic colors only; Verified green is reserved for record integrity. AUTHORED for the
// browser (Vite/Three.js) — not executed in the Node test suite (the pure logic is tested separately).
export const Tokens = {
  Background: "#090D12", PanelPrimary: "#111820", PanelSecondary: "#18212B",
  TextPrimary: "#F2F5F7", TextSecondary: "#9DA9B5", Border: "rgba(255,255,255,0.10)",
  Verified: "#2FD19A", Warning: "#F2C14E", Tampered: "#FF5F6D", Information: "#5CA8FF", Neutral: "#9DA9B5",
} as const;

export function statusColor(status: string | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "verified": case "approved": case "complete": return Tokens.Verified;
    case "failed": case "tampered": case "rejected": return Tokens.Tampered;
    case "partial": case "incomplete": case "pending": case "warning": return Tokens.Warning;
    case "info": return Tokens.Information;
    default: return Tokens.Neutral;
  }
}

export const Motion = { PanelTransition: 220, ConnectorDraw: 200, AuditNodeStagger: 80 } as const;
