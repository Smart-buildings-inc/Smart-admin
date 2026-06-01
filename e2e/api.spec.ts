import { test, expect } from "@playwright/test";

// P0 — API surface for the console. Uses the request fixture (no browser).
test.describe("ATLAS OS API", () => {
  test("GET /api/floors returns a non-empty, level-ordered floor list", async ({
    request,
  }) => {
    const res = await request.get("/api/floors");
    expect(res.status()).toBe(200);

    const { floors } = (await res.json()) as {
      floors: Array<{ key: string; level: number }>;
    };
    expect(Array.isArray(floors)).toBe(true);
    expect(floors.length).toBeGreaterThan(0);

    // Ordered bottom → top by level.
    const levels = floors.map((f) => f.level);
    const sorted = [...levels].sort((a, b) => a - b);
    expect(levels).toEqual(sorted);
  });

  test("POST /api/broadcasts returns 201 with a recipient count and mirrors into incidents", async ({
    request,
  }) => {
    const marker = `API broadcast ${Date.now()}`;

    const res = await request.post("/api/broadcasts", {
      data: { message: marker, audience: "all" },
    });
    expect(res.status()).toBe(201);

    const { broadcast } = (await res.json()) as {
      broadcast: { message: string; recipients: number };
    };
    expect(broadcast.message).toBe(marker);
    expect(typeof broadcast.recipients).toBe("number");
    expect(broadcast.recipients).toBeGreaterThan(0);

    // The broadcast is mirrored into the incident feed.
    const incRes = await request.get("/api/incidents");
    expect(incRes.status()).toBe(200);
    const { incidents } = (await incRes.json()) as {
      incidents: Array<{ title: string }>;
    };
    const mirrored = incidents.some((i) => i.title.includes(marker));
    expect(mirrored).toBe(true);
  });
});
