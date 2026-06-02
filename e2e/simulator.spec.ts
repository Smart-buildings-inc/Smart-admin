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
