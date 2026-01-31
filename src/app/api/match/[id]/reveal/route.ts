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
    const { choice, nonce } = body;

    if (choice !== 0 && choice !== 1) {
      return NextResponse.json(
        { error: "Choice must be 0 or 1" },
        { status: 400 }
      );
    }

    if (!nonce) {
      return NextResponse.json(
        { error: "Nonce is required" },
        { status: 400 }
      );
    }

    const result = await convexClient.mutation(api.matches.reveal, {
      matchId: id as Id<"matches">,
      agentId: agent._id,
      choice,
      nonce,
    });

    // Check for cheating detection (returned as result, not thrown, to preserve Convex transaction)
    if (result && "error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Reveal failed" },
      { status: 400 }
    );
  }
}
