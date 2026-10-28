import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

// TC-AISEC-062 — a run start reads the chat's runs and change sets once (history, earlier pictures and
// earlier drafts come from that one read), and an attached picture's bytes are read once per request,
// not on every model call.

type Turn = { tool: string; input: unknown } | { text: string };
const ctx: AiRequestContext = {
	organizationId: "org_1",
	tenantId: "7",
	userId: "usr_1",
	email: "owner@shop.my",
};

function setup(turns: Turn[], cacheRead = 0) {
	const usage = {
		inputTokens: {
			total: 100,
			noCache: 100 - cacheRead,
			cacheRead,
			cacheWrite: undefined,
		},
		outputTokens: { total: 20, text: 20, reasoning: undefined },
	};
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			return "tool" in turn
				? {
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
					}
				: {
						content: [{ type: "text" as const, text: turn.text }],
						finishReason: { unified: "stop" as const, raw: undefined },
						usage,
						warnings: [],
					};
		},
	});
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = {
		record: async () => undefined,
		countSince: async () => 0,
	};
	const models: ModelRegistry = {
		resolveChain: () => [
			{ model, provider: "openai", modelId: "gpt-4.1-mini" },
		],
	};
	const threads = new AgentThreadService(store, env);
	return {
		service: new AgentRunService(store, models, ledger, env, threads),
		store,
		threads,
		model,
	};
}

const draft = {
	tool: "propose_product_drafts",
	input: {
		locale: "en-US",
		products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }],
	},
};
const picture = {
	id: "att_pic",
	kind: "image" as const,
	origin: "upload" as const,
	ref: null,
	name: "scarf.jpg",
	mime: "image/jpeg",
	size: 3,
	textContent: null,
	credit: null,
	content: Buffer.from([1, 2, 3]),
};

describe("run start reads the chat once [TC-AISEC-062]", () => {
	it("lists the thread's runs and change sets once per start", async () => {
		// Arrange: a chat with one earlier turn (a picture and a staged draft)
		const { service, store } = setup([draft, { text: "Drafted." }]);
		await store.insertAttachment(ctx, picture);
		const first = await service.start(
			ctx,
			{ prompt: "draft a batik scarf", attachmentIds: ["att_pic"] },
			() => undefined,
		);
		const runs = vi.spyOn(store, "listThreadRuns");
		const changeSets = vi.spyOn(store, "listThreadChangeSets");

		// Act
		await service.start(
			ctx,
			{ prompt: "make it shorter", threadId: first.threadId },
			() => undefined,
		);

		// Assert
		expect(runs).toHaveBeenCalledTimes(1);
		expect(changeSets).toHaveBeenCalledTimes(1);
	});

	it("gives the same history, pictures and drafts as the three separate reads", async () => {
		const { service, store, threads } = setup([draft, { text: "Drafted." }]);
		await store.insertAttachment(ctx, picture);
		const first = await service.start(
			ctx,
			{ prompt: "draft a batik scarf", attachmentIds: ["att_pic"] },
			() => undefined,
		);
		const threadId = first.threadId as string;

		const memory = await threads.runMemory("org_1", threadId);

		expect(memory.history).toEqual(await threads.history("org_1", threadId));
		expect(memory.images).toEqual(await threads.knownImages("org_1", threadId));
		expect(memory.changeSets).toEqual(
			await threads.changeSets("org_1", threadId),
		);
		expect(memory.history.length).toBeGreaterThan(0);
		expect(memory.images.map((image) => image.id)).toEqual(["att_pic"]);
		expect(memory.changeSets).toHaveLength(1);
	});
});

describe("attachment bytes are read once per request [TC-AISEC-062]", () => {
	it("hydrates an attached picture once across every model call and the suggestions call", async () => {
		// Arrange: the first call says nothing (one more call follows), cache warm so suggestions run too
		const { service, store, model } = setup(
			[{ text: "" }, { text: "A batik scarf on a table." }],
			50,
		);
		await store.insertAttachment(ctx, picture);
		const content = vi.spyOn(store, "getAttachmentContent");

		// Act
		const run = await service.start(
			ctx,
			{ prompt: "what is in this photo?", attachmentIds: ["att_pic"] },
			() => undefined,
		);

		// Assert: two copilot calls + the suggestion call, one read; every copilot call still got the bytes
		// (the suggestion call is text only: the merchant's words and the reply, no pictures)
		expect(run.status).toBe("applied");
		expect(model.doGenerateCalls.length).toBeGreaterThanOrEqual(3);
		expect(content).toHaveBeenCalledTimes(1);
		const copilotCalls = model.doGenerateCalls.filter((call) => (call.tools?.length ?? 0) > 0);
		expect(copilotCalls).toHaveLength(2);
		expect(copilotCalls.every((call) => JSON.stringify(call.prompt).includes('"type":"file"'))).toBe(true);
	});
});
