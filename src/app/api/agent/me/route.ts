import { NextRequest, NextResponse } from "next/server";
import { convexClient, sha256 } from "@/lib/convex";
import { api } from "../../../../../convex/_generated/api";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid Authorization header format" },
        { status: 401 }
      );
    }

    const apiKey = match[1];
    const apiKeyHash = sha256(apiKey);

    const agent = await convexClient.query(api.agents.getMe, { apiKeyHash });

    return NextResponse.json(agent);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 401 }
    );
  }
}
