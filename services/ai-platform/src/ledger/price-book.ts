interface Price {
	/** Fresh (cache-miss) input tokens. */
	input: number;
	/** Cache-read (cache-hit) input tokens. */
	cachedInput: number;
	output: number;
	/** Fraction of the rates charged outside `isPeak` hours (DeepSeek: half). */
	offPeakFactor?: number;
	isPeak?: (at: Date) => boolean;
	/** Rates for a request whose whole prompt (cache hits included) is over `overInputTokens`. */
	longContext?: { overInputTokens: number; input: number; cachedInput: number; output: number };
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
 * USD per 1M tokens. One table for the whole platform (replaces the three
 * diverging tables in prime-web). Unknown models record tokens with a null
 * cost rather than a guessed one; reconcile against gateway logs.
 */
const PRICES: Record<string, Price> = {
	// Standard API rates from https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-29).
	// Cache writes (1.25x input) are not modelled, as for every provider here.
	"anthropic:claude-haiku-5-5": {
		input: 0.1,
		cachedInput: 0.01,
		output: 0.5,
		longContext: { overInputTokens: 100_000, input: 0.5, cachedInput: 0.05, output: 2.5 },
	},
	"anthropic:claude-haiku-4-5": { input: 1, cachedInput: 0.1, output: 5 },
	"anthropic:claude-sonnet-5-5": { input: 2, cachedInput: 0.1, output: 10 },
	"anthropic:claude-sonnet-5": { input: 2, cachedInput: 0.2, output: 10 },
	"anthropic:claude-opus-5-5": { input: 4, cachedInput: 0.2, output: 20 },
	// Standard tier from https://developers.openai.com/api/docs/pricing (read 2026-10-29).
	"openai:gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
	"openai:gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
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
const IMAGE_PRICES: Record<string, number> = {
	"openai:gpt-image-1": 0.042,
	"openai:gpt-image-1-mini": 0.011,
};

export interface TokenUsage {
	/** Pictures generated (picture models bill per picture, not per token). */
	images?: number;
	/** Total prompt tokens, cache hits included. */
	inputTokens?: number;
	outputTokens?: number;
	/** The cache-hit share of `inputTokens`, billed at `cachedInput`. */
	cachedInputTokens?: number;
}

/** Cost in micro-dollars (1e-6 USD), or null when the model has no price. */
export function estimateCostMicros(
	provider: string,
	modelId: string,
	usage: TokenUsage,
	at: Date = new Date(),
): number | null {
	if (usage.images) {
		const each = IMAGE_PRICES[`${provider}:${modelId}`];
		return each === undefined ? null : Math.round(each * usage.images * 1_000_000);
	}
	const listed = PRICES[`${provider}:${modelId}`];
	if (!listed) return null;
	// The whole request is billed at the long-context rates once its prompt passes the threshold.
	const long = listed.longContext;
	const price = long && (usage.inputTokens ?? 0) > long.overInputTokens ? { ...listed, ...long } : listed;
	const cached = usage.cachedInputTokens ?? 0;
	const freshInput = Math.max(0, (usage.inputTokens ?? 0) - cached);
	const factor = price.isPeak && !price.isPeak(at) ? (price.offPeakFactor ?? 1) : 1;
	const usd =
		((freshInput * price.input + cached * price.cachedInput + (usage.outputTokens ?? 0) * price.output) * factor) /
		1_000_000;
	return Math.round(usd * 1_000_000);
}
