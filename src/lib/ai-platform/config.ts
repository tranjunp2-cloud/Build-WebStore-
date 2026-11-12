import "server-only";

/**
 * prime-web → apps/ai-platform wiring. The AI platform is the only service
 * that calls models; prime-web reaches it server-side and the browser only
 * ever talks to /api/agent on this origin.
 */
export function getAiPlatformUrl(): string | null {
	const url = process.env.AI_PLATFORM_URL?.trim();
	return url ? url.replace(/\/+$/, "") : null;
}

export function getAiPlatformContextSecret(): string | null {
	const secret = process.env.AI_PLATFORM_CONTEXT_SECRET?.trim();
	return secret && secret.length >= 32 ? secret : null;
}

function isProductionDeploy(): boolean {
	return (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === "production";
}

/**
 * The agent mascot runs against the real AI platform only when it is
 * configured. AI_AGENT_ENABLED: unset = on outside production; "false" = off
 * everywhere (kill switch, also on staging/preview); production needs "true".
 */
export function isAiAgentEnabled(): boolean {
	if (!getAiPlatformUrl() || !getAiPlatformContextSecret()) return false;
	const flag = process.env.AI_AGENT_ENABLED?.trim().toLowerCase();
	if (flag === "false") return false;
	return flag === "true" || !isProductionDeploy();
}

/**
 * Every model call prime-web makes is a platform task. Without the platform
 * configured, AI features answer 503 or fall back to their non-AI path.
 */
export function isAiTasksEnabled(): boolean {
	return Boolean(getAiPlatformUrl() && getAiPlatformContextSecret());
}

export const AI_UNAVAILABLE_MESSAGE = "AI features are not available right now.";
