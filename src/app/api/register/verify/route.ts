import { NextRequest, NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { api } from "../../../../../convex/_generated/api";
import { fetchTwitterBio } from "@/lib/twitter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, twitter } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!twitter) {
      return NextResponse.json(
        { error: "Twitter handle is required" },
        { status: 400 }
      );
    }

    // Strip @ if present
    const handle = twitter.startsWith("@") ? twitter.slice(1) : twitter;

    // Fetch Twitter bio
    let bioContent: string;
    try {
      bioContent = await fetchTwitterBio(handle);
    } catch (error: any) {
      return NextResponse.json(
        {
          error: `Could not fetch Twitter profile for @${handle}. Make sure the account exists and is public. Details: ${error.message}`,
        },
        { status: 400 }
      );
    }

    // Verify with Convex (checks code in bio, issues API key)
    const result = await convexClient.mutation(api.agents.verifyRegistration, {
      name,
      twitter: handle,
      bioContent,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 400 }
    );
  }
}
