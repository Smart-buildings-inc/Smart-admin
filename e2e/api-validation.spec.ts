import { test, expect } from "@playwright/test";

// P1 — API validation & error-path contracts. These assert the 400/201 split
// and exact error messages for every POST route, plus the read side of the
// sensor and broadcast endpoints. All run on seed data; no DB required.

test.describe("ATLAS OS API — incident validation", () => {
  test("POST /api/incidents rejects invalid JSON with 400", async ({
    request,
  }) => {
    const res = await request.post("/api/incidents", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{ not json"),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body.");
  });

  test("POST /api/incidents requires a non-empty title", async ({
    request,
  }) => {
    for (const data of [
      {},
      { severity: "info" },
      { title: "   ", severity: "info" },
      { title: 42, severity: "info" },
    ]) {
      const res = await request.post("/api/incidents", { data });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("`title` is required.");
    }
  });

  test("POST /api/incidents rejects an out-of-enum severity", async ({
    request,
  }) => {
    const res = await request.post("/api/incidents", {
      data: { title: "Sensor drift", severity: "unknown" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe(
      "`severity` must be one of: crit, warn, info, ok.",
    );
  });

  test("POST /api/incidents creates an incident and preserves optional fields", async ({
    request,
  }) => {
    const title = `Validation incident ${Date.now()}`;
    const res = await request.post("/api/incidents", {
      data: {
        title,
        severity: "warn",
        floorKey: "residences-a",
        detail: "raised by api-validation suite",
      },
    });
    expect(res.status()).toBe(201);
    const { incident } = (await res.json()) as {
      incident: {
        title: string;
        severity: string;
        floorKey: string | null;
        detail?: string;
      };
    };
    expect(incident.title).toBe(title);
    expect(incident.severity).toBe("warn");
    expect(incident.floorKey).toBe("residences-a");
    expect(incident.detail).toBe("raised by api-validation suite");

    // It lands in the feed.
    const feed = await request.get("/api/incidents");
    const { incidents } = (await feed.json()) as {
      incidents: Array<{ title: string }>;
    };
    expect(incidents.some((i) => i.title === title)).toBe(true);
  });
});

test.describe("ATLAS OS API — broadcast validation", () => {
  test("POST /api/broadcasts rejects invalid JSON with 400", async ({
    request,
  }) => {
    const res = await request.post("/api/broadcasts", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("}{"),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body.");
  });

  test("POST /api/broadcasts requires a non-empty message", async ({
    request,
  }) => {
    for (const data of [{}, { message: "" }, { message: "   " }, { message: 7 }]) {
      const res = await request.post("/api/broadcasts", { data });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("`message` is required.");
    }
  });

  test("GET /api/broadcasts returns a newest-first history", async ({
    request,
  }) => {
    const marker = `History probe ${Date.now()}`;
    const post = await request.post("/api/broadcasts", {
      data: { message: marker, audience: "all" },
    });
    expect(post.status()).toBe(201);

    const res = await request.get("/api/broadcasts");
    expect(res.status()).toBe(200);
    const { broadcasts } = (await res.json()) as {
      broadcasts: Array<{ message: string; createdAt: string }>;
    };
    expect(Array.isArray(broadcasts)).toBe(true);
    expect(broadcasts.some((b) => b.message === marker)).toBe(true);

    // Newest first: timestamps are non-increasing down the list.
    const times = broadcasts.map((b) => new Date(b.createdAt).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sorted);
  });
});

test.describe("ATLAS OS API — sensor ingestion validation", () => {
  const validPoint = () => ({
    tag: "sensor.temp.air",
    floorKey: "residences-a",
    kind: "temperature",
    value: 21.5,
    unitOfMeasure: "degC",
    markers: ["air", "temp", "sensor"],
  });

  test("POST /api/sensors rejects invalid JSON with 400", async ({
    request,
  }) => {
    const res = await request.post("/api/sensors", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("nope"),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body.");
  });

  test("POST /api/sensors enforces each required field on a single point", async ({
    request,
  }) => {
    const cases: Array<{ patch: Record<string, unknown>; error: string }> = [
      { patch: { tag: "  " }, error: "`tag` is required." },
      { patch: { floorKey: "" }, error: "`floorKey` is required." },
      { patch: { kind: "" }, error: "`kind` is required." },
      { patch: { value: "21.5" }, error: "`value` must be a number." },
      { patch: { value: Number.NaN }, error: "`value` must be a number." },
      { patch: { unitOfMeasure: "" }, error: "`unitOfMeasure` is required." },
      {
        patch: { markers: "air" },
        error: "`markers` must be an array of strings.",
      },
      {
        patch: { markers: [1, 2] },
        error: "`markers` must be an array of strings.",
      },
    ];
    for (const { patch, error } of cases) {
      const res = await request.post("/api/sensors", {
        data: { ...validPoint(), ...patch },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(error);
    }
  });

  test("POST /api/sensors ingests a single valid point with 201", async ({
    request,
  }) => {
    const res = await request.post("/api/sensors", { data: validPoint() });
    expect(res.status()).toBe(201);
    const { point } = (await res.json()) as {
      point: { tag: string; floorKey: string; value: number };
    };
    expect(point.tag).toBe("sensor.temp.air");
    expect(point.floorKey).toBe("residences-a");
    expect(point.value).toBe(21.5);
  });

  test("POST /api/sensors rejects an empty batch", async ({ request }) => {
    const res = await request.post("/api/sensors", { data: { points: [] } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("`points` must not be empty.");
  });

  test("POST /api/sensors reports the failing index in a batch", async ({
    request,
  }) => {
    const res = await request.post("/api/sensors", {
      data: { points: [validPoint(), { ...validPoint(), value: "bad" }] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("points[1]: `value` must be a number.");
  });

  test("POST /api/sensors ingests a valid batch with 201", async ({
    request,
  }) => {
    const res = await request.post("/api/sensors", {
      data: { points: [validPoint(), validPoint(), validPoint()] },
    });
    expect(res.status()).toBe(201);
    const { points } = (await res.json()) as { points: unknown[] };
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBe(3);
  });

  test("GET /api/sensors returns points and honours the floor filter", async ({
    request,
  }) => {
    await request.post("/api/sensors", { data: validPoint() });

    const all = await request.get("/api/sensors");
    expect(all.status()).toBe(200);
    const allBody = (await all.json()) as {
      points: Array<{ floorKey: string }>;
    };
    expect(Array.isArray(allBody.points)).toBe(true);
    expect(allBody.points.length).toBeGreaterThan(0);

    const filtered = await request.get("/api/sensors?floor=residences-a");
    expect(filtered.status()).toBe(200);
    const filteredBody = (await filtered.json()) as {
      points: Array<{ floorKey: string }>;
    };
    expect(filteredBody.points.every((p) => p.floorKey === "residences-a")).toBe(
      true,
    );
  });
});
