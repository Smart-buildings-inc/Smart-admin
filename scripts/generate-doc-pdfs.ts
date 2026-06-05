/**
 * Generate the public document set for ATLAS OS.
 *
 * For every paper in the catalog (src/lib/documents.ts) this:
 *   1. reads the source markdown from repo-root `docs/<file>`,
 *   2. renders a clean, branded PDF to `public/documents/<slug>.pdf`
 *      (pure Node via pdfkit — no headless browser needed), and
 *   3. for the core legal trio, renders markdown → HTML and writes it into
 *      `src/lib/documents.generated.ts` so the /legal/* routes can render
 *      without any runtime filesystem access (serverless-safe).
 *
 * Run:  npm run docs:build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";
import { PAPERS, LEGAL_PAPERS, type LegalSlug } from "../src/lib/documents";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_DIR = path.join(ROOT, "public", "documents");
const GENERATED_FILE = path.join(ROOT, "src", "lib", "documents.generated.ts");

// ── Palette (brand-aligned; PDFs render on white pages) ───────────────────
const INK = "#0f172a";
const SLATE = "#334155";
const MUTED = "#64748b";
const ACCENT = "#2563eb";
const RULE = "#cbd5e1";
const CODE_BG = "#f1f5f9";

const PAGE = { margin: 56, size: "A4" as const };
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_ITALIC = "Helvetica-Oblique";
const FONT_MONO = "Courier";

type PDFKitDoc = InstanceType<typeof PDFDocument>;

/** Width of the printable column. */
function contentWidth(doc: PDFKitDoc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/** Render styled inline runs (bold/italic/code/links) for a set of inline tokens. */
function renderInline(doc: PDFKitDoc, tokens: Token[] | undefined, baseSize: number): void {
  if (!tokens || tokens.length === 0) {
    doc.text("", { continued: false });
    return;
  }
  tokens.forEach((t, i) => {
    const last = i === tokens.length - 1;
    const cont = !last;
    const anyTok = t as unknown as { text?: string; href?: string; tokens?: Token[] };
    switch (t.type) {
      case "strong":
        doc.font(FONT_BOLD).fillColor(INK).fontSize(baseSize).text(anyTok.text ?? "", { continued: cont });
        break;
      case "em":
        doc.font(FONT_ITALIC).fillColor(SLATE).fontSize(baseSize).text(anyTok.text ?? "", { continued: cont });
        break;
      case "codespan":
        doc.font(FONT_MONO).fillColor(ACCENT).fontSize(baseSize - 1).text(anyTok.text ?? "", { continued: cont });
        break;
      case "link": {
        const label = anyTok.text ?? anyTok.href ?? "";
        doc
          .font(FONT)
          .fillColor(ACCENT)
          .fontSize(baseSize)
          .text(label, { continued: cont, link: anyTok.href, underline: true });
        break;
      }
      case "br":
        doc.text("\n", { continued: cont });
        break;
      default:
        doc.font(FONT).fillColor(SLATE).fontSize(baseSize).text(anyTok.text ?? "", { continued: cont });
    }
  });
  // Reset style after the line.
  doc.font(FONT).fillColor(SLATE);
}

function plain(tokens: Token[] | undefined, fallback = ""): string {
  if (!tokens) return fallback;
  return tokens
    .map((t) => {
      const a = t as unknown as { text?: string; tokens?: Token[] };
      if (a.tokens && a.tokens.length) return plain(a.tokens, a.text ?? "");
      return a.text ?? "";
    })
    .join("");
}

function hr(doc: PDFKitDoc, color = RULE): void {
  const y = doc.y + 4;
  doc
    .save()
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(color)
    .stroke()
    .restore();
  doc.y = y + 10;
}

function renderTable(doc: PDFKitDoc, table: Tokens.Table): void {
  const cols = table.header.length;
  if (cols === 0) return;
  const width = contentWidth(doc);
  const colW = width / cols;
  const padX = 6;
  const padY = 5;
  const size = 9.5;

  const rows: { cells: string[]; header: boolean }[] = [
    { cells: table.header.map((c) => plain(c.tokens, c.text)), header: true },
    ...table.rows.map((r) => ({ cells: r.map((c) => plain(c.tokens, c.text)), header: false })),
  ];

  for (const row of rows) {
    // Measure tallest cell to get row height.
    doc.fontSize(size);
    let rowH = 0;
    row.cells.forEach((cell) => {
      doc.font(row.header ? FONT_BOLD : FONT);
      const h = doc.heightOfString(cell || " ", { width: colW - padX * 2 });
      rowH = Math.max(rowH, h);
    });
    rowH += padY * 2;

    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();

    const top = doc.y;
    const left = doc.page.margins.left;
    if (row.header) {
      doc.save().rect(left, top, width, rowH).fill(CODE_BG).restore();
    }
    row.cells.forEach((cell, ci) => {
      doc
        .font(row.header ? FONT_BOLD : FONT)
        .fillColor(row.header ? INK : SLATE)
        .fontSize(size)
        .text(cell || "", left + ci * colW + padX, top + padY, { width: colW - padX * 2 });
    });
    // Row separator.
    doc
      .save()
      .moveTo(left, top + rowH)
      .lineTo(left + width, top + rowH)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke()
      .restore();
    doc.y = top + rowH;
    doc.x = left;
  }
  doc.moveDown(0.6);
  doc.font(FONT).fillColor(SLATE);
}

function renderTokens(doc: PDFKitDoc, tokens: Token[]): void {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const h = token as Tokens.Heading;
        const sizes = [20, 16, 13.5, 12, 11, 10.5];
        const size = sizes[Math.min(h.depth - 1, 5)];
        doc.moveDown(h.depth <= 2 ? 0.7 : 0.45);
        if (doc.y + size + 8 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        doc.font(FONT_BOLD).fillColor(h.depth === 1 ? ACCENT : INK).fontSize(size);
        renderInline(doc, h.tokens, size);
        if (h.depth === 1) hr(doc, ACCENT);
        else doc.moveDown(0.25);
        break;
      }
      case "paragraph": {
        const p = token as Tokens.Paragraph;
        doc.moveDown(0.2);
        doc.font(FONT).fillColor(SLATE).fontSize(10.5);
        renderInline(doc, p.tokens, 10.5);
        break;
      }
      case "list": {
        const list = token as Tokens.List;
        doc.moveDown(0.2);
        list.items.forEach((item, idx) => {
          const marker = list.ordered ? `${(Number(list.start) || 1) + idx}.` : "•";
          const left = doc.page.margins.left;
          const indent = 16;
          if (doc.y + 14 > doc.page.height - doc.page.margins.bottom) doc.addPage();
          const y = doc.y;
          doc.font(FONT_BOLD).fillColor(ACCENT).fontSize(10.5).text(marker, left, y, { width: indent });
          doc.x = left + indent;
          doc.y = y;
          doc.font(FONT).fillColor(SLATE).fontSize(10.5);
          const itemTokens = (item as unknown as { tokens?: Token[] }).tokens;
          // Flatten the item's inline content (handles the common text token).
          const inline =
            itemTokens && itemTokens.length && itemTokens[0].type === "text"
              ? (itemTokens[0] as unknown as { tokens?: Token[] }).tokens
              : itemTokens;
          doc.text("", left + indent, y, { continued: true });
          renderInline(doc, inline, 10.5);
          doc.x = left;
        });
        doc.font(FONT).fillColor(SLATE);
        break;
      }
      case "code": {
        const c = token as Tokens.Code;
        doc.moveDown(0.35);
        doc.font(FONT_MONO).fontSize(9);
        const text = c.text || "";
        const h = doc.heightOfString(text, { width: contentWidth(doc) - 16 }) + 12;
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const top = doc.y;
        doc
          .save()
          .rect(doc.page.margins.left, top, contentWidth(doc), h)
          .fill(CODE_BG)
          .restore();
        doc
          .font(FONT_MONO)
          .fillColor(INK)
          .fontSize(9)
          .text(text, doc.page.margins.left + 8, top + 6, { width: contentWidth(doc) - 16 });
        doc.y = top + h;
        doc.x = doc.page.margins.left;
        doc.moveDown(0.35);
        doc.font(FONT).fillColor(SLATE);
        break;
      }
      case "blockquote": {
        const bq = token as Tokens.Blockquote;
        doc.moveDown(0.3);
        const left = doc.page.margins.left;
        const top = doc.y;
        doc.x = left + 14;
        doc.font(FONT_ITALIC).fillColor(MUTED).fontSize(10);
        renderInline(doc, (bq as unknown as { tokens?: Token[] }).tokens, 10);
        const bottom = doc.y;
        doc
          .save()
          .moveTo(left + 3, top)
          .lineTo(left + 3, bottom)
          .lineWidth(2.5)
          .strokeColor(ACCENT)
          .stroke()
          .restore();
        doc.x = left;
        doc.moveDown(0.2);
        doc.font(FONT).fillColor(SLATE);
        break;
      }
      case "table":
        doc.moveDown(0.3);
        renderTable(doc, token as Tokens.Table);
        break;
      case "hr":
        hr(doc);
        break;
      case "space":
        doc.moveDown(0.3);
        break;
      default: {
        const raw = (token as unknown as { text?: string; raw?: string }).text;
        if (raw && raw.trim()) {
          doc.font(FONT).fillColor(SLATE).fontSize(10.5).text(raw);
        }
      }
    }
  }
}

