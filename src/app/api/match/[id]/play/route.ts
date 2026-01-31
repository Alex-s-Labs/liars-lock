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
    const { choice, claim, message } = body;

    if (choice !== 0 && choice !== 1) {
      return NextResponse.json(
        { error: "Choice must be 0 or 1" },
        { status: 400 }
      );
    }

    if (claim !== 0 && claim !== 1) {
      return NextResponse.json(
        { error: "Claim must be 0 or 1" },
        { status: 400 }
      );
    }

    const result = await convexClient.mutation(api.matches.play, {
      matchId: id as Id<"matches">,
      agentId: agent._id,
      choice,
      claim,
      message: message || undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Play submission failed" },
      { status: 400 }
    );
  }
}
