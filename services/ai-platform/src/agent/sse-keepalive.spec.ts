import { afterEach, describe, expect, it, vi } from "vitest";
import { keepStreamAlive, SSE_PING_MS } from "./sse-keepalive";

afterEach(() => vi.useRealTimers());

describe("SSE keep-alive [TC-AISEC-007]", () => {
	it("writes a comment line every interval until stopped, and nothing once the response ended", () => {
		// Arrange
		vi.useFakeTimers();
		const raw = { writableEnded: false, write: vi.fn() };

		// Act
		const stop = keepStreamAlive(raw);
		vi.advanceTimersByTime(SSE_PING_MS * 2);
		raw.writableEnded = true;
		vi.advanceTimersByTime(SSE_PING_MS);
		stop();
		raw.writableEnded = false;
		vi.advanceTimersByTime(SSE_PING_MS * 3);

		// Assert: two pings while open, none after the end or after stop
		expect(raw.write.mock.calls).toEqual([[": ping\n\n"], [": ping\n\n"]]);
	});
});
