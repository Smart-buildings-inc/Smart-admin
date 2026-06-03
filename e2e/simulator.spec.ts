import { test, expect } from "@playwright/test";

// F12 — Building Simulator page renders its chrome and controls. We don't
// assert on WebGL canvas internals, just that the page boots and is usable.
test.describe("ATLAS OS building simulator", () => {
  test("page loads with header, controls and telemetry panel", async ({ page }) => {
    await page.goto("/simulator");

    await expect(
      page.getByRole("heading", { level: 1, name: "Building Simulator" }),
    ).toBeVisible();

    // Control toggles.
    for (const name of ["Cut-away", "Pixel", "Elevator"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    // Toggles are interactive.
    const cutaway = page.getByRole("button", { name: "Cut-away", exact: true });
    await cutaway.click();
    await expect(cutaway).toBeVisible();

    // Telemetry side panel prompt.
    await expect(page.getByText("Floor telemetry", { exact: true })).toBeVisible();
  });

  test("Pixel switch toggles between voxel and detailed glTF residents", async ({ page }) => {
    // The simulator defaults to Pixel (procedural) mode; the GLB is still
    // preloaded so toggling to realistic streams in the detailed residents.
    const glb = page.waitForResponse(
      (r) => r.url().includes("/models/robot.glb") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.goto("/simulator");

    const res = await glb; // model is preloaded
    expect(res.status()).toBe(200);

    const pixel = page.getByRole("button", { name: "Pixel", exact: true });
    await expect(pixel).toHaveAttribute("aria-pressed", "true");
    await pixel.click(); // → realistic (detailed glTF) mode
    await expect(pixel).toHaveAttribute("aria-pressed", "false");
  });

  test("fullscreen control opens the full-viewport viewer and exits back", async ({
    page,
  }) => {
    await page.goto("/simulator");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size");

    await page.getByRole("link", { name: "Open fullscreen viewer" }).click();
    await expect(page).toHaveURL(/\/simulate\/atlas-01$/);

    // The full-screen stage fills the viewport (allow a 2px rounding tolerance).
    const stage = page.getByTestId("fullscreen-stage");
    await expect
      .poll(async () => {
        const box = await stage.boundingBox();
        if (!box) return false;
        return (
          Math.abs(box.x) <= 2 &&
          Math.abs(box.y) <= 2 &&
          Math.abs(box.width - viewport.width) <= 2 &&
          Math.abs(box.height - viewport.height) <= 2
        );
      })
      .toBe(true);

    // Body scroll is locked while the viewer owns the screen.
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    // Exit returns to the simulator (history back).
    await page.getByRole("button", { name: "Exit fullscreen viewer" }).click();
    await expect(page).toHaveURL(/\/simulator$/);
  });

  test("dedicated full-screen viewer renders edge-to-edge", async ({ page }) => {
    await page.goto("/simulate/atlas-01");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size");

    const stage = page.getByTestId("fullscreen-stage");
    await expect
      .poll(async () => {
        const box = await stage.boundingBox();
        if (!box) return false;
        return (
          Math.abs(box.width - viewport.width) <= 2 &&
          Math.abs(box.height - viewport.height) <= 2
        );
      })
      .toBe(true);

    // Option toggles and the exit affordance are present.
    await expect(page.getByRole("button", { name: "Cut-away", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exit fullscreen viewer" })).toBeVisible();
  });

  test("simulator is reachable from the nav bar", async ({ page }) => {
    await page.goto("/");
    // On mobile use the bottom tab bar (MobileTabBar); on desktop the inline top
    // nav. ".first()" disambiguates from the site footer, which also links to
    // /simulator (the top nav precedes the footer in the DOM).
    const bottom = page.getByRole("navigation", { name: "Primary" });
    const link = (await bottom.isVisible())
      ? bottom.getByRole("link", { name: "Simulator" }).first()
      : page.getByRole("link", { name: "Simulator" }).first();
    await link.click();
    await expect(page).toHaveURL(/\/simulator$/);
  });
});
