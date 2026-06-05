import { test, expect, type Page } from "@playwright/test";

const LAYOUT_KEY = "atlas-desktop-windows:v1";

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

async function loadHome(page: Page) {
  await page.goto("/");
  await waitForSplashToStopBlocking(page);
}

test.describe("ATLAS OS desktop window manager", () => {
  test("desktop shell renders default windows, files, and Dock", async ({ page }) => {
    await loadHome(page);
    const width = page.viewportSize()?.width ?? 0;

    if (width < 1024) {
      await expect(page.getByTestId("desktop-shell")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 1, name: /ATLAS\s*OS/ }),
      ).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      return;
    }

    await expect(page.getByTestId("desktop-shell")).toBeVisible();
    await expect(page.getByTestId("desktop-menubar")).toBeVisible();
    await expect(page.getByTestId("desktop-dock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset layout" })).toBeVisible();
    await expect(page.getByText("Blueprint", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Brand Assets", { exact: true }).first()).toBeVisible();

    for (const id of ["habitat", "metrics", "incidents", "blueprint", "brand"]) {
      const win = page
        .getByTestId("desktop-window")
        .and(page.locator(`[data-window-id="${id}"]`));
      await expect(win).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Orbit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Walk-through" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Incident feed" })).toBeVisible();
    await expect(page.getByText("Resilience", { exact: true })).toBeVisible();
  });

  test("dragged window layout persists after reload", async ({ page }) => {
    await loadHome(page);
    if ((page.viewportSize()?.width ?? 0) < 1024) return;

    const titlebar = page
      .getByTestId("desktop-window-titlebar")
      .and(page.locator('[data-window-id="blueprint"]'));
    const win = page
      .getByTestId("desktop-window")
      .and(page.locator('[data-window-id="blueprint"]'));

    const before = await win.boundingBox();
    expect(before).not.toBeNull();
    const titlebarBox = await titlebar.boundingBox();
    expect(titlebarBox).not.toBeNull();
    if (!titlebarBox) return;
    await page.mouse.move(titlebarBox.x + 120, titlebarBox.y + 18);
    await page.mouse.down();
    await page.mouse.move(titlebarBox.x + 220, titlebarBox.y + 78, { steps: 6 });
    await page.mouse.up();

    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          return raw ? JSON.parse(raw).blueprint.x : null;
        }, LAYOUT_KEY),
      )
      .not.toBeNull();

    const moved = await win.boundingBox();
    expect(moved).not.toBeNull();
    expect(Math.abs((moved?.x ?? 0) - (before?.x ?? 0))).toBeGreaterThan(20);

    await page.reload();
    await waitForSplashToStopBlocking(page);
    const restored = await win.boundingBox();
    expect(restored).not.toBeNull();
    expect(Math.abs((restored?.x ?? 0) - (moved?.x ?? 0))).toBeLessThanOrEqual(8);
    expect(Math.abs((restored?.y ?? 0) - (moved?.y ?? 0))).toBeLessThanOrEqual(8);
  });

  test("offscreen saved windows are clamped into the desktop", async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          habitat: { x: -900, y: -500, w: 900, h: 620, z: 50, mode: "normal" },
        }),
      );
    }, LAYOUT_KEY);

    await loadHome(page);
    if ((page.viewportSize()?.width ?? 0) < 1024) return;

    const win = page
      .getByTestId("desktop-window")
      .and(page.locator('[data-window-id="habitat"]'));
    const box = await win.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(40);
  });

  test("minimize and Dock restore preserve a window", async ({ page }) => {
    await loadHome(page);
    if ((page.viewportSize()?.width ?? 0) < 1024) return;

    const brandWindow = page
      .getByTestId("desktop-window")
      .and(page.locator('[data-window-id="brand"]'));
    await expect(brandWindow).toBeVisible();

    await page
      .getByTestId("window-minimize")
      .and(page.locator('[data-window-id="brand"]'))
      .click();
    await expect(brandWindow).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          return raw ? JSON.parse(raw).brand.mode : null;
        }, LAYOUT_KEY),
      )
      .toBe("minimized");

    await page
      .getByTestId("desktop-dock-item")
      .and(page.locator('[data-window-id="brand"]'))
      .click();
    await expect(brandWindow).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          return raw ? JSON.parse(raw).brand.mode : null;
        }, LAYOUT_KEY),
      )
      .toBe("normal");
  });
});
