import { NextRequest, NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { api } from "../../../../../convex/_generated/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const agent = await convexClient.query(api.agents.getByName, { name });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch agent" },
      { status: 500 }
    );
  }
}
