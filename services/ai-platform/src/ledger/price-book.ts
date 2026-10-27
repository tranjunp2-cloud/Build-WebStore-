export interface Price {
	/** Fresh (cache-miss) input tokens. */
	input: number;
	/** Cache-read (cache-hit) input tokens. */
	cachedInput: number;
	/** Cache-write input tokens (Anthropic bills 1.25x input for the 5-minute TTL); defaults to `input` where writes are not billed separately. */
	cacheWrite?: number;
	output: number;
	/** When one call's total prompt tokens exceed `aboveInputTokens`, these rates replace the base ones (Haiku 5.5: over 100K). */
	longContext?: { aboveInputTokens: number; input: number; output: number; cachedInput?: number; cacheWrite?: number };
	/** Fraction of the rates charged outside `isPeak` hours (DeepSeek: half). */
	offPeakFactor?: number;
	isPeak?: (at: Date) => boolean;
}

/**
 * DeepSeek peak hours: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday. Chinese
 * public holidays are off-peak too; they are not modelled, so those days are
 * over- rather than under-estimated.
 */
export function isDeepSeekPeak(at: Date): boolean {
	const day = at.getUTCDay();
	if (day === 0 || day === 6) return false;
	const hour = at.getUTCHours();
	return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

/**
 * What a ledger row with no known price (cost_usd_micros null: unknown model) is counted as by the
 * AI battery: the deepseek-flash PEAK rates, USD per 1M tokens (= micro-dollars per token). A
 * deliberately pessimistic guess, so an unpriced model still drains the battery instead of being free.
 */
export const UNPRICED_FALLBACK_RATES = { input: 0.3, cachedInput: 0.006, output: 1.2 } as const;

/**
 * Micro-dollars of a call at the fallback rates built from the STORED columns only: the ledger keeps no
 * cache-write column, so cache writes count as fresh input here (priced rows already include them in cost_usd_micros).
 * The SQL in cost/org-battery.ts computes the same; nulls as 0.
 */
export function fallbackCostMicros(usage: {
	inputTokens: number | null;
	cachedInputTokens: number | null;
	outputTokens: number | null;
}): number {
	const cached = usage.cachedInputTokens ?? 0;
	const fresh = Math.max(0, (usage.inputTokens ?? 0) - cached);
	const r = UNPRICED_FALLBACK_RATES;
	return Math.round(fresh * r.input + cached * r.cachedInput + (usage.outputTokens ?? 0) * r.output);
}

const claude = (input: number, output: number, cachedInput: number, extra: Partial<Price> = {}): Price => ({
	input,
	cachedInput,
	cacheWrite: input * 1.25,
	output,
	...extra,
});

/**
 * USD per 1M tokens. One table for the whole platform (replaces the three
 * diverging tables in prime-web). Unknown models record tokens with a null
 * cost rather than a guessed one; reconcile against gateway logs.
 */
export const BUILTIN_PRICES: Record<string, Price> = {
	// Anthropic first-party list prices, USD per 1M tokens (Anthropic docs, cached 2026-10-06).
	// Haiku 5.5 bills 5x on every rate when one call's prompt is over 100K tokens.
	// BUILTIN_* is the fallback and the seed prime-web copies into Payload (ai-pricing); Payload overrides it at runtime.
	"anthropic:claude-haiku-5-5": claude(0.1, 0.5, 0.01, { longContext: { aboveInputTokens: 100_000, input: 0.5, output: 2.5, cachedInput: 0.05, cacheWrite: 0.625 } }),
	"anthropic:claude-haiku-4-5": claude(1, 5, 0.1),
	"anthropic:claude-sonnet-5-5": claude(2, 10, 0.2),
	"anthropic:claude-sonnet-5": claude(2, 10, 0.2),
	"anthropic:claude-sonnet-4-6": claude(3, 15, 0.3),
	"anthropic:claude-opus-5-5": claude(4, 20, 0.2),
	"anthropic:claude-opus-5": claude(5, 25, 0.5),
	"anthropic:claude-opus-4-8": claude(5, 25, 0.5),
	"anthropic:claude-opus-4-7": claude(5, 25, 0.5),
	"anthropic:claude-opus-4-6": claude(5, 25, 0.5),
	"anthropic:claude-fable-5-1": claude(10, 50, 0.25),
	"anthropic:claude-fable-5": claude(10, 50, 1),
	// https://developers.openai.com/api/docs/pricing, standard tier (read 2026-10-26)
	"openai:gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
	// https://ai.google.dev/gemini-api/docs/pricing, standard paid tier, text input (read 2026-10-26)
	"google:gemini-2.5-flash": { input: 0.3, cachedInput: 0.03, output: 2.5 },
	"google:gemini-2.5-flash-lite": { input: 0.1, cachedInput: 0.01, output: 0.4 },
	"openai:gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
	"openai:gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
	"openai:gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
	// Peak rates from https://api-docs.deepseek.com/quick_start/pricing (read 2026-10-20);
	// "Off-peak rates are half of the peak rates". Legacy deepseek-v4-flash is billed at the Flash price.
	"deepseek:deepseek-flash": { input: 0.3, cachedInput: 0.006, output: 1.2, offPeakFactor: 0.5, isPeak: isDeepSeekPeak },
	"deepseek:deepseek-v4-flash": { input: 0.3, cachedInput: 0.006, output: 1.2, offPeakFactor: 0.5, isPeak: isDeepSeekPeak },
	// TypeSafe list price (2026-10): input only, output free. Same rate platform-api meters.
	"typesafe:jev-latest": { input: 0.042, cachedInput: 0.042, output: 0 },
	"deepseek:deepseek-v4-pro": { input: 1.32, cachedInput: 0.044, output: 3.96, offPeakFactor: 0.5, isPeak: isDeepSeekPeak },
};

/**
 * USD per generated picture (1024px, medium quality). Same rule as tokens:
 * unknown models record the count with a null cost.
 */
export const BUILTIN_IMAGE_PRICES: Record<string, number> = {
	"openai:gpt-image-1": 0.042,
	"openai:gpt-image-1-mini": 0.011,
};

export interface TokenUsage {
	/** Pictures generated (picture models bill per picture, not per token). */
	images?: number;
	/** Total prompt tokens, cache hits and cache writes included. */
	inputTokens?: number;
	outputTokens?: number;
	/** The cache-hit share of `inputTokens`, billed at `cachedInput`. */
	cachedInputTokens?: number;
	/** The cache-write share of `inputTokens`, billed at `cacheWrite`. Priced into the cost; never stored. */
	cacheWriteTokens?: number;
}

/** Runtime prices from prime-web (Payload); set by the AI config service. Empty = built-in table only. */
let overridePrices: Record<string, Price> = {};
let overrideImagePrices: Record<string, number> = {};

export function setPriceOverrides(overrides: { prices?: Record<string, Price>; images?: Record<string, number> }): void {
	overridePrices = overrides.prices ?? {};
	overrideImagePrices = overrides.images ?? {};
}

/** `provider:model`, else the same without a trailing `-20251001` / `@20251001` / `-latest` snapshot suffix. */
function lookup<T>(provider: string, modelId: string, ...tables: Record<string, T>[]): T | undefined {
	const base = modelId.replace(/(?:[-@]\d{8}|-latest)$/, "");
	for (const id of base === modelId ? [modelId] : [modelId, base]) {
		for (const table of tables) {
			const hit = table[`${provider}:${id}`];
			if (hit !== undefined) return hit;
		}
	}
	return undefined;
}

/** Payload price first (exact, then suffix-stripped), then the built-in table. */
function findPrice(provider: string, modelId: string): Price | undefined {
	return lookup(provider, modelId, overridePrices, BUILTIN_PRICES);
}

/** Cost in micro-dollars (1e-6 USD), or null when the model has no price. */
export function estimateCostMicros(
	provider: string,
	modelId: string,
	usage: TokenUsage,
	at: Date = new Date(),
): number | null {
	if (usage.images) {
		const each = lookup(provider, modelId, overrideImagePrices, BUILTIN_IMAGE_PRICES);
		return each === undefined ? null : Math.round(each * usage.images * 1_000_000);
	}
	const base = findPrice(provider, modelId);
	if (!base) return null;
	const total = usage.inputTokens ?? 0;
	const long = base.longContext && total > base.longContext.aboveInputTokens ? base.longContext : undefined;
	const scale = long && base.input > 0 ? long.input / base.input : 1;
	const rates = {
		input: long?.input ?? base.input,
		output: long?.output ?? base.output,
		cachedInput: long?.cachedInput ?? base.cachedInput * scale,
		cacheWrite: long?.cacheWrite ?? (base.cacheWrite ?? base.input) * scale,
	};
	const cached = usage.cachedInputTokens ?? 0;
	const written = usage.cacheWriteTokens ?? 0;
	const freshInput = Math.max(0, total - cached - written);
	const factor = base.isPeak && !base.isPeak(at) ? (base.offPeakFactor ?? 1) : 1;
	const usd =
		((freshInput * rates.input + cached * rates.cachedInput + written * rates.cacheWrite + (usage.outputTokens ?? 0) * rates.output) * factor) /
		1_000_000;
	return Math.round(usd * 1_000_000);
}
