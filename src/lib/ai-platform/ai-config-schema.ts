import { z } from "zod";

/** featureCode of the platform-wide AI config row in `plan-features` (stored once, under FREEMIUM). */
export const AI_PLATFORM_CONFIG_FEATURE = "ai_platform_config";
export const AI_BUDGET_FEATURE = "ai_budget_usd_daily";
export const AI_PICTURES_FEATURE = "ai_pictures_daily";
/** YES / NO: AI on or off for the plan (a missing row counts as YES). */
export const AI_ENABLED_FEATURE = "ai_enabled";
/** USD per calendar month (Malaysia time) a shop on the plan may spend; UNLIMITED or a number. */
export const AI_BUDGET_MONTHLY_FEATURE = "ai_budget_usd_monthly";
/** USD per rolling 24 h for the website-setup tasks (`sitegen.*`); UNLIMITED or a number. */
export const AI_SITE_BUDGET_FEATURE = "ai_site_budget_usd_daily";
/** Every plan-features code that feeds the `lim` token claim. */
export const AI_PLAN_LIMIT_FEATURES = [
	AI_BUDGET_FEATURE,
	AI_PICTURES_FEATURE,
	AI_ENABLED_FEATURE,
	AI_BUDGET_MONTHLY_FEATURE,
	AI_SITE_BUDGET_FEATURE,
] as const;
export type AiPlanLimitFeature = (typeof AI_PLAN_LIMIT_FEATURES)[number];
export const isAiPlanLimitFeature = (code: unknown): code is AiPlanLimitFeature =>
	(AI_PLAN_LIMIT_FEATURES as readonly unknown[]).includes(code);

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

const capUsd = z.number().finite().nonnegative().nullable();
const percent = z.number().int().min(1).max(100);

/**
 * Platform-wide spend caps (`ai_platform_config.settings.caps`). `dailyUsd`: a number sets the cap, null turns it off,
 * absent keeps the env default (AI_DAILY_BUDGET_USD). `monthlyUsd`: null / absent = no monthly cap.
 * `pauseFreeAtPercent`: share of the daily or monthly cap at which FREEMIUM shops pause first (null = everyone pauses at 100 %).
 */
export const AiCapsSchema = z
	.object({
		dailyUsd: capUsd.optional(),
		monthlyUsd: capUsd.optional(),
		alertPercents: z
			.array(percent)
			.max(10)
			.refine((list) => list.every((value, index) => index === 0 || value > list[index - 1]!), {
				message: "alert percents must be whole numbers from 1 to 100, ascending, without repeats",
			})
			.optional(),
		pauseFreeAtPercent: percent.nullable().optional(),
	})
	.strict();
export type AiCaps = z.infer<typeof AiCapsSchema>;

export const AiPlatformConfigSchema = z
	.object({
		prices: z.record(modelKey, price).default({}),
		images: z.record(modelKey, usd).default({}),
		models: z
			.object({ fast: modelChain.optional(), balanced: modelChain.optional(), quality: modelChain.optional(), image: modelChain.optional() })
			.strict()
			.default({}),
		caps: AiCapsSchema.optional(),
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

/**
 * A plan limit value. Budgets / pictures: UNLIMITED (or YES, as parseLimit reads it) or a non-negative number
 * (integer for pictures); "0" turns the feature off. ai_enabled: YES or NO.
 */
export function aiLimitProblem(featureCode: string, value: unknown): string | null {
	const text = typeof value === "string" ? value.trim() : "";
	const upper = text.toUpperCase();
	if (featureCode === AI_ENABLED_FEATURE) {
		return upper === "YES" || upper === "NO" ? null : `${featureCode} must be YES or NO (got "${text}").`;
	}
	const integer = featureCode === AI_PICTURES_FEATURE;
	if (upper === "UNLIMITED" || upper === "YES") return null;
	const number = Number(text);
	if (text && Number.isFinite(number) && number >= 0 && (!integer || Number.isInteger(number))) return null;
	return `${featureCode} must be ${integer ? "a whole number" : "a number"} of 0 or more, or UNLIMITED (got "${text}").`;
}
