import "server-only";

import { AiPlatformError } from "./upstream";

/**
 * Waits before the 2nd, 3rd and 4th try of recording on ai-platform what prime-web already did (an applied
 * approval, an undo). The write is live by then, so a gateway hiccup must not leave the card pending (H-R1).
 */
export const RECORD_RETRY_DELAYS_MS: readonly number[] = [300, 1_000, 3_000];

const TRANSIENT = new Set([502, 503, 504]);

/** Unreachable, 502/503/504 or a timeout: worth another try. A 4xx answer would not change. */
export function isTransientUpstreamError(error: unknown): boolean {
	if (error instanceof AiPlatformError) return TRANSIENT.has(error.status);
	// fetch's own network failure (callAiPlatform normally turns it into a 502)
	return error instanceof TypeError;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `record()` with retries on transient failures only. A 409 after a failed try usually means that try did land
 * (the answer was lost on the way back): `landed()` reads what is stored and, when it is the recorded state,
 * that is the answer. Throws the last error when every try failed.
 */
export async function recordWithRetry<T>(
	record: () => Promise<T>,
	landed?: () => Promise<T | null>,
	delays: readonly number[] = RECORD_RETRY_DELAYS_MS,
): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await record();
		} catch (error) {
			if (attempt > 0 && landed && error instanceof AiPlatformError && error.status === 409) {
				const stored = await landed().catch(() => null);
				if (stored) return stored;
			}
			const delay = delays[attempt];
			if (delay === undefined || !isTransientUpstreamError(error)) throw error;
			await wait(delay);
		}
	}
}
