import { type AiTaskId, type AiTaskInput, type AiTaskOutput, AI_TASKS } from "./tasks/catalog";
import { type RunTaskResponse, RunTaskResponseSchema } from "./api";

export interface AiClientOptions {
	/** apps/ai-platform base URL (server-side only). */
	baseUrl: string;
	/** Short-lived context token (org, user) minted by the caller's auth layer. */
	token: () => string | Promise<string>;
	fetcher?: typeof fetch;
	timeoutMs?: number;
}

export class AiClientError extends Error {
	constructor(
		message: string,
		readonly status: number,
		/** Stable machine-readable reason from the platform's problem body, e.g. `provider_rate_limited` (429) or `provider_insufficient_quota` (402). */
		readonly code?: string,
		/** The platform's `Retry-After` hint, in milliseconds, when it sent one. */
		readonly retryAfterMs?: number,
	) {
		super(message);
		this.name = "AiClientError";
	}
}

/** `Retry-After` in seconds (the only form the platform and Vercel send), as ms; undefined when absent or not a number. */
function retryAfterMs(response: Response): number | undefined {
	const seconds = Number(response.headers.get("retry-after"));
	return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : undefined;
}

/**
 * Typed client for the task API. The only way app code should reach a model:
 * `await ai.runTask("content.translate", { targetLocale: "ms-MY", fields })`.
 */
export function createAiClient(options: AiClientOptions) {
	const base = options.baseUrl.replace(/\/+$/, "");
	const fetcher = options.fetcher ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

	async function runTask<T extends AiTaskId>(
		taskId: T,
		input: AiTaskInput<T>,
		init: { signal?: AbortSignal; requestId?: string } = {},
	): Promise<RunTaskResponse<AiTaskOutput<T>>> {
		const timeout = AbortSignal.timeout(options.timeoutMs ?? 90_000);
		const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
		const response = await fetcher(`${base}/v1/tasks/${encodeURIComponent(taskId)}/run`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${await options.token()}`,
				"content-type": "application/json",
				...(init.requestId ? { "idempotency-key": init.requestId } : {}),
			},
			body: JSON.stringify({ input }),
			signal,
		});
		const body = (await response.json().catch(() => null)) as { detail?: unknown; code?: unknown } | null;
		if (!response.ok) {
			const detail = typeof body?.detail === "string" ? body.detail : `AI task ${taskId} failed (${response.status})`;
			throw new AiClientError(detail, response.status, typeof body?.code === "string" ? body.code : undefined, retryAfterMs(response));
		}
		const parsed = RunTaskResponseSchema.parse(body);
		return { ...parsed, output: AI_TASKS[taskId].output.parse(parsed.output) as AiTaskOutput<T> };
	}

	return { runTask };
}

export type AiClient = ReturnType<typeof createAiClient>;
