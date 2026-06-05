import { test, expect, type Page } from "@playwright/test";

// Dismiss the one-time splash overlay (it can intercept early interactions).
async function settle(page: Page): Promise<void> {
  await page
    .getByTestId("app-splash")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(() => {});
}

test.describe("Documents library", () => {
  test("documents hub renders the reader, toolbar, and a downloadable PDF", async ({ page }) => {
    await page.goto("/documents");
    await settle(page);

    await expect(page.getByRole("heading", { level: 1, name: /Document/ })).toBeVisible();

    // Toolbar download link points at a generated PDF.
    const download = page.getByRole("link", { name: /Download/ }).first();
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute("href", /\/documents\/.+\.pdf$/);

    // The embedded PDF object is present in the DOM.
    await expect(page.locator('object[type="application/pdf"]')).toHaveCount(1);
  });

  test("every catalog PDF is served (200, application/pdf)", async ({ page }) => {
    const slugs = [
      "privacy-policy",
      "terms-of-service",
      "data-processing-addendum",
      "legal-compliance",
      "business-plan",
      "pitch-deck",
      "budget-and-fundraising",
      "requirements",
      "owners-project-requirements",
      "security-and-data-compliance",
    ];
    for (const slug of slugs) {
      const res = await page.request.get(`/documents/${slug}.pdf`);
      expect(res.status(), slug).toBe(200);
      expect(res.headers()["content-type"] ?? "", slug).toContain("pdf");
    }
  });
});

test.describe("Legal pages", () => {
  test("legal index lists the three core documents", async ({ page }) => {
    await page.goto("/legal");
    await settle(page);

    await expect(page.getByRole("heading", { level: 1, name: /Legal/ })).toBeVisible();
    for (const title of ["Privacy Policy", "Terms of Service", "Data Processing Addendum"]) {
      await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
    }
  });

  for (const { path, name } of [
    { path: "/legal/privacy", name: "Privacy Policy" },
    { path: "/legal/terms", name: "Terms of Service" },
    { path: "/legal/dpa", name: "Data Processing Addendum" },
  ]) {
    test(`${name} renders prose + a working PDF download`, async ({ page }) => {
      await page.goto(path);
      await settle(page);

      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

      // Rendered markdown body exists and has content.
      const article = page.locator("article.doc-prose");
      await expect(article).toBeVisible();
      await expect(article.locator("h2").first()).toBeVisible();

      const pdfLink = page.getByRole("link", { name: /Download PDF/ }).first();
      await expect(pdfLink).toBeVisible();
      const href = await pdfLink.getAttribute("href");
      expect(href).toMatch(/\/documents\/.+\.pdf$/);
      const res = await page.request.get(href!);
      expect(res.status()).toBe(200);
    });
  }
});
