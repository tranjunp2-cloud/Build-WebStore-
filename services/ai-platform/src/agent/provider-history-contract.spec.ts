import { afterEach, describe, expect, it, vi } from "vitest";
import { lastCopilot, PROVIDERS, type ProviderId, REPLY, readsSent, runCopilot, type Seen, type Turn } from "./provider-fakes.spec-helper";

// TC-AICP-359 — the copilot's run history sent to every provider we wire (real provider SDKs, the
// production registry and effort wiring; only `fetch` is faked, see provider-fakes.spec-helper). Covers
// the #2205 incident (reads → a turn with no text → wrap-up) and fallbacks carrying one provider's
// history to another.

/** Tool results the request carried in that provider's native format. */
function toolResultsSent(s: Seen | undefined): number {
	if (!s) return -1;
	if (s.provider === "anthropic") return s.body.messages.flatMap((m: { content: unknown }) => (Array.isArray(m.content) ? m.content : [])).filter((b: { type: string }) => b.type === "tool_result").length;
	if (s.provider === "google") return s.body.contents.flatMap((c: { parts: unknown[] }) => c.parts).filter((p: { functionResponse?: unknown }) => p.functionResponse).length;
	return s.body.messages.filter((m: { role: string }) => m.role === "tool").length;
}

afterEach(() => vi.unstubAllGlobals());

const SCENARIOS: Array<{ name: string; script: Turn[]; results: number }> = [
	{ name: "#2205: two reads, then a thinking-only turn", script: ["read", "read", "silent", "reply"], results: 2 },
	{ name: "two reads, then an empty turn", script: ["read", "read", "silent-empty", "reply"], results: 2 },
	{ name: "a thinking-only first turn, no reads", script: ["silent", "reply"], results: 0 },
	{ name: "six reads (step limit), then the wrap-up", script: ["read", "read", "read", "read", "read", "read", "reply"], results: 6 },
	{ name: "a read, then ask_user where questions are off", script: ["read", "ask", "reply"], results: 2 },
	{ name: "a read, then the answer", script: ["read", "reply"], results: 1 },
];

describe("copilot history on every provider [TC-AICP-359]", () => {
	for (const provider of PROVIDERS) {
		for (const scenario of SCENARIOS) {
			it(`${provider} — ${scenario.name}`, async () => {
				// Arrange + Act
				const { result, seen, refused } = await runCopilot([provider], scenario.script);

				// Assert: no request broke the API's rules, the run answered, the last call still had every read
				expect(refused()).toEqual([]);
				expect(result.status).toBe("applied");
				expect(result.answer).toBe(REPLY);
				expect(toolResultsSent(lastCopilot(seen))).toBe(scenario.results);
			});
		}
	}

	it("deepseek without thinking (the default) — #2205 scenario", async () => {
		const { result, refused } = await runCopilot(["deepseek"], ["read", "read", "silent", "reply"], { env: { AI_EFFORT_BALANCED: "" } });
		expect(refused()).toEqual([]);
		expect(result.status).toBe("applied");
	});
});

const PAIRS: Array<[ProviderId, ProviderId]> = PROVIDERS.flatMap((a) => PROVIDERS.filter((b) => b !== a).map((b) => [a, b] as [ProviderId, ProviderId]));

describe("fallback to another provider carries the first one's history [TC-AICP-359]", () => {
	for (const [first, second] of PAIRS) {
		it(`${first} down at the wrap-up → ${second}`, async () => {
			// Arrange: the first provider serves the reads and the silent turn, then is down (529 / 503)
			const { result, seen, refused } = await runCopilot([first, second], ["read", "read", "silent", "reply"], { down: { [first]: [4, 99] } });

			// Assert: the second provider accepted the first one's history and answered from both reads
			expect(refused()).toEqual([]);
			expect(result.status).toBe("applied");
			expect(readsSent(seen.filter((s) => s.copilot && s.provider === second).at(-1))).toBe(2);
		});
	}
});

describe("primary down for the first call only, back for the next one [TC-AICP-359]", () => {
	for (const [first, second] of PAIRS) {
		it(`${first} down, ${second} reads, ${first} back for the wrap-up`, async () => {
			// Arrange: the first copilot call (reads + silent turn) is served by the second provider
			const { result, seen, refused } = await runCopilot([first, second], ["read", "read", "silent", "reply"], { down: { [first]: [1, 2] } });

			// Assert: the primary took the other provider's reads (as text) and answered
			expect(refused()).toEqual([]);
			expect(result.status).toBe("applied");
			expect(lastCopilot(seen)?.provider).toBe(first);
			expect(readsSent(lastCopilot(seen))).toBe(2);
		});
	}
});
