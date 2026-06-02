import { expect, test } from "@playwright/test";

test.describe("ATLAS OS marketing parallax", () => {
  for (const route of ["/landing", "/for", "/for/operators"]) {
    test(`${route} renders the layered parallax visual`, async ({ page }) => {
      await page.goto(route);

      const parallax = page.getByTestId("marketing-parallax");
      await expect(parallax).toBeVisible();
      await expect(parallax.getByRole("img")).toBeVisible();

      const box = await parallax.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(280);
      expect(box?.height ?? 0).toBeGreaterThan(220);
    });
  }
});
