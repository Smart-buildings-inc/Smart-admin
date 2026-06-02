// One-off icon generator. Renders the ATLAS brand mark to PNGs at the sizes a
// PWA needs, using the Chromium that Playwright already ships. Re-run with
// `node scripts/gen-icons.mjs` if the mark changes.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/icons",
);

// size, filename, radiusPct (0 = full-bleed square for maskable/apple), glyphPct
const TARGETS = [
  { size: 192, file: "icon-192.png", radius: 22, glyph: 64 },
  { size: 512, file: "icon-512.png", radius: 22, glyph: 64 },
  { size: 512, file: "icon-maskable-512.png", radius: 0, glyph: 52 },
  { size: 180, file: "apple-touch-icon.png", radius: 0, glyph: 60 },
];

function html(size, radius, glyph) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${size}px;height:${size}px}
    .icon{
      width:${size}px;height:${size}px;
      border-radius:${(radius / 100) * size}px;
      background:
        radial-gradient(120% 120% at 30% 10%, #16recolor 0%, transparent 60%),
        linear-gradient(150deg,#101a24 0%,#0b121a 55%,#070b10 100%);
      display:grid;place-items:center;overflow:hidden;
      box-shadow:inset 0 0 0 ${Math.round(size * 0.012)}px rgba(255,255,255,.10);
    }
    .a{
      font-family:-apple-system,"SF Pro Display","Helvetica Neue",system-ui,sans-serif;
      font-weight:800;font-style:italic;font-size:${(glyph / 100) * size}px;
      line-height:1;letter-spacing:-0.04em;
      background:linear-gradient(135deg,#9fd0ff 0%,#4ea8ff 45%,#7fe7e0 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 ${Math.round(size*0.02)}px ${Math.round(size*0.05)}px rgba(78,168,255,.45));
    }
  </style></head><body><div class="icon"><span class="a">A</span></div></body></html>`;
}

const browser = await chromium.launch();
for (const t of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(html(t.size, t.radius, t.glyph).replace("#16recolor", "rgba(78,168,255,.18)"), {
    waitUntil: "networkidle",
  });
  const el = await page.$(".icon");
  await el.screenshot({ path: path.join(outDir, t.file), omitBackground: t.radius > 0 });
  await page.close();
  console.log("wrote", t.file, `${t.size}x${t.size}`);
}
await browser.close();
