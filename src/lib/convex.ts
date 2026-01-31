import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { createHash } from "crypto";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convexClient = new ConvexHttpClient(convexUrl);

// Hash a string using SHA-256
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Authenticate agent from Authorization header
export async function authenticateAgent(authHeader: string | null) {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new Error("Invalid Authorization header format");
  }

  const apiKey = match[1];
  const apiKeyHash = sha256(apiKey);

  const agent = await convexClient.query(api.agents.getByApiKey, { apiKeyHash });

  if (!agent) {
    throw new Error("Invalid API key");
  }

  // Gate: only verified agents (or grandfathered agents without twitter field) can use authenticated endpoints
  if (agent.twitter && agent.verified !== true) {
    throw new Error("Agent not verified. Complete Twitter verification first.");
  }

  return agent;
}
