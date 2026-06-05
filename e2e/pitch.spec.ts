import { expect, test, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

function paethPredictor(left: number, up: number, upperLeft: number) {
  const p = left + up - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upperLeft;
}

function getPngStats(buffer: Buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  expect(signature).toBe("89504e470d0a1a0a");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  expect(bitDepth).toBe(8);
  expect([2, 6]).toContain(colorType);

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;
    const prevStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[prevStart + x - bytesPerPixel]
        : 0;

      let value = rawByte;
      if (filter === 1) value = rawByte + left;
      else if (filter === 2) value = rawByte + up;
      else if (filter === 3) value = rawByte + Math.floor((left + up) / 2);
      else if (filter === 4) value = rawByte + paethPredictor(left, up, upperLeft);
      else expect(filter).toBe(0);

      pixels[rowStart + x] = value & 255;
    }

    sourceOffset += stride;
  }

  let alphaPixels = 0;
  let minLum = 255;
  let maxLum = 0;
  const step = Math.max(bytesPerPixel, Math.floor((width * height * bytesPerPixel) / 6_000));

  for (let i = 0; i < pixels.length; i += step - (step % bytesPerPixel)) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const alpha = colorType === 6 ? pixels[i + 3] : 255;
    if (alpha === 0) continue;
    alphaPixels += 1;
    const lum = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
    minLum = Math.min(minLum, lum);
    maxLum = Math.max(maxLum, lum);
  }

  return { alphaPixels, luminanceSpread: maxLum - minLum };
}

async function waitForSplashToStopBlocking(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const node = document.querySelector('[data-testid="app-splash"]');
          if (!node) return true;
          const style = window.getComputedStyle(node);
          return (
            style.pointerEvents === "none" ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) < 0.01
          );
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
}

async function expectPitchCanvasNonBlank(page: Page) {
  const canvas = page.locator('[data-testid="pitch-stage"] canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const width = Math.min(320, box.width);
  const height = Math.min(240, box.height);
  const sample = getPngStats(
    await page.screenshot({
      clip: {
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height,
      },
    }),
  );

  expect(sample.alphaPixels).toBeGreaterThan(100);
  expect(sample.luminanceSpread).toBeGreaterThan(8);
}

test.describe("ATLAS OS pitch quest", () => {
  test("renders the 3D mission pitch and advances the game loop", async ({ page }) => {
    test.setTimeout(60_000);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pitch?quality=low");
    await waitForSplashToStopBlocking(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "ATLAS Pitch Quest" }),
    ).toBeVisible();
    await expect(page.getByText("Close the non-potable water loop")).toBeVisible();
    await expectPitchCanvasNonBlank(page);

    await page.getByRole("button", { name: "Scan selected mission" }).click();
    await expect(page.getByText("Captured")).toBeVisible();
    await expect(page.getByText("17%")).toBeVisible();

    await page.getByRole("button", { name: "Next mission" }).click();
    await expect(page.getByText("Keep the building online through grid stress")).toBeVisible();

    await expect(page.getByRole("button", { name: "Low" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const stage = page.getByTestId("pitch-stage");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.44, box.y + box.height * 0.52, {
        steps: 5,
      });
      await page.mouse.up();
    }
  });

  test("exposes the pitch route through responsive navigation", async ({ page }) => {
    await page.goto("/sitemap");
    await waitForSplashToStopBlocking(page);

    const width = page.viewportSize()?.width ?? 0;
    if (width < 768) {
      await expect(
        page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Pitch" }),
      ).toBeVisible();
    } else if (width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(
        page.locator("#mobile-nav").getByRole("link", { name: "Pitch" }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: "Pitch" }).first()).toBeVisible();
    }
  });
});
