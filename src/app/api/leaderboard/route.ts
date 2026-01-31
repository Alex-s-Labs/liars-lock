import { NextRequest, NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { api } from "../../../../convex/_generated/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const leaderboard = await convexClient.query(api.leaderboard.getLeaderboard, {
      limit,
    });

    return NextResponse.json(leaderboard);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
