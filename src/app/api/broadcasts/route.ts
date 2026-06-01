import { NextResponse } from "next/server";
import { createBroadcast, getBroadcasts } from "@/lib/data";

export const dynamic = "force-dynamic";

// GET /api/broadcasts — broadcast history, newest first.
export async function GET() {
  const broadcasts = await getBroadcasts();
  return NextResponse.json({ broadcasts });
}

// POST /api/broadcasts — send a resident broadcast (mirrors into the feed).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, audience } = (body ?? {}) as Record<string, unknown>;

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "`message` is required." },
      { status: 400 },
    );
  }

  const broadcast = await createBroadcast({
    message: message.trim(),
    audience: typeof audience === "string" ? audience : undefined,
  });

  return NextResponse.json({ broadcast }, { status: 201 });
}
