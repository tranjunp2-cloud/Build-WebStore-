import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { AI_PLATFORM_CONFIG_FEATURE, AiPlatformConfigSchema, type AiPlatformConfig } from "./ai-config-schema";

export interface AiConfigResponse extends AiPlatformConfig {
	/** when an admin last changed the row; null when there is none */
	updatedAt: string | null;
}

const CACHE_TTL_MS = 60_000;
let cached: { at: number; value: AiConfigResponse } | null = null;

export function clearAiConfigCache(): void {
	cached = null;
}

const EMPTY: AiConfigResponse = { prices: {}, images: {}, models: {}, updatedAt: null };

/**
 * The platform-wide AI config (prices, picture prices, model chains): the single `ai_platform_config` row of
 * `plan-features` whatever its plan; the most recently updated wins if an admin made several. A missing row yields
 * empty maps (ai-platform then uses its env / built-in values). An invalid row (e.g. edited straight in the DB) throws,
 * so the route answers 503 and ai-platform keeps its last good copy. Cached 60 s. Throws on a DB failure.
 */
export async function getAiPlatformConfig(): Promise<AiConfigResponse> {
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
	const payload = await getPayload({ config });
	const rows = await payload.find({
		collection: "plan-features",
		overrideAccess: true,
		where: { featureCode: { equals: AI_PLATFORM_CONFIG_FEATURE } },
		sort: "-updatedAt",
		limit: 1,
		pagination: false,
		depth: 0,
	});
	const row = rows.docs[0];
	let value: AiConfigResponse = EMPTY;
	if (row) {
		const parsed = AiPlatformConfigSchema.safeParse(row.settings ?? {});
		if (parsed.success) value = { ...parsed.data, updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null };
		else throw new Error(`ai_platform_config row is invalid: ${parsed.error.issues[0]?.message ?? "unknown problem"}`);
	}
	cached = { at: Date.now(), value };
	return value;
}
