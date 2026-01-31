import { NextRequest, NextResponse } from "next/server";
import { convexClient, authenticateAgent } from "@/lib/convex";
import { api } from "../../../../../convex/_generated/api";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const agent = await authenticateAgent(authHeader);

    const result = await convexClient.mutation(api.matchmaking.findMatch, {
      agentId: agent._id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Matchmaking failed" },
      { status: 400 }
    );
  }
}
