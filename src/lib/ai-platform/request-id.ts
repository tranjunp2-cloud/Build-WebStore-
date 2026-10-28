import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * One id per browser request, sent to ai-platform on every call it makes (`x-request-id`) so one approve or run can be
 * followed across the two services' logs. The incoming `x-request-id` (or Vercel's `x-vercel-id`) is reused when it
 * looks like an id; otherwise a uuid. `withRequestId` makes it the id of every ai-platform call made inside, however
 * deep (appliers, attachments, work list), without passing it through every function.
 */

export const REQUEST_ID_HEADER = "x-request-id";
// same rule as ai-platform (observability/request-context): an id one side keeps, the other keeps too
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const scope = new AsyncLocalStorage<string>();

/** The id a request came with (`x-request-id`, else `x-vercel-id`), or null when it has none that is safe to log. */
export function incomingRequestId(req: Pick<Request, "headers"> | null | undefined): string | null {
	for (const name of [REQUEST_ID_HEADER, "x-vercel-id"]) {
		const value = req?.headers.get(name)?.trim();
		if (value && SAFE_ID.test(value)) return value;
	}
	return null;
}

/** The request's own id, or a new uuid. */
export function requestIdOf(req: Pick<Request, "headers"> | null | undefined): string {
	return incomingRequestId(req) ?? randomUUID();
}

export function withRequestId<T>(requestId: string, run: () => T): T {
	return scope.run(requestId, run);
}

/** The id of the request being handled (inside `withRequestId`), if any. */
export function currentRequestId(): string | undefined {
	return scope.getStore();
}
