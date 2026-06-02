import { NextResponse } from "next/server";
import { getPresence } from "@/lib/ruview";

export const dynamic = "force-dynamic";

// GET /api/presence[?floor=<floorKey>]
//
// Returns per-floor WiFi-CSI presence summaries powered by RuView.
// When RUVIEW_API_URL is configured, reads live from the RuView REST API;
// otherwise derives presence from seed floor data (local-first, no hardware
// required). The response shape always matches FloorPresence[].
//
// Response: { presence: FloorPresence[] }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const floor = searchParams.get("floor")?.trim() || undefined;
  const presence = await getPresence(floor);
  return NextResponse.json({ presence });
}
