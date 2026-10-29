import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry, ResolvedModel } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { budgetLine, MIN_CALL_MS, RunBudget } from "./run-budget";

// TC-AISEC-040..042, 048, 049 — a run finishes inside the 300 s function: each model call's timeout is cut to
// the time left, no call (or fallback) starts with under 20 s left, a run out of time or tokens ends cleanly
// and keeps what it staged; every copilot call caps its output tokens.

/** What the run passed to generateText (timeout, output cap) — the model itself cannot see these. */
const sent = vi.hoisted(
	() =>
		[] as Array<{ timeout?: { totalMs?: number }; maxOutputTokens?: number }>,
);
vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	const generateText = ((
		options: Parameters<typeof actual.generateText>[0],
	) => {
		sent.push(options as (typeof sent)[number]);
		return actual.generateText(options);
	}) as typeof actual.generateText;
	return { ...actual, generateText };
});

const ctx: AiRequestContext = {
	organizationId: "org_1",
	tenantId: "7",
	userId: "usr_1",
	email: "owner@shop.my",
};
const T0 = new Date("2026-10-22T03:00:00.000Z").getTime();
const usage = {
	inputTokens: {
		total: 1200,
		noCache: 1200,
		cacheRead: 0,
		cacheWrite: undefined,
	},
	outputTokens: { total: 300, text: 300, reasoning: undefined },
};

/** One model step: a tool call or text, after `elapse` ms of (fake) time; or a thrown error. */
type Turn = (
	| { tool: string; input: unknown }
	| { text: string }
	| { error: Error }
) & { elapse?: number };

function scripted(turns: Turn[]) {
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			if (turn.elapse) vi.setSystemTime(Date.now() + turn.elapse);
			if ("error" in turn) throw turn.error;
			if ("tool" in turn) {
				return {
					content: [
						{
							type: "tool-call" as const,
							toolCallId: `call_${call}`,
							toolName: turn.tool,
							input: JSON.stringify(turn.input),
						},
					],
					finishReason: { unified: "tool-calls" as const, raw: undefined },
					usage,
					warnings: [],
				};
			}
			return {
				content: [{ type: "text" as const, text: turn.text }],
				finishReason: { unified: "stop" as const, raw: undefined },
				usage,
				warnings: [],
			};
		},
	});
}

function setup(
	chain: MockLanguageModelV4[],
	envOverrides: Record<string, string> = {},
) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		// the timings below are written for a 240 s budget (the default is 200 s to leave room for the queue)
		AI_RUN_BUDGET_MS: "240000",
		...envOverrides,
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = {
		record: async () => undefined,
		countSince: async () => 0,
	};
	const resolved: ResolvedModel[] = chain.map((model, i) => ({
		model,
		provider: i === 0 ? "openai" : "anthropic",
		modelId: `m${i}`,
	}));
	const models: ModelRegistry = { resolveChain: () => resolved };
	const service = new AgentRunService(
		store,
		models,
		ledger,
		env,
		new AgentThreadService(store, env),
	);
	return { service, store };
}

const draft = {
	tool: "propose_product_drafts",
	input: {
		locale: "en-US",
		products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }],
	},
};
const timeout = () =>
	Object.assign(new Error("The operation timed out."), {
		name: "TimeoutError",
	});

beforeEach(() => {
	sent.length = 0;
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(T0);
});
afterEach(() => {
	vi.useRealTimers();
});

describe("RunBudget [TC-AISEC-040]", () => {
	it("cuts a call's timeout to the time left and refuses a new call under 20 s or above the token budget", () => {
		// Arrange
		let now = T0;
		const budget = new RunBudget(T0, 240_000, 600_000, () => now);

		// Act + Assert
		expect(budget.callTimeoutMs(210_000)).toBe(210_000);
		now = T0 + 200_000;
		expect(budget.callTimeoutMs(210_000)).toBe(40_000);
		expect(budget.stop(0)).toBeNull();
		now = T0 + 240_000 - MIN_CALL_MS + 1;
		expect(budget.stop(0)).toBe("time");
		expect(budget.stop(600_001)).toBe("tokens");
	});

	it("says why it stopped, and what was kept, in the merchant's language", () => {
		expect(budgetLine("time", false)).toBe(
			"This took too long, so I stopped. Try a smaller request, or split it into steps.",
		);
		expect(budgetLine("time", true)).toBe(
			"This took too long, so I stopped. What I drafted so far is below for your approval.",
		);
		expect(budgetLine("tokens", false, "ms")).toMatch(
			/^Ini memerlukan lebih banyak kerja AI/,
		);
		expect(budgetLine("time", true, "vi")).toMatch(/^Việc này mất quá lâu/);
	});
});

