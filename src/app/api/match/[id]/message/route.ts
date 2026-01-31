import { NextRequest, NextResponse } from "next/server";
import { convexClient, authenticateAgent } from "@/lib/convex";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const agent = await authenticateAgent(authHeader);

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const result = await convexClient.mutation(api.matches.message, {
      matchId: id as Id<"matches">,
      agentId: agent._id,
      message,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Message submission failed" },
      { status: 400 }
    );
  }
}
