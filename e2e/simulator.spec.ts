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

  test("turning Pixel mode off loads the detailed glTF residents", async ({ page }) => {
    // Realistic mode (Pixel off) streams the bundled GLB; Pixel mode stays
    // fully procedural so no model request is made.
    const glb = page.waitForResponse(
      (r) => r.url().includes("/models/robot.glb") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.goto("/simulator");

    const pixel = page.getByRole("button", { name: "Pixel", exact: true });
    await expect(pixel).toHaveAttribute("aria-pressed", "true");
    await pixel.click(); // → realistic mode
    await expect(pixel).toHaveAttribute("aria-pressed", "false");

    const res = await glb;
    expect(res.status()).toBe(200);
  });

  test("fullscreen expands the simulator stage to cover the whole viewport", async ({
    page,
  }) => {
    await page.goto("/simulator");
    const stage = page.getByTestId("sim-stage");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size");

    await page.getByRole("button", { name: "Enter fullscreen" }).click();

    // The stage fills the viewport (allow a 2px rounding tolerance).
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

    // Body scroll is locked while expanded.
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    // Exit returns the stage to its inline (non-viewport) size.
    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect
      .poll(async () => {
        const box = await stage.boundingBox();
        return box ? box.height < viewport.height : false;
      })
      .toBe(true);
  });

  test("simulator is reachable from the nav bar", async ({ page }) => {
    await page.goto("/");
    // On mobile use the bottom tab bar (MobileTabBar); on desktop the inline top nav.
    const bottom = page.getByRole("navigation", { name: "Primary" });
    const link = (await bottom.isVisible())
      ? bottom.getByRole("link", { name: "Simulator" })
      : page.getByRole("link", { name: "Simulator" });
    await link.click();
    await expect(page).toHaveURL(/\/simulator$/);
  });
});
