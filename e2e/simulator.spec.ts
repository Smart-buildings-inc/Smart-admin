import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

type RenderMode = "procedural Day" | "procedural Night" | "Hero";

type PixelBounds = {
  areaRatio: number;
  bottomMarginRatio: number;
  leftMarginRatio: number;
  rightMarginRatio: number;
  topMarginRatio: number;
};

type StagePixelStats = {
  brightRatio: number;
  darkRatio: number;
  luminanceMean: number;
  luminanceStdDev: number;
  significantBounds: PixelBounds | null;
};

function median(values: number[]) {
  const sorted = values.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function dilate(mask: Uint8Array, width: number, height: number) {
  const expanded = mask.slice();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          expanded[(y + dy) * width + x + dx] = 1;
        }
      }
    }
  }
  return expanded;
}

function findLargestComponentBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): PixelBounds | null {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let largest:
    | { area: number; maxX: number; maxY: number; minX: number; minY: number }
    | undefined;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            continue;
          }
          const next = nextY * width + nextX;
          if (!mask[next] || visited[next]) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (!largest || area > largest.area) {
      largest = { area, maxX, maxY, minX, minY };
    }
  }

  if (!largest) return null;
  return {
    areaRatio: largest.area / (width * height),
    bottomMarginRatio: (height - 1 - largest.maxY) / height,
    leftMarginRatio: largest.minX / width,
    rightMarginRatio: (width - 1 - largest.maxX) / width,
    topMarginRatio: largest.minY / height,
  };
}

