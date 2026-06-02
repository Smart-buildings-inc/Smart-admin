import { test, expect } from "@playwright/test";

// P0 — /portfolio page: ownership structure, funding programs, and approvals
// timeline render correctly on both Desktop Chrome and Mobile Chrome.
test.describe("ATLAS Portfolio plan", () => {
  test("portfolio page renders structure, programs and approvals", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    // Page heading must contain "Portfolio".
    await expect(
      page.getByRole("heading", { level: 1, name: /Portfolio/ }),
    ).toBeVisible();

    // Ownership / entity names are present somewhere on the page.
    // Some strings recur (entity name + funding/revenue list items), so match the
    // first occurrence to stay clear of Playwright strict-mode violations.
    await expect(page.getByText(/ATLAS OS Inc\./).first()).toBeVisible();
    await expect(page.getByText(/ATLAS-01 PropCo/).first()).toBeVisible();

    // Funding program (also appears in entity funding lists → use .first()).
    await expect(page.getByText(/CMHC MLI Select/).first()).toBeVisible();

    // Approvals timeline — at least the first phase label is visible.
    await expect(page.getByText(/Pre-consultation/).first()).toBeVisible();

    // Phase range label "Months 0–2" — tolerant on en-dash (U+2013) vs hyphen.
    await expect(page.getByText(/Months\s+0[–\-]2/).first()).toBeVisible();
  });
});
