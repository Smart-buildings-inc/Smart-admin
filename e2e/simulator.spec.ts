import { test, expect, type Page } from "@playwright/test";

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

// F12 — Building Simulator page renders its chrome and controls. We don't
// assert on WebGL canvas internals, just that the page boots and is usable.
test.describe("ATLAS OS building simulator", () => {
  test.describe.configure({ mode: "serial", timeout: 75_000 });

  test("page loads with header, controls and telemetry panel", async ({ page }) => {
    await page.goto("/simulator");
    await waitForSplashToStopBlocking(page);

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