function buildPdf(title: string, subtitle: string, markdown: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE.size,
      margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
      bufferPages: true,
      info: { Title: title, Author: "ATLAS OS — Smart Buildings Inc.", Creator: "ATLAS OS docs:build" },
    });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    // Masthead.
    doc.font(FONT_BOLD).fillColor(ACCENT).fontSize(9).text("ATLAS OS", { characterSpacing: 1.5 });
    doc.moveDown(0.2);
    doc.font(FONT_BOLD).fillColor(INK).fontSize(24).text(title);
    if (subtitle) {
      doc.moveDown(0.15);
      doc.font(FONT).fillColor(MUTED).fontSize(11).text(subtitle);
    }
    hr(doc, ACCENT);

    const tokens = marked.lexer(markdown);
    // Drop the leading H1 — the masthead already shows the title.
    if (tokens[0] && tokens[0].type === "heading" && (tokens[0] as Tokens.Heading).depth === 1) {
      tokens.shift();
    }
    renderTokens(doc, tokens);

    // Footers (page numbers + confidentiality line).
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - doc.page.margins.bottom + 18;
      doc
        .font(FONT)
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          "ATLAS OS · Smart Buildings Inc. — generated document, review with counsel before relying on it.",
          doc.page.margins.left,
          y,
          { width: contentWidth(doc) - 60, lineBreak: false },
        );
      doc.text(`${i - range.start + 1} / ${range.count}`, doc.page.width - doc.page.margins.right - 50, y, {
        width: 50,
        align: "right",
      });
    }

    doc.end();
  });
}

