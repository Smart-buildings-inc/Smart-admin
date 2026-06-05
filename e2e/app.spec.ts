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

// P0 — Console home page renders the core operator UI.
test.describe("ATLAS OS console", () => {
  test("splash screen animates on initial load and clears to console", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const splash = page.getByTestId("app-splash");
    await expect(splash).toBeVisible();
    await expect(splash.locator("svg")).toBeVisible();
    await expect(splash).toHaveAttribute("aria-label", "Loading ATLAS OS");
    await waitForSplashToStopBlocking(page);

    await expect(
      page.getByRole("heading", { level: 1, name: /ATLAS\s*OS/ }),
    ).toBeVisible();
  });

  test("home page loads with header, KPI strip, seed chip and twin controls", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForSplashToStopBlocking(page);

    // Header (the title contains a non-breaking space between ATLAS and OS).
    await expect(
      page.getByRole("heading", { level: 1, name: /ATLAS\s*OS/ }),
    ).toBeVisible();

    // KPI strip labels (F5) — "Resilience" is the new leading tile.
    for (const label of [
      "Resilience",
      "Energy autonomy",
      "Battery",
      "Solar",
      "Non-potable reuse",
      "Food (amenity)",
      "Residents",
      "Open incidents",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Local-first status chip (no DB).
    await expect(page.getByText("Seed data (local-first)")).toBeVisible();

    // Twin container renders with its mode controls. We do not assert on the
    // WebGL canvas internals — just that the controls render and are usable.
    const orbit = page.getByRole("button", { name: "Orbit" });
    const walkthrough = page.getByRole("button", { name: "Walk-through" });
    await expect(orbit).toBeVisible();
    await expect(walkthrough).toBeVisible();

    // The Walk-through button is clickable.
    await walkthrough.click();
    await expect(walkthrough).toBeVisible();

    // Pixel/poly ⟷ realistic render-mode switch is present and toggles.
    const pixel = page.getByRole("button", { name: "Pixel", exact: true });
    await expect(pixel).toBeVisible();
    await expect(pixel).toHaveAttribute("aria-pressed", "false");
    await pixel.click();
    await expect(pixel).toHaveAttribute("aria-pressed", "true");
  });

  test("incident feed is present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Incident feed" }),
    ).toBeVisible();
  });

  // The twin's fullscreen control links to the dedicated /simulate/atlas-01
  // viewer. The simulator spec owns the edge-to-edge geometry assertion.
  test("fullscreen control opens the full-viewport viewer", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
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
  });

  // Bottom tab bar is mobile-only (md:hidden): visible on Pixel 5, hidden on
  // Desktop Chrome. Assert per viewport so both projects stay green.
  test("mobile bottom tab bar visibility tracks viewport", async ({ page }) => {
    await page.goto("/");
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    const width = page.viewportSize()?.width ?? 0;
    if (width < 768) {
      await expect(tabBar).toBeVisible();
      await expect(tabBar.getByRole("link", { name: "Console" })).toBeVisible();
      await expect(tabBar.getByRole("link", { name: "Fleet" })).toBeVisible();
    } else {
      await expect(tabBar).toBeHidden();
    }
  });

  // The GitHub repo link shows off the source. On desktop it's an icon button
  // in the top-right cluster; on phone/tablet it lives inside the hamburger drawer.
  test("top navbar exposes a GitHub repo link per viewport", async ({ page }) => {
    // The navbar is global (rendered in layout.tsx), so any route works — use a
    // lightweight page rather than the WebGL-heavy console home.
    await page.goto("/sitemap");
    await waitForSplashToStopBlocking(page);
    const repoUrl = "https://github.com/Smart-buildings-inc/Smart-admin";
    const width = page.viewportSize()?.width ?? 0;

    if (width < 1024) {
      // Mobile: link is inside the drawer, revealed by the hamburger.
      await page.getByRole("button", { name: "Open menu" }).click();
      const mobileLink = page.locator("#mobile-nav").getByRole("link", { name: "GitHub" });
      await expect(mobileLink).toBeVisible();
      await expect(mobileLink).toHaveAttribute("href", repoUrl);
      await expect(mobileLink).toHaveAttribute("target", "_blank");
    } else {
      // Desktop/tablet: icon button in the header is visible directly.
      const ghLink = page.getByTestId("github-link");
      await expect(ghLink).toBeVisible();
      await expect(ghLink).toHaveAttribute("href", repoUrl);
      await expect(ghLink).toHaveAttribute("target", "_blank");
      await expect(ghLink).toHaveAttribute("rel", /noopener/);
      await expect(ghLink).toHaveAttribute("aria-label", "View source on GitHub");
    }
  });

  test("top navbar exposes and persists the light mode switch", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("atlas-theme", "dark");
    });
    await page.goto("/");
    await waitForSplashToStopBlocking(page);

    const themeToggle = page.getByTestId("theme-toggle");
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle).toHaveAttribute("aria-pressed", "false");
    await expect(themeToggle).toHaveAttribute("aria-label", "Switch to light mode");

    const width = page.viewportSize()?.width ?? 0;
    if (width < 768) {
      await expect(
        page.getByRole("button", { name: "Open menu" }),
      ).toBeVisible();
    }

    await themeToggle.click();

    await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
    await expect(themeToggle).toHaveAttribute("aria-label", "Switch to dark mode");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains("theme-light"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("atlas-theme")))
      .toBe("light");
  });
});
