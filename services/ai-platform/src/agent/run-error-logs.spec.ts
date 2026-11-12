import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, MERCHANT_COPILOT_TASK } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ctx, STAGING_FULL } from "./run-harness.spec-helper";

// TC-AICP-366 — every copilot failure the merchant sees leaves a usage row Studio / Payload can show:
// a failed model call with its status and the provider's message (one row, not two), and a run that
// ended on its own error (no model call failed) with the run's reason.

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const prefill = () =>
	new APICallError({ message: "This model does not support assistant message prefill.", url: "https://api.anthropic.com/v1/messages", requestBodyValues: {}, statusCode: 400, isRetryable: false });

function setup(model: MockLanguageModelV4, store = new InMemoryAgentStore()) {
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_AGENT_CAPABILITIES: STAGING_FULL });
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (event) => void recorded.push(event), countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "anthropic", modelId: "claude-haiku-5-5" }] };
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env));
	return { service, recorded, store };
}

describe("copilot failures in the usage log [TC-AICP-366]", () => {
	it("a refused model call: one error row with the status and the provider's message", async () => {
		// Arrange: the #2205 refusal, as Claude answers it
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				throw prefill();
			},
		});
		const { service, recorded } = setup(model);

		// Act
		const run = await service.start(ctx, { prompt: "Thêm block mới cho trang Home", context: { module: "editor" } } as never, () => undefined);

		// Assert
		expect(run.status).toBe("failed");
		const errors = recorded.filter((e) => e.outcome === "error");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			task: MERCHANT_COPILOT_TASK,
			runId: run.id,
			provider: "anthropic",
			model: "claude-haiku-5-5",
			errorCode: "AI_APICallError",
			errorDetail: "AI_APICallError 400: This model does not support assistant message prefill.",
		});
	});

	it("a run that ends on its own error (an attachment that cannot be read): a run row with the reason", async () => {
		// Arrange: no model call happens; reading the attached picture fails
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: "text" as const, text: "never" }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] }) });
		const store = new InMemoryAgentStore();
		const { service, recorded } = setup(model, store);
		await store.insertAttachment(ctx, { id: "att_pic", kind: "image", origin: "upload", ref: null, name: "home.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1, 2, 3]) });
		store.getAttachmentContent = async () => {
			throw new Error("connection terminated unexpectedly");
		};

		// Act
		const run = await service.start(ctx, { prompt: "Thay ảnh hero", context: { module: "editor" }, attachmentIds: ["att_pic"] } as never, () => undefined);

		// Assert
		expect(run.status).toBe("failed");
		expect(model.doGenerateCalls).toHaveLength(0);
		expect(recorded.filter((e) => e.outcome === "error")).toEqual([
			expect.objectContaining({ runId: run.id, errorCode: "run.Error", errorDetail: "Error: connection terminated unexpectedly", latencyMs: 0 }),
		]);
	});
});
