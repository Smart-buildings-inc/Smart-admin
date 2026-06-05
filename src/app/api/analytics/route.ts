import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics-data";

export const dynamic = "force-dynamic";

// GET /api/analytics — derived building-health summary (advisory, per OPR §4).
export async function GET() {
  const summary = await getAnalyticsSummary();
  return NextResponse.json(summary);
}