describe("a run's model calls stay inside the run budget [TC-AISEC-040]", () => {
	it("gives a call the model + picture time, and cuts a later call to the time left", async () => {
		// Arrange: the first call takes 200 s and says nothing, so the run makes one more (wrap-up) call
		const { service } = setup([
			scripted([{ text: "", elapse: 200_000 }, { text: "Here you go." }]),
		]);

		// Act
		const run = await service.start(ctx, { prompt: "hi" }, () => undefined);

		// Assert: 60 s model + 150 s picture; then min(60 s, 40 s left)
		expect(run.status).toBe("applied");
		expect(sent.map((options) => options.timeout?.totalMs)).toEqual([
			210_000, 40_000,
		]);
	});

	it("keeps the same per-call time without image_generation (a call spans up to 6 tool steps)", async () => {
		const { service } = setup([scripted([{ text: "ok" }])], {
			AI_AGENT_CAPABILITIES: "site,blog",
		});
		await service.start(ctx, { prompt: "hi" }, () => undefined);
		expect(sent[0]?.timeout?.totalMs).toBe(210_000);
	});
});

describe("a run out of time stops cleanly [TC-AISEC-041]", () => {
	it("starts no new model call with under 20 s left and fails with the stop line", async () => {
		// Arrange: 225 s gone after the first call, which needs a follow-up
		const model = scripted([
			{ text: "", elapse: 225_000 },
			{ text: "never sent" },
		]);
		const { service, store } = setup([model]);

		// Act
		const run = await service.start(
			ctx,
			{ prompt: "write a blog post" },
			() => undefined,
		);

		// Assert
		expect(model.doGenerateCalls).toHaveLength(1);
		expect(run.status).toBe("failed");
		expect(run.error).toBe(
			"This took too long, so I stopped. Try a smaller request, or split it into steps.",
		);
		expect(await store.getRun("org_1", run.id)).toMatchObject({
			status: "failed",
		});
	});

	it("tries no fallback provider with under 20 s left", async () => {
		const first = scripted([{ error: timeout(), elapse: 225_000 }]);
		const second = scripted([{ text: "late answer" }]);
		const { service } = setup([first, second]);

		const run = await service.start(
			ctx,
			{ prompt: "write a blog post" },
			() => undefined,
		);

		expect(second.doGenerateCalls).toHaveLength(0);
		expect(run.status).toBe("failed");
		expect(run.error).toMatch(/^This took too long, so I stopped\./);
	});

	it("still falls back when there is time left", async () => {
		const first = scripted([{ error: timeout(), elapse: 30_000 }]);
		const second = scripted([{ text: "answer from the second provider" }]);
		const { service } = setup([first, second]);

		const run = await service.start(
			ctx,
			{ prompt: "write a blog post" },
			() => undefined,
		);

		expect(second.doGenerateCalls).toHaveLength(1);
		expect(run.answer).toBe("answer from the second provider");
		// the fallback's own timeout is cut to what is left
		expect(sent.map((options) => options.timeout?.totalMs)).toEqual([
			210_000, 210_000,
		]);
	});
});

describe("a run out of time keeps its drafts [TC-AISEC-042]", () => {
	it("ends awaiting approval with the stop line, the staged card still pending", async () => {
		// Arrange: stages a draft, then the step that should have replied runs past the budget
		const { service, store } = setup([
			scripted([draft, { text: "", elapse: 230_000 }, { text: "never sent" }]),
		]);

		// Act
		const run = await service.start(
			ctx,
			{ prompt: "draft a batik scarf" },
			() => undefined,
		);

		// Assert
		expect(run.status).toBe("awaiting_approval");
		expect(run.answer).toBe(
			"This took too long, so I stopped. What I drafted so far is below for your approval.",
		);
		expect(run.changeSetIds).toHaveLength(1);
		const [card] = await store.listChangeSets("org_1", { limit: 10 });
		expect(card?.status).toBe("pending");
	});
});

describe("copilot calls cap their output [TC-AISEC-048]", () => {
	it("sends maxOutputTokens 8192 by default and AI_MAX_OUTPUT_TOKENS when set", async () => {
		const byDefault = setup([scripted([{ text: "ok" }])]);
		await byDefault.service.start(ctx, { prompt: "hi" }, () => undefined);
		const capped = setup([scripted([{ text: "ok" }])], {
			AI_MAX_OUTPUT_TOKENS: "1024",
		});
		await capped.service.start(ctx, { prompt: "hi" }, () => undefined);

		expect(sent.map((options) => options.maxOutputTokens)).toEqual([
			8192, 1024,
		]);
	});
});

describe("a run out of tokens stops cleanly [TC-AISEC-049]", () => {
	it("starts no new model call above AI_RUN_TOKEN_BUDGET and says so", async () => {
		// Arrange: one call uses 1 500 tokens and needs a follow-up; the budget is 1 000
		const model = scripted([{ text: "" }, { text: "never sent" }]);
		const { service } = setup([model], { AI_RUN_TOKEN_BUDGET: "1000" });

		// Act
		const run = await service.start(
			ctx,
			{ prompt: "summarise my catalog" },
			() => undefined,
		);

		// Assert
		expect(model.doGenerateCalls).toHaveLength(1);
		expect(run.status).toBe("failed");
		expect(run.error).toBe(
			"This needed more AI work than one request allows, so I stopped. Try a smaller request, or split it into steps.",
		);
	});
});
