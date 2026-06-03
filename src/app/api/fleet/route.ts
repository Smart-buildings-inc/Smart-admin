import { NextResponse } from "next/server";
import { getFleetRollup } from "@/lib/fleet-rollup";

export const dynamic = "force-dynamic";

// GET /api/fleet — fleet-wide rollup aggregated across all buildings.
export async function GET() {
  const rollup = await getFleetRollup();
  return NextResponse.json({ rollup });
}
