import "server-only";

import { randomUUID } from "node:crypto";
import { getAiPlatformUrl } from "./config";
import { currentRequestId, REQUEST_ID_HEADER } from "./request-id";

export class AiPlatformError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export interface AiPlatformRequest {
	method: string;
	path: string;
	token: string;
	body?: string;
	/** defaults to application/json when a body is sent */
	contentType?: string;
	accept?: string;
	signal?: AbortSignal;
	/**
	 * Give up after this many ms (504). Without a `signal`, JSON calls default to 10 s; with one (the browser's
	 * request, a caller's own limit) only this adds a timeout. Streams (text/event-stream) never get the default.
	 */
	timeoutMs?: number;
	/**
	 * Sent as `x-request-id` so the call can be found in ai-platform's logs. Defaults to the id of the browser request
	 * being handled (`withRequestId`), else a new uuid.
	 */
	requestId?: string;
}

/** A BFF → ai-platform JSON call that hangs pins the prime-web function; this is the most it waits by default. */
export const AI_PLATFORM_TIMEOUT_MS = 10_000;

function requestSignal(request: AiPlatformRequest): AbortSignal | undefined {
	const { signal, timeoutMs } = request;
	if (signal) return timeoutMs ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : signal;
	// a run streams for minutes: only the caller's signal (the browser leaving) may end it
	if (!timeoutMs && request.accept?.includes("text/event-stream")) return undefined;
	return AbortSignal.timeout(timeoutMs ?? AI_PLATFORM_TIMEOUT_MS);
}

/** What a failed fetch (or body read) tells the caller: a timeout is 504, anything else 502. */
function upstreamFailure(error: unknown): AiPlatformError {
	if (error instanceof AiPlatformError) return error;
	if ((error as { name?: unknown } | null)?.name === "TimeoutError") {
		return new AiPlatformError("The AI platform took too long to answer.", 504);
	}
	return new AiPlatformError("The AI platform is unreachable.", 502);
}

/** Raw upstream call — the proxy streams the response body straight through. */
export async function callAiPlatform(request: AiPlatformRequest): Promise<Response> {
	const base = getAiPlatformUrl();
	if (!base) throw new AiPlatformError("The AI platform is not configured.", 503);
	try {
		return await fetch(`${base}${request.path}`, {
			method: request.method,
			headers: {
				authorization: `Bearer ${request.token}`,
				accept: request.accept ?? "application/json",
				[REQUEST_ID_HEADER]: request.requestId ?? currentRequestId() ?? randomUUID(),
				...(request.body !== undefined ? { "content-type": request.contentType ?? "application/json" } : {}),
			},
			body: request.body,
			cache: "no-store",
			signal: requestSignal(request),
		});
	} catch (error) {
		throw upstreamFailure(error);
	}
}

/** JSON helper for server-side orchestration; surfaces problem-details text. */
export async function aiPlatformJson<T>(request: Omit<AiPlatformRequest, "accept">): Promise<T> {
	const response = await callAiPlatform(request);
	// the timeout also covers reading the body
	const text = await response.text().catch((error: unknown) => {
		throw upstreamFailure(error);
	});
	let parsed: unknown = null;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		parsed = null;
	}
	if (!response.ok) {
		const detail = (parsed as { detail?: unknown } | null)?.detail;
		throw new AiPlatformError(typeof detail === "string" ? detail : `AI platform ${response.status}`, response.status);
	}
	return parsed as T;
}
