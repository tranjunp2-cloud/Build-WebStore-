import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

/**
 * TC-AIREL-280..284 — "Start over" / history delete while a reply is still being written:
 * the run stops, and nothing it would still stage lands as a draft with no chat.
 */

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", locale: "en-MY" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const stageProduct = {
	name: "propose_product_drafts",
	input: { locale: "en-US", products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }] },
};

/**
 * First model call waits until `release()`. With `obeyAbort` it fails when aborted (a real provider
 * does); without it, it ignores Stop and then asks for a draft (the slow-run race).
 */
function gatedModel(obeyAbort: boolean) {
	let release: () => void = () => undefined;
	let started: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const begun = new Promise<void>((resolve) => (started = resolve));
	let calls = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async (options: CallOptions) => {
			calls += 1;
			if (calls > 1) {
				return { content: [{ type: "text" as const, text: "Done." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
			}
			started();
			await new Promise<void>((resolve, reject) => {
				void gate.then(resolve);
				if (obeyAbort) options.abortSignal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
			});
			return {
				content: [{ type: "tool-call" as const, toolCallId: "call_1", toolName: stageProduct.name, input: JSON.stringify(stageProduct.input) }],
				finishReason: { unified: "tool-calls" as const, raw: undefined },
				usage,
				warnings: [],
			};
		},
	});
	return { model, release, begun, calls: () => calls };
}

function setup(model: MockLanguageModelV4, env: Record<string, string> = {}) {
	const parsed = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...env,
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const threads = new AgentThreadService(store, parsed);
	const runs = new AgentRunService(store, models, ledger, parsed, threads);
	return { store, threads, runs };
}

function startRun(runs: AgentRunService) {
	const frames: RunFrame[] = [];
	const done = runs.start(ctx, { prompt: "Create a draft product: Batik scarf" }, (frame) => frames.push(frame));
	const started = () => frames.find((f) => f.type === "run.started");
	return { done, started, frames };
}

describe("deleting a chat while its reply is being written [TC-AIREL-280..284]", () => {
	it("TC-AIREL-280: removeThread aborts the run that is driving here and leaves no rows behind", async () => {
		// Arrange
		const gated = gatedModel(true);
		const { runs, store } = setup(gated.model);
		const { done, started } = startRun(runs);
		await gated.begun;
		const threadId = (started() as Extract<RunFrame, { type: "run.started" }>).run.threadId as string;

		// Act
		await runs.removeThread(ctx, threadId);
		const run = await done;

		// Assert: stopped, not completed; the model was not asked again
		expect(run.status).toBe("cancelled");
		expect(gated.calls()).toBe(1);
		expect(store.runs.size).toBe(0);
		expect(store.threads.size).toBe(0);
		expect(store.changeSets.size).toBe(0);
	});

	it("TC-AIREL-281: a draft the model asks for after the chat was deleted is refused, not stored", async () => {
		// Arrange: the model ignores Stop and still returns a tool call (a slow provider)
		const gated = gatedModel(false);
		const { runs, threads, store } = setup(gated.model);
		const { done, started } = startRun(runs);
		await gated.begun;
		const threadId = (started() as Extract<RunFrame, { type: "run.started" }>).run.threadId as string;

		// Act: delete without the in-process abort (the run is on another instance), then let the model answer
		await threads.remove(ctx, threadId);
		gated.release();
		const run = await done;

		// Assert
		expect(store.changeSets.size).toBe(0);
		expect(run.changeSetIds).toEqual([]);
		expect(store.runs.size).toBe(0);
	});

	it("TC-AIREL-282: a run on another instance stops when its run row is gone (cancel poll)", async () => {
		// Arrange
		const gated = gatedModel(true);
		const { runs, threads, store } = setup(gated.model, { AI_RUN_CANCEL_POLL_MS: "100" });
		const { done, started } = startRun(runs);
		await gated.begun;
		const threadId = (started() as Extract<RunFrame, { type: "run.started" }>).run.threadId as string;

		// Act: only the store changes, no abort in this process
		await threads.remove(ctx, threadId);
		const run = await done;

		// Assert
		expect(run.status).toBe("cancelled");
		expect(gated.calls()).toBe(1);
		expect(store.changeSets.size).toBe(0);
	});

	it("TC-AIREL-283: someone else's chat is a 404 and its run keeps going", async () => {
		// Arrange
		const gated = gatedModel(true);
		const { runs } = setup(gated.model);
		const { done, started } = startRun(runs);
		await gated.begun;
		const threadId = (started() as Extract<RunFrame, { type: "run.started" }>).run.threadId as string;

		// Act + Assert
		await expect(runs.removeThread({ ...ctx, userId: "usr_2" }, threadId)).rejects.toMatchObject({ status: 404 });
		gated.release();
		const run = await done;
		expect(run.status).not.toBe("cancelled");
		expect(run.changeSetIds).toHaveLength(1);
	});

	it("TC-AIREL-284: a chat with no running reply is simply deleted", async () => {
		// Arrange
		const gated = gatedModel(true);
		gated.release();
		const { runs, store } = setup(gated.model);
		const { done, started } = startRun(runs);
		const finished = await done;
		const threadId = (started() as Extract<RunFrame, { type: "run.started" }>).run.threadId as string;
		expect(finished.changeSetIds).toHaveLength(1);

		// Act
		await runs.removeThread(ctx, threadId);

		// Assert
		expect(store.threads.size).toBe(0);
		expect(store.runs.size).toBe(0);
		expect(store.changeSets.size).toBe(0);
	});
});
