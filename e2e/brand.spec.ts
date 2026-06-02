import { test, expect } from "@playwright/test";

// Brand page: living style guide + downloadable brand kit. Runs on seed data,
// no DB required.
test.describe("ATLAS OS brand", () => {
  test("brand page renders identity, copyable swatches, and a download link", async ({
    page,
  }) => {
    await page.goto("/brand");

    // Hero heading (non-breaking-space-tolerant ATLAS OS title).
    await expect(
      page.getByRole("heading", { level: 1, name: /ATLAS\s*OS/ }),
    ).toBeVisible();

    // Tagline is present.
    await expect(
      page.getByText("Building the future. Creating lasting spaces."),
    ).toBeVisible();

    // Color swatches render and are click-to-copy buttons.
    const swatches = page.getByTestId("color-swatch");
    expect(await swatches.count()).toBeGreaterThan(10);

    // The primary brand-kit download link points at the zip endpoint.
    const download = page.getByTestId("brand-download-zip").first();
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute("href", "/api/brand/zip");
  });

  test("brand-kit zip endpoint returns a valid downloadable archive", async ({
    request,
  }) => {
    const res = await request.get("/api/brand/zip");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/zip");
    expect(res.headers()["content-disposition"]).toContain(
      "atlas-os-brand-kit.zip",
    );

    // Body starts with the ZIP local-file-header magic "PK\x03\x04".
    const body = await res.body();
    expect(body.length).toBeGreaterThan(100);
    expect(body[0]).toBe(0x50); // P
    expect(body[1]).toBe(0x4b); // K
    expect(body[2]).toBe(0x03);
    expect(body[3]).toBe(0x04);
  });
});
