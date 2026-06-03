import { expect, test } from "@playwright/test";

test.describe("ATLAS OS marketing parallax", () => {
  for (const route of [
    "/landing",
    "/for",
    "/for/operators",
    "/brand",
    "/fleet",
    "/simulator",
  ]) {
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

  test("parallax image layers keep intentional depth styling", async ({
    page,
  }) => {
    await page.goto("/landing");

    const depth = await page.getByTestId("marketing-parallax").evaluate((el) => {
      const layer = (selector: string) => {
        const node = el.querySelector(selector);
        if (!node) throw new Error(`Missing layer: ${selector}`);
        const style = window.getComputedStyle(node);
        return {
          filter: style.filter,
          opacity: Number.parseFloat(style.opacity),
          zIndex: Number.parseInt(style.zIndex, 10),
        };
      };

      return {
        back: layer(".marketing-parallax__backdrop"),
        front: layer(".marketing-parallax__foreground"),
        mid: layer(".marketing-parallax__twin"),
      };
    });

    expect(depth.back.filter).toContain("blur");
    expect(depth.back.opacity).toBeLessThan(depth.front.opacity);
    expect(depth.back.zIndex).toBeLessThan(depth.mid.zIndex);
    expect(depth.front.zIndex).toBeGreaterThan(depth.mid.zIndex);
  });
});
