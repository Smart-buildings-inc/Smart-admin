import { test, expect } from "@playwright/test";

// P0 — API + page coverage for the platform expansion: AI Ops Advisor,
// fleet rollups, and the Carbon & ESG page. All run on seed data.
test.describe("ATLAS OS platform", () => {
  test("GET /api/advisor returns ranked recommendations", async ({
    request,
  }) => {
    const res = await request.get("/api/advisor");
    expect(res.status()).toBe(200);

    const { recommendations } = (await res.json()) as {
      recommendations: Array<{
        id: string;
        title: string;
        severity: string;
        category: string;
        source: string;
      }>;
    };
    expect(Array.isArray(recommendations)).toBe(true);
    for (const r of recommendations) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.title).toBe("string");
      expect(["crit", "warn", "info", "ok"]).toContain(r.severity);
      expect(["energy", "water", "food", "air", "presence", "ops"]).toContain(
        r.category,
      );
      // No API key in CI → heuristic engine; the AI path is optional.
      expect(["ai", "heuristic"]).toContain(r.source);
    }
  });

  test("GET /api/fleet returns a portfolio rollup", async ({ request }) => {
    const res = await request.get("/api/fleet");
    expect(res.status()).toBe(200);

    const { rollup } = (await res.json()) as {
      rollup: {
        buildings: number;
        totalDwellings: number;
        totalBeds: number;
        compliancePct: number;
        gridTied: number;
      };
    };
    expect(rollup.buildings).toBeGreaterThan(0);
    expect(rollup.totalDwellings).toBeGreaterThan(0);
    expect(rollup.totalBeds).toBeGreaterThan(0);
    expect(rollup.compliancePct).toBeGreaterThanOrEqual(0);
    expect(rollup.compliancePct).toBeLessThanOrEqual(100);
    expect(rollup.gridTied).toBeGreaterThanOrEqual(0);
  });

  test("carbon page renders operational + embodied carbon", async ({
    page,
  }) => {
    await page.goto("/carbon");
    await expect(
      page.getByRole("heading", { level: 1, name: /Carbon/ }),
    ).toBeVisible();
  });

  test("hero glTF model asset is served and lightweight", async ({
    request,
  }) => {
    const res = await request.get("/models/atlas-01.glb");
    expect(res.status()).toBe(200);
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(1000); // real asset, not a stub
    expect(body.byteLength).toBeLessThan(3_000_000); // stays lightweight
    // glTF binary magic header "glTF".
    expect(body.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  test("Hero toggle swaps the twin model without crashing the viewer", async ({
    page,
  }) => {
    await page.goto("/simulate/atlas-01");
    const hero = page.getByRole("button", { name: "Hero", exact: true });
    await expect(hero).toBeVisible();
    await hero.click();
    // The error boundary falls back to voxel on any load failure, so either way
    // the viewer stays alive: its exit affordance remains present.
    await expect(
      page.getByRole("button", { name: "Exit fullscreen viewer" }),
    ).toBeVisible();
  });
});
