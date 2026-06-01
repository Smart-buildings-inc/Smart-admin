import { NextResponse } from "next/server";
import { getFloors } from "@/lib/data";

export const dynamic = "force-dynamic";

// GET /api/floors — all floors, ordered bottom → top.
export async function GET() {
  const floors = await getFloors();
  return NextResponse.json({ floors });
}
