import type { ServerResponse } from "node:http";

const PENDING_WORK = Symbol.for("ech.ai-platform.pendingWork");
type WithPendingWork = ServerResponse & { [PENDING_WORK]?: Promise<unknown> };

/**
 * Work that may outlive its response: a run keeps going when the browser closes its SSE stream.
 * The Vercel handler waits for it before the invocation ends (Vercel may freeze an instance once
 * the handler returns), so the run finishes and saves its state instead of hanging as `running`.
 */
export function keepInvocationFor(res: ServerResponse, work: Promise<unknown>): void {
	(res as WithPendingWork)[PENDING_WORK] = work;
}

/** Settles when the response's pending work does (never rejects); at once when there is none. */
export async function pendingWorkOf(res: ServerResponse): Promise<void> {
	await (res as WithPendingWork)[PENDING_WORK]?.catch(() => undefined);
}
