import { afterEach, describe, expect, it, vi } from "vitest";
import { lastCopilot, MODEL, PROVIDERS, type ProviderId, REPLY, readsSent, runCopilot, type Turn } from "./provider-fakes.spec-helper";
import { ctx } from "./run-harness.spec-helper";

// TC-AICP-360 — the shapes a copilot run takes on a real provider beyond the #2205 incident: parallel
// calls, tool errors, redacted / truncated thinking, an imitated internal marker, a wrap-up that calls a
// tool anyway or stays silent, origins mixed over three calls, another model of the same provider, and
// a question paused, saved as JSON and answered (also on another provider). Fakes: provider-fakes.spec-helper.

afterEach(() => vi.unstubAllGlobals());

const NOTHING_VI = "Tôi chưa soạn được gì từ yêu cầu này.";

const SHAPES: Array<{ name: string; script: Turn[]; reads: number; answer?: string }> = [
	{ name: "two reads in one step, then a thinking-only turn", script: ["reads2", "silent", "reply"], reads: 2 },
	{ name: "a line of text with the read, then a thinking-only turn", script: ["read-text", "read", "silent", "reply"], reads: 2 },
	{ name: "a read the schema refuses, then a good read, then silent", script: ["read-invalid", "read", "silent", "reply"], reads: 1 },
	{ name: "redacted thinking before the read, then silent", script: ["redacted", "read", "silent", "reply"], reads: 2 },
	{ name: "a read, then out of tokens while thinking", script: ["read", "truncated", "reply"], reads: 1 },
	{ name: "the reply only imitates an internal marker", script: ["read", "markers", "reply"], reads: 1 },
	{ name: "the wrap-up calls a tool anyway (tool choice none ignored)", script: ["read", "silent", "read"], reads: 2, answer: NOTHING_VI },
	{ name: "the wrap-up is silent too", script: ["read", "silent", "silent"], reads: 1, answer: NOTHING_VI },
];

describe("run shapes on every provider [TC-AICP-360]", () => {
	for (const provider of PROVIDERS) {
		for (const shape of SHAPES) {
			it(`${provider} — ${shape.name}`, async () => {
				// Arrange + Act
				const { result, seen, refused } = await runCopilot([provider], shape.script);

				// Assert: no request the API refuses, an answer in the merchant's language, the reads kept
				expect(refused()).toEqual([]);
				expect(result.status).toBe("applied");
				expect(result.answer).toBe(shape.answer ?? REPLY);
				expect(result.answer).not.toMatch(/Earlier in this request I used|untrusted_tool_result/);
				expect(readsSent(lastCopilot(seen))).toBeGreaterThanOrEqual(Math.min(shape.reads, 1));
			});
		}
	}
});

describe("the wrap-up never runs a tool [TC-AICP-360]", () => {
	for (const provider of PROVIDERS) {
		it(`${provider} — a wrap-up that calls site_read reads nothing`, async () => {
			// Arrange: the provider ignores tool choice "none" and calls a tool in the wrap-up
			const siteRead = vi.fn(async () => ({ view: "page", blocks: [{ id: "hero_1", type: "hero", heading: "Kopi Kampung" }] }));

			// Act
			const { result, refused } = await runCopilot([provider], ["read", "silent", "read"], { shop: { siteRead } as never });

			// Assert: only the first read ran
			expect(refused()).toEqual([]);
			expect(result.status).toBe("applied");
			expect(siteRead).toHaveBeenCalledTimes(1);
		});
	}
});

const PAIRS: Array<[ProviderId, ProviderId]> = PROVIDERS.flatMap((a) => PROVIDERS.filter((b) => b !== a).map((b) => [a, b] as [ProviderId, ProviderId]));

describe("origins mixed over three model calls [TC-AICP-360]", () => {
	for (const [first, second] of PAIRS) {
		it(`${first} → ${second} (first down for call 2) → ${first}`, async () => {
			// Arrange: call 1 = read + a refused ask (first), call 2 = read + silent (second, first is down), call 3 = wrap-up (first)
			const { result, seen, refused } = await runCopilot([first, second], ["read", "ask", "read", "silent", "reply"], { down: { [first]: [3, 4] } });

			// Assert
			expect(refused()).toEqual([]);
			expect(result.status).toBe("applied");
			expect(lastCopilot(seen)?.provider).toBe(first);
			expect(readsSent(lastCopilot(seen))).toBe(2);
		});
	}
});

describe("another model of the same provider [TC-AICP-360]", () => {
	const SAME: Array<[ProviderId, string, string]> = [
		["anthropic", "claude-haiku-5-5", "claude-sonnet-5-5"],
		["google", "gemini-3-flash-preview", "gemini-3-pro-preview"],
		["openai", "gpt-5.4-mini", "gpt-5.4"],
		["deepseek", "deepseek-v4-flash", "deepseek-v4-pro"],
	];
	for (const [provider, primary, backup] of SAME) {
		it(`${primary} down at the wrap-up → ${backup}: the backup gets the reads as text`, async () => {
			// Arrange
			const { result, seen, refused } = await runCopilot([provider, provider], ["read", "read", "silent", "reply"], { models: [primary, backup], down: { [primary]: [4, 99] } });

			// Assert: the backup model answered from both reads, none sent as another model's signed turns
			expect(refused()).toEqual([]);
			expect(result.status).toBe("applied");
			const last = lastCopilot(seen);
			expect(last?.model).toBe(backup);
			expect(readsSent(last)).toBe(2);
			expect(JSON.stringify(last?.body)).toContain("Earlier in this request I used site_read with");
		});
	}
});

describe("a question paused, saved as JSON, answered [TC-AICP-360]", () => {
	const answerOf = (paused: { ask?: { toolCallId: string; question: { id: string } } }) => ({
		toolCallId: paused.ask?.toolCallId as string,
		questionId: paused.ask?.question.id as string,
		values: ["a"],
	});

	for (const provider of PROVIDERS) {
		it(`${provider} — read, ask, answer, read, silent, wrap-up`, async () => {
			// Arrange: the run pauses on the question
			const { result: paused, seen, service, refused } = await runCopilot([provider], ["read", "ask-valid", "read", "silent", "reply"], { flows: true });
			expect(paused.status).toBe("awaiting_input");

			// Act: the merchant answers
			const done = await service.answer(ctx, paused.id, answerOf(paused), () => undefined);

			// Assert: the run went on from the saved state and answered from both reads and the answer
			expect(refused()).toEqual([]);
			expect(done.status).toBe("applied");
			expect(done.answer).toBe(REPLY);
			expect(readsSent(lastCopilot(seen))).toBe(2);
		});
	}

	for (const [first, second] of PAIRS) {
		it(`asked on ${first}, answered while ${first} is down → ${second}`, async () => {
			// Arrange: the first provider serves the read and the question, then is down
			const { result: paused, seen, service, refused } = await runCopilot([first, second], ["read", "ask-valid", "read", "silent", "reply"], { flows: true, down: { [first]: [3, 99] } });
			expect(paused.status).toBe("awaiting_input");

			// Act
			const done = await service.answer(ctx, paused.id, answerOf(paused), () => undefined);

			// Assert
			expect(refused()).toEqual([]);
			expect(done.status).toBe("applied");
			expect(lastCopilot(seen)?.provider).toBe(second);
			expect(readsSent(lastCopilot(seen))).toBe(2);
		});
	}
});

it("covers every provider model id in the fakes", () => {
	expect(Object.keys(MODEL).sort()).toEqual([...PROVIDERS].sort());
});
