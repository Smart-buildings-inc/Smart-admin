// GET /api/brand/zip — assemble the ATLAS OS brand kit as a downloadable .zip.
//
// Everything shipped here is derived from the brand tokens in `@/lib/brand`
// (colors, type ramp, voice) so the kit can never drift from the living style
// guide at `/brand`. Logo files are read from disk at request time and skipped
// gracefully if missing. The archive is built with the dependency-free
// `createZip` writer. Node runtime so we can read files from the filesystem.

import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  BRAND,
  COLOR_GROUPS,
  TYPE_RAMP,
  FONT_STACK,
  MONO_STACK,
  VOICE,
} from "@/lib/brand";
import { createZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ZipFile = { name: string; data: string | Uint8Array };

// — README.md ——————————————————————————————————————————————————————————————

function buildReadme(): string {
  const voicePillars = VOICE.pillars
    .map((p) => `- **${p.title}** — ${p.body}`)
    .join("\n");
  const dos = VOICE.dos.map((d) => `- ${d}`).join("\n");
  const donts = VOICE.donts.map((d) => `- ${d}`).join("\n");

  return `# ${BRAND.name} — Brand Kit

> ${BRAND.tagline}

${BRAND.description}

## The mark

${BRAND.markStory}

## Voice

${voicePillars}

### Do

${dos}

### Don't

${donts}

## Contents

- \`README.md\` — these brand guidelines.
- \`colors/colors.json\` — every color grouped by namespace.
- \`colors/colors.css\` — \`:root\` custom properties for all colors.
- \`colors/tailwind.tokens.js\` — Tailwind color tokens (mirrors \`tailwind.config.ts\`).
- \`typography/typography.md\` — type ramp and font stacks.
- \`logos/\` — logo + icon assets (svg / png).
`;
}

// — colors/colors.json —————————————————————————————————————————————————————

function buildColorsJson(): string {
  const grouped: Record<
    string,
    {
      title: string;
      blurb: string;
      colors: Record<string, { hex: string; use: string }>;
    }
  > = {};

  for (const group of COLOR_GROUPS) {
    const colors: Record<string, { hex: string; use: string }> = {};
    for (const color of group.colors) {
      colors[color.name] = { hex: color.hex, use: color.use };
    }
    grouped[group.id] = {
      title: group.title,
      blurb: group.blurb,
      colors,
    };
  }

  return JSON.stringify(grouped, null, 2);
}

// — colors/colors.css ——————————————————————————————————————————————————————

function buildColorsCss(): string {
  const lines = COLOR_GROUPS.flatMap((group) =>
    group.colors.map((color) => `  --aos-${color.name}: ${color.hex};`),
  );
  return `/* ${BRAND.name} — color custom properties (derived from brand tokens). */
:root {
${lines.join("\n")}
}
`;
}

// — colors/tailwind.tokens.js ——————————————————————————————————————————————

function buildTailwindTokens(): string {
  const namespaces: Record<string, Record<string, string>> = {};

  for (const group of COLOR_GROUPS) {
    const tokens: Record<string, string> = {};
    for (const color of group.colors) {
      // Key is the token name minus the "<group id>-" prefix, e.g.
      // "ink-950" -> "950", "signal-ok" -> "ok", "need-water" -> "water".
      const key = color.name.slice(group.id.length + 1);
      tokens[key] = color.hex;
    }
    namespaces[group.id] = tokens;
  }

  return `// ${BRAND.name} — Tailwind color tokens.
// Mirrors the color scales in tailwind.config.ts so external tooling can
// consume the same palette. Generated from the brand tokens in src/lib/brand.ts.
module.exports = ${JSON.stringify(namespaces, null, 2)};
`;
}

// — typography/typography.md ———————————————————————————————————————————————

function buildTypography(): string {
  const rows = TYPE_RAMP.map(
    (t) => `| ${t.role} | ${t.sample} | ${t.spec} |`,
  ).join("\n");

  return `# ${BRAND.name} — Typography

| Role | Sample | Spec |
| --- | --- | --- |
${rows}

## Font stack

\`\`\`css
${FONT_STACK}
\`\`\`

## Mono stack

\`\`\`css
${MONO_STACK}
\`\`\`
`;
}

// — Logo assets (read from disk, skip if missing) ——————————————————————————

type DiskAsset = {
  name: string;
  source: string;
  encoding: "utf-8" | "binary";
};

const DISK_ASSETS: DiskAsset[] = [
  { name: "logos/logo.svg", source: "public/logo.svg", encoding: "utf-8" },
  { name: "logos/icon.svg", source: "src/app/icon.svg", encoding: "utf-8" },
  {
    name: "logos/icon-192.png",
    source: "public/icon-192.png",
    encoding: "binary",
  },
  {
    name: "logos/icon-512.png",
    source: "public/icon-512.png",
    encoding: "binary",
  },
];

async function readDiskAsset(asset: DiskAsset): Promise<ZipFile | null> {
  try {
    const filePath = path.join(process.cwd(), asset.source);
    if (asset.encoding === "utf-8") {
      const text = await readFile(filePath, "utf-8");
      return { name: asset.name, data: text };
    }
    const buffer = await readFile(filePath);
    return { name: asset.name, data: new Uint8Array(buffer) };
  } catch {
    // Optional asset missing — skip it so the route never 500s.
    return null;
  }
}

export async function GET() {
  const files: ZipFile[] = [
    { name: "README.md", data: buildReadme() },
    { name: "colors/colors.json", data: buildColorsJson() },
    { name: "colors/colors.css", data: buildColorsCss() },
    { name: "colors/tailwind.tokens.js", data: buildTailwindTokens() },
    { name: "typography/typography.md", data: buildTypography() },
  ];

  const assets = await Promise.all(DISK_ASSETS.map(readDiskAsset));
  for (const asset of assets) {
    if (asset) files.push(asset);
  }

  const zip = createZip(files);

  return new NextResponse(Buffer.from(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="atlas-os-brand-kit.zip"',
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
