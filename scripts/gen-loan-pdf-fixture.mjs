// Generate a minimal valid PDF fixture for OCR smoke tests.
// One-shot generator — fixture is committed; this script is for regen.
//
// Produces: test/fixtures/sample-loan.pdf
//
// Content matches STUB_LOAN_PDF_TEXT so the council verdict is predictable:
// FICO 720, DTI 0.30, LTV 0.75, $250k, industrials → should approve.
//
// Hand-rolled PDF 1.4 to avoid adding a 600KB devDependency. Text-PDF (not
// scanned image) — claudeVisionOcr() still has to base64 + parse the document
// content block. For a true scanned-image PDF (preferable for OCR realism)
// regen with a rasterizer once Alex's machine has one.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "test", "fixtures", "sample-loan.pdf");

const LINES = [
  "LOAN APPLICATION - Mid-Tier Bank Standard Form",
  "",
  "Borrower: Acme Industrial Holdings LLC",
  "Application Date: 2026-06-23",
  "Applicant ID: ACM-2026-0623-001",
  "",
  "CREDIT METRICS",
  "  FICO Score: 720",
  "  Debt-to-Income Ratio: 0.30",
  "  Loan-to-Value Ratio: 0.75",
  "  Borrower Rating: BB+",
  "",
  "LOAN DETAILS",
  "  Requested Amount: $250,000",
  "  Purpose: Working capital expansion",
  "  Term: 5 years",
  "  Sector: Industrials (NAICS 332710)",
  "  Collateral: Equipment + receivables (LTV-eligible)",
  "",
  "REGULATORY FLAGS",
  "  Fair Lending Review Required: No",
  "  CRA Assessment Area: Yes",
  "  HMDA Reportable: No",
  "",
  "UNDERWRITER NOTES",
  "  Strong industrial sub-sector tailwinds.",
  "  Receivables aging within 60-day band.",
  "  Recommend Compliance + Risk Officer sign-off.",
];

// Build the page content stream — PDF text operators.
// Tj draws a string at current text position. T* advances to next line.
function buildContentStream() {
  const ops = [];
  ops.push("BT");                  // begin text
  ops.push("/F1 11 Tf");           // font Helvetica 11pt
  ops.push("14 TL");               // leading 14pt (line spacing)
  ops.push("72 760 Td");           // start at top-left margin
  for (const line of LINES) {
    const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    ops.push(`(${escaped}) Tj`);
    ops.push("T*");
  }
  ops.push("ET");                  // end text
  return ops.join("\n");
}

const content = buildContentStream();
const contentLen = Buffer.byteLength(content, "binary");

// PDF objects. Offsets computed after serialization.
const objects = [
  // 1: Catalog
  `<< /Type /Catalog /Pages 2 0 R >>`,
  // 2: Pages tree
  `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
  // 3: Page
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
  // 4: Font (Helvetica is one of 14 standard fonts — no embed needed)
  `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  // 5: Content stream
  `<< /Length ${contentLen} >>\nstream\n${content}\nendstream`,
];

const header = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
const chunks = [Buffer.from(header, "binary")];
const offsets = [0]; // placeholder for free entry

let cursor = chunks[0].length;
objects.forEach((body, idx) => {
  const objNum = idx + 1;
  const objStr = `${objNum} 0 obj\n${body}\nendobj\n`;
  const buf = Buffer.from(objStr, "binary");
  offsets.push(cursor);
  chunks.push(buf);
  cursor += buf.length;
});

// xref table
const xrefOffset = cursor;
let xref = `xref\n0 ${objects.length + 1}\n`;
xref += "0000000000 65535 f \n";
for (let i = 1; i <= objects.length; i++) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}

const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
chunks.push(Buffer.from(xref + trailer, "binary"));

const pdfBuffer = Buffer.concat(chunks);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdfBuffer);

console.log(`✓ Wrote ${OUT} — ${pdfBuffer.length} bytes`);
console.log(`  Lines: ${LINES.length}, content stream: ${contentLen} bytes`);
console.log(`  Verify: open ${OUT}`);
