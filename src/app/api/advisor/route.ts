import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/advisor";

export const dynamic = "force-dynamic";

// GET /api/advisor — ranked operational recommendations (heuristic + optional AI).
export async function GET() {
  const recommendations = await getRecommendations();
  return NextResponse.json({ recommendations });
}
