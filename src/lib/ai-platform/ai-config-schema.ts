import { z } from "zod";

/** featureCode of the platform-wide AI config row in `plan-features` (stored once, under FREEMIUM). */
export const AI_PLATFORM_CONFIG_FEATURE = "ai_platform_config";
export const AI_BUDGET_FEATURE = "ai_budget_usd_daily";
export const AI_PICTURES_FEATURE = "ai_pictures_daily";

const usd = z.number().finite().nonnegative();
/** "provider:model", e.g. "anthropic:claude-haiku-5-5" */
const modelKey = z.string().regex(/^[a-z0-9_-]+:[^\s,]+$/i, 'key must look like "provider:model"');

const priceShape = {
	/** USD per 1M tokens */
	input: usd,
	output: usd,
	cachedInput: usd.optional(),
	cacheWrite: usd.optional(),
};

const price = z
	.object({
		...priceShape,
		/** multiplier applied off-peak (DeepSeek) */
		offPeakFactor: usd.optional(),
		/** higher rates once a single call's input passes the threshold */
		longContext: z.object({ aboveInputTokens: z.number().int().positive(), ...priceShape }).strict().optional(),
	})
	.strict();

const modelChain = z.string().trim().min(1);

export const AiPlatformConfigSchema = z
	.object({
		prices: z.record(modelKey, price).default({}),
		images: z.record(modelKey, usd).default({}),
		models: z
			.object({ fast: modelChain.optional(), balanced: modelChain.optional(), quality: modelChain.optional(), image: modelChain.optional() })
			.strict()
			.default({}),
	})
	.strict();
export type AiPlatformConfig = z.infer<typeof AiPlatformConfigSchema>;

/** First problem of a config JSON as a sentence an admin can act on, or null when valid. */
export function aiConfigProblem(settings: unknown): string | null {
	const parsed = AiPlatformConfigSchema.safeParse(settings);
	if (parsed.success) return null;
	const issue = parsed.error.issues[0];
	const where = issue?.path.length ? issue.path.join(".") : "settings";
	return `AI platform config is invalid at "${where}": ${issue?.message ?? "unknown problem"}`;
}

/** A plan limit value: UNLIMITED or a non-negative number (integer for pictures); "0" turns the feature off. */
export function aiLimitProblem(featureCode: string, value: unknown): string | null {
	const integer = featureCode === AI_PICTURES_FEATURE;
	const text = typeof value === "string" ? value.trim() : "";
	if (text.toUpperCase() === "UNLIMITED") return null;
	const number = Number(text);
	if (text && Number.isFinite(number) && number >= 0 && (!integer || Number.isInteger(number))) return null;
	return `${featureCode} must be ${integer ? "a whole number" : "a number"} of 0 or more, or UNLIMITED (got "${text}").`;
}
