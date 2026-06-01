import { NextResponse } from "next/server";
import { createIncident, getIncidents } from "@/lib/data";
import type { Severity } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITIES: Severity[] = ["crit", "warn", "info", "ok"];

// GET /api/incidents — severity-ranked feed, newest first.
export async function GET() {
  const incidents = await getIncidents();
  return NextResponse.json({ incidents });
}

// POST /api/incidents — create a new incident/event.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { severity, title, floorKey, detail } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "`title` is required." },
      { status: 400 },
    );
  }
  if (typeof severity !== "string" || !SEVERITIES.includes(severity as Severity)) {
    return NextResponse.json(
      { error: `\`severity\` must be one of: ${SEVERITIES.join(", ")}.` },
      { status: 400 },
    );
  }

  const incident = await createIncident({
    severity: severity as Severity,
    title: title.trim(),
    floorKey: typeof floorKey === "string" ? floorKey : null,
    detail: typeof detail === "string" ? detail : undefined,
  });

  return NextResponse.json({ incident }, { status: 201 });
}
