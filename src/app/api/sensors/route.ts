import { NextResponse } from "next/server";
import {
  getSensorPoints,
  ingestSensorPoint,
  ingestSensorPoints,
  type NewSensorPoint,
} from "@/lib/sensors";

export const dynamic = "force-dynamic";

// GET /api/sensors[?floor=<floorKey>] — tagged points, newest reading first.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const floor = searchParams.get("floor")?.trim() || undefined;
  const points = await getSensorPoints(floor);
  return NextResponse.json({ points });
}

/**
 * Validate one raw point payload into a `NewSensorPoint`. Returns an error
 * string when a required field is missing/malformed, otherwise the parsed point.
 */
function parsePoint(
  raw: unknown,
): { point: NewSensorPoint } | { error: string } {
  const {
    id,
    tag,
    markers,
    floorKey,
    unit,
    kind,
    value,
    unitOfMeasure,
    ts,
  } = (raw ?? {}) as Record<string, unknown>;

  if (typeof tag !== "string" || tag.trim().length === 0) {
    return { error: "`tag` is required." };
  }
  if (typeof floorKey !== "string" || floorKey.trim().length === 0) {
    return { error: "`floorKey` is required." };
  }
  if (typeof kind !== "string" || kind.trim().length === 0) {
    return { error: "`kind` is required." };
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { error: "`value` must be a number." };
  }
  if (typeof unitOfMeasure !== "string" || unitOfMeasure.trim().length === 0) {
    return { error: "`unitOfMeasure` is required." };
  }
  if (
    markers !== undefined &&
    !(Array.isArray(markers) && markers.every((m) => typeof m === "string"))
  ) {
    return { error: "`markers` must be an array of strings." };
  }

  return {
    point: {
      id: typeof id === "string" ? id : undefined,
      tag: tag.trim(),
      markers: markers as string[] | undefined,
      floorKey: floorKey.trim(),
      unit: typeof unit === "string" ? unit : undefined,
      kind: kind.trim(),
      value,
      unitOfMeasure: unitOfMeasure.trim(),
      ts: typeof ts === "string" ? ts : undefined,
    },
  };
}

// POST /api/sensors — ingest a single point or a { points: [...] } batch.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const batch = (body ?? {}) as Record<string, unknown>;

  // Batch form: { points: [...] }
  if (Array.isArray(batch.points)) {
    if (batch.points.length === 0) {
      return NextResponse.json(
        { error: "`points` must not be empty." },
        { status: 400 },
      );
    }
    const parsed: NewSensorPoint[] = [];
    for (let i = 0; i < batch.points.length; i++) {
      const result = parsePoint(batch.points[i]);
      if ("error" in result) {
        return NextResponse.json(
          { error: `points[${i}]: ${result.error}` },
          { status: 400 },
        );
      }
      parsed.push(result.point);
    }
    const points = await ingestSensorPoints(parsed);
    return NextResponse.json({ points }, { status: 201 });
  }

  // Single-point form.
  const result = parsePoint(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const point = await ingestSensorPoint(result.point);
  return NextResponse.json({ point }, { status: 201 });
}