function subtitleFor(slug: string, group: string): string {
  if (group === "legal") return "Legal & compliance · draft for counsel review";
  if (group === "business") return "Business & fundraising";
  return "Technical & requirements";
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const legalHtml: Partial<Record<LegalSlug, string>> = {};

  for (const paper of PAPERS) {
    const src = path.join(DOCS_DIR, paper.file);
    if (!fs.existsSync(src)) {
      console.warn(`! missing source, skipping: docs/${paper.file}`);
      continue;
    }
    const md = fs.readFileSync(src, "utf8");
    const out = path.join(OUT_DIR, `${paper.slug}.pdf`);
    await buildPdf(paper.title, subtitleFor(paper.slug, paper.group), md, out);
    console.log(`✓ pdf  public/documents/${paper.slug}.pdf`);

    if (paper.legalRoute) {
      legalHtml[paper.legalRoute] = marked.parse(md, { async: false }) as string;
    }
  }

  // Emit the serverless-safe generated HTML module for /legal/*.
  const header = `// AUTO-GENERATED by scripts/generate-doc-pdfs.ts — do not edit by hand.\n// Run \`npm run docs:build\` to regenerate from docs/*.md.\n/* eslint-disable */\nimport type { LegalSlug } from "./documents";\n\nexport const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};\n\nexport const LEGAL_HTML: Record<LegalSlug, string> = ${JSON.stringify(
    {
      privacy: legalHtml.privacy ?? "",
      terms: legalHtml.terms ?? "",
      dpa: legalHtml.dpa ?? "",
    },
    null,
    2,
  )};\n`;
  fs.writeFileSync(GENERATED_FILE, header, "utf8");
  console.log(`✓ html src/lib/documents.generated.ts (${Object.keys(legalHtml).length} legal docs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
