import { test, expect } from "@playwright/test";

// P1 — SEO & accessibility guarantees. Each indexable route must carry a
// unique, descriptive <title> and a self-referencing canonical; the app must
// expose a keyboard skip-link to the main landmark.

const titled: Array<{ path: string; titleIncludes: string }> = [
  { path: "/simulator", titleIncludes: "Building Simulator" },
  { path: "/fleet", titleIncludes: "Fleet" },
  { path: "/portfolio", titleIncludes: "Portfolio" },
  { path: "/carbon", titleIncludes: "Carbon" },
];

test.describe("ATLAS OS SEO", () => {
  for (const { path, titleIncludes } of titled) {
    test(`${path} has a unique title and a self-referencing canonical`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(new RegExp(titleIncludes, "i"));
      await expect(page).toHaveTitle(/ATLAS OS/i);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute(
        "href",
        new RegExp(`${path}/?$`),
      );
    });
  }
});

test.describe("ATLAS OS accessibility", () => {
  test("home exposes a skip-to-content link targeting the main landmark", async ({
    page,
  }) => {
    await page.goto("/");

    const skip = page.getByRole("link", { name: /skip to main content/i });
    await expect(skip).toHaveAttribute("href", "#main");

    // The target landmark exists.
    await expect(page.locator("main#main")).toHaveCount(1);
  });
});
