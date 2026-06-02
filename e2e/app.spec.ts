import { test, expect } from "@playwright/test";

// P0 — Console home page renders the core operator UI.
test.describe("ATLAS OS console", () => {
  test("home page loads with header, KPI strip, seed chip and twin controls", async ({
    page,
  }) => {
    await page.goto("/");

    // Header (the title contains a non-breaking space between ATLAS and OS).
    await expect(
      page.getByRole("heading", { level: 1, name: /ATLAS\s*OS/ }),
    ).toBeVisible();

    // KPI strip labels (F5).
    for (const label of [
      "Autonomy",
      "Battery",
      "Solar",
      "Water reuse",
      "Food output",
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
  });

  test("incident feed is present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Incident feed" }),
    ).toBeVisible();
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
});
