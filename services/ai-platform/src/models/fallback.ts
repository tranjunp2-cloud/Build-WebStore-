import { Logger } from "@nestjs/common";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import type { ResolvedModel } from "./model-registry";

export interface FallbackAttempt {
	provider: string;
	model: string;
	error: string;
}

/**
 * Worth trying the next provider: rate limits, provider outages, timeouts,
 * network failures, or a model that could not produce the required object.
 * Bad requests (our bug or invalid input) are not retried elsewhere.
 */
export function isFallbackWorthy(error: unknown): boolean {
	// The SDK retries transient errors itself and then wraps the last one.
	if (RetryError.isInstance(error)) return isFallbackWorthy(error.lastError);
	if (APICallError.isInstance(error)) {
		const status = error.statusCode ?? 0;
		return error.isRetryable || status === 429 || status >= 500 || status === 0;
	}
	if (NoObjectGeneratedError.isInstance(error)) return true;
	const name = error instanceof Error ? error.name : "";
	return /timeout|abort|fetch|network|econn/i.test(name) || /timed out|ECONNREFUSED|fetch failed/i.test(String(error));
}

/**
 * The provider account has no credit left (OpenAI 429 `insufficient_quota`, DeepSeek 402
 * "Insufficient Balance", Anthropic 400 "credit balance is too low"). Retrying cannot help and a
 * plain rate limit (also 429) must not be mistaken for it, so this needs the provider's own wording.
 */
const BILLING_EXHAUSTED =
	/insufficient[_ ]quota|exceeded your current quota|insufficient (?:balance|funds|credit)|credit balance is too low|out of credits?|billing (?:hard )?limit/i;

export function isProviderBillingError(error: unknown): boolean {
	if (RetryError.isInstance(error)) return isProviderBillingError(error.lastError);
	if (!APICallError.isInstance(error)) return false;
	const status = error.statusCode ?? 0;
	if (status === 402) return true;
	if (status !== 400 && status !== 403 && status !== 429) return false;
	return BILLING_EXHAUSTED.test(`${error.message} ${error.responseBody ?? ""}`);
}

/** Stable `AgentError.code` / ledger error code for "every provider answered 429 (rate limit, not billing)". */
export const PROVIDER_RATE_LIMITED = "provider_rate_limited";

/** A plain provider rate limit (HTTP 429). Check `isProviderBillingError` first: exhausted credit can also be a 429. */
export function isProviderRateLimitError(error: unknown): boolean {
	if (RetryError.isInstance(error)) return isProviderRateLimitError(error.lastError);
	return APICallError.isInstance(error) && error.statusCode === 429;
}

const logger = new Logger("ModelFallback");

/** Provider error summary for logs — status and message only, never the prompt. */
export function describeModelError(error: unknown): string {
	if (RetryError.isInstance(error)) return describeModelError(error.lastError);
	if (!(error instanceof Error)) return String(error).slice(0, 300);
	const status = APICallError.isInstance(error) && error.statusCode ? ` ${error.statusCode}` : "";
	return `${error.name}${status}: ${error.message.slice(0, 300)}`;
}

/**
 * Runs `attempt` on each candidate of an alias chain until one succeeds.
 * `onFailure` lets the caller ledger every failed attempt.
 */
export async function runWithFallback<T>(
	chain: ResolvedModel[],
	attempt: (model: ResolvedModel) => Promise<T>,
	options: {
		onFailure?: (model: ResolvedModel, error: unknown, latencyMs: number) => Promise<void> | void;
		canFallback?: () => boolean;
	} = {},
): Promise<{ value: T; model: ResolvedModel; latencyMs: number; fallbacks: FallbackAttempt[] }> {
	const fallbacks: FallbackAttempt[] = [];
	for (const [index, candidate] of chain.entries()) {
		const t0 = Date.now();
		try {
			const value = await attempt(candidate);
			return { value, model: candidate, latencyMs: Date.now() - t0, fallbacks };
		} catch (error) {
			logger.warn(`${candidate.provider}:${candidate.modelId} failed — ${describeModelError(error)}`);
			await options.onFailure?.(candidate, error, Date.now() - t0);
			const last = index === chain.length - 1;
			if (last || !isFallbackWorthy(error) || options.canFallback?.() === false) throw error;
			fallbacks.push({
				provider: candidate.provider,
				model: candidate.modelId,
				error: error instanceof Error ? error.name : "error",
			});
		}
	}
	throw new Error("empty model chain");
}
