import { test, expect } from "@playwright/test";

// P0 — Analytics + anomaly/trend engine API contract. Uses the request fixture.
// The engine is advisory-only (OPR §4); these assertions cover the shape it
// must always return so the console panel + copilot context can rely on it.
test.describe("ATLAS OS Analytics API", () => {
  test("GET /api/analytics returns a well-formed AnalyticsSummary", async ({
    request,
  }) => {
    const res = await request.get("/api/analytics");
    expect(res.status()).toBe(200);

    const summary = (await res.json()) as {
      score: number;
      status: string;
      alerts: Array<{
        id: string;
        severity: string;
        floorKey: string;
        title: string;
      }>;
      topRisks: unknown[];
      trends: Record<string, unknown>;
      counts: { crit: number; warn: number; info: number; ok: number };
    };

    // Score is a number in [0, 100].
    expect(typeof summary.score).toBe("number");
    expect(Number.isFinite(summary.score)).toBe(true);
    expect(summary.score).toBeGreaterThanOrEqual(0);
    expect(summary.score).toBeLessThanOrEqual(100);

    // Status is one of the known bands.
    expect(["nominal", "watch", "degraded"]).toContain(summary.status);

    // Alerts is an array; each entry is well-formed when present.
    expect(Array.isArray(summary.alerts)).toBe(true);
    for (const alert of summary.alerts) {
      expect(typeof alert.id).toBe("string");
      expect(["crit", "warn", "info", "ok"]).toContain(alert.severity);
      expect(typeof alert.floorKey).toBe("string");
      expect(typeof alert.title).toBe("string");
    }

    // Rollup collections are present.
    expect(Array.isArray(summary.topRisks)).toBe(true);
    expect(typeof summary.trends).toBe("object");
    expect(typeof summary.counts.crit).toBe("number");
    expect(typeof summary.counts.warn).toBe("number");
  });
});