async function getStagePixelStats(screenshot: Buffer): Promise<StagePixelStats> {
  const metadata = await sharp(screenshot).metadata();
  const inset = 12;
  const analysisScreenshot =
    metadata.width && metadata.height && metadata.width > inset * 2 && metadata.height > inset * 2
      ? await sharp(screenshot)
          .extract({
            left: inset,
            top: inset,
            width: metadata.width - inset * 2,
            height: metadata.height - inset * 2,
          })
          .png()
          .toBuffer()
      : screenshot;

  const { data, info } = await sharp(analysisScreenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let luminanceTotal = 0;
  let luminanceSquaredTotal = 0;
  let brightPixels = 0;
  let darkPixels = 0;
  const pixelCount = info.width * info.height;

  for (let index = 0; index < data.length; index += info.channels) {
    const luminance =
      data[index] * 0.2126 +
      data[index + 1] * 0.7152 +
      data[index + 2] * 0.0722;
    luminanceTotal += luminance;
    luminanceSquaredTotal += luminance * luminance;
    if (luminance >= 232) brightPixels += 1;
    if (luminance <= 24) darkPixels += 1;
  }

  const luminanceMean = luminanceTotal / pixelCount;
  const luminanceVariance =
    luminanceSquaredTotal / pixelCount - luminanceMean * luminanceMean;

  const framingWidth = Math.min(info.width, 320);
  const {
    data: framingData,
    info: framingInfo,
  } = await sharp(analysisScreenshot)
    .resize({ width: framingWidth, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edgeWidth = Math.max(2, Math.floor(framingInfo.width * 0.04));
  let significantMask = new Uint8Array(
    framingInfo.width * framingInfo.height,
  );

  for (let y = 0; y < framingInfo.height; y += 1) {
    const edgeR: number[] = [];
    const edgeG: number[] = [];
    const edgeB: number[] = [];
    for (let x = 0; x < framingInfo.width; x += 1) {
      if (x >= edgeWidth && x < framingInfo.width - edgeWidth) continue;
      const index = (y * framingInfo.width + x) * framingInfo.channels;
      edgeR.push(framingData[index]);
      edgeG.push(framingData[index + 1]);
      edgeB.push(framingData[index + 2]);
    }
    const backgroundR = median(edgeR);
    const backgroundG = median(edgeG);
    const backgroundB = median(edgeB);

    for (let x = 0; x < framingInfo.width; x += 1) {
      const pixel = y * framingInfo.width + x;
      const index = pixel * framingInfo.channels;
      const redDelta = framingData[index] - backgroundR;
      const greenDelta = framingData[index + 1] - backgroundG;
      const blueDelta = framingData[index + 2] - backgroundB;
      const colorDistanceSquared =
        redDelta * redDelta +
        greenDelta * greenDelta +
        blueDelta * blueDelta;
      if (colorDistanceSquared > 35 * 35) significantMask[pixel] = 1;
    }
  }

  significantMask = dilate(
    dilate(significantMask, framingInfo.width, framingInfo.height),
    framingInfo.width,
    framingInfo.height,
  );

  return {
    brightRatio: brightPixels / pixelCount,
    darkRatio: darkPixels / pixelCount,
    luminanceMean,
    luminanceStdDev: Math.sqrt(Math.max(0, luminanceVariance)),
    significantBounds: findLargestComponentBounds(
      significantMask,
      framingInfo.width,
      framingInfo.height,
    ),
  };
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

async function waitForRouteLoadingToClear(page: Page) {
  await expect(page.getByTestId("route-loading")).toBeHidden({ timeout: 20_000 });
}

async function captureSettledStage(page: Page, mode: RenderMode) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/simulator");
  await waitForSplashToStopBlocking(page);
  await waitForRouteLoadingToClear(page);

  const stage = page.getByTestId("sim-stage");
  const canvas = stage.locator("canvas");
  const canvasRoot = stage.locator(":scope > div:has(canvas)").first();
  await expect(stage).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvasRoot).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      () =>
        canvas.evaluate((node) => ({
          height: (node as HTMLCanvasElement).height,
          width: (node as HTMLCanvasElement).width,
        })),
      { timeout: 30_000 },
    )
    .toEqual(expect.objectContaining({ height: expect.any(Number), width: expect.any(Number) }));

  const orbit = page.getByRole("button", { name: "Orbit", exact: true });
  if ((await orbit.getAttribute("aria-pressed")) === "true") {
    await orbit.click();
  }
  await expect(orbit).toHaveAttribute("aria-pressed", "false");

  const timeOfDay = page.getByRole("slider", { name: "Time of day" });
  await timeOfDay.fill("0.5");
  await expect(timeOfDay).toHaveValue("0.5");

  if (mode === "procedural Night") {
    const day = page.getByRole("button", { name: "Day", exact: true });
    await day.click();
    await expect(
      page.getByRole("button", { name: "Night", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  } else if (mode === "Hero") {
    const hero = page.getByRole("button", { name: "Hero", exact: true });
    await hero.click();
    await expect(hero).toHaveAttribute("aria-pressed", "true");
  }

  await page.waitForTimeout(mode === "Hero" ? 2_500 : 2_000);
  await page.addStyleTag({
    content: [
      "nav",
      '[data-testid="sim-stage"] > :not(:has(canvas))',
      '[data-testid="sim-stage"] > :has(canvas) > :not(:has(canvas))',
    ].join(",") + " { visibility: hidden !important; }",
  });

  let settledHeroScreenshot: Buffer | undefined;
  if (mode === "Hero") {
    await expect
      .poll(
        async () => {
          const screenshot = await stage.screenshot({ caret: "hide" });
          const stats = await getStagePixelStats(screenshot);
          if (stats.darkRatio < 0.94) settledHeroScreenshot = screenshot;
          return stats.darkRatio;
        },
        {
          intervals: [1_000],
          timeout: 25_000,
          message: "Hero GLB should finish loading and produce visible model pixels",
        },
      )
      .toBeLessThan(0.94);
  }

  return (
    settledHeroScreenshot ??
    stage.screenshot({ caret: "hide" })
  );
}

async function expectStageRenderedAndFramed(page: Page, mode: RenderMode) {
  const stats = await getStagePixelStats(await captureSettledStage(page, mode));
  const summary =
    `${mode}: mean=${stats.luminanceMean.toFixed(2)}, ` +
    `stddev=${stats.luminanceStdDev.toFixed(2)}, ` +
    `bright=${stats.brightRatio.toFixed(4)}, dark=${stats.darkRatio.toFixed(4)}`;

  expect(stats.luminanceMean, `${summary}; stage must not be black`).toBeGreaterThan(6);
  expect(stats.luminanceMean, `${summary}; stage must not be white`).toBeLessThan(249);
  expect(
    stats.luminanceStdDev,
    `${summary}; stage needs rendered luminance variation`,
  ).toBeGreaterThan(7.5);
  expect(
    stats.brightRatio,
    `${summary}; bright pixels must not wash out the stage`,
  ).toBeLessThan(0.82);
  expect(
    stats.darkRatio,
    `${summary}; dark pixels must not swallow the stage`,
  ).toBeLessThan(0.94);

  expect(
    stats.significantBounds,
    `${summary}; no significant non-background rendered pixels found`,
  ).not.toBeNull();
  if (!stats.significantBounds) return;

  const bounds = stats.significantBounds;
  const framingSummary =
    `${mode}: component area=${bounds.areaRatio.toFixed(4)}, ` +
    `margins=${[
      bounds.topMarginRatio,
      bounds.rightMarginRatio,
      bounds.bottomMarginRatio,
      bounds.leftMarginRatio,
    ]
      .map((ratio) => ratio.toFixed(4))
      .join("/")}`;
  expect(
    bounds.areaRatio,
    `${framingSummary}; rendered subject must occupy a meaningful area`,
  ).toBeGreaterThan(0.01);
  expect(bounds.topMarginRatio, `${framingSummary}; subject clips the top`).toBeGreaterThan(0.04);
  expect(bounds.rightMarginRatio, `${framingSummary}; subject clips the right`).toBeGreaterThan(0.04);
  expect(bounds.bottomMarginRatio, `${framingSummary}; subject clips the bottom`).toBeGreaterThan(0.04);
  expect(bounds.leftMarginRatio, `${framingSummary}; subject clips the left`).toBeGreaterThan(0.04);
}

// F12 — Building Simulator page renders its chrome and controls. We don't
// rely only on WebGL DOM internals: rendered-pixel tests below verify the scene.
test.describe("ATLAS OS building simulator", () => {
  test.describe.configure({ mode: "serial", timeout: 75_000 });

  for (const mode of [
    "procedural Day",
    "procedural Night",
    "Hero",
  ] as const) {
    test(`${mode} renders nonblank and remains responsively framed`, async ({
      page,
    }) => {
      await expectStageRenderedAndFramed(page, mode);
    });
  }

  test("page loads with header, controls and telemetry panel", async ({ page }) => {
    await page.goto("/simulator");
    await waitForSplashToStopBlocking(page);
    await waitForRouteLoadingToClear(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Building Simulator" }),
    ).toBeVisible();

    // Control toggles.
    for (const name of ["Cut-away", "Pixel", "ASCII", "Elevator"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    const researchLens = page.getByLabel("3D research lens");
    for (const name of ["Ops", "Fluid", "SDF", "Holo"]) {
      await expect(researchLens.getByRole("button", { name, exact: true })).toBeVisible();
    }

    // Toggles are interactive.
    const cutaway = page.getByRole("button", { name: "Cut-away", exact: true });
    await cutaway.click();
    await expect(cutaway).toBeVisible();

    const fluid = researchLens.getByRole("button", { name: "Fluid", exact: true });
    await fluid.click();
    await expect(fluid).toHaveAttribute("aria-pressed", "true");

    // Telemetry side panel prompt.
    await expect(page.getByText("Floor telemetry", { exact: true })).toBeVisible();
    await expect(page.getByText("Volumetric flow field", { exact: true })).toBeVisible();
  });

  test("Pixel switch toggles between architectural and retro fallback modes", async ({ page }) => {
    const robotRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/models/robot.glb")) robotRequests.push(request.url());
    });

    await page.goto("/simulator");
    await waitForSplashToStopBlocking(page);
    await waitForRouteLoadingToClear(page);

    const pixel = page.getByRole("button", { name: "Pixel", exact: true });
    await expect(pixel).toHaveAttribute("aria-pressed", "false");
    await pixel.click(); // retro fallback
    await expect(pixel).toHaveAttribute("aria-pressed", "true");
    expect(robotRequests).toHaveLength(0);
  });

  test("fullscreen control opens the full-viewport viewer and exits back", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/simulator");
    await waitForSplashToStopBlocking(page);
    await waitForRouteLoadingToClear(page);

    await page.getByRole("link", { name: "Open fullscreen viewer" }).click();
    await expect(page).toHaveURL(/\/simulate\/atlas-01$/);

    await waitForRouteLoadingToClear(page);
    const stage = page.getByTestId("fullscreen-stage");
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await expect(stage).toHaveClass(/fixed/);

    // Body scroll is locked while the viewer owns the screen.
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    // Exit returns to the simulator (history back).
    await page.getByRole("button", { name: "Exit fullscreen viewer" }).click();
    await expect(page).toHaveURL(/\/simulator$/);
  });

  test("dedicated full-screen viewer renders edge-to-edge", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/simulate/atlas-01");
    await waitForSplashToStopBlocking(page);
    await waitForRouteLoadingToClear(page);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size");

    const stage = page.getByTestId("fullscreen-stage");
    await expect
      .poll(
        async () => {
          const box = await stage.boundingBox();
          if (!box) return false;
          return (
            Math.abs(box.width - viewport.width) <= 2 &&
            Math.abs(box.height - viewport.height) <= 2
          );
        },
        { timeout: 45_000 },
      )
      .toBe(true);

    // Option toggles and the exit affordance are present.
    await expect(page.getByRole("button", { name: "Cut-away", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pixel", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ASCII", exact: true })).toBeVisible();
    await expect(page.getByLabel("3D research lens").getByRole("button", { name: "Holo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exit fullscreen viewer" })).toBeVisible();
  });

  test("simulator is reachable from the nav bar", async ({ page }) => {
    await page.goto("/");
    await waitForSplashToStopBlocking(page);
    // Phone uses the bottom tab bar; tablet uses the drawer; desktop uses inline nav.
    const bottom = page.getByRole("navigation", { name: "Primary" });
    let link = page.locator("nav").getByRole("link", { name: "Simulator" });
    const width = page.viewportSize()?.width ?? 0;
    if (await bottom.isVisible()) {
      link = bottom.getByRole("link", { name: "Simulator" });
    } else if (width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      link = page.locator("#mobile-nav").getByRole("link", { name: "Simulator" });
    }
    await link.click();
    await expect(page).toHaveURL(/\/simulator$/);
  });
});
