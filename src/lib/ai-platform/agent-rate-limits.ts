import "server-only";

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import type { AgentActor } from "./context";

/**
 * Per-user limits on the BFF routes that cost money or storage before ai-platform's own quotas apply: a picture is
 * a paid model call (and ai-platform's daily count is checked before it records), an attachment stores up to 3 MB and
 * runs the document readers. Counted with the shared limiter (Upstash, in-memory fallback, QC lane bypass).
 */
export const AGENT_RATE_LIMITS = {
	/** "Generate" a picture: 10 per user per hour */
	picture: { key: "ai:image", limit: 10, windowMs: 3_600_000, what: (n: number) => `You generated ${n} pictures in the last hour` },
	/** upload a file or pick a picture into the chat (one count for both): 30 per user per 10 minutes */
	attachment: { key: "ai:attach", limit: 30, windowMs: 600_000, what: (n: number) => `You attached ${n} files in the last 10 minutes` },
} as const;

export type AgentRateLimitName = keyof typeof AGENT_RATE_LIMITS;

const waitWords = (seconds: number) => (seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`);

/** null when the user may go on; otherwise the 429 to answer with (plain message, `Retry-After` in seconds). */
export async function agentRateLimited(name: AgentRateLimitName, actor: Pick<AgentActor, "user">, now = Date.now()): Promise<NextResponse | null> {
	const rule = AGENT_RATE_LIMITS[name];
	const result = await checkRateLimit(`${rule.key}:${actor.user.id}`, rule.limit, rule.windowMs);
	if (result.allowed) return null;
	const retryAfter = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
	const detail = `${rule.what(rule.limit)}. Try again in ${waitWords(retryAfter)}.`;
	return NextResponse.json(
		{ title: "Too many requests", status: 429, detail },
		{ status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "private, no-store" } },
	);
}
