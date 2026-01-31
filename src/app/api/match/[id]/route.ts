import { NextRequest, NextResponse } from "next/server";
import { convexClient, sha256 } from "@/lib/convex";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Optional auth - if provided, show player-specific info
    const authHeader = req.headers.get("authorization");
    let agentId: Id<"agents"> | undefined;

    if (authHeader) {
      const match = authHeader.match(/^Bearer (.+)$/);
      if (match) {
        const apiKey = match[1];
        const apiKeyHash = sha256(apiKey);
        const agent = await convexClient.query(api.agents.getByApiKey, { apiKeyHash });
        if (agent) {
          agentId = agent._id;
        }
      }
    }

    const matchData = await convexClient.query(api.matches.get, {
      matchId: id as Id<"matches">,
      agentId,
    });

    if (!matchData) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(matchData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch match" },
      { status: 500 }
    );
  }
}
