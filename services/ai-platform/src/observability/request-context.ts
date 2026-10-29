import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** Carried from prime-web, echoed on every response, forwarded to the agent tool facade. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Safe to log and echo: no spaces, quotes or control characters, bounded. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** The caller's id when it is a safe token, else a fresh uuid. */
export function requestIdFor(header: string | string[] | undefined): string {
	const value = Array.isArray(header) ? header[0] : header;
	return value && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}

const store = new AsyncLocalStorage<{ requestId: string }>();

/** Everything `fn` starts (a run that outlives the response included) sees this request id. */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
	return store.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
	return store.getStore()?.requestId;
}

/** `{ "x-request-id": id }` inside a request, `{}` outside one. */
export function requestIdHeaders(): Record<string, string> {
	const requestId = currentRequestId();
	return requestId ? { [REQUEST_ID_HEADER]: requestId } : {};
}

export type RequestLogMode = "default" | "all";

export interface RequestLogLine {
	reqId: string;
	method: string;
	/** the route pattern (`/agent/runs/:id`), never the raw url with its query */
	route: string;
	status: number;
	ms: number;
	org?: string;
}

const SLOW_MS = 2_000;

/** Failures and slow requests by default; every request with AI_LOG_REQUESTS=all. */
export function shouldLogRequest(status: number, ms: number, mode: RequestLogMode): boolean {
	return mode === "all" || status >= 400 || ms >= SLOW_MS;
}

/** One JSON line per request; no tokens, bodies or headers ever reach it. */
export function logRequest(line: RequestLogLine): void {
	console.log(JSON.stringify(line));
}

/** One JSON line per unhandled 5xx. */
export function logServerError(line: { reqId: string; route: string; message: string }): void {
	console.error(JSON.stringify({ level: "error", ...line, message: line.message.slice(0, 500) }));
}
