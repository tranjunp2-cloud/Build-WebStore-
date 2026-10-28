/** How often an open run stream gets a comment line while nothing else is written. */
export const SSE_PING_MS = 15_000;

type Writable = { readonly writableEnded: boolean; write(chunk: string): unknown };

/**
 * A model call can be silent for minutes; proxies, corporate networks and mobile carriers drop idle
 * connections. An SSE comment (`: ping`) keeps the stream open; clients skip lines without `data:`.
 * Returns the stop function (call it before ending the response).
 */
export function keepStreamAlive(raw: Writable, everyMs: number = SSE_PING_MS): () => void {
	const timer = setInterval(() => {
		if (!raw.writableEnded) raw.write(": ping\n\n");
	}, everyMs);
	return () => clearInterval(timer);
}
