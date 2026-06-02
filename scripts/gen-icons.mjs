// Bakes static raster brand assets from the source SVGs.
//
// This is a build-time/dev utility: `sharp` + `png-to-ico` are installed on
// demand (`npm i --no-save sharp png-to-ico`) and are NOT runtime deps. The
// generated files (favicon.ico, apple-icon.png, icon-*.png, og.png) are
// committed so the app ships without any image-processing dependency.
//
// Re-run after editing public/logo.svg or src/app/icon.svg:
//   npm i --no-save sharp png-to-ico && node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const icon = readFileSync(resolve(root, "src/app/icon.svg"));   // simplified mark
const logo = readFileSync(resolve(root, "public/logo.svg"));    // detailed emblem

const png = (svg, size) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

async function main() {
  // Favicon .ico packs the bold mark at the sizes browsers actually request.
  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(icoSizes.map((s) => png(icon, s)));
  writeFileSync(resolve(root, "src/app/favicon.ico"), await pngToIco(icoPngs));

  // Apple touch icon — opaque, full-bleed, 180px (uses the detailed emblem).
  await sharp(logo, { density: 384 })
    .resize(180, 180)
    .flatten({ background: "#04070b" })
    .png()
    .toFile(resolve(root, "src/app/apple-icon.png"));

  // PNG fallbacks + a maskable/PWA-friendly 512.
  for (const s of [192, 512]) {
    writeFileSync(resolve(root, `public/icon-${s}.png`), await png(logo, s));
  }
  writeFileSync(resolve(root, "public/favicon-32.png"), await png(icon, 32));

  // Open Graph / social share card (1200×630) on the ops-console background.
  const emblem = await png(logo, 480);
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: "#070b10" },
  })
    .composite([{ input: emblem, top: 75, left: 360 }])
    .png()
    .toFile(resolve(root, "public/og.png"));

  console.log("Generated: favicon.ico, apple-icon.png, icon-192/512.png, favicon-32.png, og.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
